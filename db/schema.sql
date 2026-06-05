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
  type text not null,                 -- 'baseline' | 'attempt'
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
         greatest(0, least(100, coalesce((s->>'score')::numeric, 0)))::int,
         coalesce(
           (select array_agg(left(value, 200)) from jsonb_array_elements_text(s->'weak_concepts') as value),
           '{}'::text[]
         ),
         left(coalesce(s->>'comment', ''), 2000),
         now()
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as s
  where s->>'subject' in ('math', 'physics', 'chemistry')
  on conflict (user_id, subject) do nothing;

  insert into public.attempts (user_id, type, subject, reasoning_score, delta, new_score, total_after, phd_after, created_at)
  select uid,
         coalesce(a->>'type', 'attempt'),
         a->>'subject',
         (a->>'reasoning_score')::int,
         (a->>'delta')::int,
         (a->>'new_score')::int,
         (a->>'total_after')::int,
         (a->>'phd_after')::int,
         coalesce((a->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb)) as a
  where a->>'subject' is null or a->>'subject' in ('math', 'physics', 'chemistry');

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
