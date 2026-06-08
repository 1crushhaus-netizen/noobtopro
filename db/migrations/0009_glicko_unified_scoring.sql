-- ===========================================================================
-- 0009 — unified Glicko-2 scoring (DELTA migration)
--
-- The scoring system moves from two disconnected tracks (an item-as-opponent Elo
-- subject score + a difficulty-blind EWMA radar) to ONE Glicko-2 engine: each of
-- the 9 reasoning axes (per subject) is a Glicko-2 rating, the question is the
-- opponent, and the subject score is a RUBRIC_WEIGHTS-weighted aggregate of the 9
-- axis ratings. The per-axis Glicko state is the new SOURCE OF TRUTH.
--
--   P1 · scores.glicko jsonb — per-axis Glicko-2 state {axis:{rating,rd,vol}};
--        opaque, NULL until seeded (same posture as scores.rubric, no PII).
--   P1 · attempts.topic/band — so the anti-farm "diminishing returns on repeats"
--        rule can detect a learner grinding the same (subject,topic,band) bucket.
--   P1 · save_progress_for — persist scores.glicko + attempts.topic/band
--        (4-arg signature UNCHANGED; the new fields ride inside p_scores/p_attempt).
--   P2 · migrate_guest_data — carry glicko + topic/band into the account on sign-in.
--
-- scores.rubric stays the 0–4 radar (now DERIVED from glicko), so the radar UI is
-- unchanged. leaderboard_tiers / item_difficulty / RLS / GRANTs are UNAFFECTED
-- (score stays an int 0–100; the new columns inherit the SELECT-own + writes-revoked
-- posture). Apply once; safe to re-run (IF NOT EXISTS / CREATE OR REPLACE / drop-guard).
-- Expect ZERO new advisors (opaque/nullable columns on already-RLS'd tables).
-- ===========================================================================

begin;

-- ---- P1: new columns (idempotent) ----
alter table public.scores add column if not exists glicko jsonb;
comment on column public.scores.glicko is
  'Per-axis Glicko-2 state {axis:{rating,rd,vol}} over the 9 RUBRIC_KEYS — the source of truth from which scores.score (weighted aggregate) and scores.rubric (0–4 radar) are derived. Opaque; server-written only; NULL until a first graded result.';

alter table public.attempts add column if not exists topic text;
alter table public.attempts add column if not exists band text;
comment on column public.attempts.topic is 'Taxonomy slug of the practiced item (anti-farm repeat detection). NULL for baselines / pre-0009 rows.';
comment on column public.attempts.band is 'Difficulty band of the practiced item (anti-farm repeat detection). NULL for baselines / pre-0009 rows.';

-- ---- P1: save_progress_for — persist glicko + topic/band (4-arg signature kept) ----
-- Defend against a stale 3-arg overload lingering on a partially-migrated DB (as 0007 did).
drop function if exists public.save_progress_for(uuid, jsonb, jsonb);
create or replace function public.save_progress_for(p_user uuid, p_scores jsonb, p_attempt jsonb, p_review jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id bigint;
begin
  if p_user is null then
    raise exception 'user required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

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

  if p_attempt is not null and jsonb_typeof(p_attempt) = 'object' then
    if coalesce(p_attempt->>'type', 'attempt') not in ('baseline', 'attempt') then
      raise exception 'invalid attempt type: %', coalesce(p_attempt->>'type', 'attempt');
    end if;
    if p_attempt->>'subject' is not null and p_attempt->>'subject' not in ('math', 'physics', 'chemistry') then
      raise exception 'invalid attempt subject: %', p_attempt->>'subject';
    end if;
    insert into public.attempts (user_id, type, subject, reasoning_score, delta, new_score, total_after, phd_after, created_at, rationale, topic, band)
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
            case when p_attempt->>'band' in ('beginner','foundational','intermediate','advanced','phd') then p_attempt->>'band' else null end)
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
end;
$$;

revoke all on function public.save_progress_for(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_progress_for(uuid, jsonb, jsonb, jsonb) to service_role;

-- ---- P2: migrate_guest_data — carry glicko + topic/band into the account ----
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
    return false;
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
         case when jsonb_typeof(s->'glicko') = 'object' then s->'glicko' else null end,
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

commit;
