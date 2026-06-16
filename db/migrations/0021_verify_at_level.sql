-- ---------------------------------------------------------------------------
-- 0021 — Verification gate requires AT-OR-NEAR-level attempts (audit 05 P1-2).
--
-- save_progress_for previously flipped scores.verified after ANY 5 server-graded practice
-- attempts, so 5 trivial far-below-level aces could "verify" a high placement. The route
-- now passes p_attempt.verify=false for a below-level item (lib/scoring#attemptVerifies),
-- and the verification counter only advances when the attempt is at-or-near level. Absent
-- flag → counts (backward compatible). Full function replaced below (established pattern).
-- ---------------------------------------------------------------------------

-- ---- RPC: server-authoritative save of a score update + its attempt ---------
-- Server-authoritative scoring path. The score is COMPUTED ON THE SERVER (/api/score
-- verifies the caller's JWT, grades via Groq, then blends from the user's STORED
-- level) and persisted here for the verified user. SERVICE-ROLE ONLY: the server
-- passes the JWT-verified uid as p_user; the scores/attempts tables are SELECT-only
-- under RLS — so a signed-in user cannot self-assert a score by ANY path (no direct
-- write, no client-callable save RPC). SECURITY DEFINER so the service-role caller's
-- write passes the SELECT-only RLS. p_scores is a jsonb array of
-- {subject,score,weak_concepts,comment,rubric}; p_attempt is the single attempt to
-- append. Values are clamped / allow-listed / guard-cast like migrate_guest_data, and
-- the score upsert + attempt insert run in ONE transaction (all-or-nothing).
--
-- WARNING: p_user is trusted to be a JWT-verified uid resolved server-side. This MUST
-- stay service-role only — a grant to anon/authenticated would let a caller write to
-- ANY user_id. (The old client-callable save_progress(jsonb,jsonb) is dropped below.)
drop function if exists public.save_progress(jsonb, jsonb);
-- p_review (PR 6, optional) carries the answer-review detail for a graded PRACTICE
-- attempt; when present it is written to attempt_reviews IN THE SAME TRANSACTION as the
-- attempt (the diagnostic path omits it, so p_review defaults null). The old 3-arg
-- signature is dropped so a 3-arg call resolves unambiguously to this defaulted 4-arg.
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
  -- audit 05 P1-2 (migration 0021): the attempt must also be AT-OR-NEAR level — the route
  -- sets p_attempt.verify=false for a far-below-level item, so 5 trivial easy aces can't
  -- "verify" a high placement. Absent flag → counts (backward compatible).
  v_graded_inc := case
    when p_attempt is not null and jsonb_typeof(p_attempt) = 'object'
         and coalesce(p_attempt->>'type', 'attempt') = 'attempt'
         and coalesce(p_attempt->>'verify', 'true') <> 'false'
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
