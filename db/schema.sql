-- ===========================================================================
-- noobtopro — Supabase schema (source of truth for the database)
--
-- This is the full DDL applied to the Supabase project (via the connector /
-- migrations). It is committed so the database is reproducible from version
-- control. The app depends on exactly these tables AND on the RPCs below —
-- migrate_guest_data, delete_user_data (called by lib/store.js) and
-- save_progress_for (service-role only; called by /api/score for
-- server-authoritative scoring) — so provisioning the tables alone is NOT
-- enough; the functions must exist or sign-in migration, "Reset my progress",
-- and the practice/diagnostic write path will fail at runtime.
--
-- Apply in order. Safe to re-run (idempotent where practical).
-- ===========================================================================

-- ---- tables ----------------------------------------------------------------
create table if not exists public.scores (
  user_id uuid not null references auth.users on delete cascade,
  subject text not null check (subject in ('math','physics','chemistry')),
  score int not null default 0,
  weak_concepts text[] not null default '{}',
  comment text,
  -- Per-subject reasoning radar (9 axes, 0–4 each) — now DERIVED from `glicko` below
  -- (radarFromGlicko). Opaque jsonb; server-computed only (see save_progress_for); NULL
  -- until a first graded result. RadarChart/lowestRubricDimensions read it unchanged.
  rubric jsonb,
  -- Per-axis Glicko-2 state {axis:{rating,rd,vol}} over the 9 RUBRIC_KEYS — the unified
  -- SOURCE OF TRUTH from which `score` (RUBRIC_WEIGHTS-weighted aggregate, via
  -- subjectScoreFromGlicko) and `rubric` (0–4 radar) are derived. Opaque; NULL until seeded.
  glicko jsonb,
  -- FIX 8 (guest score laundering, migration 0016). server_graded counts SERVER-GRADED
  -- attempts written through save_progress_for for THIS (user, subject); verified flips
  -- true once that count reaches LEADERBOARD_VERIFY_MIN (5). A guest score migrated on
  -- first sign-in lands verified=false / server_graded=0, so a client-computed (editable
  -- localStorage) score is VISIBLE to the user but EXCLUDED from the leaderboard until it
  -- is earned back through real server-graded practice. A baseline write does NOT count
  -- (it is the placement, not a practice attempt).
  server_graded int not null default 0,
  verified boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, subject)
);
-- Add the rubric/glicko columns to an already-provisioned scores table (idempotent).
alter table public.scores add column if not exists rubric jsonb;
alter table public.scores add column if not exists glicko jsonb;
-- FIX 8: server_graded / verified (idempotent; default false so existing rows that
-- have NOT been re-verified through the new counting path are excluded from the
-- leaderboard until they earn 5 server-graded attempts).
alter table public.scores add column if not exists server_graded int not null default 0;
alter table public.scores add column if not exists verified boolean not null default false;

create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  type text not null check (type in ('baseline','attempt')),
  subject text,
  reasoning_score int,
  delta int,
  new_score int,
  total_after int,
  phd_after int,
  -- One-line, server-computed "why your rank moved" explanation (rating delta + dock
  -- signals), shown to the learner. NULL for pre-0004 rows / baseline attempts.
  rationale text,
  -- The practiced item's (topic slug, difficulty band) — used by the anti-farm
  -- "diminishing returns on repeats" rule to detect grinding the same bucket. NULL for
  -- baselines / pre-0009 rows.
  topic text,
  band text,
  -- The server-issued question token's jti (0011): one served question is scoreable
  -- at most once (replay/duplicate-delivery dedupe in save_progress_for). NULL for
  -- baselines / pre-0011 rows.
  jti text
);
-- Add the rationale/topic/band/jti columns to an already-provisioned attempts table (idempotent).
alter table public.attempts add column if not exists rationale text;
alter table public.attempts add column if not exists topic text;
alter table public.attempts add column if not exists band text;
alter table public.attempts add column if not exists jti text;
create unique index if not exists attempts_user_jti_uidx
  on public.attempts (user_id, jti) where jti is not null;

create index if not exists attempts_user_created_idx
  on public.attempts (user_id, created_at, id);

-- attempt_reviews (PR 6): per-practice-attempt review detail (the question, the
-- learner's answer, the rubric, and the post-grade feedback incl. the worked solution),
-- 1:1 with a practice attempt. A SIBLING table so the hot `attempts` chart query stays
-- lean and this heavy payload is fetched LAZILY only when the learner opens a review.
-- RLS SELECT-own (the learner reads their OWN reviews directly via PostgREST); all
-- WRITES go through save_progress_for (service-role) — direct client DML is revoked.
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
-- "Answer history" is a PRO feature (P0-2 / migration 0018): there is NO client SELECT on
-- attempt_reviews. RLS stays enabled (deny-by-default) with no SELECT policy, and ALL
-- direct DML is revoked from anon/authenticated. Reads go through /api/reviews, which
-- checks the Pro entitlement and queries via the service role; the SECURITY DEFINER writer
-- migrate_guest_data (privileged owner) is unaffected by these grants.
alter table public.attempt_reviews enable row level security;
drop policy if exists "read own attempt reviews" on public.attempt_reviews;
revoke select, insert, update, delete, truncate on public.attempt_reviews from anon, authenticated;
create index if not exists attempt_reviews_user_created_idx
  on public.attempt_reviews (user_id, created_at desc);

-- concept_mastery (Learn-tab increment 2, migration 0010): per-(user, subject,
-- curriculum-concept) mastery counters behind the green/yellow/red/grey chip
-- coloring (RANKS_PLAN §12.1). The display state derives in lib/mastery.js
-- (green = ≥2 attempts at quality ≥70, sticky; red = last <40 or skipped).
-- SELECT-own under RLS; all writes revoked — only bump_concept_mastery /
-- migrate_guest_data (both SECURITY DEFINER) write it. ⚠️ quality values are
-- always SERVER-computed reasoning scores; the client never supplies them.
create table if not exists public.concept_mastery (
  user_id     uuid not null references auth.users(id) on delete cascade,
  subject     text not null check (subject in ('math', 'physics', 'chemistry')),
  concept_key text not null check (char_length(concept_key) between 1 and 80),
  attempts     int not null default 0 check (attempts >= 0),
  green_hits   int not null default 0 check (green_hits >= 0),
  last_quality int check (last_quality between 0 and 100),
  best_quality int check (best_quality between 0 and 100),
  updated_at  timestamptz not null default now(),
  primary key (user_id, subject, concept_key)
);
alter table public.concept_mastery enable row level security;
drop policy if exists concept_mastery_select_own on public.concept_mastery;
create policy concept_mastery_select_own on public.concept_mastery
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.concept_mastery from public, anon, authenticated;
grant select on public.concept_mastery to authenticated;

-- ---- row-level security ----------------------------------------------------
-- SERVER-AUTHORITATIVE SCORING: clients may READ their own rows (for hydrate) but
-- may NOT write scores/attempts directly. Removing the write policy closes the
-- self-assert gap — a signed-in user can no longer PATCH their own scores row to an
-- arbitrary value via PostgREST. All writes go through SECURITY DEFINER functions:
--   save_progress_for  (service-role only; called by /api/score after JWT verify)
--   migrate_guest_data / delete_user_data (authenticated; self-scoped via auth.uid())
-- Those functions are owned by a role that bypasses RLS, so a SELECT-only policy
-- here does not block them.
alter table public.scores   enable row level security;
alter table public.attempts enable row level security;

-- Drop the prior read+write policies (named "own ...") if present, then the
-- read-only replacements. Idempotent: safe to re-run.
drop policy if exists "own scores" on public.scores;
drop policy if exists "read own scores" on public.scores;
create policy "read own scores"
  on public.scores for select
  to authenticated
  using ((select auth.uid()) = user_id);     -- (select ...) => evaluated once/query

drop policy if exists "own attempts" on public.attempts;
drop policy if exists "read own attempts" on public.attempts;
create policy "read own attempts"
  on public.attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Defense-in-depth: also revoke direct write privileges at the GRANT layer (Supabase
-- grants anon/authenticated full table DML by default). With these revoked, the
-- SELECT-only intent holds even if a permissive write policy is ever added by mistake
-- or RLS is toggled. SELECT stays (RLS-gated by the read policies). The legitimate
-- write path — save_progress_for / migrate_guest_data / delete_user_data — is
-- SECURITY DEFINER (owner bypasses RLS and these grants), so it is unaffected.
revoke insert, update, delete, truncate on public.scores   from anon, authenticated;
revoke insert, update, delete, truncate on public.attempts from anon, authenticated;

-- ---- P2-6: bounded, numerically sane guest glicko ------------------------------
-- A guest-migrated glicko blob must be a small per-axis map of finite, in-range
-- {rating, rd, vol} triples — else it is dropped (the engine lazy-seeds from the
-- score instead). Blocks NaN/Infinity (NaN fails BETWEEN in PG), absurd ratings,
-- and oversized maps from entering the rating engine via a hand-edited blob.
create or replace function public._valid_glicko(j jsonb)
returns boolean
language sql
immutable
set search_path = public
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

-- ---- FIX 8: reset a migrated guest glicko's per-axis RD to the seed max ---------
-- A guest score is CLIENT-computed in editable localStorage; a hand-edited blob could
-- claim a LOW rating deviation (rd), which would make the laundered seed resist
-- correction by later server-graded attempts (low rd = "high confidence"). On
-- migration we keep the guest RATING (visible to the user) but reset every axis's rd to
-- GLICKO_RD0 (350, the seed max in lib/scoring.js) so the placement stays maximally
-- correctable. Preserves rating + vol; rd hard-set to 350. NULL passes through as NULL.
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

-- ---- RPC: atomic guest -> account migration (called on first sign-in) ------
-- SECURITY DEFINER: the scores/attempts tables are now SELECT-only under RLS
-- (server-authoritative scoring), so this function must run with definer rights to
-- write. It is SELF-SCOPED — it captures auth.uid() and only ever touches the
-- caller's own rows (the JWT claim is read from the request regardless of definer),
-- so authenticated callers can migrate ONLY their own guest data. Advisory-locked
-- per user + "scores already exist" guard = idempotent and concurrency-safe; both
-- inserts run in ONE transaction so history can't be partially migrated or
-- duplicated. Input sizes are bounded. set search_path pins schema resolution.
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

-- ---- RPC: service-role-only per-concept mastery counter upsert --------------
-- Called by /api/score (non-blocking, after the attempt persists) with one entry
-- per graded answer: [{ subject, concept_key, quality }] — quality is the SERVER-
-- computed reasoning score, never client-supplied. Mirrors the pure increment in
-- lib/mastery.js#applyMasteryAttempt; the `>= 70` is MASTERY_GREEN_QUALITY — keep
-- the two in sync (test/schema-invariants.test.js pins this marker).
create or replace function public.bump_concept_mastery(p_user uuid, p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_subject text;
  v_key text;
  v_quality int;
begin
  if p_user is null then
    raise exception 'p_user is required';
  end if;
  if coalesce(jsonb_array_length(coalesce(p_entries, '[]'::jsonb)), 0) > 16 then
    raise exception 'too many mastery entries';
  end if;

  for v in select value from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    if jsonb_typeof(v) <> 'object' then continue; end if;
    v_subject := v->>'subject';
    if v_subject is null or v_subject not in ('math', 'physics', 'chemistry') then continue; end if;
    v_key := left(coalesce(v->>'concept_key', ''), 80);
    if v_key = '' then continue; end if;
    v_quality := case when pg_input_is_valid(v->>'quality', 'numeric')
                      then greatest(0, least(100, round((v->>'quality')::numeric)))::int end;
    if v_quality is null then continue; end if;

    insert into public.concept_mastery as cm
      (user_id, subject, concept_key, attempts, green_hits, last_quality, best_quality, updated_at)
    values
      (p_user, v_subject, v_key, 1,
       case when v_quality >= 70 then 1 else 0 end,  -- MASTERY_GREEN_QUALITY (lib/mastery.js)
       v_quality, v_quality, now())
    on conflict (user_id, subject, concept_key) do update set
      attempts     = least(cm.attempts + 1, 100000),
      green_hits   = least(cm.green_hits + (case when excluded.last_quality >= 70 then 1 else 0 end), 100000),
      last_quality = excluded.last_quality,
      best_quality = greatest(coalesce(cm.best_quality, 0), excluded.best_quality),
      updated_at   = now();
  end loop;
end;
$$;

revoke all on function public.bump_concept_mastery(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.bump_concept_mastery(uuid, jsonb) to service_role;

-- ---- RPC: atomic delete of the caller's data (Profile -> "Reset my progress")
-- SECURITY DEFINER (scores/attempts are SELECT-only under RLS now), self-scoped to
-- auth.uid() so a caller can delete ONLY their own rows.
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
  delete from public.concept_mastery where user_id = uid;  -- a reset clears the chip coloring too
end;
$$;

revoke all on function public.delete_user_data() from public, anon;
grant execute on function public.delete_user_data() to authenticated;

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

-- ---- concept hub: taxonomy reference + guide catalog ------------------------
-- The Learn tab is a UNIVERSAL, browsable concept hub. concept_guides is the
-- catalog: each guide is generated ONCE by Groq and reused for every account.
-- It is PUBLICLY READABLE (read-only) so the browser can browse/search it via
-- PostgREST with no Groq call; all WRITES stay service-role-only (no write
-- policy -> only the admin client, which bypasses RLS, can write). The public
-- read policy is intentionally scoped to visibility='public' AND status='ready'
-- so pending stubs and hidden/moderated rows never leak.
--
-- IMPORTANT: this table is now a public object. NEVER add a PII / per-user
-- column here (the public SELECT exposes every column) — keep such data in the
-- RLS-scoped scores/attempts tables instead.

-- concept_topics: the curated, fixed Subject->Topic taxonomy (mirrors
-- lib/taxonomy.js). Public-readable so the hub renders labels/ordering.
create table if not exists public.concept_topics (
  subject text not null check (subject in ('math','physics','chemistry')),
  slug    text not null,                  -- stable/immutable identifier (in URLs + FK)
  label   text not null,                  -- display name
  sort    smallint not null default 0,
  primary key (subject, slug)
);
alter table public.concept_topics enable row level security;
drop policy if exists "concept topics are public" on public.concept_topics;
create policy "concept topics are public"
  on public.concept_topics for select to anon, authenticated using (true);
-- Seed the 36 topics (3 subjects x 12, incl. a general_<subject> fallback). Keep
-- in sync with lib/taxonomy.js TOPICS.
insert into public.concept_topics (subject, slug, label, sort) values
  ('math','arithmetic_number','Arithmetic & Number Theory',0),
  ('math','algebra','Algebra',1),
  ('math','functions_precalc','Functions & Precalculus',2),
  ('math','geometry','Geometry',3),
  ('math','trigonometry','Trigonometry',4),
  ('math','calculus_analysis','Calculus & Analysis',5),
  ('math','linear_algebra','Linear Algebra',6),
  ('math','differential_equations','Differential Equations',7),
  ('math','probability_statistics','Probability & Statistics',8),
  ('math','discrete_logic','Discrete Math & Logic',9),
  ('math','proof_reasoning','Proof & Mathematical Reasoning',10),
  ('math','general_math','General / Other',11),
  ('physics','kinematics_dynamics','Kinematics & Dynamics',0),
  ('physics','energy_momentum','Energy & Momentum',1),
  ('physics','gravitation_orbits','Gravitation & Orbits',2),
  ('physics','oscillations_waves','Oscillations & Waves',3),
  ('physics','fluids_continuum','Fluids & Continuum Mechanics',4),
  ('physics','thermodynamics_statmech','Thermodynamics & Statistical Mechanics',5),
  ('physics','electromagnetism','Electricity & Magnetism',6),
  ('physics','optics','Optics',7),
  ('physics','modern_quantum','Modern & Quantum Physics',8),
  ('physics','relativity','Relativity',9),
  ('physics','nuclear_particle','Nuclear & Particle Physics',10),
  ('physics','general_physics','General / Other',11),
  ('chemistry','atomic_structure','Atomic Structure & Periodicity',0),
  ('chemistry','bonding_molecular','Bonding & Molecular Structure',1),
  ('chemistry','stoichiometry','Stoichiometry & Reactions',2),
  ('chemistry','states_intermolecular','States of Matter & Intermolecular Forces',3),
  ('chemistry','thermochemistry','Thermochemistry & Energetics',4),
  ('chemistry','equilibrium','Equilibrium',5),
  ('chemistry','acids_bases','Acids, Bases & Salts',6),
  ('chemistry','kinetics','Reaction Kinetics',7),
  ('chemistry','electrochemistry','Electrochemistry',8),
  ('chemistry','organic','Organic Chemistry',9),
  ('chemistry','analytical_spectroscopy','Analytical Chemistry & Spectroscopy',10),
  ('chemistry','general_chemistry','General / Other',11)
on conflict (subject, slug) do update set label = excluded.label, sort = excluded.sort;

create table if not exists public.concept_guides (
  subject text not null check (subject in ('math','physics','chemistry')),
  concept_key text not null,             -- normalized key (see _concept_key / conceptKey)
  concept text not null,                 -- canonical display phrasing
  topic text not null default 'general_math',  -- FK below; set per-row by app/backfill
  content jsonb,                         -- the full normalized guide; NULL for a 'pending' stub
  status text not null default 'pending' check (status in ('ready','pending')),
  visibility text not null default 'public' check (visibility in ('public','hidden')),
  source text not null default 'curated' check (source in ('grader','curated','user')),
  level_band text check (level_band is null or level_band in ('beginner','foundational','intermediate','advanced','phd')),
  times_opened bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (subject, concept_key),
  -- ready <=> content present; pending <=> content null
  constraint concept_guides_content_status_chk
    check ((status='ready' and content is not null) or (status='pending' and content is null)),
  foreign key (subject, topic) references public.concept_topics(subject, slug)
);
alter table public.concept_guides enable row level security;
-- Public read of ONLY vetted, ready guides; writes remain service-role-only.
drop policy if exists "public read ready guides" on public.concept_guides;
create policy "public read ready guides"
  on public.concept_guides for select to anon, authenticated
  using (visibility = 'public' and status = 'ready');

-- Byte-for-byte parity with conceptKey() in lib/supabaseAdmin.js, verified on the
-- live DB against the JS golden vectors (test/conceptKey.test.js). Steps:
--   1. strip control/format chars (C0, DEL+C1, zero-width, BOM) — the chars where
--      JS \s / String.trim() and Postgres \s disagree — so the two cannot diverge;
--   2. trim -> lower -> strip leading/trailing quote runs -> collapse whitespace;
--   3. left(...,200) truncates by CHARACTER, matching JS Array.from(s).slice(0,200).
-- A drift would leave grader-registered keys that generation never lands on.
create or replace function public._concept_key(p text)
returns text language sql immutable set search_path = '' as $$
  select left(
           regexp_replace(
             regexp_replace(
               lower(regexp_replace(
                 regexp_replace(coalesce(p, ''), '[\x00-\x1F\x7F-\x9F\x200b-\x200d\xfeff]', '', 'g'),
                 '^\s+|\s+$', '', 'g'
               )),
               '^["''`]+|["''`]+$', '', 'g'
             ),
             '\s+', ' ', 'g'
           ),
           200
         );
$$;

-- ---- auto-grow registration — DROPPED (0014) --------------------------------
-- register_concepts once turned the grader's weak concepts into PENDING hidden
-- stubs (the hub's organic-growth pipeline). Retired by owner decision
-- 2026-06-11 (#75) — the curated curriculum + written guides superseded the
-- organic catalog — and dropped in 0014_drop_register_concepts.sql.

-- On a /api/learn generation: promote a pending stub to ready, or insert a fresh
-- user-originated guide. CURATION-ONLY MODEL (security): auto-grown guides are
-- ALWAYS stored visibility='hidden' — they are cached + servable to a direct opener
-- but are NEVER publicly browsable. Only curated rows (the seed / explicit approval,
-- source='curated', visibility='public') reach the public hub, so attacker-influenced
-- concept labels/content can never be broadcast to all users via the public read
-- policy. `p_safe` is retained for compatibility but no longer grants public
-- visibility. Never overwrites an existing ready guide (first-writer-wins).
create or replace function public.promote_or_insert_guide(
  p_subject text, p_concept text, p_content jsonb, p_topic text, p_level text, p_safe boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  k  text := _concept_key(p_concept);
  t  text := case when exists (select 1 from public.concept_topics where subject = p_subject and slug = p_topic)
                  then p_topic else 'general_' || p_subject end;
  lv text := case when p_level in ('beginner','foundational','intermediate','advanced','phd') then p_level else null end;
begin
  if p_subject not in ('math','physics','chemistry') or k = '' or p_content is null then return; end if;
  update public.concept_guides
     set content = p_content, topic = t, level_band = lv, status = 'ready',
         visibility = 'hidden', updated_at = now()
   where subject = p_subject and concept_key = k and status = 'pending';
  if found then return; end if;
  insert into public.concept_guides (subject, concept_key, concept, content, topic, level_band, status, source, visibility)
  values (p_subject, k, left(p_concept, 200), p_content, t, lv, 'ready', 'user', 'hidden')
  on conflict (subject, concept_key) do nothing;
end;
$$;
revoke all on function public.promote_or_insert_guide(text, text, jsonb, text, text, boolean) from public, anon, authenticated;
grant execute on function public.promote_or_insert_guide(text, text, jsonb, text, text, boolean) to service_role;

-- Auto-heal a STALE auto-grown guide (PR 5): overwrite a non-curated `ready` guide in
-- place, preserving visibility/source/status. /api/learn calls this when a cache hit is
-- a non-curated guide whose content lacks the `whyItWorks` proof field (added in PR 5),
-- so each stale guide regenerates AT MOST ONCE then is healed. CURATED guides are
-- author-vetted and refreshed ONLY by the seed (seed_curated_guide). service-role only.
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
  update public.concept_guides
     set content = p_content, topic = t, level_band = lv, updated_at = now()
   where subject = p_subject and concept_key = k and status = 'ready' and source <> 'curated';
end;
$$;
revoke all on function public.refresh_guide(text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.refresh_guide(text, text, jsonb, text, text) to service_role;

-- Concept Hub PUBLIC SEED (PR 4): the sanctioned BATCH public-publish path (alongside
-- the admin "approve" action). Upserts a CURATED, PUBLIC, READY guide for a core
-- concept; idempotent + re-runnable (re-running refreshes content). On conflict it also
-- promotes any prior hidden grader/user row for the key to the curated public catalog
-- (taking canonical ownership). service-role only — a signed-in user can NEVER publish
-- via it (the curation-only model holds: seed + admin approve are the only public paths).
-- The seed script (scripts/seed-concept-hub.mjs) calls this for the core concept of each
-- of the 36 taxonomy topics (lib/taxonomy.js SEED_CONCEPTS).
create or replace function public.seed_curated_guide(
  p_subject text, p_topic text, p_concept text, p_content jsonb, p_level text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  k  text := _concept_key(p_concept);
  t  text := case when exists (select 1 from public.concept_topics where subject = p_subject and slug = p_topic)
                  then p_topic else 'general_' || p_subject end;
  lv text := case when p_level in ('beginner','foundational','intermediate','advanced','phd') then p_level else null end;
begin
  if p_subject not in ('math','physics','chemistry') or k = '' or p_content is null then return; end if;
  insert into public.concept_guides (subject, concept_key, concept, content, topic, level_band, status, source, visibility, updated_at)
  values (p_subject, k, left(p_concept, 200), p_content, t, lv, 'ready', 'curated', 'public', now())
  on conflict (subject, concept_key) do update
    set content    = excluded.content,
        concept    = excluded.concept,
        topic      = excluded.topic,
        level_band = excluded.level_band,
        status     = 'ready',
        source     = 'curated',
        visibility = 'public',
        updated_at = now();
end;
$$;
revoke all on function public.seed_curated_guide(text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.seed_curated_guide(text, text, text, jsonb, text) to service_role;

-- Conservative canonical de-dup housekeeping (PR 4): delete content-less grader PENDING
-- stubs already subsumed by a READY guide in the same (subject, topic) (the stub's key
-- appears as a whole WORD in the ready guide's key — a word-boundary match, not a raw
-- substring, so "sin" is NOT pruned by "cosine"; wildcard-safe, no LIKE). Pending stubs
-- are mere hints (no content, never public), so this is a safe collapse; a concept
-- re-stubs if a future grade re-registers it. Touches NO ready/public/curated row.
-- service-role only. (Fuzzy semantic merge of distinct-keyed near-duplicates is the
-- v1.1 follow-on — pg_trgm.)
create or replace function public.dedupe_pending_stubs() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_removed int;
begin
  with kept as (
    select subject, topic, concept_key from public.concept_guides where status = 'ready'
  ),
  dupes as (
    select g.ctid
    from public.concept_guides g
    join kept k
      on k.subject = g.subject
     and k.topic   = g.topic
     and k.concept_key <> g.concept_key
     and g.concept_key = any(string_to_array(k.concept_key, ' '))
    where g.status = 'pending'
  )
  delete from public.concept_guides where ctid in (select ctid from dupes);
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;
revoke all on function public.dedupe_pending_stubs() from public, anon, authenticated;
grant execute on function public.dedupe_pending_stubs() to service_role;

-- ---- shared diagnostic pool — DROPPED (0013) --------------------------------
-- diagnostic_pool + try_add_diagnostic once pooled generated 3-subject sets so
-- /api/generate could serve diagnostics without a Groq call. Superseded by the
-- CURATED in-repo bank (lib/diagnosticBank.js — zero Groq, fully standardized);
-- the drained table and its filler RPC were dropped in 0013_drop_diagnostic_pool.

-- ---- admin / abuse monitoring ----------------------------------------------
-- security_events: server-logged warnings surfaced in the admin dashboard
-- (prompt-injection attempts, rate-limit/abuse spikes, user reports). INTERNAL:
-- RLS on, NO policy (service-role only — same lock as rate_limits). NEVER
-- written by the browser; the server logs it via the service-role admin client.
create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('prompt_injection','rate_limit','invalid_input','report','other')),
  severity text not null default 'low' check (severity in ('low','medium','high')),
  route text,
  ip text,
  user_id uuid,                          -- usually null (the public routes are unauthenticated)
  subject text,
  concept text,
  sample text,                           -- capped matched snippet — never the full payload
  detail jsonb,
  status text not null default 'open' check (status in ('open','reviewed','dismissed'))
);
alter table public.security_events enable row level security;
create index if not exists security_events_status_created_idx
  on public.security_events (status, created_at desc);

-- concept_reports: a signed-in user's report about a public guide. Since 0011 the
-- ONLY write path is the submit_concept_report RPC (self-scoped, ≤20 open per
-- reporter); the direct RLS INSERT policy is dropped and the grant revoked; reads are admin-only (service-role; NO select policy).
-- The user-facing "report" button ships with the Concept Hub browse UI; the table is
-- created now so the admin dashboard can render reports.
create table if not exists public.concept_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  subject text not null check (subject in ('math','physics','chemistry')),
  -- Length-capped: the one column an authenticated user writes directly (RLS insert),
  -- so bound it like every other text field to stop junk-row bloat of the admin queue.
  concept_key text not null check (char_length(concept_key) <= 200),
  reporter_id uuid not null references auth.users on delete cascade,
  reason text check (reason is null or char_length(reason) <= 1000),
  status text not null default 'open' check (status in ('open','reviewed','dismissed'))
);
alter table public.concept_reports enable row level security;
-- 0011 (audit P2-8): the direct PostgREST INSERT policy is GONE — reports go
-- through submit_concept_report below (self-scoped, ≤20 open per reporter), so
-- an authenticated attacker can no longer flood the admin queue unmetered.
drop policy if exists "report own" on public.concept_reports;
revoke insert on public.concept_reports from anon, authenticated;
create index if not exists concept_reports_status_created_idx
  on public.concept_reports (status, created_at desc);
-- One OPEN report per user per guide: collapses report-flooding by an authenticated
-- user (the RLS insert policy alone places no bound). A duplicate insert hits this
-- unique index; lib/catalog.js#reportConcept treats the 23505 conflict as success.
create unique index if not exists concept_reports_one_open_per_user
  on public.concept_reports (reporter_id, subject, concept_key)
  where status = 'open';

-- Rate-bounded report path (0011, audit P2-8): the ONLY way a user files a report.
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

-- ---- GRANT-layer hardening (defense-in-depth) ------------------------------
-- Supabase grants anon/authenticated full table DML by default; like scores/attempts
-- (above), strip writes the app doesn't need at the GRANT layer so the RLS intent
-- holds even if a policy is later added by mistake. All legitimate writes to these
-- tables go through SECURITY DEFINER RPCs / the service-role admin client.
--   - internal (RLS on, no policy): no browser write at all.
revoke insert, update, delete, truncate on public.security_events from anon, authenticated;
--   - public-read content (writes service-role only): keep SELECT, drop writes.
revoke insert, update, delete, truncate on public.concept_guides, public.concept_topics from anon, authenticated;
--   - concept_reports: writes go ONLY through submit_concept_report (0011) — the
--     direct INSERT grant is revoked below alongside update/delete/truncate.
--     one grant; revoke everything else (anon can't report; nobody updates/deletes).
revoke update, delete, truncate on public.concept_reports from anon, authenticated;
revoke insert on public.concept_reports from anon;

-- ---- durable rate limiter --------------------------------------------------
-- DURABLE, per-account (or per-IP) rate limiting shared across all serverless
-- instances — replacing the in-memory per-instance limiter (which multiplied the
-- effective limit by the instance count and was IP-spoofable). Each bucket is a
-- fixed window: rate_limit_hit() atomically increments and returns whether the call
-- is allowed. lib/rateLimit.js#checkRateLimit calls this with the service-role
-- client and falls back to the in-memory limiter when the service-role key is unset
-- (local/dev/CI). INTERNAL: RLS on, NO policy (service-role only), never browser-read.
create table if not exists public.rate_limits (
  bucket text primary key,                 -- e.g. "acct:<uid>", "<ip>", "<ip>:diag"
  hits int not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.rate_limits enable row level security;  -- no policy => service-role only
revoke insert, update, delete, truncate on public.rate_limits from anon, authenticated;

-- Atomic fixed-window counter. Increments the bucket (resetting if its window has
-- rolled over) and reports allowance in ONE statement, so concurrent lambdas can't
-- race the read/modify/write. SECURITY DEFINER + service-role only.
create or replace function public.rate_limit_hit(p_bucket text, p_max int, p_window_seconds int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window int := greatest(1, coalesce(p_window_seconds, 60));
  v_max int := greatest(1, coalesce(p_max, 30));
  v_hits int;
  v_reset timestamptz;
begin
  if p_bucket is null or p_bucket = '' then
    raise exception 'bucket required';
  end if;
  insert into public.rate_limits (bucket, hits, reset_at, updated_at)
  values (left(p_bucket, 200), 1, v_now + make_interval(secs => v_window), v_now)
  on conflict (bucket) do update
    set hits = case when public.rate_limits.reset_at <= v_now then 1 else public.rate_limits.hits + 1 end,
        reset_at = case when public.rate_limits.reset_at <= v_now then v_now + make_interval(secs => v_window) else public.rate_limits.reset_at end,
        updated_at = v_now
  returning hits, reset_at into v_hits, v_reset;

  -- Opportunistic prune (~2% of calls via a clock-based sampler) of long-expired rows
  -- so the table stays bounded without a cron dependency. Never touches live buckets.
  if (extract(milliseconds from clock_timestamp())::bigint % 50) = 0 then
    delete from public.rate_limits
     where ctid in (select ctid from public.rate_limits where reset_at < v_now - interval '1 hour' limit 200);
  end if;

  return jsonb_build_object(
    'allowed', v_hits <= v_max,
    'remaining', greatest(0, v_max - v_hits),
    'reset_at', v_reset,
    'retry_after', case when v_hits <= v_max then 0 else greatest(1, ceil(extract(epoch from (v_reset - v_now))))::int end
  );
end;
$$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- FIX 8 / audit P2-2: REFUND n hits to a bucket's CURRENT window (floored at 0).
-- chargeGlobalGroq charges the global Groq budget BEFORE grading; when the charged
-- grade does NOT succeed (an upstream outage) the route refunds the slot so an outage
-- doesn't keep over-throttling the whole platform for the rest of the window. No-op when
-- the bucket is absent or its window already rolled (the hits there are irrelevant).
-- SECURITY DEFINER + service-role only, exactly like rate_limit_hit.
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

-- ---- item-as-opponent Elo: self-calibrating question difficulty ------------
-- The rating engine (lib/scoring.js) treats each QUESTION as the rated opponent. Its
-- difficulty lives on the same 0–100 scale as the learner's per-subject rating and is
-- calibrated per BUCKET — (subject, taxonomy-topic-slug, band) — because questions are
-- generated fresh (no stable per-question id). /api/score reads the bucket difficulty,
-- computes the Elo update server-side, and nudges the bucket via bump_item_difficulty.
-- INTERNAL: RLS on, NO policy (service-role only — same lock as
-- rate_limits / security_events; produces the accepted INFO rls_enabled_no_policy
-- advisor). NEVER browser-read/written; holds NO per-user data.
create table if not exists public.item_difficulty (
  subject text not null check (subject in ('math','physics','chemistry')),
  topic   text not null,                          -- a taxonomy slug (FK -> concept_topics)
  band    text not null check (band in ('beginner','foundational','intermediate','advanced','phd')),
  difficulty numeric not null,                    -- 0..100, calibrated toward population outcomes
  attempts bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (subject, topic, band),
  foreign key (subject, topic) references public.concept_topics(subject, slug)
);
alter table public.item_difficulty enable row level security;  -- no policy => service-role only
revoke insert, update, delete, truncate on public.item_difficulty from anon, authenticated;

-- Atomic difficulty nudge (seed-lazy upsert). The Elo math lives in JS (one source of
-- truth); this just applies the computed delta as an atomic, clamped increment.
-- Concurrent attempts on one bucket commute (additive deltas), so no advisory lock is
-- needed. FK-guarded: a non-taxonomy topic returns null rather than violating the FK.
-- SECURITY DEFINER + service-role only.
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

-- ---- leaderboard (ANONYMOUS tiers) -----------------------------------------
-- The Profile leaderboard exposes NO names, NO email, NO per-attempt rows — only the
-- aggregate distribution across the 5 fixed ranks (per subject + 'overall', the rounded
-- mean of a user's subject scores) PLUS the caller's own band/score and how many ranked
-- users sit strictly above them (for a "top X%" readout). Because scores is SELECT-own
-- under RLS, this cross-user aggregate needs definer rights; it is SERVICE-ROLE ONLY and
-- invoked by the JWT-verified /api/leaderboard route with the caller's uid — so it never
-- trusts a client identity and adds NO authenticated_security_definer advisor. The
-- per-band counts are exactly what a future percentile-recut tiering would consume.
--
-- FIX 8 (guest score laundering): only VERIFIED rows (server_graded >= 5, set by
-- save_progress_for) feed the distribution counts and ranking. A migrated guest score is
-- unverified, so a client-edited localStorage seed can NOT inflate the leaderboard. The
-- caller's own 'you' is returned PROVISIONAL (no real rank — just their visible band/score
-- + how many more graded attempts they owe) until their row is verified.
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

-- ===========================================================================
-- PRO SUBSCRIPTIONS / ENTITLEMENTS (Polar.sh monetization, migration 0017)
--
-- One row per user = the source of truth for "is this user Pro?". Written ONLY by the
-- Polar webhook (via the service-role upsert_subscription RPC, after it verifies the
-- signature and resolves the user from the event); read by the server-side gate
-- (lib/entitlements.js) and, SELECT-own, by the client UI. `status` is the RAW Polar
-- SubscriptionStatus stored as length-bounded free text (NOT a CHECK enum) so a future
-- Polar status can't make the webhook upsert abort and silently drop an entitlement —
-- the "is Pro" decision lives in lib/entitlements.js#isActiveSubscription (active status
-- AND not past current_period_end). delete_user_data deliberately leaves this table
-- alone: wiping your progress doesn't cancel a paid subscription.
-- ===========================================================================
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive' check (char_length(status) between 1 and 40),
  product_id text check (product_id is null or char_length(product_id) <= 200),
  polar_customer_id text check (polar_customer_id is null or char_length(polar_customer_id) <= 200),
  polar_subscription_id text check (polar_subscription_id is null or char_length(polar_subscription_id) <= 200),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
-- SELECT-own under RLS (the user reads their OWN Pro state for the UI); all writes
-- revoked — only the service-role upsert_subscription RPC writes it (same pattern as
-- concept_mastery). The columns hold no secrets, so exposing the owner's own row is fine.
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.subscriptions from public, anon, authenticated;
grant select on public.subscriptions to authenticated;

-- Service-role-ONLY entitlement upsert the Polar webhook calls. SECURITY DEFINER; a
-- signed-in user can never self-grant Pro (table is SELECT-only; not granted to
-- authenticated). COALESCE on the optional ids keeps a stored id when a later event
-- omits it; status / period-end / cancel flag always reflect the newest event.
create or replace function public.upsert_subscription(
  p_user uuid,
  p_status text,
  p_product_id text default null,
  p_polar_customer_id text default null,
  p_polar_subscription_id text default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false
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
     current_period_end, cancel_at_period_end, updated_at)
  values
    (p_user,
     left(coalesce(nullif(p_status, ''), 'inactive'), 40),
     left(p_product_id, 200),
     left(p_polar_customer_id, 200),
     left(p_polar_subscription_id, 200),
     p_current_period_end,
     coalesce(p_cancel_at_period_end, false),
     now())
  on conflict (user_id) do update set
    status                = excluded.status,
    product_id            = coalesce(excluded.product_id, s.product_id),
    polar_customer_id     = coalesce(excluded.polar_customer_id, s.polar_customer_id),
    polar_subscription_id = coalesce(excluded.polar_subscription_id, s.polar_subscription_id),
    current_period_end    = excluded.current_period_end,
    cancel_at_period_end  = excluded.cancel_at_period_end,
    updated_at            = now();
end;
$$;
revoke all on function public.upsert_subscription(uuid, text, text, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.upsert_subscription(uuid, text, text, text, text, timestamptz, boolean) to service_role;
