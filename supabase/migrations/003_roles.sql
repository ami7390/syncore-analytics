-- Execute once in Supabase SQL Editor after 001_admin_users.sql.
-- Existing members remain administrators until the owner is explicitly promoted.
alter table public.admin_users add column if not exists role text not null default 'admin';
alter table public.admin_users add column if not exists active boolean not null default true;
alter table public.admin_users add column if not exists updated_at timestamptz not null default now();
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check check (role in ('owner','admin','director'));
create unique index if not exists admin_users_single_owner on public.admin_users (role) where role = 'owner';
-- Existing RLS own-row policy from migration 001 remains enabled.
-- Run separately, replacing the address with the owner's actual Auth email:
-- update public.admin_users set role = 'owner', active = true
-- where user_id = (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE'));
-- Verify exactly one owner before enabling account creation.
