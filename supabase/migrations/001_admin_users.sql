-- Exécuter dans le SQL Editor du NOUVEAU projet Supabase Syncore Analytics.
create table if not exists public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
drop policy if exists "Admins can read own membership" on public.admin_users;
create policy "Admins can read own membership" on public.admin_users for select to authenticated using (auth.uid() = user_id);
-- Créer d'abord le compte dans Authentication > Users (sans inscription publique).
-- Puis remplacer l'email ci-dessous et exécuter la commande séparément :
-- insert into public.admin_users(user_id)
-- select id from auth.users where email = 'admin@votre-domaine.com'
-- on conflict do nothing;
