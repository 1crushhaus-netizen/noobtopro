-- ---------------------------------------------------------------------------
-- 0014 — DROP THE UNCALLED register_concepts RPC (housekeeping).
--
-- The concept-hub AUTO-GROW pipeline was retired by owner decision 2026-06-11
-- (#75): /api/grade and /api/score no longer register the grader's weak
-- concepts as pending catalog stubs (the curated curriculum + written guides
-- superseded the organic catalog), and the accumulated empty stubs were purged
-- live. This drops the now-uncalled writer. The rest of the hub machinery is
-- untouched: promote_or_insert_guide (the /api/learn cache write),
-- seed_curated_guide (the curation path — 36/36 topics seeded live), and
-- dedupe_pending_stubs (still invoked by scripts/seed-concept-hub.mjs) remain.
--
-- Idempotent; safe to re-run. schema.sql is updated in the same commit, so the
-- live DB == schema.sql invariant holds after applying this.
-- ---------------------------------------------------------------------------

drop function if exists public.register_concepts(text, jsonb);
