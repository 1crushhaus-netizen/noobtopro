-- ---------------------------------------------------------------------------
-- 0023 — Round-2 audit hardening (DB):
--   1. upsert_subscription: a NULL incoming event_modified_at must NOT act as a
--      wildcard that always overwrites the row (a malformed/partial Polar event, or the
--      7-arg deploy-order fallback, could otherwise resurrect a canceled Pro). Treat a
--      NULL incoming timestamp as the OLDEST possible, so it only writes a row that itself
--      has no recorded timestamp.
--   2. save_progress_for: a diagnostic re-baseline (p_attempt.type='baseline') must NOT
--      LOWER an already-earned displayed score (or reset its glicko). Practice writes stay
--      unconditional; a baseline row only updates when the new placement is strictly higher.
--
-- Idempotent (CREATE OR REPLACE); SECURITY DEFINER + pinned search_path + service-role-only
-- grants preserved. schema.sql is updated in the same commit (live DB == schema.sql).
-- ---------------------------------------------------------------------------

-- 1. upsert_subscription: NULL incoming timestamp sorts oldest (no wildcard overwrite) ----
create or replace function public.upsert_subscription(
  p_user uuid,
  p_status text,
  p_product_id text default null,
  p_polar_customer_id text default null,
  p_polar_subscription_id text default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_event_modified_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    raise exception 'p_user is required';
  end if;

  insert into public.subscriptions as s
    (user_id, status, product_id, polar_customer_id, polar_subscription_id,
     current_period_end, cancel_at_period_end, event_modified_at, updated_at)
  values
    (p_user,
     left(coalesce(nullif(p_status, ''), 'inactive'), 40),
     left(p_product_id, 200),
     left(p_polar_customer_id, 200),
     left(p_polar_subscription_id, 200),
     p_current_period_end,
     coalesce(p_cancel_at_period_end, false),
     p_event_modified_at,
     now())
  on conflict (user_id) do update set
    status                = excluded.status,
    product_id            = coalesce(excluded.product_id, s.product_id),
    polar_customer_id     = coalesce(excluded.polar_customer_id, s.polar_customer_id),
    polar_subscription_id = coalesce(excluded.polar_subscription_id, s.polar_subscription_id),
    current_period_end    = excluded.current_period_end,
    cancel_at_period_end  = excluded.cancel_at_period_end,
    event_modified_at     = coalesce(excluded.event_modified_at, s.event_modified_at),
    updated_at            = now()
  -- A NULL incoming timestamp is treated as 'epoch' (oldest), so it only overwrites a row
  -- that itself has no recorded event time — never a row already stamped by a real event.
  where s.event_modified_at is null
     or coalesce(excluded.event_modified_at, 'epoch'::timestamptz) >= s.event_modified_at;
end;
$$;

revoke all on function public.upsert_subscription(uuid, text, text, text, text, timestamptz, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.upsert_subscription(uuid, text, text, text, text, timestamptz, boolean, timestamptz) to service_role;

-- 2. save_progress_for: a baseline re-placement never LOWERS an earned score ---------------
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
  v_graded_inc int;
  -- A diagnostic re-baseline must not regress an earned score (audit re-baseline laundering).
  v_is_baseline boolean := (p_attempt is not null and jsonb_typeof(p_attempt) = 'object'
                            and coalesce(p_attempt->>'type', 'attempt') = 'baseline');
begin
  if p_user is null then
    raise exception 'user required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  v_jti := case when p_attempt is not null and jsonb_typeof(p_attempt) = 'object'
                then nullif(left(p_attempt->>'jti', 64), '') end;
  if v_jti is not null and exists (
    select 1 from public.attempts where user_id = p_user and jti = v_jti
  ) then
    return jsonb_build_object('status', 'duplicate');
  end if;

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
        server_graded = public.scores.server_graded + excluded.server_graded,
        verified = (public.scores.server_graded + excluded.server_graded) >= 5,
        updated_at = excluded.updated_at
    -- Practice writes are unconditional; a BASELINE re-placement only applies when it would
    -- RAISE the score, so re-taking the free diagnostic can never launder a regression or
    -- reset the glicko of an account that has practiced up.
    where not v_is_baseline or excluded.score > public.scores.score;

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
