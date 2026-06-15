-- ---------------------------------------------------------------------------
-- 0017 — PRO SUBSCRIPTIONS / ENTITLEMENTS (Polar.sh monetization, step 1).
--
-- The entitlement FOUNDATION for the paid "Pro" tier. This migration adds only the
-- storage + write primitive; the checkout route, the Polar webhook handler, the
-- server-side gate, and the free daily-practice cap land in follow-up changes (see
-- MONETIZATION_PLAN.md). Nothing here changes app behavior on its own.
--
--   * subscriptions       — one row per user; the source of truth for "is this user
--                           Pro?". SELECT-own under RLS (so the client UI can read its
--                           OWN Pro state to show a badge / hide the upgrade CTA); all
--                           writes revoked — only upsert_subscription (service-role)
--                           writes it. Same lock-down pattern as scores/concept_mastery.
--   * upsert_subscription — service-role-ONLY upsert the Polar webhook calls after it
--                           verifies the signature and resolves the user from the event.
--
-- WHY status is free text (length-bounded) and NOT a CHECK enum: `status` mirrors
-- Polar's external SubscriptionStatus vocabulary (active/trialing/past_due/canceled/…),
-- which Polar controls and can extend. A too-strict CHECK would make the webhook upsert
-- ABORT on an unrecognized status — silently dropping an entitlement update and risking
-- locking out a paying customer. So we store the raw status and decide "is Pro" in ONE
-- place (lib/entitlements.js#isActiveSubscription: an allow-listed active status AND not
-- past current_period_end), where an unknown status simply reads as non-Pro until added.
--
-- NOTE: "Reset my progress" (delete_user_data) intentionally does NOT touch this table —
-- a learner who wipes their scores is still a paying customer and keeps Pro.
--
-- All RPCs keep SECURITY DEFINER + a pinned search_path + service-role-only grants.
-- Idempotent; safe to re-run. db/schema.sql is updated in the same commit so the
-- live-DB == schema.sql invariant holds after applying this.
-- ---------------------------------------------------------------------------

-- ---- table -----------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Raw Polar SubscriptionStatus (see header). Length-bounded, not enum-checked.
  status text not null default 'inactive' check (char_length(status) between 1 and 40),
  -- The Polar product the user is subscribed to (e.g. POLAR_PRODUCT_ID_PRO).
  product_id text check (product_id is null or char_length(product_id) <= 200),
  -- Polar's own identifiers — handy for support / reconciliation / the customer portal.
  polar_customer_id text check (polar_customer_id is null or char_length(polar_customer_id) <= 200),
  polar_subscription_id text check (polar_subscription_id is null or char_length(polar_subscription_id) <= 200),
  -- End of the paid period; the entitlement gate treats a subscription past this as
  -- non-Pro even if a revoke webhook was missed (belt-and-suspenders with `status`).
  current_period_end timestamptz,
  -- Polar flag: the user canceled but keeps access until current_period_end.
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

-- SELECT-own under RLS (the user reads their OWN Pro state via PostgREST for the UI);
-- ALL writes revoked — only the service-role RPC below touches it. Same pattern as
-- concept_mastery. The columns hold no secrets (Polar ids are non-sensitive), so
-- exposing the owner's own row is fine.
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.subscriptions from public, anon, authenticated;
grant select on public.subscriptions to authenticated;

-- ---- RPC: service-role-only entitlement upsert ------------------------------
-- Called by the Polar webhook handler (after it verifies the signature and resolves
-- the user_id from the event's customer external-id / metadata) with the latest
-- subscription state. SECURITY DEFINER + service-role only: a signed-in user can never
-- self-grant Pro by any client path (table is SELECT-only; this RPC is not granted to
-- authenticated). COALESCE on the optional ids keeps a previously-stored id when a later
-- event omits it; status / period-end / cancel flag always reflect the newest event.
create or replace function public.upsert_subscription(
  p_user uuid,
  p_status text,
  p_product_id text default null,
  p_polar_customer_id text default null,
  p_polar_subscription_id text default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false
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
     current_period_end, cancel_at_period_end, updated_at)
  values
    (p_user,
     left(coalesce(nullif(p_status, ''), 'inactive'), 40),
     left(p_product_id, 200),
     left(p_polar_customer_id, 200),
     left(p_polar_subscription_id, 200),
     p_current_period_end,
     coalesce(p_cancel_at_period_end, false),
     now())
  on conflict (user_id) do update set
    status                = excluded.status,
    product_id            = coalesce(excluded.product_id, s.product_id),
    polar_customer_id     = coalesce(excluded.polar_customer_id, s.polar_customer_id),
    polar_subscription_id = coalesce(excluded.polar_subscription_id, s.polar_subscription_id),
    current_period_end    = excluded.current_period_end,
    cancel_at_period_end  = excluded.cancel_at_period_end,
    updated_at            = now();
end;
$$;

revoke all on function public.upsert_subscription(uuid, text, text, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.upsert_subscription(uuid, text, text, text, text, timestamptz, boolean) to service_role;
