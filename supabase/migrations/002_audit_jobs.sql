create table if not exists public.audit_jobs (
 id uuid primary key default gen_random_uuid(),
 url text not null check (length(url) between 12 and 2048),
 strategy text not null check (strategy in ('mobile','desktop')),
 status text not null default 'pending' check (status in ('pending','running','completed','failed')),
 result jsonb, error text,
 requester_hash text not null,
 created_at timestamptz not null default now(),
 started_at timestamptz,
 completed_at timestamptz
);
create index if not exists audit_jobs_recent_idx on public.audit_jobs (requester_hash, created_at desc);
create index if not exists audit_jobs_pending_idx on public.audit_jobs (created_at) where status='pending';
alter table public.audit_jobs enable row level security;
revoke all on public.audit_jobs from anon, authenticated;
-- Only server-side service_role may access this table; never expose this key to browser.
create or replace function public.enqueue_audit(p_url text,p_strategy text,p_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare job_id uuid;
begin
 if (select count(*) from public.audit_jobs where requester_hash=p_hash and created_at > now()-interval '1 hour') >= 3 then
  raise exception 'RATE_LIMIT';
 end if;
 if (select count(*) from public.audit_jobs where status in ('pending','running')) >= 30 then
  raise exception 'QUEUE_FULL';
 end if;
 insert into public.audit_jobs(url,strategy,requester_hash) values(p_url,p_strategy,p_hash) returning id into job_id;
 return job_id;
end $$;
revoke all on function public.enqueue_audit(text,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_audit(text,text,text) to service_role;
