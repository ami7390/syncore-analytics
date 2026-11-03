-- Run once in Supabase SQL Editor. Existing admin_users and audit_jobs are unchanged.
create table if not exists public.monitored_sites (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 2 and 120),
 url text not null unique check (char_length(url) between 12 and 2048 and url ~ '^https://'),
 description text not null default '',
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.site_assignments (
 site_id uuid not null references public.monitored_sites(id) on delete cascade,
 user_id uuid not null references public.admin_users(user_id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (site_id,user_id)
);
create index if not exists site_assignments_user_idx on public.site_assignments(user_id);
alter table public.monitored_sites enable row level security;
alter table public.site_assignments enable row level security;
-- No direct browser access. All operations go through authenticated Next.js API routes
-- that enforce roles and use the server-only service-role client.
revoke all on public.monitored_sites from anon, authenticated;
revoke all on public.site_assignments from anon, authenticated;
