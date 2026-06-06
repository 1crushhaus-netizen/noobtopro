-- ===========================================================================
-- noobtopro — Supabase schema (source of truth for the database)
--
-- This is the full DDL applied to the Supabase project (via the connector /
-- migrations). It is committed so the database is reproducible from version
-- control. The app's lib/store.js depends on exactly these tables AND on the
-- two RPCs below (migrate_guest_data, delete_user_data) — provisioning the
-- tables alone is NOT enough; the functions must exist or sign-in migration and
-- "Reset my progress" will fail at runtime.
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
  updated_at timestamptz not null default now(),
  primary key (user_id, subject)
);

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
alter table public.scores   enable row level security;
alter table public.attempts enable row level security;

drop policy if exists "own scores" on public.scores;
create policy "own scores"
  on public.scores for all
  to authenticated
  using ((select auth.uid()) = user_id)        -- (select ...) => evaluated once/query
  with check ((select auth.uid()) = user_id);

drop policy if exists "own attempts" on public.attempts;
create policy "own attempts"
  on public.attempts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---- RPC: atomic guest -> account migration (called on first sign-in) ------
-- SECURITY INVOKER so RLS still applies (a user can only write their own rows).
-- Advisory-locked per user + "scores already exist" guard = idempotent and
-- concurrency-safe; both inserts run in ONE transaction so history can't be
-- partially migrated or duplicated. Input sizes are bounded.
create or replace function public.migrate_guest_data(p_scores jsonb, p_attempts jsonb)
returns boolean
language plpgsql
security invoker
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

  insert into public.scores (user_id, subject, score, weak_concepts, comment, updated_at)
  select uid,
         s->>'subject',
         greatest(0, least(100, coalesce(case when pg_input_is_valid(s->>'score', 'numeric') then round((s->>'score')::numeric) end, 0)))::int,
         coalesce(
           (select array_agg(left(value, 200)) from jsonb_array_elements_text(s->'weak_concepts') as value),
           '{}'::text[]
         ),
         left(coalesce(s->>'comment', ''), 2000),
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
         case when pg_input_is_valid(a->>'reasoning_score', 'numeric') then round((a->>'reasoning_score')::numeric)::int end,
         case when pg_input_is_valid(a->>'delta', 'numeric') then round((a->>'delta')::numeric)::int end,
         case when pg_input_is_valid(a->>'new_score', 'numeric') then round((a->>'new_score')::numeric)::int end,
         case when pg_input_is_valid(a->>'total_after', 'numeric') then round((a->>'total_after')::numeric)::int end,
         case when pg_input_is_valid(a->>'phd_after', 'numeric') then round((a->>'phd_after')::numeric)::int end,
         coalesce(case when pg_input_is_valid(a->>'created_at', 'timestamptz') then (a->>'created_at')::timestamptz end, now())
  from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb)) as a
  where (a->>'subject' is null or a->>'subject' in ('math', 'physics', 'chemistry'))
    and coalesce(a->>'type', 'attempt') in ('baseline', 'attempt');

  return true;
end;
$$;

grant execute on function public.migrate_guest_data(jsonb, jsonb) to authenticated;

-- ---- RPC: atomic delete of the caller's data (Profile -> "Reset my progress")
create or replace function public.delete_user_data()
returns void
language plpgsql
security invoker
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

grant execute on function public.delete_user_data() to authenticated;

-- ---- RPC: atomic save of a score update + its matching attempt --------------
-- The practice/diagnostic flow persists a subject-score change AND appends an
-- attempt-history row. Done as two separate client writes, a partial failure can
-- persist the score but lose the attempt (and the client re-resolves identity
-- twice). This RPC does BOTH in one transaction, capturing auth.uid() once.
-- SECURITY INVOKER so RLS still applies. p_scores is the full scores map as a
-- jsonb array of {subject,score,weak_concepts,comment}; p_attempt is the single
-- attempt to append (snake_case, matching lib/store.js). Values are clamped /
-- allow-listed / guard-cast exactly like migrate_guest_data so malformed input
-- can't violate a CHECK or abort the write.
create or replace function public.save_progress(p_scores jsonb, p_attempt jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if coalesce(jsonb_array_length(coalesce(p_scores, '[]'::jsonb)), 0) > 3 then
    raise exception 'too many score rows';
  end if;

  insert into public.scores (user_id, subject, score, weak_concepts, comment, updated_at)
  select uid,
         s->>'subject',
         greatest(0, least(100, coalesce(case when pg_input_is_valid(s->>'score', 'numeric') then round((s->>'score')::numeric) end, 0)))::int,
         coalesce(
           (select array_agg(left(value, 200)) from jsonb_array_elements_text(s->'weak_concepts') as value),
           '{}'::text[]
         ),
         left(coalesce(s->>'comment', ''), 2000),
         now()
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as s
  where s->>'subject' in ('math', 'physics', 'chemistry')
  on conflict (user_id, subject) do update
    set score = excluded.score,
        weak_concepts = excluded.weak_concepts,
        comment = excluded.comment,
        updated_at = excluded.updated_at;

  -- Append the attempt (skip if no usable attempt was supplied).
  if p_attempt is not null and jsonb_typeof(p_attempt) = 'object' then
    insert into public.attempts (user_id, type, subject, reasoning_score, delta, new_score, total_after, phd_after, created_at)
    select uid,
           coalesce(p_attempt->>'type', 'attempt'),
           p_attempt->>'subject',
           case when pg_input_is_valid(p_attempt->>'reasoning_score', 'numeric') then round((p_attempt->>'reasoning_score')::numeric)::int end,
           case when pg_input_is_valid(p_attempt->>'delta', 'numeric') then round((p_attempt->>'delta')::numeric)::int end,
           case when pg_input_is_valid(p_attempt->>'new_score', 'numeric') then round((p_attempt->>'new_score')::numeric)::int end,
           case when pg_input_is_valid(p_attempt->>'total_after', 'numeric') then round((p_attempt->>'total_after')::numeric)::int end,
           case when pg_input_is_valid(p_attempt->>'phd_after', 'numeric') then round((p_attempt->>'phd_after')::numeric)::int end,
           coalesce(case when pg_input_is_valid(p_attempt->>'created_at', 'timestamptz') then (p_attempt->>'created_at')::timestamptz end, now())
    where coalesce(p_attempt->>'type', 'attempt') in ('baseline', 'attempt')
      and (p_attempt->>'subject' is null or p_attempt->>'subject' in ('math', 'physics', 'chemistry'));
  end if;
end;
$$;

grant execute on function public.save_progress(jsonb, jsonb) to authenticated;

-- ---- shared concept-guide cache --------------------------------------------
-- /api/learn generates a Socratic guide per concept ONCE, then reuses it for
-- every account (standardized + saves Groq calls). This table is INTERNAL:
-- RLS is enabled with NO policies, so no end user (anon or authenticated) can
-- read or write it. The API route accesses it server-side with the
-- SUPABASE_SERVICE_ROLE_KEY (which bypasses RLS). If that key is unset, caching
-- is simply skipped — the app still works, generating a guide each time.
create table if not exists public.concept_guides (
  subject text not null check (subject in ('math','physics','chemistry')),
  concept_key text not null,             -- normalized: lower(trim(collapse ws))
  concept text not null,                 -- canonical display phrasing
  content jsonb not null,                -- the full normalized guide
  created_at timestamptz not null default now(),
  primary key (subject, concept_key)
);
alter table public.concept_guides enable row level security;
-- (No policies on purpose — service-role-only access. Writes use first-writer-
-- wins: insert ... on conflict do nothing, so a guide is generated once and frozen.)

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
