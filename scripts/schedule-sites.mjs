// Schedule one successful audit per UTC day, per active site and strategy.
// Retry failed audits at most once per day; never duplicate active or successful jobs.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase configuration missing');
const db = createClient(url, key, { auth: { persistSession: false } });
const { data: sites, error } = await db.from('monitored_sites').select('id,url').eq('active', true);
if (error) throw error;

const MAX_ATTEMPTS_PER_DAY = 2;
const todayUtc = new Date().toISOString().slice(0, 10);
const dayStart = `${todayUtc}T00:00:00.000Z`;
const dayEnd = `${todayUtc}T23:59:59.999Z`;
let queued = 0, skipped = 0, retries = 0;

for (const site of sites || []) {
  for (const strategy of ['mobile', 'desktop']) {
    const { data: jobs, error: readError } = await db.from('audit_jobs')
      .select('id,status,created_at').eq('url', site.url).eq('strategy', strategy)
      .gte('created_at', dayStart).lte('created_at', dayEnd)
      .order('created_at', { ascending: false });
    if (readError) throw readError;

    // A pending/running job must finish before another attempt can be scheduled.
    // A completed job already satisfies this strategy for the day.
    if ((jobs || []).some(j => ['pending', 'running', 'completed'].includes(j.status))) {
      skipped++;
      continue;
    }
    if ((jobs || []).length >= MAX_ATTEMPTS_PER_DAY) {
      skipped++;
      continue;
    }

    const requester_hash = createHash('sha256').update(`scheduled:${site.id}`).digest('hex');
    const { error: insertError } = await db.from('audit_jobs').insert({
      url: site.url, strategy, requester_hash, status: 'pending',
    });
    if (insertError) throw insertError;
    if ((jobs || []).length) retries++;
    queued++;
  }
}
console.log('Daily sites:', JSON.stringify({ date: todayUtc, activeSites: sites?.length || 0, queued, skipped, retries }));
