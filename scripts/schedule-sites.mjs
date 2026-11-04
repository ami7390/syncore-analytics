// Daily enqueue for active registered sites; no user-controlled URL is accepted here.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase configuration missing');
const db = createClient(url, key, { auth: { persistSession: false } });
const { data: sites, error } = await db.from('monitored_sites').select('id,url').eq('active', true);
if (error) throw error;
let queued = 0, skipped = 0;
const since = new Date(Date.now() - 24 * 3600_000).toISOString();
for (const site of sites || []) {
  for (const strategy of ['mobile', 'desktop']) {
    const { data: recent, error: readError } = await db.from('audit_jobs')
      .select('id').eq('url', site.url).eq('strategy', strategy)
      .gte('created_at', since).order('created_at', { ascending: false }).limit(1);
    if (readError) throw readError;
    if (recent?.length) { skipped++; continue; }
    const requester_hash = createHash('sha256').update(`scheduled:${site.id}`).digest('hex');
    const { error: insertError } = await db.from('audit_jobs').insert({ url: site.url, strategy, requester_hash, status: 'pending' });
    if (insertError) throw insertError;
    queued++;
  }
}
console.log('Daily sites:', JSON.stringify({ activeSites: sites?.length || 0, queued, skipped }));
