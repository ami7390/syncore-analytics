-- Run once in Supabase SQL Editor. Service-role writes only; no client access.
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (length(event_type) between 3 and 80),
  subject_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_events_created_at_idx on public.security_events(created_at desc);
create index if not exists security_events_actor_idx on public.security_events(actor_user_id, created_at desc);
alter table public.security_events enable row level security;
revoke all on table public.security_events from anon, authenticated;
-- No policies: only the service role (which bypasses RLS) can access the table.
