-- ---------------------------------------------------------------------------
-- 0018 — Pro-gate "answer history" (attempt_reviews) at the DB layer.
--
-- P0-2 (audit): "Progress trends + answer history" is a paid Pro feature, but
-- attempt_reviews rows were directly readable by ANY signed-in user via PostgREST
-- (the SELECT-own RLS policy + the default authenticated SELECT grant), so the gate
-- was effectively client-only — a non-Pro user could read the full feature from the
-- browser console / PostgREST.
--
-- Fix: remove direct client read access. Reads now go exclusively through the server
-- route /api/reviews, which verifies the JWT AND the Pro entitlement (requireProUser,
-- incl. the configured Pro product) before returning rows via the service-role client.
-- The service role bypasses RLS + grants, so the route still reads; and the
-- SECURITY DEFINER writer migrate_guest_data (owned by a privileged role) is unaffected.
--
-- DEPLOY ORDER: ship the application code (the /api/reviews route + the store.js change
-- that reads through it) BEFORE applying this migration. Applying it while the old client
-- (which selects attempt_reviews directly) is still live would break the review drawer for
-- Pro users until the new code is deployed. The new code reads via the service role, so it
-- works regardless of this grant; this migration is the server-side enforcement backstop.
-- ---------------------------------------------------------------------------

-- Remove direct client SELECT. (insert/update/delete/truncate were already revoked.)
revoke select on public.attempt_reviews from anon, authenticated;

-- The SELECT-own policy is now moot for clients (no SELECT grant remains), but drop it so
-- the intent is unambiguous: attempt_reviews is service-role-only at the API layer, gated
-- by the Pro check in /api/reviews. (RLS stays ENABLED — deny-by-default for any role
-- that might be granted SELECT in the future without re-adding a policy.)
drop policy if exists "read own attempt reviews" on public.attempt_reviews;
