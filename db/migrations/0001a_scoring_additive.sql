-- ===========================================================================
-- Migration 0001a — server-authoritative scoring: ADDITIVE phase
--
-- Apply this BEFORE (or as part of) deploying the new client. It is 100%
-- BACKWARD-COMPATIBLE with the OLD deployed client: it only ADDS things
--   - the scores.rubric column (old client ignores it),
--   - the service-role-only save_progress_for() RPC (unused until the new client),
--   - and converts migrate_guest_data/delete_user_data to SECURITY DEFINER
--     (still self-scoped to auth.uid(); they keep working for the old client).
-- It does NOT drop save_progress or change RLS, so the old client keeps saving.
-- After the new client is live, apply 0001b_scoring_lockdown.sql to close the
-- self-assert gap. Idempotent: safe to re-run. (Pairs with db/schema.sql, the
-- canonical fresh-provision script.)
-- ===========================================================================

begin;

-- 1) Per-subject reasoning rubric column (additive).
alter table public.scores add column if not exists rubric jsonb;

-- 2) Convert the self-scoped client RPCs to SECURITY DEFINER so they keep working
--    once the tables go SELECT-only (0001b). They capture auth.uid() and only touch
--    the caller's own rows, so authenticated callers stay self-scoped.
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

-- 3) Server-authoritative save RPC (service-role only). CREATE only — the old
--    client-callable save_progress() is left in place until 0001b, so the old
--    client keeps saving during the deploy.
-- Apply ONCE, in order (this is a delta migration). Drop any prior overload first so an
-- in-order replay rebuilds cleanly; note that re-applying THIS file in ISOLATION on a DB
-- already at 0007 (which replaced this with a 4-arg overload) would still leave two
-- overloads and make /api/score's call ambiguous — provision fresh DBs from db/schema.sql.
drop function if exists public.save_progress_for(uuid, jsonb, jsonb);
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

commit;
