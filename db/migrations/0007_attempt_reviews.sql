-- ===========================================================================
-- Migration 0007 — answer review records (PR 6)
--
-- DELTA migration vs a live DB at the 0006 state. Additive + idempotent; one
-- transaction. Lets a signed-in learner REVIEW past answers (the question they got,
-- what they wrote, the rubric, and the full post-grade feedback incl. the worked
-- solution). Stored 1:1 with practice attempts in a SIBLING table so the hot
-- `attempts` table (read for every chart) stays lean and the heavy review payload is
-- fetched lazily only when the learner opens a review.
--
--   1. attempt_reviews  — per-practice-attempt detail. RLS SELECT-own (the learner
--                         reads their OWN reviews directly via PostgREST); all WRITES
--                         revoked (only save_progress_for, service-role, writes it).
--   2. save_progress_for(p_user,p_scores,p_attempt,p_review) — the 3-arg version is
--                         dropped and replaced with a 4-arg version (p_review defaults
--                         null, so the diagnostic 3-arg call still resolves). It now
--                         captures the inserted attempt id and, when p_review is given,
--                         writes the matching attempt_reviews row IN THE SAME
--                         TRANSACTION (all-or-nothing).
--
-- No new advisor: attempt_reviews has an RLS SELECT-own policy (not RLS-no-policy), and
-- save_progress_for stays service-role only (not authenticated-executable).
-- ===========================================================================

begin;

create table if not exists public.attempt_reviews (
  attempt_id bigint primary key references public.attempts(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  subject text,
  question text,
  answer text,
  target_concept text,
  difficulty text,
  reasoning_score int,
  delta int,
  rubric jsonb,
  feedback jsonb,            -- { strengths[], improvements[], workedSolution, correctnessNote, socraticHint, microLesson }
  created_at timestamptz not null default now()
);
alter table public.attempt_reviews enable row level security;
-- The learner may READ their own reviews directly (lazy fetch for the Review view).
drop policy if exists "read own attempt reviews" on public.attempt_reviews;
create policy "read own attempt reviews"
  on public.attempt_reviews for select
  to authenticated
  using ((select auth.uid()) = user_id);
-- All writes go through save_progress_for (service-role); revoke direct client DML.
revoke insert, update, delete, truncate on public.attempt_reviews from anon, authenticated;
create index if not exists attempt_reviews_user_created_idx
  on public.attempt_reviews (user_id, created_at desc);

-- Replace save_progress_for with a 4-arg version that also writes the review row.
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

  insert into public.scores (user_id, subject, score, weak_concepts, comment, rubric, updated_at)
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
         now()
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as s
  where s->>'subject' in ('math', 'physics', 'chemistry')
  on conflict (user_id, subject) do update
    set score = excluded.score,
        weak_concepts = excluded.weak_concepts,
        comment = excluded.comment,
        rubric = excluded.rubric,
        updated_at = excluded.updated_at;

  if p_attempt is not null and jsonb_typeof(p_attempt) = 'object' then
    if coalesce(p_attempt->>'type', 'attempt') not in ('baseline', 'attempt') then
      raise exception 'invalid attempt type: %', coalesce(p_attempt->>'type', 'attempt');
    end if;
    if p_attempt->>'subject' is not null and p_attempt->>'subject' not in ('math', 'physics', 'chemistry') then
      raise exception 'invalid attempt subject: %', p_attempt->>'subject';
    end if;
    insert into public.attempts (user_id, type, subject, reasoning_score, delta, new_score, total_after, phd_after, created_at, rationale)
    values (p_user,
            coalesce(p_attempt->>'type', 'attempt'),
            p_attempt->>'subject',
            case when pg_input_is_valid(p_attempt->>'reasoning_score', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'reasoning_score')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'delta', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'delta')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'new_score', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'new_score')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'total_after', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'total_after')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'phd_after', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'phd_after')::numeric)))::int end,
            least(coalesce(case when pg_input_is_valid(p_attempt->>'created_at', 'timestamptz') then (p_attempt->>'created_at')::timestamptz end, now()), now()),
            left(p_attempt->>'rationale', 500))
    returning id into v_attempt_id;

    -- Persist the review detail for a graded practice attempt (same transaction). Text
    -- fields are length-capped; rubric/feedback are stored only if they are JSON objects.
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

commit;
