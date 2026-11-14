import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase configuration missing');

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const utcDate = date => date.toISOString().slice(0, 10);
const shiftUtcDay = (date, days) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return utcDate(value);
};
const isValidDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(Date.parse(`${date}T00:00:00.000Z`)) &&
  utcDate(new Date(`${date}T00:00:00.000Z`)) === date;

// Automatic runs cover yesterday and the preceding two days, repairing late audits.
// REPORT_DATE targets one date; FORCE_REGENERATE=true refreshes even complete reports.
const requestedDate = process.env.REPORT_DATE;
if (requestedDate && !isValidDate(requestedDate)) {
  throw new Error('REPORT_DATE must be a valid date in YYYY-MM-DD format');
}
const yesterday = shiftUtcDay(utcDate(new Date()), -1);
const reportDates = requestedDate
  ? [requestedDate]
  : [yesterday, shiftUtcDay(yesterday, -1), shiftUtcDay(yesterday, -2)];
const forceRegenerate = process.env.FORCE_REGENERATE === 'true';

const { data: sites, error: siteError } = await db
  .from('monitored_sites')
  .select('id,name,url')
  .eq('active', true);
if (siteError) throw siteError;

let created = 0;
let updated = 0;
let skipped = 0;
let incomplete = 0;

for (const reportDate of reportDates) {
  const start = `${reportDate}T00:00:00.000Z`;
  const nextStart = `${shiftUtcDay(reportDate, 1)}T00:00:00.000Z`;

  for (const site of sites ?? []) {
    const { data: existing, error: existsError } = await db
      .from('daily_reports')
      .select('id,content')
      .eq('site_id', site.id)
      .eq('report_date', reportDate)
      .maybeSingle();
    if (existsError) throw existsError;

    const previousLatest = existing?.content?.audit?.latest;
    const previouslyComplete = Boolean(previousLatest?.mobile && previousLatest?.desktop);
    if (existing && previouslyComplete && !forceRegenerate) {
      skipped++;
      continue;
    }

    // Include jobs created on the day and jobs completed on the day even if queued earlier.
    // Separate queries avoid missing late completions across UTC midnight.
    const selectJobs = 'id,url,strategy,status,result,error,created_at,completed_at';
    const [{ data: createdJobs, error: createdError }, { data: finishedJobs, error: finishedError }] = await Promise.all([
      db.from('audit_jobs').select(selectJobs).eq('url', site.url)
        .gte('created_at', start).lt('created_at', nextStart)
        .order('created_at', { ascending: false }).limit(1000),
      db.from('audit_jobs').select(selectJobs).eq('url', site.url)
        .eq('status', 'completed').gte('completed_at', start).lt('completed_at', nextStart)
        .order('completed_at', { ascending: false }).limit(1000),
    ]);
    if (createdError) throw createdError;
    if (finishedError) throw finishedError;

    const jobs = [...new Map([...(createdJobs ?? []), ...(finishedJobs ?? [])]
      .map(job => [job.id, job])).values()];
    const completed = jobs.filter(job => job.status === 'completed' && job.result);
    const completedOnDay = completed
      .filter(job => job.completed_at && job.completed_at >= start && job.completed_at < nextStart)
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
    const latest = Object.fromEntries(['mobile', 'desktop'].map(strategy => [
      strategy,
      completedOnDay.find(job => job.strategy === strategy)?.result ?? null,
    ]));

    // Do not erase an existing result when refreshing a report after a delayed run.
    for (const strategy of ['mobile', 'desktop']) {
      if (!latest[strategy] && previousLatest?.[strategy]) latest[strategy] = previousLatest[strategy];
    }

    const { data: journal, error: journalError } = await db
      .from('project_journal')
      .select('id,title,details,status,category,created_at,updated_at,completed_at')
      .eq('site_id', site.id)
      .gte('updated_at', start).lt('updated_at', nextStart)
      .order('updated_at', { ascending: false }).limit(100);
    if (journalError) throw journalError;

    const recommendations = [
      ...new Map(
        Object.entries(latest).flatMap(([strategy, result]) =>
          (Array.isArray(result?.opportunities) ? result.opportunities : [])
            .map(opportunity => [
              `${strategy}:${String(opportunity?.id ?? opportunity?.title ?? '')}`,
              {
                title: String(opportunity?.title ?? 'Amélioration suggérée'),
                description: String(opportunity?.description ?? ''),
                source: 'Lighthouse',
                strategy,
              },
            ])
            .filter(([id]) => !id.endsWith(':')),
        ),
      ).values(),
    ].slice(0, 15);

    const content = {
      site: { id: site.id, name: site.name, url: site.url },
      period: { date: reportDate, timezone: 'UTC' },
      audit: {
        total: jobs.length,
        completed: completed.length,
        failed: jobs.filter(job => job.status === 'failed').length,
        pending: jobs.filter(job => ['pending', 'running'].includes(job.status)).length,
        latest,
      },
      recommendations,
      journal: journal ?? [],
      note: 'Rapport basé sur les audits et interventions enregistrés. Une absence de mesure ne signifie pas un score nul. Les recommandations ne sont pas des travaux réalisés.',
    };

    if (!latest.mobile || !latest.desktop) incomplete++;
    if (existing) {
      const { error: updateError } = await db.from('daily_reports')
        .update({ content, generated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (updateError) throw updateError;
      updated++;
    } else {
      const { error: insertError } = await db.from('daily_reports')
        .insert({ site_id: site.id, report_date: reportDate, content });
      if (insertError && insertError.code !== '23505') throw insertError;
      if (insertError) skipped++;
      else created++;
    }
  }
}

console.log(JSON.stringify({ reportDates, sites: sites?.length ?? 0, created, updated, skipped, incomplete }));
