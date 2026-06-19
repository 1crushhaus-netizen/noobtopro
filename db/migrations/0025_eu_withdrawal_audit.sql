-- 0025_eu_withdrawal_audit.sql
-- EU Consumer Rights Directive compliance for the paid "Pro" subscription.
--
--   * Art. 16(a): record the consumer's EXPRESS request for immediate access + their
--     acknowledgement that the 14-day right of withdrawal is lost once the service is
--     fully performed. Captured at checkout, BEFORE the Polar session is created.
--   * Art. 11a (the mandatory "Withdraw from contract here" function, applicable from
--     19 June 2026): record each withdrawal — the durable-medium audit trail of a
--     consumer terminating within the 14-day window (immediate cancel + pro-rata refund).
--
-- ONE append-only audit table keyed by user, with a `kind` discriminator:
--   'immediate_access_consent'  detail: { version, text }
--   'withdrawal'                detail: { polarSubscriptionId, refund:{...}, withinDays }
--
-- The client reads its OWN rows (SELECT-own RLS) so the dashboard can offer the 14-day
-- "Withdraw from contract here" control while the window is open (anchored on the latest
-- consent row's created_at). ALL writes are service-role only (recorded by /api/checkout
-- and /api/account/withdraw after the JWT is verified) — direct client DML is revoked,
-- same pattern as subscriptions / concept_mastery.
--
-- NUMBERING: 0024 is claimed by the trends-paywall change (a sibling PR off the same
-- base); this is 0025 to avoid a collision on merge.

create table if not exists public.billing_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 60),
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_audit_user_kind_idx
  on public.billing_audit (user_id, kind, created_at desc);

alter table public.billing_audit enable row level security;
drop policy if exists billing_audit_select_own on public.billing_audit;
create policy billing_audit_select_own on public.billing_audit
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.billing_audit from public, anon, authenticated;
grant select on public.billing_audit to authenticated;
