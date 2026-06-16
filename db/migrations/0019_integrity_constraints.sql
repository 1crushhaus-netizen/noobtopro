-- ---------------------------------------------------------------------------
-- 0019 — DB-level integrity backstops + hot-path indexes (audit P1-1/P1-2/P1-4 + P2s).
--
-- The scoring/ranking invariants were enforced ONLY inside the RPCs. These add
-- database-level CHECKs and indexes so a buggy RPC or a direct service-role write can't
-- silently corrupt rankings, and the leaderboard's hottest filter stops full-scanning.
-- All existing data already complies (the RPCs clamp scores and item_difficulty to
-- [0,350]), so these constraints validate without a data fix.
-- ---------------------------------------------------------------------------

-- P1-1: scores.score is the ranking column; the [0,350] bound lived only in the RPC
-- clamps (save_progress_for / migrate_guest_data). Add a hard backstop.
alter table public.scores
  drop constraint if exists scores_score_range;
alter table public.scores
  add constraint scores_score_range check (score >= 0 and score <= 350);

-- P1-2: item_difficulty.difficulty drives population ranking. bump_item_difficulty already
-- clamps to [0,350] (and the comparison rejects NaN, which sorts above 350), but there was
-- no DB backstop against a direct write.
alter table public.item_difficulty
  drop constraint if exists item_difficulty_range;
alter table public.item_difficulty
  add constraint item_difficulty_range check (difficulty >= 0 and difficulty <= 350);

-- P1-4: leaderboard_tiers() filters on scores.verified on every Profile load; without an
-- index that's a full scan. Partial index on the verified=true rows it actually reads.
create index if not exists scores_verified_idx
  on public.scores (verified) where verified = true;

-- 04 P2 / ties into the webhook cross-account guard (P1-3): one Polar subscription must map
-- to exactly ONE account. A partial UNIQUE index prevents two user rows claiming the same
-- polar_subscription_id (and lets the webhook find "the row for this subscription" by index).
create unique index if not exists subscriptions_polar_subscription_id_uniq
  on public.subscriptions (polar_subscription_id) where polar_subscription_id is not null;

-- Live Supabase advisor (performance): the concept_guides (subject, topic) FK to
-- concept_topics had no covering index. Anonymous browse + FK maintenance both benefit.
create index if not exists concept_guides_subject_topic_idx
  on public.concept_guides (subject, topic);
