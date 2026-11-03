-- Run in Supabase SQL Editor before deploying the updated worker.
create table if not exists public.performance_alerts (
  id uuid primary key default gen_random_uuid(),
  audit_job_id uuid not null unique references public.audit_jobs(id) on delete cascade,
  url text not null,
  strategy text not null check (strategy in ('mobile', 'desktop')),
  previous_score integer not null check (previous_score between 0 and 100),
  current_score integer not null check (current_score between 0 and 100),
  status text not null default 'pending' check (status in ('pending','sending','sent','needs_review')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists performance_alerts_pending_idx
  on public.performance_alerts (created_at) where status = 'pending';
alter table public.performance_alerts enable row level security;
revoke all on public.performance_alerts from anon, authenticated;
