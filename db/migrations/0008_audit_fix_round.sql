-- ===========================================================================
-- 0008 — audit-fix round (DELTA migration vs a live DB already at the 0007 state).
--
-- Independent fleet-audit fixes that touch the database:
--   P2 · leaderboard_tiers 'overall' now averages over ALL THREE subjects (sum/3),
--        matching the client's phdIndex — was avg() over only a user's POPULATED rows,
--        which over-ranked 1–2-subject users and was gameable.
--   P2 · migrate_guest_data now carries each guest practice attempt's embedded REVIEW
--        detail into attempt_reviews (keyed to the new attempt id) — previously the
--        guest "Review your answers" history was silently lost on first sign-in. Also
--        adds a lower clamp on attempts.created_at (no arbitrary back/forward-dating).
--   P2 · concept_reports.concept_key gets a 200-char CHECK — was the one authenticated
--        write column with no length cap (junk-row bloat of the admin queue).
--   P3 · register_concepts stores grader PENDING stubs as visibility='hidden' (was
--        'public' — harmless today since the read policy also requires status='ready',
--        but it contradicts the curation-only "auto-grown guides are always hidden"
--        invariant and would leak if the read policy ever dropped the status check).
--
-- Apply once. Safe to re-run (CREATE OR REPLACE / DROP-CONSTRAINT-IF-EXISTS).
-- ===========================================================================

begin;

-- ---- P2: anonymous leaderboard 'overall' = mean over ALL three subjects ----------
-- Was round(avg(score)) over the user's PRESENT scores rows, so a 1-subject user
-- (math=90) ranked at 90 while their own phdIndex (sum/3) shows 30. Divide by the fixed
-- subject count so a missing subject counts as 0, consistent with lib/scoring.js phdIndex.
create or replace function public.leaderboard_tiers(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select subject::text as track, user_id, score from public.scores
    union all
    select 'overall'::text as track, user_id, round(sum(score) / 3.0)::int as score
      from public.scores group by user_id
  ),
  banded as (
    select track, user_id, score,
      case when score < 20 then 0 when score < 40 then 1 when score < 60 then 2 when score < 80 then 3 else 4 end as bidx
    from base
  ),
  counts as (
    select track,
      count(*) filter (where bidx = 0) as c0,
      count(*) filter (where bidx = 1) as c1,
      count(*) filter (where bidx = 2) as c2,
      count(*) filter (where bidx = 3) as c3,
      count(*) filter (where bidx = 4) as c4,
      count(*) as total
    from banded group by track
  ),
  me as (
    select track, score, bidx from banded where user_id = p_uid
  ),
  per_track as (
    select c.track,
      jsonb_build_object(
        'counts', jsonb_build_array(c.c0, c.c1, c.c2, c.c3, c.c4),
        'total', c.total,
        'you', case when m.track is null then null else jsonb_build_object(
            'band', m.bidx,
            'score', m.score,
            'above', (select count(*) from banded b where b.track = c.track and b.score > m.score)
          ) end
      ) as obj
    from counts c left join me m on m.track = c.track
  )
  select coalesce(jsonb_object_agg(track, obj), '{}'::jsonb) from per_track;
$$;
revoke all on function public.leaderboard_tiers(uuid) from public, anon, authenticated;
grant execute on function public.leaderboard_tiers(uuid) to service_role;

-- ---- P3: grader pending stubs are HIDDEN by default (curation-only invariant) -----
create or replace function public.register_concepts(p_subject text, p_concepts jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_subject not in ('math','physics','chemistry') then return; end if;
  if (select count(*) from public.concept_guides where status = 'pending') >= 50000 then return; end if;
  insert into public.concept_guides (subject, concept_key, concept, topic, status, content, visibility, source)
  select p_subject, _concept_key(val), left(val, 200), 'general_' || p_subject, 'pending', null, 'hidden', 'grader'
  from jsonb_array_elements_text(coalesce(p_concepts, '[]'::jsonb)) as val
  where coalesce(btrim(val), '') <> '' and _concept_key(val) <> ''
  on conflict (subject, concept_key) do nothing;
end;
$$;
revoke all on function public.register_concepts(text, jsonb) from public, anon, authenticated;
grant execute on function public.register_concepts(text, jsonb) to service_role;

-- ---- P2: concept_key length cap on concept_reports --------------------------------
-- The one authenticated INSERT surface; concept_key had no bound (multi-KB junk rows).
alter table public.concept_reports drop constraint if exists concept_reports_concept_key_len;
alter table public.concept_reports
  add constraint concept_reports_concept_key_len check (char_length(concept_key) <= 200);

-- ---- P2: guest answer-reviews survive first sign-in + created_at lower clamp -------
-- Rewritten to insert attempts PER ROW (was one bulk insert) so each guest practice
-- attempt's embedded review can be linked to its freshly-inserted attempt id and written
-- into attempt_reviews. Same null/auth + size guards + advisory lock + "scores already
-- exist" first-writer-wins + type/subject allow-list + int4 clamps as before.
create or replace function public.migrate_guest_data(p_scores jsonb, p_attempts jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_a jsonb;
  v_type text;
  v_subject text;
  v_attempt_id bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if coalesce(jsonb_array_length(coalesce(p_scores, '[]'::jsonb)), 0) > 10
     or coalesce(jsonb_array_length(coalesce(p_attempts, '[]'::jsonb)), 0) > 5000 then
    raise exception 'migration payload too large';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  if exists (select 1 from public.scores where user_id = uid) then
    return false;  -- account already has data; nothing to migrate
  end if;

  insert into public.scores (user_id, subject, score, weak_concepts, comment, rubric, updated_at)
  select uid,
         s->>'subject',
         greatest(0, least(100, coalesce(case when pg_input_is_valid(s->>'score', 'numeric') then round((s->>'score')::numeric) end, 0)))::int,
         coalesce(
           (select array_agg(v order by ord)
              from (select left(value, 200) as v, ord
                      from jsonb_array_elements_text(s->'weak_concepts') with ordinality as e(value, ord)
                     order by ord limit 64) sub),
           '{}'::text[]
         ),
         left(coalesce(s->>'comment', ''), 2000),
         case when jsonb_typeof(s->'rubric') = 'object' then s->'rubric' else null end,
         now()
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as s
  where s->>'subject' in ('math', 'physics', 'chemistry')
  on conflict (user_id, subject) do nothing;

  for v_a in select value from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb)) loop
    if jsonb_typeof(v_a) <> 'object' then continue; end if;
    v_type := coalesce(v_a->>'type', 'attempt');
    if v_type not in ('baseline', 'attempt') then continue; end if;
    v_subject := v_a->>'subject';
    if v_subject is not null and v_subject not in ('math', 'physics', 'chemistry') then continue; end if;

    insert into public.attempts (user_id, type, subject, reasoning_score, delta, new_score, total_after, phd_after, created_at)
    values (
      uid, v_type, v_subject,
      case when pg_input_is_valid(v_a->>'reasoning_score', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'reasoning_score')::numeric)))::int end,
      case when pg_input_is_valid(v_a->>'delta', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'delta')::numeric)))::int end,
      case when pg_input_is_valid(v_a->>'new_score', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'new_score')::numeric)))::int end,
      case when pg_input_is_valid(v_a->>'total_after', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'total_after')::numeric)))::int end,
      case when pg_input_is_valid(v_a->>'phd_after', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'phd_after')::numeric)))::int end,
      -- created_at clamped to (now() - 5y, now()] so a hand-edited blob can't back- or
      -- forward-date an attempt (the upper bound was already enforced; add the floor).
      greatest(now() - interval '5 years',
               least(coalesce(case when pg_input_is_valid(v_a->>'created_at', 'timestamptz') then (v_a->>'created_at')::timestamptz end, now()), now()))
    )
    returning id into v_attempt_id;

    -- Guest review detail (camelCase keys, embedded by the client) -> attempt_reviews,
    -- keyed to the new attempt id. Only practice attempts carry one. Text length-capped;
    -- rubric/feedback stored only if JSON objects; difficulty allow-listed.
    if jsonb_typeof(v_a->'review') = 'object' then
      insert into public.attempt_reviews (attempt_id, user_id, subject, question, answer, target_concept, difficulty, reasoning_score, delta, rubric, feedback, created_at)
      values (
        v_attempt_id, uid, v_subject,
        left(v_a->'review'->>'question', 4000),
        left(v_a->'review'->>'answer', 12000),
        left(v_a->'review'->>'targetConcept', 200),
        case when v_a->'review'->>'difficulty' in ('beginner','foundational','intermediate','advanced','phd') then v_a->'review'->>'difficulty' else null end,
        case when pg_input_is_valid(v_a->>'reasoning_score', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'reasoning_score')::numeric)))::int end,
        case when pg_input_is_valid(v_a->>'delta', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'delta')::numeric)))::int end,
        case when jsonb_typeof(v_a->'review'->'rubric') = 'object' then v_a->'review'->'rubric' else null end,
        case when jsonb_typeof(v_a->'review'->'feedback') = 'object' then v_a->'review'->'feedback' else null end,
        now()
      );
    end if;
  end loop;

  return true;
end;
$$;
revoke all on function public.migrate_guest_data(jsonb, jsonb) from public, anon;
grant execute on function public.migrate_guest_data(jsonb, jsonb) to authenticated;

commit;
