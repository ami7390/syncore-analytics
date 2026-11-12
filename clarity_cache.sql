-- Syncore Analytics: persistent Microsoft Clarity cache.
-- Execute once in the Supabase SQL Editor.
create table if not exists public.clarity_cache (
  site_id uuid primary key references public.monitored_sites(id) on delete cascade,
  data jsonb,
  cached_at timestamptz,
  next_attempt_at timestamptz not null default '-infinity'::timestamptz,
  lease_until timestamptz not null default '-infinity'::timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.clarity_cache enable row level security;
-- No client policies: only the trusted service role can access this cache.
revoke all on public.clarity_cache from anon, authenticated;

-- Atomically grant a short refresh lease to only one request per site.
create or replace function public.claim_clarity_refresh(p_site_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean := false;
begin
  insert into public.clarity_cache (site_id, lease_until, updated_at)
  values (p_site_id, now() + interval '2 minutes', now())
  on conflict (site_id) do update
    set lease_until = now() + interval '2 minutes',
        updated_at = now()
    where clarity_cache.lease_until <= now()
      and clarity_cache.next_attempt_at <= now()
      and (clarity_cache.cached_at is null or clarity_cache.cached_at <= now() - interval '24 hours')
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_clarity_refresh(uuid) from public, anon, authenticated;
grant execute on function public.claim_clarity_refresh(uuid) to service_role;
