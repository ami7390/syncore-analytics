import { createClient } from '@supabase/supabase-js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);
const MAX_JOBS_PER_RUN = 3;
const AUDIT_TIMEOUT_MS = 125_000;
const ALLOWED_AUDIT_HOSTS = new Set(['example.com']);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Configuration Supabase manquante.');
}
const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function publicIp(ip) {
  if (isIP(ip) !== 4) return false;
  const a = ip.split('.').map(Number);
  return !(
    a[0] === 0 || a[0] === 10 || a[0] === 127 || a[0] >= 224 ||
    (a[0] === 169 && a[1] === 254) ||
    (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
    (a[0] === 192 && a[1] === 168) ||
    (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
    (a[0] === 192 && a[1] === 0) ||
    (a[0] === 198 && [18, 19].includes(a[1]))
  );
}

async function validate(raw) {
  let u;
  try { u = new URL(raw); }
  catch { throw new Error('URL invalide'); }
  const hostname = u.hostname.toLowerCase().replace(/\.$/, '');
  if (u.protocol !== 'https:' || u.username || u.password || u.port ||
      isIP(hostname) || !ALLOWED_AUDIT_HOSTS.has(hostname)) {
    throw new Error('URL interdite');
  }
  const ips = await lookup(hostname, { all: true, family: 4 });
  if (!ips.length || ips.some(({ address }) => !publicIp(address))) {
    throw new Error('Adresse interdite');
  }
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
  try {
    await validate(job.url);
    if (!['mobile', 'desktop'].includes(job.strategy)) throw new Error('Strategie invalide');
    dir = await mkdtemp(join(tmpdir(), 'syncore-audit-'));
    const reportPath = join(dir, 'report.json');
    const args = [
      'lighthouse', job.url, '--output=json',
      `--output-path=${reportPath}`,
      '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
      '--quiet', '--only-categories=performance,accessibility,best-practices,seo',
      '--max-wait-for-load=45000',
    ];
    if (job.strategy === 'desktop') args.push('--preset=desktop');
    // Private testing only: DNS validation does NOT constrain Chromium redirects,
    // subresource requests or DNS rebinding. Do not enable arbitrary public URLs.
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
  }
}

async function main() {
  const { data: jobs, error } = await db.from('audit_jobs')
    .select('id,url,strategy').eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(MAX_JOBS_PER_RUN);
  if (error) throw error;
  if (!jobs?.length) {
    console.log('No pending jobs');
    return;
  }
  const counts = { completed: 0, failed: 0, skipped: 0 };
  for (const job of jobs) {
    const outcome = await processJob(job);
    counts[outcome]++;
  }
  console.log('Bilan:', JSON.stringify(counts));
}

await main();
