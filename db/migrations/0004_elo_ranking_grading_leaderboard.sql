-- ===========================================================================
-- Migration 0004 — item-as-opponent Elo ranking + explainable grading + leaderboard
--
-- DELTA migration vs a live DB at the 0003 state. Additive + idempotent; one
-- transaction. Adds:
--   1. item_difficulty        — per-(subject,topic,band) self-calibrating question
--                               difficulty (INTERNAL: RLS on, no policy = service-role
--                               only, same lock as diagnostic_pool/rate_limits).
--   2. bump_item_difficulty() — atomic, FK-guarded difficulty nudge (service-role).
--   3. attempts.rationale     — persisted one-line "why your rank moved" explanation.
--   4. save_progress_for()    — now persists attempts.rationale (length-capped).
--   5. leaderboard_tiers()    — ANONYMOUS aggregate (5-band distribution per subject +
--                               overall, plus the caller's own band/percentile). NO
--                               names, NO per-attempt rows. service-role only, so it
--                               adds NO authenticated_security_definer advisor.
--
-- Expected NEW advisor after apply: one INFO `rls_enabled_no_policy` on
-- public.item_difficulty — the SAME accepted pattern as diagnostic_pool / rate_limits
-- / security_events (internal, service-role-only). No new WARN/ERROR.
-- ===========================================================================

begin;

-- ---- 1. item_difficulty: self-calibrating question difficulty -----------------
-- The "opponent" rating in the item-as-opponent Elo. Questions are generated fresh
-- (no stable per-question id), so difficulty is calibrated per BUCKET: (subject,
-- taxonomy-topic-slug, band). Seeded lazily from the band midpoint and nudged toward
-- what the user population actually scores. INTERNAL — never browser-read/written.
create table if not exists public.item_difficulty (
  subject text not null check (subject in ('math','physics','chemistry')),
  topic   text not null,                          -- taxonomy slug (FK below)
  band    text not null check (band in ('beginner','foundational','intermediate','advanced','phd')),
  difficulty numeric not null,                    -- 0..100, calibrated
  attempts bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (subject, topic, band),
  foreign key (subject, topic) references public.concept_topics(subject, slug)
);
alter table public.item_difficulty enable row level security;  -- no policy => service-role only
revoke insert, update, delete, truncate on public.item_difficulty from anon, authenticated;

-- Atomic difficulty nudge. Reads-modify-writes are commutative (additive deltas), so
-- concurrent attempts on one bucket simply both apply — no advisory lock needed.
-- FK-guarded: a non-taxonomy topic returns null instead of raising (the caller
-- normalizes, but defend regardless). Difficulty stays clamped to [0,100].
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
          greatest(0, least(100, coalesce(p_seed, 50) + coalesce(p_delta, 0))), 1, now())
  on conflict (subject, topic, band) do update
    set difficulty = greatest(0, least(100, public.item_difficulty.difficulty + coalesce(p_delta, 0))),
        attempts   = public.item_difficulty.attempts + 1,
        updated_at = now()
  returning difficulty into v_difficulty;
  return v_difficulty;
end;
$$;
revoke all on function public.bump_item_difficulty(text, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.bump_item_difficulty(text, text, text, numeric, numeric) to service_role;

-- ---- 2. attempts.rationale: the persisted "why your rank moved" line -----------
alter table public.attempts add column if not exists rationale text;

-- ---- 3. save_progress_for(): persist the rationale (length-capped) -------------
-- Unchanged except the attempts insert now carries `rationale` (<=500 chars). Still
-- service-role only; still SECURITY DEFINER; still one transaction (all-or-nothing).
create or replace function public.save_progress_for(p_user uuid, p_scores jsonb, p_attempt jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
            left(p_attempt->>'rationale', 500));
  end if;
end;
$$;
revoke all on function public.save_progress_for(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_progress_for(uuid, jsonb, jsonb) to service_role;

-- ---- 4. leaderboard_tiers(): anonymous 5-band distribution + caller position ----
-- ANONYMOUS by design: returns ONLY aggregate counts per rank band (no user_id, no
-- name, no per-attempt rows) for each subject + 'overall' (the rounded mean of a
-- user's subject scores), plus the caller's own band index, score, and the number of
-- ranked users strictly above them (for a "top X%" readout). Qualifying users = those
-- with >=1 scores row (i.e. completed a diagnostic). The 5 band cutoffs mirror
-- lib/scoring.js band(): <20, <40, <60, <80, else. SERVICE-ROLE ONLY — called by the
-- JWT-verified /api/leaderboard route with the caller's uid (so it adds no
-- authenticated_security_definer advisor and never trusts a client-supplied identity).
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
    select 'overall'::text as track, user_id, round(avg(score))::int as score
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

commit;
