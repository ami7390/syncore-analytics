-- À exécuter une seule fois dans Supabase SQL Editor.
-- Les données sont lues/écrites uniquement côté serveur avec contrôle de rôle.
create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.monitored_sites(id) on delete cascade,
  report_month text not null check (report_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  description text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  captured_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(site_id,report_month)
);
alter table public.monthly_reports enable row level security;
-- Pas de policy publique : seul le serveur (service role) accède à cette table.
