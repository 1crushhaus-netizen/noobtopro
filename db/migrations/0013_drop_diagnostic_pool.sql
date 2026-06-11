-- ---------------------------------------------------------------------------
-- 0013 — DROP THE UNUSED DIAGNOSTIC POOL (owner-gated housekeeping).
--
-- The diagnostic is served from the CURATED in-repo bank (lib/diagnosticBank.js
-- — zero Groq, fully standardized) since the diagnostic-bank ship; /api/generate
-- no longer reads or fills the pool, the table has been drained, and no runtime
-- code references either object. This drops the leftovers:
--   * try_add_diagnostic(jsonb, int) — the advisory-locked, count-gated pool
--     filler (service-role-only). Dropped FIRST: it references the table.
--   * diagnostic_pool               — the internal pooled-sets table (RLS on,
--                                     no policies; service-role only).
--
-- No data migration: the pool held only regenerable, non-user content.
-- Idempotent; safe to re-run. schema.sql is updated in the same commit, so the
-- live DB == schema.sql invariant holds after applying this.
-- ---------------------------------------------------------------------------

drop function if exists public.try_add_diagnostic(jsonb, int);
drop table if exists public.diagnostic_pool;
