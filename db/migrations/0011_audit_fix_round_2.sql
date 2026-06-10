-- ---------------------------------------------------------------------------
-- 0011 — AUDIT FIX ROUND 2 (the 2026-06 full-repo audit; pairs with the
-- audit-fix application PR). Four independent hardenings:
--
--   P2-5  attempts.jti + unique index + save_progress_for dedupe — a server-
--         issued question token is scoreable AT MOST ONCE (replay/duplicate-
--         delivery can no longer double-apply a rating step).
--   P2-4/7 save_progress_for optimistic concurrency (p_expected_updated_at +
--         p_check_conflict → status:"conflict") — a concurrent same-subject
--         grade or a mid-grade "Reset my progress" makes the route RECOMPUTE
--         from fresh state instead of silently losing/resurrecting an update.
--         delete_user_data also takes the per-user advisory lock.
--   P2-6  _valid_glicko() — a guest-migrated glicko blob must be a bounded,
--         numerically sane per-axis map or it is dropped (lazy-seed covers it);
--         a hand-crafted NaN/extreme state can no longer enter the engine.
--   P2-8  submit_concept_report RPC (≤20 open reports per reporter) replaces
--         the direct PostgREST INSERT on concept_reports — closing the
--         unmetered admin-queue flood.
--
-- NOTE ON NUMBERING: 0010 is reserved by the (held) Learn-curriculum stack
-- (concept_mastery). This migration is INDEPENDENT of 0010 and may be applied
-- before it. If 0011 lands first, the stack's 0010 must be rebased to fold the
-- _valid_glicko check into its 3-arg migrate_guest_data body.
--
-- Idempotent; safe to re-run. APPLY BEFORE (or together with) the audit-fix
-- deploy — migration-first is fully forward-compatible (the old code's named-
-- param subset calls resolve against the new defaulted signature, and the old
-- route ignores the new jsonb return), while code-first breaks practice scoring
-- with PGRST202 until the migration lands.
-- ---------------------------------------------------------------------------

-- ---- P2-5: attempt dedupe key ------------------------------------------------
-- The server-issued question token's jti, recorded on the attempt it scored.
-- NULL for baselines / pre-0011 rows.
alter table public.attempts add column if not exists jti text;
create unique index if not exists attempts_user_jti_uidx
  on public.attempts (user_id, jti) where jti is not null;

-- ---- P2-4/5/7: save_progress_for — returns a status, dedupes, checks conflicts
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

-- ---- P2-7: delete_user_data serializes against save_progress_for --------------
create or replace function public.delete_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  -- Same per-user advisory lock as save_progress_for (audit P2-7): a reset can no
  -- longer interleave with an in-flight save's transaction. (The route-level
  -- read→grade→write window is covered by save_progress_for's conflict check.)
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  delete from public.attempts where user_id = uid;
  delete from public.scores   where user_id = uid;
end;
$$;

revoke all on function public.delete_user_data() from public, anon;
grant execute on function public.delete_user_data() to authenticated;

-- ---- P2-6: bounded, numerically sane guest glicko ------------------------------
-- A guest-migrated glicko blob must be a small per-axis map of finite, in-range
-- {rating, rd, vol} triples — else it is dropped (the engine lazy-seeds from the
-- score instead). Blocks NaN/Infinity (NaN fails BETWEEN in PG), absurd ratings,
-- and oversized maps from entering the rating engine via a hand-edited blob.
create or replace function public._valid_glicko(j jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(j) = 'object'
     and (select count(*) from jsonb_each(j)) between 1 and 16
     and not exists (
       select 1 from jsonb_each(j) ax
       where jsonb_typeof(ax.value) <> 'object'
          -- IS NOT TRUE (not `not (...)`): a missing/null rating/rd/vol makes the
          -- conjunction NULL, which `not` would also leave NULL — silently admitting
          -- the axis. IS NOT TRUE flags NULL and false alike.
          or (
                pg_input_is_valid(ax.value->>'rating', 'numeric')
            -- The engine's legal band is ~[-2300, +5300] (lib/scoring.js RATING_LO/HI);
            -- a fully-docked guest can legitimately sit below 0 internally.
            and (ax.value->>'rating')::numeric between -2500 and 5500
            and pg_input_is_valid(ax.value->>'rd', 'numeric')
            and (ax.value->>'rd')::numeric between 1 and 500
            and pg_input_is_valid(ax.value->>'vol', 'numeric')
            and (ax.value->>'vol')::numeric between 0 and 0.2
          ) is not true
     );
$$;

-- Recreate migrate_guest_data with the glicko gate (body otherwise identical to
-- 0009's). NOTE: if the Learn-curriculum stack's 0010 (3-arg, p_mastery) applies
-- AFTER this, its body must fold this gate in.
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

  insert into public.scores (user_id, subject, score, weak_concepts, comment, rubric, glicko, updated_at)
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
         -- Audit P2-6: the glicko blob is guest-asserted — admit only a bounded,
         -- numerically sane per-axis map (else null → lazy-seed from the score).
         case when public._valid_glicko(s->'glicko') then s->'glicko' else null end,
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

    insert into public.attempts (user_id, type, subject, reasoning_score, delta, new_score, total_after, phd_after, created_at, topic, band)
    values (
      uid, v_type, v_subject,
      case when pg_input_is_valid(v_a->>'reasoning_score', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'reasoning_score')::numeric)))::int end,
      case when pg_input_is_valid(v_a->>'delta', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'delta')::numeric)))::int end,
      case when pg_input_is_valid(v_a->>'new_score', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'new_score')::numeric)))::int end,
      case when pg_input_is_valid(v_a->>'total_after', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'total_after')::numeric)))::int end,
      case when pg_input_is_valid(v_a->>'phd_after', 'numeric') then greatest(-2147483648, least(2147483647, round((v_a->>'phd_after')::numeric)))::int end,
      greatest(now() - interval '5 years',
               least(coalesce(case when pg_input_is_valid(v_a->>'created_at', 'timestamptz') then (v_a->>'created_at')::timestamptz end, now()), now())),
      case when v_a->>'topic' is not null then left(v_a->>'topic', 64) else null end,
      case when v_a->>'band' in ('beginner','foundational','intermediate','advanced','phd') then v_a->>'band' else null end
    )
    returning id into v_attempt_id;

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

-- ---- P2-8: rate-bounded report path -------------------------------------------
-- The browser's direct PostgREST INSERT on concept_reports bypassed every rate
-- limiter; the only bound was one OPEN report per (user, subject, key) — so an
-- authenticated attacker could flood the admin queue with distinct keys. Reports
-- now go through this self-scoped RPC (≤20 open per reporter) and the direct
-- INSERT is revoked.
create or replace function public.submit_concept_report(p_subject text, p_concept_key text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_open int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_subject is null or p_subject not in ('math', 'physics', 'chemistry') then
    raise exception 'invalid subject';
  end if;
  if p_concept_key is null or btrim(p_concept_key) = '' then
    raise exception 'concept key required';
  end if;

  -- Serialize per reporter (review P3): without this the 20-open cap is a TOCTOU
  -- count check that a concurrent burst could overshoot. Same lock pattern as the
  -- sibling per-user RPCs.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 1));

  select count(*) into v_open from public.concept_reports where reporter_id = uid and status = 'open';
  if v_open >= 20 then
    return jsonb_build_object('status', 'limited');
  end if;

  begin
    insert into public.concept_reports (subject, concept_key, reporter_id, reason, status)
    values (
      p_subject,
      left(btrim(p_concept_key), 200),
      uid,
      case when p_reason is null or btrim(p_reason) = '' then null else left(btrim(p_reason), 1000) end,
      'open'
    );
  exception when unique_violation then
    -- An already-open report for this guide by this user — the client treats it
    -- as success (same UX as the old 23505 handling).
    return jsonb_build_object('status', 'duplicate');
  end;
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.submit_concept_report(text, text, text) from public, anon;
grant execute on function public.submit_concept_report(text, text, text) to authenticated;

-- Close the direct write path: the RPC above is now the ONLY insert.
drop policy if exists "report own" on public.concept_reports;
revoke insert on public.concept_reports from anon, authenticated;
