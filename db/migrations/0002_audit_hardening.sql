-- ===========================================================================
-- Migration 0002 — audit hardening (fleet-audit follow-ups)
--
-- DELTA migration vs a live DB already at the 0001a+0001b state. All changes are
-- additive/backward-compatible (no client-visible breakage). Idempotent; apply in
-- one transaction. db/schema.sql is the canonical final state.
--
-- Contents:
--   1. save_progress_for: add a per-user advisory lock (serialize same-user writes
--      so a concurrent practice/diagnostic can't lose an update or mix state).
--   2. concept_guides.topic: restore the 'general_math' default (live drifted to none).
--   3. concept_reports: one-open-report-per-user unique index (anti-flooding).
--   4. GRANT-layer hardening: revoke default client DML on the 5 concept-hub/internal
--      tables (mirrors scores/attempts), keeping public SELECT + authenticated report
--      INSERT.
-- ===========================================================================

begin;

-- 1) Per-user advisory lock in the server-authoritative save RPC.
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

  -- Serialize concurrent writes for the SAME user so a read-modify-write blend can't
  -- lose an update or interleave into a mixed state. Transaction-scoped.
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

-- 2) Restore the topic default (drifted to none on the live DB).
alter table public.concept_guides alter column topic set default 'general_math';

-- 3) One OPEN report per user per guide (anti-flooding).
create unique index if not exists concept_reports_one_open_per_user
  on public.concept_reports (reporter_id, subject, concept_key)
  where status = 'open';

-- 4) GRANT-layer hardening on the concept-hub / internal tables.
revoke insert, update, delete, truncate on public.diagnostic_pool, public.security_events from anon, authenticated;
revoke insert, update, delete, truncate on public.concept_guides, public.concept_topics from anon, authenticated;
revoke update, delete, truncate on public.concept_reports from anon, authenticated;
revoke insert on public.concept_reports from anon;

commit;
