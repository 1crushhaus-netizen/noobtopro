-- ===========================================================================
-- Migration 0001b — server-authoritative scoring: LOCKDOWN phase
--
-- Apply this AFTER 0001a AND AFTER the new client is deployed and confirmed
-- healthy. It is BREAKING for the OLD client (it removes the client write path),
-- so it must NOT run while the old client is still serving traffic:
--   - drops the client-callable save_progress(jsonb,jsonb),
--   - makes scores/attempts SELECT-only under RLS, and
--   - revokes direct INSERT/UPDATE/DELETE grants from anon/authenticated.
-- After this, signed-in scores can ONLY be written by /api/score via the
-- service-role save_progress_for() RPC — a signed-in user can no longer
-- self-assert a score by any path. The new client never calls save_progress and
-- never writes the tables directly, so it is unaffected. Idempotent.
--
-- Rollback: recreate save_progress(jsonb,jsonb) from git history, restore the
-- "own scores"/"own attempts" for-all policies, and re-grant insert/update/delete
-- to authenticated. (No data migration — rollback is policy/function-only.)
-- ===========================================================================

begin;

-- Drop the client-callable save RPC (the self-assert path). save_progress_for
-- (service-role only, created in 0001a) is now the sole signed-in write path.
drop function if exists public.save_progress(jsonb, jsonb);

-- Lock scores/attempts to SELECT-only for authenticated (no direct client writes).
drop policy if exists "own scores" on public.scores;
drop policy if exists "read own scores" on public.scores;
create policy "read own scores"
  on public.scores for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own attempts" on public.attempts;
drop policy if exists "read own attempts" on public.attempts;
create policy "read own attempts"
  on public.attempts for select to authenticated
  using ((select auth.uid()) = user_id);

-- Defense-in-depth: revoke default client write grants (SELECT stays, RLS-gated).
-- The DEFINER write functions (save_progress_for/migrate_guest_data/delete_user_data)
-- bypass these grants, so the app keeps working.
revoke insert, update, delete, truncate on public.scores   from anon, authenticated;
revoke insert, update, delete, truncate on public.attempts from anon, authenticated;

commit;
