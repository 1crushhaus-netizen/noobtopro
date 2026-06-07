-- ===========================================================================
-- Migration 0003 — durable rate limiter (Supabase Postgres)
--
-- DELTA migration vs a live DB at the 0002 state. Purely additive (new table +
-- function); backward-compatible — the old in-memory limiter keeps working until the
-- new client (lib/rateLimit.js#checkRateLimit) ships. Idempotent; one transaction.
-- ===========================================================================

begin;

create table if not exists public.rate_limits (
  bucket text primary key,
  hits int not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.rate_limits enable row level security;  -- no policy => service-role only
revoke insert, update, delete, truncate on public.rate_limits from anon, authenticated;

create or replace function public.rate_limit_hit(p_bucket text, p_max int, p_window_seconds int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window int := greatest(1, coalesce(p_window_seconds, 60));
  v_max int := greatest(1, coalesce(p_max, 30));
  v_hits int;
  v_reset timestamptz;
begin
  if p_bucket is null or p_bucket = '' then
    raise exception 'bucket required';
  end if;
  insert into public.rate_limits (bucket, hits, reset_at, updated_at)
  values (left(p_bucket, 200), 1, v_now + make_interval(secs => v_window), v_now)
  on conflict (bucket) do update
    set hits = case when public.rate_limits.reset_at <= v_now then 1 else public.rate_limits.hits + 1 end,
        reset_at = case when public.rate_limits.reset_at <= v_now then v_now + make_interval(secs => v_window) else public.rate_limits.reset_at end,
        updated_at = v_now
  returning hits, reset_at into v_hits, v_reset;

  if (extract(milliseconds from clock_timestamp())::bigint % 50) = 0 then
    delete from public.rate_limits
     where ctid in (select ctid from public.rate_limits where reset_at < v_now - interval '1 hour' limit 200);
  end if;

  return jsonb_build_object(
    'allowed', v_hits <= v_max,
    'remaining', greatest(0, v_max - v_hits),
    'reset_at', v_reset,
    'retry_after', case when v_hits <= v_max then 0 else greatest(1, ceil(extract(epoch from (v_reset - v_now))))::int end
  );
end;
$$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

commit;
