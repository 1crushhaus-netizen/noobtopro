-- ===========================================================================
-- Migration 0001 — server-authoritative scoring + per-subject reasoning rubric
--
-- DELTA migration: brings a live database that ALREADY has the PR #29–#32 schema
-- (concept hub, diagnostic pool, admin tables) up to the server-authoritative-scoring
-- state. It does NOT (re)create those objects — to provision a FRESH database, run the
-- canonical db/schema.sql, not this file. Apply in ONE transaction (the Supabase SQL
-- editor / connector wraps it). Idempotent: safe to re-run.
--
-- Rollback (if needed before the new client ships): recreate the client-callable
-- save_progress(jsonb,jsonb) from git history, restore the "own scores"/"own attempts"
-- for-all policies, and re-grant insert/update/delete to authenticated. Easier: revert
-- the deploy. (No data migration is involved, so rollback is policy/function-only.)
--
-- DEPLOY ORDERING — this migration is BREAKING for the OLD client:
--   The OLD deployed client writes scores/attempts via the client-callable
--   save_progress RPC + own-row RLS. This migration removes both. Apply it
--   TOGETHER WITH (or immediately before) deploying the new client that routes
--   signed-in writes through /api/score. Between the two, signed-in users cannot
--   save progress (reads + guest mode are unaffected). For a prototype with no
--   live data this window is harmless; sequence it for any real traffic.
-- ===========================================================================

begin;

-- 1) Per-subject reasoning rubric column (additive, safe for the old client). -----
alter table public.scores add column if not exists rubric jsonb;

-- 2) Convert the self-scoped client RPCs to SECURITY DEFINER so they can still
--    write once the tables go SELECT-only (step 4). They capture auth.uid() and
--    only touch the caller's own rows, so authenticated callers stay self-scoped. --
--    (Re-running the full bodies from schema.sql keeps this file self-contained.)
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
    return false;
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
revoke all on function public.migrate_guest_data(jsonb, jsonb) from public, anon;
grant execute on function public.migrate_guest_data(jsonb, jsonb) to authenticated;

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

-- 3) Server-authoritative save RPC (service-role only); drop the client-callable one.
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

-- 4) Lock scores/attempts to SELECT-only for authenticated (no direct client writes).
drop policy if exists "own scores" on public.scores;
drop policy if exists "read own scores" on public.scores;
create policy "read own scores"
  on public.scores for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own attempts" on public.attempts;
drop policy if exists "read own attempts" on public.attempts;
create policy "read own attempts"
  on public.attempts for select to authenticated
  using ((select auth.uid()) = user_id);

-- 5) Defense-in-depth: revoke default client write grants (SELECT stays, RLS-gated).
--    The DEFINER write functions (save_progress_for/migrate_guest_data/delete_user_data)
--    bypass these grants, so the app keeps working.
revoke insert, update, delete, truncate on public.scores   from anon, authenticated;
revoke insert, update, delete, truncate on public.attempts from anon, authenticated;

commit;
