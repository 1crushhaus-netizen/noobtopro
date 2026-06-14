-- ---------------------------------------------------------------------------
-- 0016 — VERIFIED LEADERBOARD + GUEST-LAUNDERING DEFENSE (FIX 8) + a few
--        supporting helpers (FIX 2 durable budget refund).
--
-- Guest scores are CLIENT-computed in editable localStorage and migrated into the
-- authoritative scores table on first sign-in with only range-clamping — a hand-edited
-- localStorage blob could thus launder a top rank onto the leaderboard. The chosen
-- approach (PROVISIONAL UNTIL VERIFIED): keep the migrated score VISIBLE to the user,
-- but mark the account UNVERIFIED and EXCLUDE it from the leaderboard until it has
-- N=5 SERVER-GRADED attempts (writes via save_progress_for), then "verified".
--
-- 1. SCHEMA: scores gains server_graded int not null default 0 and
--    verified boolean not null default false (idempotent add-columns; existing rows
--    default to unverified — they earn verification through real server-graded practice).
-- 2. migrate_guest_data: a migrated guest score lands verified=false / server_graded=0,
--    and its imported glicko has every axis RD RESET to the seed max (350, via the new
--    _reset_glicko_rd helper) so a low-RD laundered seed can't resist correction.
-- 3. save_progress_for: each SERVER-GRADED practice attempt (type 'attempt', NOT a
--    baseline) increments server_graded; verified flips true once server_graded >= 5
--    (monotonic — a baseline re-placement never resets it).
-- 4. leaderboard_tiers: only VERIFIED rows feed the distribution counts + ranking; an
--    unverified caller gets a PROVISIONAL position (their visible band/score + how many
--    graded attempts remain) instead of a real rank.
-- 5. rate_limit_refund (FIX 2 / audit P2-2): refund n hits to a bucket's live window
--    so a charged-but-failed global Groq grade doesn't over-throttle the platform.
--
-- All RPCs keep their SECURITY DEFINER + pinned search_path + service-role-only (or, for
-- migrate_guest_data, authenticated-self-scoped) grants. Idempotent; safe to re-run.
-- schema.sql is updated in the same commit, so the live DB == schema.sql invariant holds
-- after applying this.
-- ---------------------------------------------------------------------------

-- 1. SCHEMA -----------------------------------------------------------------
alter table public.scores add column if not exists server_graded int not null default 0;
alter table public.scores add column if not exists verified boolean not null default false;

-- 2. helper: reset a migrated guest glicko's per-axis RD to the seed max (350) -----
create or replace function public._reset_glicko_rd(j jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when jsonb_typeof(j) <> 'object' then null
    else (
      select jsonb_object_agg(ax.key, ax.value || jsonb_build_object('rd', 350))
      from jsonb_each(j) ax
      where jsonb_typeof(ax.value) = 'object'
    )
  end;
$$;

-- 3. migrate_guest_data: unverified + RD-reset migrated guest score ---------
drop function if exists public.migrate_guest_data(jsonb, jsonb);
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

  insert into public.scores (user_id, subject, score, weak_concepts, comment, rubric, glicko, server_graded, verified, updated_at)
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
         -- FIX 8: reset every axis's RD to the seed max so a low-rd laundered seed
         -- can't resist correction by later server-graded attempts.
         case when public._valid_glicko(s->'glicko') then public._reset_glicko_rd(s->'glicko') else null end,
         -- FIX 8: a migrated guest score is UNVERIFIED with zero server-graded attempts —
         -- VISIBLE to the user but excluded from the leaderboard until earned back.
         0,
         false,
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

-- Grant hygiene: Postgres grants EXECUTE to PUBLIC by default, which would let the
-- anon role call this RPC (it would still fail the auth.uid() null-check, but no
-- unauthenticated role should hold the grant at all). Revoke PUBLIC/anon, then
-- grant only to authenticated.
revoke all on function public.migrate_guest_data(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.migrate_guest_data(jsonb, jsonb, jsonb) to authenticated;

-- 4. save_progress_for: count server-graded attempts; verify at >= 5 --------
drop function if exists public.save_progress_for(uuid, jsonb, jsonb, jsonb);
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
  -- FIX 8: a graded PRACTICE attempt (type 'attempt') counts toward verification;
  -- a baseline (the diagnostic placement) does not. 1 → increment server_graded.
  v_graded_inc int;
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

  -- FIX 8: only a SERVER-GRADED practice attempt advances verification. A baseline
  -- (re)placement and a pure score upsert do NOT count (a baseline never makes an
  -- account verified by itself — verification is earned through real practice).
  v_graded_inc := case
    when p_attempt is not null and jsonb_typeof(p_attempt) = 'object'
         and coalesce(p_attempt->>'type', 'attempt') = 'attempt'
    then 1 else 0 end;

  insert into public.scores (user_id, subject, score, weak_concepts, comment, rubric, glicko, server_graded, verified, updated_at)
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
         -- New row: starts at this write's graded increment; verified once it reaches 5.
         v_graded_inc,
         v_graded_inc >= 5,
         now()
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as s
  where s->>'subject' in ('math', 'physics', 'chemistry')
  on conflict (user_id, subject) do update
    set score = excluded.score,
        weak_concepts = excluded.weak_concepts,
        comment = excluded.comment,
        rubric = excluded.rubric,
        glicko = excluded.glicko,
        -- FIX 8: accumulate server-graded attempts and flip verified once >= 5. Stays
        -- monotonic — a baseline re-placement (v_graded_inc 0) never resets the count,
        -- and once verified the flag stays true (>= 5 can only grow).
        server_graded = public.scores.server_graded + excluded.server_graded,
        verified = (public.scores.server_graded + excluded.server_graded) >= 5,
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

-- 5. leaderboard_tiers: verified-only distribution; provisional for unverified ---
create or replace function public.leaderboard_tiers(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with verified_scores as (
    -- Only verified rows count toward the cross-user distribution + ranking.
    select user_id, subject, score from public.scores where verified = true
  ),
  base as (
    select subject::text as track, user_id, score from verified_scores
    union all
    -- 'overall' = mean over ALL THREE subjects (sum/3), matching lib/scoring.js phdIndex.
    -- Computed over VERIFIED rows only; a user with no verified rows simply doesn't appear.
    select 'overall'::text as track, user_id, round(sum(score) / 3.0)::int as score
      from verified_scores group by user_id
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
  -- The caller's OWN rows (verified AND unverified) so a provisional user still sees
  -- their band/score; per-subject verification + remaining graded attempts ride along.
  my_subjects as (
    select subject::text as track, score,
      case when score < 70 then 0 when score < 140 then 1 when score < 210 then 2 when score < 280 then 3 else 4 end as bidx,
      verified, greatest(0, 5 - server_graded) as needed
    from public.scores where user_id = p_uid
  ),
  my_overall as (
    select 'overall'::text as track,
      round(sum(score) / 3.0)::int as score,
      case when round(sum(score) / 3.0)::int < 70 then 0 when round(sum(score) / 3.0)::int < 140 then 1
           when round(sum(score) / 3.0)::int < 210 then 2 when round(sum(score) / 3.0)::int < 280 then 3 else 4 end as bidx,
      -- The overall row is verified only when EVERY subject row is verified.
      bool_and(verified) as verified,
      greatest(0, max(5 - server_graded)) as needed
    from public.scores where user_id = p_uid
    having count(*) > 0  -- no 'overall you' for a caller with zero scores rows
  ),
  me as (
    select track, score, bidx, verified, needed from my_subjects
    union all
    select track, score, bidx, verified, needed from my_overall
  ),
  tracks as (
    select track from counts union select track from me
  ),
  per_track as (
    select t.track,
      jsonb_build_object(
        'counts', jsonb_build_array(coalesce(c.c0,0), coalesce(c.c1,0), coalesce(c.c2,0), coalesce(c.c3,0), coalesce(c.c4,0)),
        'total', coalesce(c.total, 0),
        'you', case
          when m.track is null then null
          -- VERIFIED caller → a real position (band + rank-above among verified users).
          when m.verified then jsonb_build_object(
            'band', m.bidx,
            'score', m.score,
            'above', (select count(*) from banded b where b.track = t.track and b.score > m.score),
            'provisional', false
          )
          -- UNVERIFIED caller → PROVISIONAL: their visible band/score, no real rank, and
          -- how many more server-graded attempts unlock the leaderboard.
          else jsonb_build_object(
            'band', m.bidx,
            'score', m.score,
            'provisional', true,
            'needed', m.needed
          )
        end
      ) as obj
    from tracks t
    left join counts c on c.track = t.track
    left join me m on m.track = t.track
  )
  select coalesce(jsonb_object_agg(track, obj), '{}'::jsonb) from per_track;
$$;
revoke all on function public.leaderboard_tiers(uuid) from public, anon, authenticated;
grant execute on function public.leaderboard_tiers(uuid) to service_role;

-- 6. rate_limit_refund (FIX 2): give back a charged-but-failed Groq slot ----
create or replace function public.rate_limit_refund(p_bucket text, p_n int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_n int := greatest(0, coalesce(p_n, 0));
begin
  if p_bucket is null or p_bucket = '' or v_n = 0 then
    return;
  end if;
  update public.rate_limits
     set hits = greatest(0, hits - v_n),
         updated_at = v_now
   where bucket = left(p_bucket, 200)
     and reset_at > v_now; -- only the live window; an expired one resets on next hit anyway
end;
$$;
revoke all on function public.rate_limit_refund(text, int) from public, anon, authenticated;
grant execute on function public.rate_limit_refund(text, int) to service_role;
