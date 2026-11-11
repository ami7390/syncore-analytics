-- Etape 1 : journal des travaux, sans modifier les tables existantes.
create table if not exists public.project_journal (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.monitored_sites(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 160),
  details text not null default '' check (char_length(details) <= 5000),
  status text not null default 'todo' check (status in ('todo','in_progress','done','blocked')),
  category text not null default 'improvement' check (category in ('fix','improvement','deployment','maintenance','other')),
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_completed_consistency check ((status = 'done') = (completed_at is not null))
);
create index if not exists project_journal_site_created_idx on public.project_journal(site_id, created_at desc);
create index if not exists project_journal_completed_idx on public.project_journal(completed_at) where completed_at is not null;
alter table public.project_journal enable row level security;
revoke all on public.project_journal from anon, authenticated;
-- Acces uniquement via API Next.js avec role owner et cle serveur.
