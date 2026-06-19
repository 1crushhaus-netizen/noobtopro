-- ---------------------------------------------------------------------------
-- 0024 — Pro-gate "Progress trends" (attempts) at the DB layer.
--
-- F-01 / P0 (audit): "Progress trends + answer history" is a paid Pro feature.
-- Answer history was locked down in 0018 (attempt_reviews), but the TRENDS half
-- still read `attempts` directly via PostgREST (the "read own attempts" SELECT
-- policy + the default authenticated SELECT grant) — so a non-Pro signed-in user
-- could reconstruct the trend charts from the browser/PostgREST. The gate was
-- client-only.
--
-- Fix: remove direct client read access to `attempts`. Reads now go through two
-- server routes that read via the service-role client (which bypasses RLS + grants):
--   - /api/history  — FREE: the always-visible attempt data (the "problems graded"
--                     count and the "why your reasoning moved" rationale). Returns
--                     NO cumulative `total_after`, so the trend charts can't be built
--                     from it.
--   - /api/trends   — PRO (requireProUser): the trend chart series (the cumulative
--                     total over time + per-attempt deltas).
-- The SECURITY DEFINER writers (save_progress_for / migrate_guest_data /
-- delete_user_data) own the table and are unaffected by this grant change.
--
-- DEPLOY ORDER: ship the application code (the /api/history + /api/trends routes and
-- the lib/store.js change that reads through them) BEFORE applying this migration.
-- Applying it while the old client (which selects `attempts` directly) is still live
-- would blank the signed-in dashboard until the new code is deployed. The new code
-- reads via the service role, so it works regardless of this grant; this migration is
-- the server-side enforcement backstop.
-- ---------------------------------------------------------------------------

-- Remove direct client SELECT. (insert/update/delete/truncate were already revoked.)
revoke select on public.attempts from anon, authenticated;

-- The SELECT-own policy is now moot for clients (no SELECT grant remains), but drop it
-- so the intent is unambiguous: `attempts` is service-role-only at the API layer, gated
-- by /api/history (free fields) and /api/trends (Pro). RLS stays ENABLED — deny-by-default
-- for any role that might be granted SELECT in the future without re-adding a policy.
drop policy if exists "read own attempts" on public.attempts;
