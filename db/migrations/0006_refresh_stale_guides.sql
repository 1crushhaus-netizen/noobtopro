-- ===========================================================================
-- Migration 0006 — auto-heal stale concept guides (PR 5)
--
-- DELTA migration vs a live DB at the 0005 state. Additive + idempotent.
--
-- PR 5 deepens the Learn guides (a new `whyItWorks` proof/derivation field). Existing
-- cached guides predate it and `promote_or_insert_guide` NEVER overwrites a ready guide
-- (first-writer-wins), so a better prompt alone can't refresh them — a user re-opening
-- e.g. "Fermat's little theorem" would keep seeing the old shallow guide forever.
--
-- refresh_guide() overwrites a STALE AUTO-GROWN (non-curated) guide IN PLACE, preserving
-- its visibility/source/status (a hidden grader/user guide stays hidden). /api/learn
-- calls it when a cache hit is a non-curated `ready` guide whose content lacks a
-- whyItWorks — so each stale guide regenerates AT MOST ONCE, then it's healed (it now
-- has whyItWorks → no longer stale). CURATED guides are author-vetted and are refreshed
-- ONLY by the seed (seed_curated_guide / scripts/seed-concept-hub.mjs --force), never here.
-- service-role only; no new table, so no new advisor.
-- ===========================================================================

begin;

create or replace function public.refresh_guide(
  p_subject text, p_concept text, p_content jsonb, p_topic text, p_level text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  k  text := _concept_key(p_concept);
  t  text := case when exists (select 1 from public.concept_topics where subject = p_subject and slug = p_topic)
                  then p_topic else 'general_' || p_subject end;
  lv text := case when p_level in ('beginner','foundational','intermediate','advanced','phd') then p_level else null end;
begin
  if p_subject not in ('math','physics','chemistry') or k = '' or p_content is null then return; end if;
  -- Overwrite a stale NON-CURATED ready guide in place; visibility/source/status are
  -- left untouched (a hidden auto-grown guide stays hidden — never promoted to public).
  update public.concept_guides
     set content = p_content, topic = t, level_band = lv, updated_at = now()
   where subject = p_subject and concept_key = k and status = 'ready' and source <> 'curated';
end;
$$;
revoke all on function public.refresh_guide(text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.refresh_guide(text, text, jsonb, text, text) to service_role;

commit;
