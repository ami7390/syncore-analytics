// Server-only Telegram notifications. Never expose the bot token to the browser.
const TELEGRAM_API = 'https://api.telegram.org';
const THRESHOLD = Math.max(1, Math.min(100, Number(process.env.PERFORMANCE_ALERT_DROP_POINTS || 15) || 15));

export function isPerformanceDrop(previous, current) {
  return Number.isFinite(previous) && Number.isFinite(current) &&
    previous >= 0 && previous <= 100 && current >= 0 && current <= 100 &&
    previous - current >= THRESHOLD;
}

export async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Secrets Telegram manquants');
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`Telegram HTTP ${response.status}`);
}

export async function detectPerformanceDrop(db, job, result) {
  const current = result?.scores?.performance;
  if (typeof current !== 'number') return;
  const { data: prior, error } = await db.from('audit_jobs')
    .select('id,result').eq('url', job.url).eq('strategy', job.strategy)
    .eq('status', 'completed').neq('id', job.id)
    .lt('created_at', job.created_at)
    .order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  const previous = prior?.[0]?.result?.scores?.performance;
  if (!isPerformanceDrop(previous, current)) return;
  const { error: insertError } = await db.from('performance_alerts').upsert({
    audit_job_id: job.id, url: job.url, strategy: job.strategy,
    previous_score: previous, current_score: current, status: 'pending',
  }, { onConflict: 'audit_job_id', ignoreDuplicates: true });
  if (insertError) throw insertError;
}

export async function deliverPendingAlerts(db) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('Telegram non configure : notifications en attente.');
    return;
  }
  const { data: pending, error } = await db.from('performance_alerts')
    .select('id,url,strategy,previous_score,current_score,created_at')
    .eq('status', 'pending').order('created_at', { ascending: true }).limit(10);
  if (error) throw error;
  for (const alert of pending || []) {
    // A pending row is claimed before sending to avoid concurrent sends.
    const { data: claimed, error: claimError } = await db.from('performance_alerts')
      .update({ status: 'sending' }).eq('id', alert.id).eq('status', 'pending').select('id');
    if (claimError) throw claimError;
    if (!claimed?.length) continue;
    const text = [
      '⚠️ Syncore Analytics — baisse de performance',
      `Site : ${alert.url}`,
      `Appareil : ${alert.strategy}`,
      `Score Lighthouse : ${alert.previous_score} → ${alert.current_score}`,
      `Baisse : ${alert.previous_score - alert.current_score} points`,
      'Consultez Syncore Analytics pour analyser le problème.',
    ].join('\n');
    try {
      await sendTelegramMessage(text);
      const { error: updateError } = await db.from('performance_alerts')
        .update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', alert.id);
      if (updateError) throw updateError;
      console.log('Telegram alert sent:', alert.id);
    } catch (err) {
      // Unknown delivery state: do not auto-retry to avoid duplicate phone alerts.
      console.error('Telegram delivery needs manual review:', alert.id, err);
      const { error: failError } = await db.from('performance_alerts')
        .update({ status: 'needs_review' }).eq('id', alert.id);
      if (failError) console.error('Alert status update failed:', failError);
    }
  }
}
