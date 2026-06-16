-- ---------------------------------------------------------------------------
-- 0020 — Webhook event ordering / replay guard for subscriptions (audit P1, 02 P1-1).
--
-- The Polar webhook upserted the subscription row on EVERY event, overwriting wholesale.
-- A stale or out-of-order delivery (e.g. an `active` delivered AFTER a later cancel/revoke)
-- would resurrect access until the period end. This adds the source event's modified
-- timestamp and makes upsert_subscription ignore any event older than the last one applied
-- (replays of the same event re-apply identical state harmlessly).
-- ---------------------------------------------------------------------------

alter table public.subscriptions add column if not exists event_modified_at timestamptz;

drop function if exists public.upsert_subscription(uuid, text, text, text, text, timestamptz, boolean);

create or replace function public.upsert_subscription(
  p_user uuid,
  p_status text,
  p_product_id text default null,
  p_polar_customer_id text default null,
  p_polar_subscription_id text default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_event_modified_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    raise exception 'p_user is required';
  end if;

  insert into public.subscriptions as s
    (user_id, status, product_id, polar_customer_id, polar_subscription_id,
     current_period_end, cancel_at_period_end, event_modified_at, updated_at)
  values
    (p_user,
     left(coalesce(nullif(p_status, ''), 'inactive'), 40),
     left(p_product_id, 200),
     left(p_polar_customer_id, 200),
     left(p_polar_subscription_id, 200),
     p_current_period_end,
     coalesce(p_cancel_at_period_end, false),
     p_event_modified_at,
     now())
  on conflict (user_id) do update set
    status                = excluded.status,
    product_id            = coalesce(excluded.product_id, s.product_id),
    polar_customer_id     = coalesce(excluded.polar_customer_id, s.polar_customer_id),
    polar_subscription_id = coalesce(excluded.polar_subscription_id, s.polar_subscription_id),
    current_period_end    = excluded.current_period_end,
    cancel_at_period_end  = excluded.cancel_at_period_end,
    event_modified_at     = coalesce(excluded.event_modified_at, s.event_modified_at),
    updated_at            = now()
  where s.event_modified_at is null
     or excluded.event_modified_at is null
     or excluded.event_modified_at >= s.event_modified_at;
end;
$$;

revoke all on function public.upsert_subscription(uuid, text, text, text, text, timestamptz, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.upsert_subscription(uuid, text, text, text, text, timestamptz, boolean, timestamptz) to service_role;
