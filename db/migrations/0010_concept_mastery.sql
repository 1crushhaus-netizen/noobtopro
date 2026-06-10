-- ---------------------------------------------------------------------------
-- 0010 — PER-CONCEPT MASTERY (RANKS_PLAN §12.1, Learn-tab increment 2).
--
-- Adds the per-(user, subject, curriculum-concept) mastery counters behind the
-- Learn tab's green/yellow/red/grey chip coloring:
--   * concept_mastery        — counter rows; SELECT-own under RLS, writes revoked
--                              (the same lock pattern as scores/attempts).
--   * bump_concept_mastery   — service-role-only counter upsert; /api/score calls
--                              it with the SERVER-computed quality after a graded
--                              attempt (the client never supplies quality).
--   * migrate_guest_data     — gains `p_mastery jsonb default null` so a guest's
--                              local mastery map survives first sign-in (same
--                              first-writer-wins, only-into-an-empty-account rule).
--
-- The display STATE is derived in lib/mastery.js (green = ≥2 attempts at quality
-- ≥70, sticky; red = last attempt <40 or skipped; yellow = otherwise practiced).
-- The `>= 70` in bump_concept_mastery mirrors MASTERY_GREEN_QUALITY — keep in sync.
--
-- Idempotent; safe to re-run. Apply AFTER the Learn-curriculum stack ships.
-- ---------------------------------------------------------------------------

-- ---- table -----------------------------------------------------------------
create table if not exists public.concept_mastery (
  user_id     uuid not null references auth.users(id) on delete cascade,
  subject     text not null check (subject in ('math', 'physics', 'chemistry')),
  -- lib/curriculum.js concept key; the server allowlists against the curriculum
  -- before writing, the CHECK only bounds the key space defensively.
  concept_key text not null check (char_length(concept_key) between 1 and 80),
  attempts     int not null default 0 check (attempts >= 0),
  green_hits   int not null default 0 check (green_hits >= 0),
  last_quality int check (last_quality between 0 and 100),
  best_quality int check (best_quality between 0 and 100),
  updated_at  timestamptz not null default now(),
  primary key (user_id, subject, concept_key)
);

-- SELECT-own under RLS (the learner reads their own mastery via PostgREST);
-- ALL writes revoked — only the service-role RPCs below touch it.
alter table public.concept_mastery enable row level security;
drop policy if exists concept_mastery_select_own on public.concept_mastery;
create policy concept_mastery_select_own on public.concept_mastery
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.concept_mastery from public, anon, authenticated;
grant select on public.concept_mastery to authenticated;

-- ---- RPC: service-role-only counter upsert ----------------------------------
-- Called by /api/score (non-blocking, after the attempt persists) with one entry
-- per graded answer: [{ subject, concept_key, quality }]. quality is the server-
-- computed reasoning score. Mirrors lib/mastery.js#applyMasteryAttempt.
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

-- ---- migrate_guest_data: carry the guest mastery map across sign-in ---------
-- New defaulted parameter (p_mastery) — the old 2-arg signature is dropped and the
-- 3-arg one resolves the existing named-param calls ({p_scores, p_attempts}), the
-- same pattern 0007 used for save_progress_for. The body is unchanged except for
-- the appended mastery insert (first-writer-wins; counters clamped; subject
-- allow-listed; green_hits capped at attempts so a forged blob can't pre-bake an
-- impossible record).
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
            from jsonb_each(p_mastery) s, jsonb_each(s.value) c
           where jsonb_typeof(s.value) = 'object') > 768 then
    raise exception 'migration payload too large';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  if exists (select 1 from public.scores where user_id = uid) then
    return false;  -- account already has data; nothing to migrate
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
    cross join lateral jsonb_each(s.value) c
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

revoke all on function public.migrate_guest_data(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.migrate_guest_data(jsonb, jsonb, jsonb) to authenticated;

-- ---- delete_user_data: a reset clears the mastery coloring too ---------------
-- Body identical to schema.sql; re-stated here so the migration leaves the live
-- function matching the canonical DDL.
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
  delete from public.concept_mastery where user_id = uid;  -- a reset clears the chip coloring too
end;
$$;

revoke all on function public.delete_user_data() from public, anon;
grant execute on function public.delete_user_data() to authenticated;
