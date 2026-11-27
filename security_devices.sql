create table if not exists public.security_devices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 environment text not null check (environment in ('preview','production')),
 token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'pending' check (status in ('pending','approved','denied','revoked')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references auth.users(id) on delete set null,
 unique(user_id,environment,token_hash)
);
alter table public.security_devices enable row level security;
revoke all on public.security_devices from anon, authenticated;
grant select, insert, update, delete on public.security_devices to service_role;
