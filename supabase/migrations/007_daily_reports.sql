-- Reports are private to the owner and server-side worker.
create table if not exists public.daily_reports (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.monitored_sites(id) on delete cascade,
 report_date date not null,
 content jsonb not null,
 generated_at timestamptz not null default now(),
 unique (site_id, report_date)
);
create index if not exists daily_reports_recent_idx on public.daily_reports (report_date desc, site_id);
alter table public.daily_reports enable row level security;
revoke all on public.daily_reports from anon, authenticated;
-- Only the service role may access the reports; API checks owner access first.
