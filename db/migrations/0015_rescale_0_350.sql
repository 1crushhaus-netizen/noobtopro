-- ---------------------------------------------------------------------------
-- 0015 — THE 0–350 SUBJECT-SCORE RESCALE (RANKS_PLAN §2–§3, owner-approved).
--
-- Subject scores move from 0–100 to 0–350 (linear ×3.5; the Glicko jsonb state
-- is scale-free and untouched), with the five display ranks now the curriculum
-- ranks: Elementary 0–69 | Middle 70–139 | High 140–209 | University 210–279 |
-- Doctorate 280–350. Per-attempt QUALITY (reasoning_score, mastery counters)
-- STAYS 0–100 by design — only score-scale columns rescale.
--
-- 1. DATA: multiply every stored score-scale value ×3.5 (scores.score,
--    attempts.delta/new_score/total_after/phd_after, item_difficulty.difficulty).
--    Baselines' null fields are untouched. Idempotence guard: the rescale runs
--    only when the data still looks 0–100-scaled (no score above 100 exists) —
--    a re-run after the rescale is a no-op rather than a double-multiply.
-- 2. FUNCTIONS: re-create the four with scale-bound clamps/cutoffs —
--    save_progress_for + migrate_guest_data (score clamp 350), 
--    bump_item_difficulty (clamp 350, neutral seed 175), leaderboard_tiers
--    (70-point rank bands).
-- ---------------------------------------------------------------------------

do $rescale$
begin
  if not exists (select 1 from public.scores where score > 100)
     and not exists (select 1 from public.attempts where new_score > 100) then
    update public.scores set score = round(score * 3.5)::int;
    update public.attempts set
      delta       = case when delta       is null then null else round(delta * 3.5)::int end,
      new_score   = case when new_score   is null then null else round(new_score * 3.5)::int end,
      total_after = case when total_after is null then null else round(total_after * 3.5)::int end,
      phd_after   = case when phd_after   is null then null else round(phd_after * 3.5)::int end;
    update public.item_difficulty set difficulty = round((difficulty * 3.5)::numeric, 2);
  end if;
end
$rescale$;

create or replace function public.save_progress_for(
  p_user uuid,
  p_scores jsonb,
  p_attempt jsonb,
  p_review jsonb default null,
  p_expected_updated_at timestamptz default null,
  p_check_conflict boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id bigint;
  v_jti text;
  v_subject text;
  v_current timestamptz;
begin
  if p_user is null then
    raise exception 'user required';
  end if;

  -- Serialize concurrent writes for the SAME user (practice vs practice, practice
  -- vs diagnostic re-baseline, or vs delete_user_data — which now takes the same
  -- lock). Transaction-scoped: released at commit/rollback.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  -- Replay dedupe (audit P2-5): one server-issued question token = at most one
  -- scored attempt. Checked under the advisory lock, so two concurrent duplicate
  -- deliveries serialize and the second sees the first's row; the partial unique
  -- index backs this even against a future caller that skips the check.
  v_jti := case when p_attempt is not null and jsonb_typeof(p_attempt) = 'object'
                then nullif(left(p_attempt->>'jti', 64), '') end;
  if v_jti is not null and exists (
    select 1 from public.attempts where user_id = p_user and jti = v_jti
  ) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- Optimistic concurrency (audit P2-4/P2-7): the practice route computes the new
  -- rating from a row it just read; commit ONLY if that row is still in the
  -- observed state. IS DISTINCT FROM covers every drift: a row that appeared
  -- (expected null, row exists), vanished (reset raced the grade), or moved
  -- (stamp mismatch) all return "conflict" so the route recomputes from fresh
  -- state — no lost update, no resurrected pre-reset state.
  if p_check_conflict then
    if coalesce(jsonb_array_length(coalesce(p_scores, '[]'::jsonb)), 0) <> 1 then
      raise exception 'p_check_conflict requires exactly one score row';
    end if;
    v_subject := p_scores->0->>'subject';
    select updated_at into v_current from public.scores where user_id = p_user and subject = v_subject;
    if v_current is distinct from p_expected_updated_at then
      return jsonb_build_object('status', 'conflict');
    end if;
  end if;

  if coalesce(jsonb_array_length(coalesce(p_scores, '[]'::jsonb)), 0) > 3 then
    raise exception 'too many score rows';
  end if;

  insert into public.scores (user_id, subject, score, weak_concepts, comment, rubric, glicko, updated_at)
  select p_user,
         s->>'subject',
         greatest(0, least(350, coalesce(case when pg_input_is_valid(s->>'score', 'numeric') then round((s->>'score')::numeric) end, 0)))::int,
         coalesce(
           (select array_agg(v order by ord)
              from (select left(value, 200) as v, ord
                      from jsonb_array_elements_text(s->'weak_concepts') with ordinality as e(value, ord)
                     order by ord limit 64) sub),
           '{}'::text[]
         ),
         left(coalesce(s->>'comment', ''), 2000),
         case when jsonb_typeof(s->'rubric') = 'object' then s->'rubric' else null end,
         case when jsonb_typeof(s->'glicko') = 'object' then s->'glicko' else null end,
         now()
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as s
  where s->>'subject' in ('math', 'physics', 'chemistry')
  on conflict (user_id, subject) do update
    set score = excluded.score,
        weak_concepts = excluded.weak_concepts,
        comment = excluded.comment,
        rubric = excluded.rubric,
        glicko = excluded.glicko,
        updated_at = excluded.updated_at;

  -- Append the attempt (skip if no usable attempt was supplied). Validate type +
  -- subject BEFORE inserting and RAISE on an out-of-domain value, so the whole
  -- transaction aborts (rolling back the score upsert too) rather than silently
  -- committing the score and dropping the attempt via a WHERE filter — preserving
  -- this RPC's all-or-nothing guarantee even against a buggy/typo'd future caller.
  if p_attempt is not null and jsonb_typeof(p_attempt) = 'object' then
    if coalesce(p_attempt->>'type', 'attempt') not in ('baseline', 'attempt') then
      raise exception 'invalid attempt type: %', coalesce(p_attempt->>'type', 'attempt');
    end if;
    if p_attempt->>'subject' is not null and p_attempt->>'subject' not in ('math', 'physics', 'chemistry') then
      raise exception 'invalid attempt subject: %', p_attempt->>'subject';
    end if;
    insert into public.attempts (user_id, type, subject, reasoning_score, delta, new_score, total_after, phd_after, created_at, rationale, topic, band, jti)
    values (p_user,
            coalesce(p_attempt->>'type', 'attempt'),
            p_attempt->>'subject',
            case when pg_input_is_valid(p_attempt->>'reasoning_score', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'reasoning_score')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'delta', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'delta')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'new_score', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'new_score')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'total_after', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'total_after')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'phd_after', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'phd_after')::numeric)))::int end,
            least(coalesce(case when pg_input_is_valid(p_attempt->>'created_at', 'timestamptz') then (p_attempt->>'created_at')::timestamptz end, now()), now()),
            left(p_attempt->>'rationale', 500),
            case when p_attempt->>'topic' is not null then left(p_attempt->>'topic', 64) else null end,
            case when p_attempt->>'band' in ('beginner','foundational','intermediate','advanced','phd') then p_attempt->>'band' else null end,
            v_jti)
    returning id into v_attempt_id;

    -- Answer-review detail (PR 6) for a graded practice attempt — same transaction.
    -- Text fields length-capped; rubric/feedback stored only if JSON objects.
    if v_attempt_id is not null and p_review is not null and jsonb_typeof(p_review) = 'object' then
      insert into public.attempt_reviews (attempt_id, user_id, subject, question, answer, target_concept, difficulty, reasoning_score, delta, rubric, feedback, created_at)
      values (
        v_attempt_id, p_user,
        p_attempt->>'subject',
        left(p_review->>'question', 4000),
        left(p_review->>'answer', 12000),
        left(p_review->>'target_concept', 200),
        case when p_review->>'difficulty' in ('beginner','foundational','intermediate','advanced','phd') then p_review->>'difficulty' else null end,
        case when pg_input_is_valid(p_attempt->>'reasoning_score', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'reasoning_score')::numeric)))::int end,
        case when pg_input_is_valid(p_attempt->>'delta', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'delta')::numeric)))::int end,
        case when jsonb_typeof(p_review->'rubric') = 'object' then p_review->'rubric' else null end,
        case when jsonb_typeof(p_review->'feedback') = 'object' then p_review->'feedback' else null end,
        now()
      );
    end if;
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function public.save_progress_for(uuid, jsonb, jsonb, jsonb, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.save_progress_for(uuid, jsonb, jsonb, jsonb, timestamptz, boolean) to service_role;

create or replace function public.migrate_guest_data(p_scores jsonb, p_attempts jsonb, p_mastery jsonb default null)
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
  if jsonb_typeof(p_mastery) = 'object'
     and (select count(*)
            -- CASE-wrap the inner jsonb_each: a non-object subject value must yield
            -- zero rows, not depend on planner qual-pushdown to dodge a 22023 error.
            from jsonb_each(p_mastery) s
           cross join lateral jsonb_each(case when jsonb_typeof(s.value) = 'object' then s.value else '{}'::jsonb end) c) > 768 then
    raise exception 'migration payload too large';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  if exists (select 1 from public.scores where user_id = uid) then
    return false;  -- account already has data; nothing to migrate
  end if;

  insert into public.scores (user_id, subject, score, weak_concepts, comment, rubric, glicko, updated_at)
  select uid,
         s->>'subject',
         greatest(0, least(350, coalesce(case when pg_input_is_valid(s->>'score', 'numeric') then round((s->>'score')::numeric) end, 0)))::int,
         coalesce(
           (select array_agg(v order by ord)
              from (select left(value, 200) as v, ord
                      from jsonb_array_elements_text(s->'weak_concepts') with ordinality as e(value, ord)
                     order by ord limit 64) sub),
           '{}'::text[]
         ),
         left(coalesce(s->>'comment', ''), 2000),
         case when jsonb_typeof(s->'rubric') = 'object' then s->'rubric' else null end,
         -- Audit P2-6: the glicko blob is guest-asserted — admit only a bounded,
         -- numerically sane per-axis map (else null → lazy-seed from the score).
         case when public._valid_glicko(s->'glicko') then s->'glicko' else null end,
         now()
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as s
  where s->>'subject' in ('math', 'physics', 'chemistry')
  on conflict (user_id, subject) do nothing;

  -- Attempts: insert PER ROW (not one bulk insert) so each guest practice attempt's
  -- embedded review detail can be linked to its freshly-inserted attempt id and written
  -- into attempt_reviews — otherwise the guest "Review your answers" history is lost on
  -- first sign-in. Guarded casts (pg_input_is_valid, PG16+): a malformed numeric/timestamp
  -- in the guest blob coerces to NULL/now() instead of aborting; type/subject are
  -- allow-listed (rows that don't qualify are skipped, matching the old WHERE).
  for v_a in select value from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb)) loop
    if jsonb_typeof(v_a) <> 'object' then continue; end if;
    v_type := coalesce(v_a->>'type', 'attempt');
    if v_type not in ('baseline', 'attempt') then continue; end if;
    v_subject := v_a->>'subject';
    if v_subject is not null and v_subject not in ('math', 'physics', 'chemistry') then continue; end if;

    insert into public.attempts (user_id, type, subject, reasoning_score, delta, new_score, total_after, phd_after, created_at, topic, band)
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
               least(coalesce(case when pg_input_is_valid(v_a->>'created_at', 'timestamptz') then (v_a->>'created_at')::timestamptz end, now()), now())),
      case when v_a->>'topic' is not null then left(v_a->>'topic', 64) else null end,
      case when v_a->>'band' in ('beginner','foundational','intermediate','advanced','phd') then v_a->>'band' else null end
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

  -- Guest per-concept mastery counters -> concept_mastery (Learn-tab chip coloring).
  -- Shape: { subject: { conceptKey: { attempts, greenHits, lastQuality, bestQuality } } }
  -- (the lib/mastery.js map, camelCase). Counters clamped; green_hits capped at
  -- attempts; zero-attempt records skipped. First-writer-wins (the scores-exists
  -- guard above already ensures an empty account).
  if jsonb_typeof(p_mastery) = 'object' then
    insert into public.concept_mastery (user_id, subject, concept_key, attempts, green_hits, last_quality, best_quality, updated_at)
    select uid,
           s.key,
           left(c.key, 80),
           a.attempts,
           least(greatest(0, least(100000, coalesce(case when pg_input_is_valid(c.value->>'greenHits', 'numeric') then round((c.value->>'greenHits')::numeric) end, 0)))::int, a.attempts),
           case when pg_input_is_valid(c.value->>'lastQuality', 'numeric') then greatest(0, least(100, round((c.value->>'lastQuality')::numeric)))::int end,
           case when pg_input_is_valid(c.value->>'bestQuality', 'numeric') then greatest(0, least(100, round((c.value->>'bestQuality')::numeric)))::int end,
           now()
    from jsonb_each(p_mastery) s
    -- CASE-wrapped for the same planner-independence reason as the size guard above.
    cross join lateral jsonb_each(case when jsonb_typeof(s.value) = 'object' then s.value else '{}'::jsonb end) c
    cross join lateral (
      select greatest(0, least(100000, coalesce(case when pg_input_is_valid(c.value->>'attempts', 'numeric') then round((c.value->>'attempts')::numeric) end, 0)))::int as attempts
    ) a
    where s.key in ('math', 'physics', 'chemistry')
      and jsonb_typeof(s.value) = 'object'
      and jsonb_typeof(c.value) = 'object'
      and char_length(c.key) between 1 and 80
      and a.attempts > 0
    on conflict (user_id, subject, concept_key) do nothing;
  end if;

  return true;
end;
$$;

create or replace function public.bump_item_difficulty(
  p_subject text, p_topic text, p_band text, p_delta numeric, p_seed numeric
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_difficulty numeric;
begin
  if p_subject not in ('math','physics','chemistry') then return null; end if;
  if p_band not in ('beginner','foundational','intermediate','advanced','phd') then return null; end if;
  if not exists (select 1 from public.concept_topics where subject = p_subject and slug = p_topic) then
    return null;
  end if;
  insert into public.item_difficulty (subject, topic, band, difficulty, attempts, updated_at)
  values (p_subject, p_topic, p_band,
          greatest(0, least(350, coalesce(p_seed, 175) + coalesce(p_delta, 0))), 1, now())
  on conflict (subject, topic, band) do update
    set difficulty = greatest(0, least(350, public.item_difficulty.difficulty + coalesce(p_delta, 0))),
        attempts   = public.item_difficulty.attempts + 1,
        updated_at = now()
  returning difficulty into v_difficulty;
  return v_difficulty;
end;
$$;
revoke all on function public.bump_item_difficulty(text, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.bump_item_difficulty(text, text, text, numeric, numeric) to service_role;

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
    -- 'overall' = mean over ALL THREE subjects (sum/3), matching lib/scoring.js phdIndex:
    -- a missing subject counts as 0 rather than being dropped, so a 1–2-subject user can't
    -- out-rank a 3-subject user (and can't game it by only scoring their best subject).
    select 'overall'::text as track, user_id, round(sum(score) / 3.0)::int as score
      from public.scores group by user_id
  ),
  banded as (
    select track, user_id, score,
      case when score < 70 then 0 when score < 140 then 1 when score < 210 then 2 when score < 280 then 3 else 4 end as bidx
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
