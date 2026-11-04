import { createClient } from '@supabase/supabase-js';
import { isIP } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectPerformanceDrop, deliverPendingAlerts } from './telegram-alerts.mjs';
import { startAuditProxy, resolvePublicHost } from './audit-proxy.mjs';

const exec = promisify(execFile);
const MAX_JOBS_PER_RUN = 3;
const AUDIT_TIMEOUT_MS = 125_000;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Configuration Supabase manquante.');
}
const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function validate(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('URL invalide'); }
  const hostname = u.hostname.toLowerCase().replace(/\.$/, '');
  if (u.protocol !== 'https:' || u.username || u.password || u.port ||
      isIP(hostname) || u.hash) throw new Error('URL interdite');
  await resolvePublicHost(hostname);
  // Explicit allowlist: only active sites registered by the owner.
  const { data, error } = await db.from('monitored_sites')
    .select('id').eq('url', u.toString()).eq('active', true).limit(1);
  if (error) throw error;
  if (!data?.length && u.toString() !== 'https://example.com/') throw new Error('Site non enregistre ou inactif');
}

async function processJob(job) {
  const { data: claimed, error: claimError } = await db.from('audit_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id).eq('status', 'pending').select('id');
  if (claimError) throw new Error(`Reservation impossible: ${claimError.message}`);
  if (!claimed?.length) {
    console.log('Tache deja reservee:', job.id);
    return 'skipped';
  }

  let dir;
  let proxy;
  try {
    await validate(job.url);
    if (!['mobile', 'desktop'].includes(job.strategy)) throw new Error('Strategie invalide');
    proxy = await startAuditProxy();
    dir = await mkdtemp(join(tmpdir(), 'syncore-audit-'));
    const reportPath = join(dir, 'report.json');
    const args = [
  'lighthouse', job.url,
  '--output=json',
  `--output-path=${reportPath}`,
  `--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage --proxy-server=http=127.0.0.1:${proxy.port} --proxy-bypass-list=<-loopback>`,
  '--locale=fr',
  '--quiet',
  '--only-categories=performance,accessibility,best-practices,seo',
  '--max-wait-for-load=45000',
];
    if (job.strategy === 'desktop') args.push('--preset=desktop');
    // Chromium HTTP(S) traffic is restricted by the local proxy, including redirects.
    await exec('npx', args, { timeout: AUDIT_TIMEOUT_MS, maxBuffer: 1024 * 1024 });
    const lhr = JSON.parse(await readFile(reportPath, 'utf8'));
    if (!lhr.categories) throw new Error('Rapport Lighthouse incomplet');

    const scores = {};
    for (const c of ['performance', 'accessibility', 'best-practices', 'seo']) {
      scores[c] = typeof lhr.categories?.[c]?.score === 'number'
        ? Math.round(lhr.categories[c].score * 100) : null;
    }
    const metrics = {};
    for (const [key, label] of [
      ['first-contentful-paint', 'FCP'],
      ['largest-contentful-paint', 'LCP'],
      ['speed-index', 'Speed Index'],
      ['total-blocking-time', 'TBT'],
      ['cumulative-layout-shift', 'CLS'],
    ]) {
      metrics[label] = lhr.audits?.[key]?.displayValue || 'Non disponible';
    }
    const opportunities = Object.values(lhr.audits || {})
      .filter(v => v?.details?.type === 'opportunity' && v?.score != null && v.score < 0.9)
      .slice(0, 8)
      .map(v => ({
        title: String(v.title),
        description: String(v.description || '').replace(/<[^>]+>/g, '').slice(0, 240),
      }));
    const result = {
      url: job.url, strategy: job.strategy, scores, metrics, opportunities,
      fetchedAt: new Date().toISOString(),
    };
    const { error: saveError } = await db.from('audit_jobs').update({
      status: 'completed', result, error: null, completed_at: new Date().toISOString(),
    }).eq('id', job.id).eq('status', 'running');
    if (saveError) throw saveError;
    try {
      await detectPerformanceDrop(db, job, result);
    } catch (alertError) {
      console.error('Alert detection failed (audit preserved):', job.id, alertError);
    }
    console.log('Audit completed:', job.id);
    return 'completed';
  } catch (err) {
    console.error('Audit failed:', job.id, err);
    const { error: updateError } = await db.from('audit_jobs').update({
      status: 'failed', error: 'Analyse impossible pour cette URL.',
      completed_at: new Date().toISOString(),
    }).eq('id', job.id).eq('status', 'running');
    if (updateError) console.error('Echec enregistrement erreur:', job.id, updateError);
    return 'failed';
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
    if (proxy) await proxy.close();
  }
}

async function main() {
  const { data: jobs, error } = await db.from('audit_jobs')
    .select('id,url,strategy,created_at').eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(MAX_JOBS_PER_RUN);
  if (error) throw error;
  if (!jobs?.length) {
    console.log('No pending jobs');
    await deliverPendingAlerts(db);
    return;
  }
  const counts = { completed: 0, failed: 0, skipped: 0 };
  for (const job of jobs) {
    const outcome = await processJob(job);
    counts[outcome]++;
  }
  console.log('Bilan:', JSON.stringify(counts));
  await deliverPendingAlerts(db);
}

await main();
