
import {createClient} from '@supabase/supabase-js';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const exec=promisify(execFile);

const db=createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {auth:{persistSession:false}}
);

function publicIp(ip){
  if(isIP(ip)!==4)return false;
  const a=ip.split('.').map(Number);
  return !(
    a[0]===0||
    a[0]===10||
    a[0]===127||
    a[0]>=224||
    a[0]===169&&a[1]===254||
    a[0]===172&&a[1]>=16&&a[1]<=31||
    a[0]===192&&a[1]===168||
    a[0]===100&&a[1]>=64&&a[1]<=127||
    a[0]===198&&[18,19].includes(a[1])
  );
}

async function validate(raw){
  const u=new URL(raw);

  if(
    u.protocol!=='https:'||
    u.username||
    u.password||
    u.port||
    isIP(u.hostname)
  )throw Error('URL interdite');

  // Correction : résolution DNS IPv4 uniquement
  const ips=await lookup(u.hostname,{
    all:true,
    family:4
  });

  if(
    !ips.length||
    ips.some(a=>!publicIp(a.address))
  )throw Error('Adresse interdite');
}

const {data:jobs,error}=await db
  .from('audit_jobs')
  .select('id,url,strategy')
  .eq('status','pending')
  .order('created_at',{ascending:true})
  .limit(1);

if(error)throw error;

const job=jobs?.[0];

if(!job){
  console.log('No pending jobs');
  process.exit(0);
}

// Claim is serialized by GitHub workflow concurrency;
// do not run other workers simultaneously.
const {data:claimed,error:claimError}=await db
  .from('audit_jobs')
  .update({
    status:'running',
    started_at:new Date().toISOString()
  })
  .eq('id',job.id)
  .eq('status','pending')
  .select('id');

if(claimError||!claimed?.length)process.exit(0);

let dir;

try{
  await validate(job.url);

  dir=await mkdtemp(join(tmpdir(),'syncore-audit-'));
  const output=join(dir,'report');

  const args=[
    'lighthouse',
    job.url,
    '--output=json',
    '--output-path='+output+'.report.json',
    '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
    '--quiet',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--max-wait-for-load=45000'
  ];

  if(job.strategy==='desktop')args.push('--preset=desktop');

  // IMPORTANT: arbitrary target redirects and DNS rebinding
  // require egress enforcement before public production.
  await exec('npx',args,{
    timeout:125000,
    maxBuffer:1024*1024
  });

  const lhr=JSON.parse(
    await readFile(output+'.report.json','utf8')
  );

  const scores={};

  for(const c of [
    'performance',
    'accessibility',
    'best-practices',
    'seo'
  ]){
    scores[c]=typeof lhr.categories?.[c]?.score==='number'
      ?Math.round(lhr.categories[c].score*100)
      :null;
  }

  const metrics={};

  for(const [k,label] of [
    ['first-contentful-paint','FCP'],
    ['largest-contentful-paint','LCP'],
    ['speed-index','Speed Index'],
    ['total-blocking-time','TBT'],
    ['cumulative-layout-shift','CLS']
  ]){
    metrics[label]=lhr.audits?.[k]?.displayValue||'Non disponible';
  }

  const opportunities=Object.values(lhr.audits||{})
    .filter(v=>
      v?.details?.type==='opportunity'&&
      v?.score!==null&&
      v?.score<0.9
    )
    .slice(0,8)
    .map(v=>({
      title:String(v.title),
      description:String(v.description||'')
        .replace(/<[^>]+>/g,'')
        .slice(0,240)
    }));

  const result={
    url:job.url,
    strategy:job.strategy,
    scores,
    metrics,
    opportunities,
    fetchedAt:new Date().toISOString()
  };

  const {error:saveError}=await db
    .from('audit_jobs')
    .update({
      status:'completed',
      result,
      completed_at:new Date().toISOString()
    })
    .eq('id',job.id);

  if(saveError)throw saveError;

  console.log('Audit completed',job.id);

}catch(e){
  console.error(e);

  await db
    .from('audit_jobs')
    .update({
      status:'failed',
      error:'Analyse impossible pour cette URL.',
      completed_at:new Date().toISOString()
    })
    .eq('id',job.id);

}finally{
  if(dir)await rm(dir,{recursive:true,force:true});
}
