-- ===========================================================================
-- Migration 0005 — Concept Hub: public seed system + canonical de-dup (PR 4)
--
-- DELTA migration vs a live DB at the 0004 state. Additive + idempotent; one
-- transaction. Adds:
--   1. seed_curated_guide()    — the sanctioned BATCH public-publish path (alongside
--                                the admin "approve" action). Upserts a CURATED,
--                                PUBLIC, READY guide; idempotent + re-runnable so the
--                                seed script can refresh content. service-role only.
--   2. dedupe_pending_stubs()  — conservative housekeeping: deletes content-less
--                                grader PENDING stubs that a READY guide in the same
--                                (subject, topic) already subsumes (so the auto-grow
--                                catalog doesn't accumulate redundant fragments).
--                                Touches NO public/curated/ready row. service-role only.
--
-- WHY this is safe under the curation-only model: the PUBLIC read policy only exposes
-- visibility='public' AND status='ready'. Auto-grown guides stay 'hidden', so the
-- ONLY rows a user ever browses are curated ones (the seed / admin approve). The seed
-- is therefore the sole batch path that makes a guide public, and it publishes only
-- author-controlled curated content. (Fuzzy/semantic near-duplicate merge — e.g.
-- "energy" vs "conservation of energy" — needs pg_trgm/embeddings and is the v1.1
-- follow-on; v1 relies on the curated catalog being canonical by construction.)
-- ===========================================================================

begin;

-- 1. seed_curated_guide: the sanctioned batch public-publish path.
create or replace function public.seed_curated_guide(
  p_subject text, p_topic text, p_concept text, p_content jsonb, p_level text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  k  text := _concept_key(p_concept);
  t  text := case when exists (select 1 from public.concept_topics where subject = p_subject and slug = p_topic)
                  then p_topic else 'general_' || p_subject end;
  lv text := case when p_level in ('beginner','foundational','intermediate','advanced','phd') then p_level else null end;
begin
  if p_subject not in ('math','physics','chemistry') or k = '' or p_content is null then return; end if;
  -- Upsert a CURATED, PUBLIC, READY guide. Re-running refreshes content/topic/level
  -- (idempotent). On conflict this also PROMOTES any prior hidden grader/user row for
  -- the same key to the curated public catalog — taking canonical ownership of the
  -- concept (the seed content is author-trusted, unlike auto-grown content).
  insert into public.concept_guides (subject, concept_key, concept, content, topic, level_band, status, source, visibility, updated_at)
  values (p_subject, k, left(p_concept, 200), p_content, t, lv, 'ready', 'curated', 'public', now())
  on conflict (subject, concept_key) do update
    set content    = excluded.content,
        concept    = excluded.concept,
        topic      = excluded.topic,
        level_band = excluded.level_band,
        status     = 'ready',
        source     = 'curated',
        visibility = 'public',
        updated_at = now();
end;
$$;
revoke all on function public.seed_curated_guide(text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.seed_curated_guide(text, text, text, jsonb, text) to service_role;

-- 2. dedupe_pending_stubs: conservative housekeeping (never deletes a ready/public row).
create or replace function public.dedupe_pending_stubs() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_removed int;
begin
  -- Delete a content-less grader PENDING stub when a READY guide in the SAME
  -- (subject, topic) already covers it — the stub's (single-word) key appears as a
  -- whole WORD in the ready guide's key, i.e. the broader concept is already taught
  -- (e.g. "energy" subsumed by "energy conservation"). A whole-word match (not a raw
  -- substring) avoids mid-word false positives like "sin" inside "cosine" and is
  -- wildcard-safe (no LIKE). Pending stubs are mere hints (no content, never public),
  -- so this is a safe collapse; the concept re-stubs if a future grade re-registers it.
  with kept as (
    select subject, topic, concept_key from public.concept_guides where status = 'ready'
  ),
  dupes as (
    select g.ctid
    from public.concept_guides g
    join kept k
      on k.subject = g.subject
     and k.topic   = g.topic
     and k.concept_key <> g.concept_key
     and g.concept_key = any(string_to_array(k.concept_key, ' '))
    where g.status = 'pending'
  )
  delete from public.concept_guides where ctid in (select ctid from dupes);
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;
revoke all on function public.dedupe_pending_stubs() from public, anon, authenticated;
grant execute on function public.dedupe_pending_stubs() to service_role;

commit;
