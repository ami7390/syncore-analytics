import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase configuration missing');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const reportDate = new Date().toISOString().slice(0, 10); // UTC date, daily at 23:45 UTC
const start = `${reportDate}T00:00:00.000Z`;
const end = `${reportDate}T23:59:59.999Z`;
const { data: sites, error: siteError } = await db.from('monitored_sites').select('id,name,url').eq('active', true);
if (siteError) throw siteError;
let created = 0;
for (const site of sites ?? []) {
  // Never overwrite a generated snapshot: the report is a dated record.
  const { data: existing, error: existsError } = await db.from('daily_reports').select('id').eq('site_id', site.id).eq('report_date', reportDate).maybeSingle();
  if (existsError) throw existsError;
  if (existing) continue;
  const { data: jobs, error: jobsError } = await db.from('audit_jobs').select('id,url,strategy,status,result,error,created_at,completed_at').eq('url', site.url).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(100);
  if (jobsError) throw jobsError;
  const { data: journal, error: journalError } = await db.from('project_journal').select('id,title,details,status,category,created_at,updated_at,completed_at').eq('site_id', site.id).gte('updated_at', start).lte('updated_at', end).order('updated_at', { ascending: false }).limit(100);
  if (journalError) throw journalError;
  const completed = (jobs ?? []).filter(j => j.status === 'completed' && j.result);
  const latest = Object.fromEntries(['mobile','desktop'].map(strategy => [strategy, completed.find(j => j.strategy === strategy)?.result ?? null]));
  const recommendations = [...new Map(completed.flatMap(j => (Array.isArray(j.result?.opportunities) ? j.result.opportunities : []).map(o => [String(o?.id ?? o?.title ?? ''), { title: String(o?.title ?? 'Amélioration suggérée'), description: String(o?.description ?? ''), source: 'Lighthouse', strategy: j.strategy }])).filter(([id]) => id)).values()].slice(0, 15);
  const content = {
    site: { id: site.id, name: site.name, url: site.url },
    period: { date: reportDate, timezone: 'UTC' },
    audit: { total: (jobs ?? []).length, completed: completed.length, failed: (jobs ?? []).filter(j => j.status === 'failed').length, pending: (jobs ?? []).filter(j => ['pending','running'].includes(j.status)).length, latest },
    recommendations,
    journal: journal ?? [],
    note: 'Rapport basé sur les audits et interventions enregistrés. Une absence de mesure ne signifie pas un score nul. Les recommandations ne sont pas des travaux réalisés.'
  };
  const { error: insertError } = await db.from('daily_reports').insert({ site_id: site.id, report_date: reportDate, content });
  if (insertError && insertError.code !== '23505') throw insertError;
  created++;
}
console.log(JSON.stringify({ reportDate, sites: sites?.length ?? 0, created }));
