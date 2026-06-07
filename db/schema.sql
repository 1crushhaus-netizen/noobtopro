-- ===========================================================================
-- noobtopro — Supabase schema (source of truth for the database)
--
-- This is the full DDL applied to the Supabase project (via the connector /
-- migrations). It is committed so the database is reproducible from version
-- control. The app depends on exactly these tables AND on the RPCs below —
-- migrate_guest_data, delete_user_data (called by lib/store.js), save_progress_for
-- (service-role only; called by /api/score for server-authoritative scoring)
-- and try_add_diagnostic (called by the /api/generate server route) — so
-- provisioning the tables alone is NOT enough; the functions must exist or sign-in
-- migration, "Reset my progress", the practice/diagnostic write path, and the
-- diagnostic-pool fill will fail at runtime.
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
  -- Per-subject reasoning rubric ({conceptual_understanding, logical_structure,
  -- strategy, execution_accuracy, communication} each 0–4) powering the radar chart.
  -- Server-computed only (see save_progress_for); NULL until a first graded result.
  rubric jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, subject)
);
-- Add the rubric column to an already-provisioned scores table (idempotent).
alter table public.scores add column if not exists rubric jsonb;

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
  phd_after int
);

create index if not exists attempts_user_created_idx
  on public.attempts (user_id, created_at, id);

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

-- ---- RPC: atomic guest -> account migration (called on first sign-in) ------
-- SECURITY DEFINER: the scores/attempts tables are now SELECT-only under RLS
-- (server-authoritative scoring), so this function must run with definer rights to
-- write. It is SELF-SCOPED — it captures auth.uid() and only ever touches the
-- caller's own rows (the JWT claim is read from the request regardless of definer),
-- so authenticated callers can migrate ONLY their own guest data. Advisory-locked
-- per user + "scores already exist" guard = idempotent and concurrency-safe; both
-- inserts run in ONE transaction so history can't be partially migrated or
-- duplicated. Input sizes are bounded. set search_path pins schema resolution.
create or replace function public.migrate_guest_data(p_scores jsonb, p_attempts jsonb)
returns boolean
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

  -- Guarded casts (pg_input_is_valid, PG16+): a single malformed numeric/timestamp
  -- in the guest blob must not abort the whole migration — coerce it to NULL/now()
  -- instead of raising. The type is allow-listed so a client-supplied value can't
  -- land an out-of-domain string in attempts.type (which now has a CHECK).
  insert into public.attempts (user_id, type, subject, reasoning_score, delta, new_score, total_after, phd_after, created_at)
  select uid,
         coalesce(a->>'type', 'attempt'),
         a->>'subject',
         case when pg_input_is_valid(a->>'reasoning_score', 'numeric') then greatest(-2147483648, least(2147483647, round((a->>'reasoning_score')::numeric)))::int end,
         case when pg_input_is_valid(a->>'delta', 'numeric') then greatest(-2147483648, least(2147483647, round((a->>'delta')::numeric)))::int end,
         case when pg_input_is_valid(a->>'new_score', 'numeric') then greatest(-2147483648, least(2147483647, round((a->>'new_score')::numeric)))::int end,
         case when pg_input_is_valid(a->>'total_after', 'numeric') then greatest(-2147483648, least(2147483647, round((a->>'total_after')::numeric)))::int end,
         case when pg_input_is_valid(a->>'phd_after', 'numeric') then greatest(-2147483648, least(2147483647, round((a->>'phd_after')::numeric)))::int end,
         least(coalesce(case when pg_input_is_valid(a->>'created_at', 'timestamptz') then (a->>'created_at')::timestamptz end, now()), now())
  from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb)) as a
  where (a->>'subject' is null or a->>'subject' in ('math', 'physics', 'chemistry'))
    and coalesce(a->>'type', 'attempt') in ('baseline', 'attempt');

  return true;
end;
$$;

-- Grant hygiene: Postgres grants EXECUTE to PUBLIC by default, which would let the
-- anon role call this RPC (it would still fail the auth.uid() null-check, but no
-- unauthenticated role should hold the grant at all). Revoke PUBLIC/anon, then
-- grant only to authenticated.
revoke all on function public.migrate_guest_data(jsonb, jsonb) from public, anon;
grant execute on function public.migrate_guest_data(jsonb, jsonb) to authenticated;

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
  delete from public.attempts where user_id = uid;
  delete from public.scores   where user_id = uid;
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

  -- Serialize concurrent writes for the SAME user (practice vs practice, or practice
  -- vs diagnostic re-baseline) so a read-modify-write blend can't lose an update or
  -- interleave into a mixed state. Transaction-scoped: released at commit/rollback.
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
    insert into public.attempts (user_id, type, subject, reasoning_score, delta, new_score, total_after, phd_after, created_at)
    values (p_user,
            coalesce(p_attempt->>'type', 'attempt'),
            p_attempt->>'subject',
            case when pg_input_is_valid(p_attempt->>'reasoning_score', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'reasoning_score')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'delta', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'delta')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'new_score', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'new_score')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'total_after', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'total_after')::numeric)))::int end,
            case when pg_input_is_valid(p_attempt->>'phd_after', 'numeric') then greatest(-2147483648, least(2147483647, round((p_attempt->>'phd_after')::numeric)))::int end,
            least(coalesce(case when pg_input_is_valid(p_attempt->>'created_at', 'timestamptz') then (p_attempt->>'created_at')::timestamptz end, now()), now()));
  end if;
end;
$$;

revoke all on function public.save_progress_for(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_progress_for(uuid, jsonb, jsonb) to service_role;

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

-- Auto-grow: register grader-recommended weak concepts as PENDING stubs (hidden
-- from the public hub until generated). service-role only; never disturbs an
-- existing pending/ready row.
create or replace function public.register_concepts(p_subject text, p_concepts jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_subject not in ('math','physics','chemistry') then return; end if;
  -- Best-effort global cap on auto-grown PENDING stubs so steered grader traffic
  -- can't grow concept_guides without bound (no TTL/cleanup yet); curated/ready rows
  -- are unaffected. A small overshoot under concurrency is fine for this P3 guard.
  if (select count(*) from public.concept_guides where status = 'pending') >= 50000 then return; end if;
  insert into public.concept_guides (subject, concept_key, concept, topic, status, content, visibility, source)
  select p_subject, _concept_key(val), left(val, 200), 'general_' || p_subject, 'pending', null, 'public', 'grader'
  from jsonb_array_elements_text(coalesce(p_concepts, '[]'::jsonb)) as val
  where coalesce(btrim(val), '') <> '' and _concept_key(val) <> ''
  on conflict (subject, concept_key) do nothing;
end;
$$;
revoke all on function public.register_concepts(text, jsonb) from public, anon, authenticated;
grant execute on function public.register_concepts(text, jsonb) to service_role;

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

-- ---- shared diagnostic pool ------------------------------------------------
-- The diagnostic is a static, level-neutral baseline (no per-user input), so it
-- is safe to standardize across users — same philosophy as concept_guides. We
-- pool a handful of full 3-subject sets, then /api/generate serves them at random
-- with NO Groq call; below DIAG_POOL_TARGET the pool self-fills. INTERNAL table:
-- RLS on, NO policies (service-role only). If SUPABASE_SERVICE_ROLE_KEY is unset,
-- pooling is skipped and the diagnostic is generated fresh each time (still works).
create table if not exists public.diagnostic_pool (
  id bigint generated always as identity primary key,
  content jsonb not null,                 -- a full {questions:[{subject,topic,question}x3]} set
  created_at timestamptz not null default now()
);
alter table public.diagnostic_pool enable row level security;

-- Atomic, advisory-locked, count-gated pool insert. Concurrent cold-start fills
-- would otherwise each read count < target and all insert (TOCTOU -> overshoot);
-- serializing on one advisory lock and re-checking the count inside the same
-- statement caps the pool at p_target exactly. SECURITY DEFINER + service-role-only
-- (the table has no RLS policies; only the server's admin client calls this).
create or replace function public.try_add_diagnostic(p_content jsonb, p_target int default 12)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('diagnostic_pool_fill'));
  if (select count(*) from public.diagnostic_pool) < greatest(coalesce(p_target, 0), 0) then
    insert into public.diagnostic_pool (content) values (p_content);
  end if;
end;
$$;
revoke all on function public.try_add_diagnostic(jsonb, int) from public, anon, authenticated;
grant execute on function public.try_add_diagnostic(jsonb, int) to service_role;

-- ---- admin / abuse monitoring ----------------------------------------------
-- security_events: server-logged warnings surfaced in the admin dashboard
-- (prompt-injection attempts, rate-limit/abuse spikes, user reports). INTERNAL:
-- RLS on, NO policy (service-role only — same lock as diagnostic_pool). NEVER
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

-- concept_reports: a signed-in user's report about a public guide. RLS lets a user
-- INSERT only their OWN report; reads are admin-only (service-role; NO select policy).
-- The user-facing "report" button ships with the Concept Hub browse UI; the table is
-- created now so the admin dashboard can render reports.
create table if not exists public.concept_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  subject text not null check (subject in ('math','physics','chemistry')),
  concept_key text not null,
  reporter_id uuid not null references auth.users on delete cascade,
  reason text check (reason is null or char_length(reason) <= 1000),
  status text not null default 'open' check (status in ('open','reviewed','dismissed'))
);
alter table public.concept_reports enable row level security;
drop policy if exists "report own" on public.concept_reports;
create policy "report own"
  on public.concept_reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id);
create index if not exists concept_reports_status_created_idx
  on public.concept_reports (status, created_at desc);
-- One OPEN report per user per guide: collapses report-flooding by an authenticated
-- user (the RLS insert policy alone places no bound). A duplicate insert hits this
-- unique index; lib/catalog.js#reportConcept treats the 23505 conflict as success.
create unique index if not exists concept_reports_one_open_per_user
  on public.concept_reports (reporter_id, subject, concept_key)
  where status = 'open';

-- ---- GRANT-layer hardening (defense-in-depth) ------------------------------
-- Supabase grants anon/authenticated full table DML by default; like scores/attempts
-- (above), strip writes the app doesn't need at the GRANT layer so the RLS intent
-- holds even if a policy is later added by mistake. All legitimate writes to these
-- tables go through SECURITY DEFINER RPCs / the service-role admin client.
--   - internal (RLS on, no policy): no browser write at all.
revoke insert, update, delete, truncate on public.diagnostic_pool, public.security_events from anon, authenticated;
--   - public-read content (writes service-role only): keep SELECT, drop writes.
revoke insert, update, delete, truncate on public.concept_guides, public.concept_topics from anon, authenticated;
--   - concept_reports: authenticated INSERTs its OWN report (RLS policy), so keep that
--     one grant; revoke everything else (anon can't report; nobody updates/deletes).
revoke update, delete, truncate on public.concept_reports from anon, authenticated;
revoke insert on public.concept_reports from anon;
