# Audit 04 — Database / Migrations / RLS / Data Integrity

**Target:** `noobtopro` (Next.js 15 + Supabase Postgres)
**Scope:** `db/schema.sql` (1366 lines) + all `db/migrations/*.sql` (0001a → 0017)
**Date:** 2026-06-16
**Auditor posture:** Adversarial. Assume insecure until proven otherwise.

---

## Verdict (read this first)

This is, frankly, one of the more defensively-written Supabase schemas I have audited. The
server-authoritative scoring model is sound: **every user-data and billing table has RLS
enabled, SELECT is scoped to the owner (`auth.uid() = user_id`), all direct client writes
are revoked at the GRANT layer AND there is no write policy, and every write goes through a
`SECURITY DEFINER` RPC with a pinned `search_path`.** I could not find a cross-user read
hole, a forgeable `user_id` write, a privilege-escalation via mutable `search_path`, or a
broken billing path. There is **no P0**.

That said, the mandate is to be ruthless, and there are real P1/P2 issues: **the absence of
DB-level CHECK constraints on the score/counter columns** (integrity rests entirely on RPC
clamping — a single future direct service-role write or buggy RPC corrupts rankings with no
backstop), **missing indexes on the leaderboard's hot filter (`scores.verified`) and the
public catalog browse**, a **webhook customer→user mapping that trusts a Polar field with
no ownership re-check** (billing-adjacent), and **measurable schema/migration drift**.

I must also flag a **factual error in the audit mandate itself**: there is **no
`verified_leaderboard` view**. Migration `0016` is named `0016_verified_leaderboard.sql` but
it implements verification through the `leaderboard_tiers()` SECURITY DEFINER *function*, not
a view. There is no `CREATE VIEW` anywhere in the repo (verified via grep). The "leaderboard
view leaking PII or being writable" concern is therefore moot — but I analyzed the function
that stands in for it, and it is clean (anonymous aggregates only, service-role-only). See
P2-7.

---

## Summary table

| ID | Sev | Title |
|----|-----|-------|
| P1-1 | P1 | No DB-level CHECK on `scores.score` / counter columns — integrity is RPC-only |
| P1-2 | P1 | No CHECK / NOT NULL backstop on `item_difficulty.difficulty` (rankings driver) |
| P1-3 | P1 | Polar webhook maps `customer.externalId` → user with no ownership re-verification |
| P1-4 | P1 | Missing index on `scores.verified` — leaderboard full-scans on the hottest filter |
| P2-1 | P2 | Migration chain is NOT idempotent end-to-end (0001a/0004 leave function overloads) |
| P2-2 | P2 | Schema/migration drift: `schema.sql` is fresh-provision only; replaying chain diverges |
| P2-3 | P2 | `attempts` has no FK/index parity story; orphan `jti` reuse across resets |
| P2-4 | P2 | No index supporting the public `concept_guides` browse (subject/concept ILIKE + order) |
| P2-5 | P2 | `subscriptions` has no index on `polar_subscription_id` / `polar_customer_id` (reconciliation) |
| P2-6 | P2 | `leaderboard_tiers` recomputes a full distribution per call — no caching / no covering index |
| P2-7 | P2 | `leaderboard_tiers` "above" rank can disagree with band counts for the caller (consistency) |
| P2-8 | P2 | `security_events` / `concept_reports` retain unbounded `detail jsonb` / no TTL prune |
| P2-9 | P2 | `0010` gap + doc drift (`lib/entitlements.js#isActiveSubscription` actually in `proStatus.js`) |
| P2-10 | P2 | `rate_limits` opportunistic prune is clock-sampled (non-deterministic, can starve) |

**Counts:** P0 = 0, P1 = 4, P2 = 10.

---

## The missing `0010` migration — conclusion

**This is an INTENTIONAL, documented renumbering, NOT a lost or never-applied migration. The
schema is in sync with respect to it.**

Evidence (grounded):

- `0011_audit_fix_round_2.sql:20-23` — *"NOTE ON NUMBERING: 0010 is reserved by the (held)
  Learn-curriculum stack (concept_mastery). This migration is INDEPENDENT of 0010 and may be
  applied before it. If 0011 lands first, the stack's 0010 must be rebased…"*
- `0012_concept_mastery.sql:6-8` — *"(Renumbered 0010 → 0012: the audit-fix migration 0011
  landed on live FIRST, so this migration applies on top of it. Two 0011 hardenings are
  FOLDED IN below…)"*

So the original "0010" (concept_mastery / Learn-curriculum stack) was **rebased and shipped
as `0012`** after the audit-fix `0011` landed first on the live DB. `0012`'s body explicitly
re-folds the two `0011` hardenings it would otherwise clobber (the `_valid_glicko` gate in
`migrate_guest_data`, the advisory lock in `delete_user_data`). The `concept_mastery` table
the "0010" stack was supposed to create **does exist** in `schema.sql:124-140` and in
`0012`. **There is no functional gap and no orphaned object.** The skip is a numbering
artifact, not a data-integrity defect.

The only residual risk is *organizational*: a fresh operator running `ls db/migrations` will
see `…0009, 0011, 0012…` and may suspect a lost file. That is a P2 maintainability concern
(see P2-9), not a correctness one.

---

# FINDINGS

## P1 — High

### [P1-1] No database-level CHECK on `scores.score` (and the mastery/attempt counters) — integrity is enforced ONLY in the RPCs
- **File(s):** `db/schema.sql:17-50` (scores DDL); clamps live only in `db/schema.sql:283,575` (`greatest(0, least(350, …))`) and `0015_rescale_0_350.sql:100,215`
- **Category:** Missing CHECK constraint / data integrity (rankings + billing-adjacent)
- **Description:** `scores.score` is `int not null default 0` with **no CHECK** bounding it to `[0, 350]`. The valid range is enforced *exclusively* inside `save_progress_for` and `migrate_guest_data` via `greatest(0, least(350, …))`. Contrast this with `concept_mastery`, which DOES have proper CHECKs (`attempts >= 0`, `last_quality between 0 and 100`, `db/schema.sql:128-131`) — so the pattern is known to the authors and was simply not applied to the single most important integrity column in the system. The leaderboard band cutoffs (`< 70 / < 140 / < 210 / < 280`, `db/schema.sql:1214`) assume `score ∈ [0,350]`; a value outside that range silently lands in band 0 or band 4 and skews the distribution counts every other user sees.
- **Impact:** The clamp is a single point of failure. Any future code path that writes `scores` directly with the service-role key (which **bypasses RLS *and* CHECKs would be the only remaining guard**), any new RPC that forgets the clamp, or any data-migration `UPDATE` (e.g. the `0015` rescale `update public.scores set score = round(score * 3.5)` — which has no clamp and would happily produce 350→1225 on a double-run if its guard were wrong) can write a negative or >350 score with **no backstop**. Corrupt scores propagate into `leaderboard_tiers` band math and `overall = sum/3`, poisoning every user's rank distribution. For a launch where "a bad constraint = corrupt rankings," the *absence* of the obvious constraint is the finding.
- **Recommended fix:** Add `check (score between 0 and 350)` to `scores.score`. Also add `check (server_graded >= 0)` (currently `int not null default 0`, unbounded below — a buggy decrement would make `verified` math nonsensical) and consider `check (reasoning_score is null or reasoning_score between 0 and 100)` etc. on `attempts`. These are belt-and-suspenders to the RPC clamps, exactly as `concept_mastery` already does.

### [P1-2] `item_difficulty.difficulty` (the ranking calibration driver) has no CHECK / range constraint
- **File(s):** `db/schema.sql:1134-1145`; `0004:29-38`; clamp only in `bump_item_difficulty` (`db/schema.sql:1166-1168`, `0015:328-333`)
- **Category:** Missing CHECK constraint / scoring integrity
- **Description:** `difficulty numeric not null` with no CHECK. The `[0,350]` clamp lives only in `bump_item_difficulty`. `numeric` (unbounded precision/scale) is used, so a direct/buggy write could store `1e300`, `NaN` (yes — `numeric` accepts `'NaN'`), or a negative. `attempts bigint` likewise has no `>= 0` CHECK.
- **Impact:** This table is the "opponent rating" the server uses to compute every Elo step (`/api/score`). A poisoned `difficulty` (especially `NaN`, which propagates through arithmetic and comparisons) would corrupt the rating delta for **every learner who practices that (subject, topic, band) bucket** — a platform-wide scoring corruption, not a per-user one, because difficulty is shared population state.
- **Recommended fix:** `check (difficulty >= 0 and difficulty <= 350)` and `check (attempts >= 0)`. Consider a stricter `numeric(6,2)` type to bound precision and reject `NaN` at the type level.

### [P1-3] Polar webhook trusts `customer.externalId` for the user mapping with no ownership re-check
- **File(s):** `app/api/webhooks/polar/route.js:43-49,82-107`; RPC `upsert_subscription` (`db/schema.sql:1324-1366`, `0017:69-112`)
- **Category:** Billing integrity / entitlement forgery (race + trust boundary)
- **Description:** `resolveUserId(sub)` returns `sub.customer.externalId` (or `sub.metadata.user_id` fallback) and passes it straight to `upsert_subscription(p_user => userId, …)`, which writes/overwrites the `subscriptions` row for that `user_id`. The signature check authenticates that *Polar* sent the event, but the **mapping of a Polar subscription to a noobtopro `user_id` is only as trustworthy as whatever set `externalId` at checkout.** The RPC does not verify that the resolved `user_id` is the *same* account that previously owned `polar_subscription_id`, nor that `externalId` is a real `auth.users` row (the only guard is the `user_id` FK to `auth.users` — a non-existent uid would fail the FK and 500→retry forever, but a *valid-but-different* uid would succeed). If the checkout route ever lets a client influence `externalId`/`metadata.user_id` (this audit is DB-scoped; that route was not in scope but is the trust source), one user could be granted/revoked another's Pro by replaying or crafting a checkout. Even absent an attacker: a `subscription.updated` event whose `externalId` differs from the original `subscription.created` would silently move the entitlement to a different account.
- **Impact:** Entitlement misassignment (Pro granted to the wrong account) or entitlement theft, depending on how `externalId` is populated. Billing-grade.
- **Recommended fix:** In `upsert_subscription`, on an `ON CONFLICT` keyed by `polar_subscription_id` (add a UNIQUE index — see P2-5), reject or alarm if the incoming `p_user` differs from the stored row's `user_id`. Better: key the upsert on `polar_subscription_id` and treat `user_id` as immutable-after-first-write, raising on a mismatch so a cross-account move is loud, not silent. **NEEDS VERIFICATION:** confirm the checkout route sets `externalId = JWT-verified auth.uid()` server-side and never from request body.

### [P1-4] No index on `scores.verified` — every leaderboard call full-scans `scores`
- **File(s):** `db/schema.sql:1200-1202` (`where verified = true`), `1233,1243` (`where user_id = p_uid`); table DDL `17-42` defines only the PK `(user_id, subject)`
- **Category:** Missing index on hot filter column (perf / availability)
- **Description:** `leaderboard_tiers` (called by `/api/leaderboard` for every Profile load) runs `select … from public.scores where verified = true` (`schema.sql:1202`) as its distribution base, plus two `where user_id = p_uid` lookups. The **only** index on `scores` is the composite PK `(user_id, subject)`. The `user_id = p_uid` predicate uses the PK prefix (fine), but `where verified = true` has **no supporting index** — it is a full sequential scan of the entire `scores` table on every leaderboard request, then a `union all` + `group by user_id` + per-band `count(*) filter`. At launch scale this is fine; as `scores` grows, the leaderboard becomes an O(rows) scan on the hottest read path, and the `(select count(*) from banded b where b.track = t.track and b.score > m.score)` correlated subquery (`schema.sql:1265`) compounds it.
- **Impact:** Leaderboard latency/cost grows linearly with total users; a hot path with no index ceiling. Not a breach, but a launch-scaling landmine on a "hot query column."
- **Recommended fix:** `create index scores_verified_score_idx on public.scores (verified, subject, score) where verified;` (partial index on the verified subset, covering the band/distribution aggregation). Re-evaluate the correlated `above` subquery against it.

---

## P2 — Medium

### [P2-1] The migration chain is not idempotent / clean-replayable end-to-end (function-overload accretion)
- **File(s):** `0001a:111-112` (own comment admits it), `0004:78-79`, `0007:53-54`, `0009:38-39`
- **Category:** Migration defect / idempotency
- **Description:** Several migrations recreate `save_progress_for` / `migrate_guest_data` with *changing signatures* and rely on a `drop function if exists public.save_progress_for(uuid, jsonb, jsonb)` guard that names only **one** prior overload. `0001a:111-112` explicitly warns: *"re-applying THIS file in ISOLATION on a DB already at 0007 (which replaced this with a 4-arg overload) would still leave two overloads and make /api/score's call ambiguous."* So the files are individually re-runnable only in a narrow sense; replaying the whole chain out of order, or re-running an early file on a later DB, can leave **multiple overloads of the same function**, causing `PGRST203`/ambiguous-function errors at the call site. The authors mitigate by saying "provision fresh DBs from `db/schema.sql`" — which is a process control, not a property of the migrations.
- **Impact:** A real risk during incident recovery / branch rebuilds (Supabase preview branches, `db reset`): the chain does not converge to a single canonical function set unless applied exactly once in exactly this order. Ambiguous-overload errors break the scoring write path.
- **Recommended fix:** At the top of each migration that redefines these functions, `drop function if exists` **all** historical signatures (2-, 3-, 4-, 6-arg) before `create`. Or adopt a tool (sqitch/atlas/supabase migration repair) that tracks applied state instead of "apply in order, once."

### [P2-2] `schema.sql` is a fresh-provision script that can drift from the applied migration chain
- **File(s):** `db/schema.sql:13` ("Apply in order. Safe to re-run (idempotent where practical)"), entire file
- **Category:** Schema/migration drift
- **Description:** `schema.sql` is hand-maintained as the "source of truth" *in parallel* with the delta migrations; each migration header claims "schema.sql is updated in the same commit so live-DB == schema.sql holds." This is a manual invariant with no automated check. I spot-verified several places where they agree (the 6-arg `save_progress_for`, the `0–350` clamps, `subscriptions`, `concept_mastery`), so drift is currently *small* — but it is structurally unguarded. Example of latent drift: `schema.sql:44-50` re-`alter table … add column if not exists` the rubric/glicko/server_graded/verified columns inline *after* the `create table` already defines them — harmless but indicates the file is an accreted paste of migration fragments rather than a normalized DDL, which is exactly how drift creeps in unnoticed.
- **Impact:** A future migration that updates the live DB but not `schema.sql` (or vice-versa) silently breaks the "fresh provision == live" guarantee; a preview branch built from `schema.sql` would then behave differently from prod.
- **Recommended fix:** Add a CI job that provisions a throwaway DB from `schema.sql`, separately applies `migrations/*` to another, and `pg_dump --schema-only` diffs them. Fail the build on any diff. The existing `test/schema-invariants.test.js` is a good hook to extend.

### [P2-3] `attempts.jti` dedupe is per-`(user_id, jti)` but survives a "Reset my progress" reset; orphan/replay window
- **File(s):** `db/schema.sql:81-82` (partial unique `(user_id, jti) where jti is not null`), `delete_user_data` (`schema.sql:470-472`) deletes attempts on reset
- **Category:** Constraint scope / replay integrity (minor)
- **Description:** The replay-dedupe unique index is `(user_id, jti)`. `delete_user_data` deletes all of a user's `attempts` rows, which **removes the jti dedupe history**. A question token (`jti`) that was already scored, then "reset," could be **replayed and re-scored** after the reset because the dedupe row is gone. The token's own server-side TTL (`lib/questionToken.js`, not in DB scope) is the real backstop; if a token outlives a reset, the DB no longer blocks the replay. Also: `jti` is `text` with no length/charset CHECK at the DB level (only `left(…,64)` truncation in the RPC), so two distinct server tokens that share a 64-char prefix would collide into one dedupe slot (unlikely but unconstrained).
- **Impact:** Narrow double-scoring window straddling a progress reset; depends on token TTL vs reset timing. Low likelihood, but it is a real read-modify-write/replay edge the dedupe was meant to close.
- **Recommended fix:** Tie dedupe to something reset-independent, or document that token TTL < reset is a required invariant and assert it. Add `check (char_length(jti) <= 64)` so the truncation can't silently merge tokens.

### [P2-4] No index supporting the public `concept_guides` browse query
- **File(s):** `lib/catalog.js:38-47` (`select … where subject = ? ilike concept … order by subject, concept limit 500`); RLS adds `visibility='public' and status='ready'` (`schema.sql:749-751`); table DDL `727-745` has only PK `(subject, concept_key)`
- **Category:** Missing index (perf) on a public/anon-readable hot path
- **Description:** The Learn-tab browse is an **anonymous, public** query. It filters by `visibility/status` (RLS), optionally `subject`, does an `ilike` substring on `concept`, and `order by subject, concept`. The only index is the PK `(subject, concept_key)` — useless for the `order by concept` and the `ilike` is a guaranteed seq-scan+filter. With the curated catalog being small (36 seed topics + auto-grown hidden rows) it's fine *today*, but this is the one query unauthenticated traffic can hammer.
- **Impact:** Anonymous users can drive repeated full scans of `concept_guides`; a cheap DoS amplifier and a scaling cliff as the catalog grows.
- **Recommended fix:** Add a partial index for the public read shape, e.g. `create index concept_guides_public_browse_idx on public.concept_guides (subject, concept) where visibility='public' and status='ready';`. For the `ilike '%term%'` substring search, a `pg_trgm` GIN index (`gin (concept gin_trgm_ops)`) — the repo already references pg_trgm as a "v1.1 follow-on" (`schema.sql:880`).

### [P2-5] `subscriptions` lacks a UNIQUE index on `polar_subscription_id` (and reconciliation indexes)
- **File(s):** `db/schema.sql:1300-1309` (PK is `user_id` only); `0017:34-49`
- **Category:** Missing UNIQUE/index / billing reconciliation + ties into P1-3
- **Description:** The table is keyed solely on `user_id`. `polar_subscription_id` / `polar_customer_id` are plain nullable text with length CHECKs but **no UNIQUE constraint and no index**. Nothing prevents two different `user_id` rows from claiming the **same** `polar_subscription_id` (a sign of the P1-3 cross-account move), and webhook handlers that need to find "the row for this Polar subscription" can only scan.
- **Impact:** No DB-level guard that one Polar subscription maps to exactly one account; harder/scan-based reconciliation; enables the silent cross-account entitlement move in P1-3.
- **Recommended fix:** `create unique index subscriptions_polar_sub_uidx on public.subscriptions (polar_subscription_id) where polar_subscription_id is not null;` and an index on `polar_customer_id`. Enforce 1:1 subscription↔user.

### [P2-6] `leaderboard_tiers` recomputes the entire cross-user distribution on every call
- **File(s):** `db/schema.sql:1193-1283`
- **Category:** Performance / scalability of a hot SECURITY DEFINER function
- **Description:** Each `/api/leaderboard` call rebuilds `verified_scores → base (union all + group by) → banded → counts (5× count filter) → per_track`, plus the correlated `above` count. It is `stable` (good, but not cached across calls). With P1-4's missing index this is a full scan; even with it, the full distribution is recomputed per request rather than served from a periodically-refreshed aggregate.
- **Impact:** Leaderboard cost scales with users × request rate. Combined with P1-4, the single worst read-path scaling risk.
- **Recommended fix:** Back the distribution with a materialized view or a periodically-refreshed `leaderboard_distribution` table (refresh on a cron or after N writes), and have the RPC read the precomputed bands + compute only the caller's own `you`. This is also the natural home for the "verified leaderboard" the mandate expected as a view.

### [P2-7] `leaderboard_tiers` "you.above" can be inconsistent with "counts" for an unverified caller, and `overall` band is recomputed independently
- **File(s):** `db/schema.sql:1227-1276` (`my_subjects`/`my_overall` read the caller's *unverified* rows; `above` counts over verified `banded`)
- **Category:** Logical consistency (minor scoring correctness)
- **Description:** The caller's `you` block is derived from **all** their rows (verified + unverified, `schema.sql:1233`) while the distribution `counts` and the `above` rank-count are over **verified-only** rows. For a verified caller this is consistent. But the `my_overall` CTE computes `round(sum(score)/3.0)` over the caller's rows independently of how `base`'s `overall` is computed (also `sum/3` — they match by construction, but they are duplicated band-cutoff logic at `1214`, `1231`, `1238-1239`, so a future edit to one and not the others silently desyncs the caller's displayed band from the distribution they're placed in). The verified gate also means `bool_and(verified)` makes `overall` verified only if *all three* subjects are verified — a user verified in 2 of 3 subjects shows provisional overall forever even with hundreds of attempts in two subjects (product decision, but worth flagging as a sharp edge).
- **Impact:** Band-cutoff logic is triplicated; a future rescale that misses one copy desyncs the caller's "you" band from the population bands. The 2-of-3 verification stall is a UX trap.
- **Recommended fix:** Factor the band-cutoff into a single `_band(score int) returns int` immutable helper and call it in all three places. Document/verify the all-subjects-verified rule for `overall` is intended.

### [P2-8] `security_events.detail jsonb` and `concept_reports` have no size cap / retention prune
- **File(s):** `db/schema.sql:918-934` (security_events, `detail jsonb` uncapped), `941-965` (concept_reports)
- **Category:** Unbounded growth / minor integrity
- **Description:** `security_events.detail` is unbounded `jsonb` written by the server admin client; `sample` is "capped" only by convention (no CHECK). `security_events` and `concept_reports` have no TTL/prune (unlike `rate_limits`, which self-prunes). Both are written in response to *abuse* — i.e. precisely when an attacker controls the volume.
- **Impact:** An abuse spike (the thing these tables record) inflates them without bound; no automated cleanup. Slow-burn storage/cost and admin-queue bloat. Not a breach.
- **Recommended fix:** Length-CHECK `sample`; consider a JSON size guard on `detail`; add a retention prune (cron or opportunistic, like `rate_limits`) for dismissed/old rows.

### [P2-9] `0010` numbering gap + a stale code-reference in security-sensitive comments
- **File(s):** `db/migrations/` directory listing; `db/schema.sql:1296` & `lib/entitlements.js` header reference `lib/entitlements.js#isActiveSubscription`
- **Category:** Maintainability / doc drift on security-sensitive code
- **Description:** (1) The `0010` skip is intentional (see the dedicated conclusion above) but undocumented *at the directory level* — there is no `0010_RENUMBERED.md` or placeholder, so it reads as a lost migration until you open `0011`/`0012`. (2) `schema.sql:1296` and the `entitlements.js` header attribute the Pro decision to `lib/entitlements.js#isActiveSubscription`, but that function actually lives in `lib/proStatus.js:28` and is merely *re-exported* by `entitlements.js:24-26`. Minor, but the "is this user Pro" predicate is the billing gate; comments pointing at the wrong file slow incident response.
- **Impact:** Operator confusion during recovery/onboarding; misdirection on the billing-critical predicate.
- **Recommended fix:** Add a one-line note/placeholder for the `0010→0012` renumber in the migrations dir or a `MIGRATIONS.md`. Fix the `#isActiveSubscription` file references to `lib/proStatus.js`.

### [P2-10] `rate_limits` opportunistic prune is clock-millisecond-sampled (non-deterministic; can under-prune)
- **File(s):** `db/schema.sql:1080-1083`; `0003:44-47`
- **Category:** Durable rate-limiter integrity (minor)
- **Description:** The prune fires when `extract(milliseconds from clock_timestamp())::bigint % 50 = 0` — i.e. ~2% of calls, *if* the millisecond value happens to land on a multiple of 50. `extract(milliseconds …)` returns seconds×1000+ms as a numeric; the modulo behavior depends on sub-second timing and is not a clean 1/50 sampler. Under low traffic the prune may rarely fire, letting expired rows accumulate; under a burst all concurrent lambdas can sample the same window and either all-prune (lock contention on `delete … limit 200`) or all-skip. Live buckets are never touched (good), and the limiter's *correctness* (the `on conflict do update` fixed-window counter) is sound and race-safe — this is purely about table bloat housekeeping.
- **Impact:** `rate_limits` can grow unbounded under traffic patterns that never hit the sampler; no functional limiter failure, just storage/scan cost.
- **Recommended fix:** Drive the prune from a deterministic source (a real cron via `pg_cron`, or `random() < 0.02`), and/or add a partial index `(reset_at) where reset_at < now()` to keep the prune cheap.

---

## Things I checked and found CLEAN (no false comfort — these were genuine attack targets)

- **RLS coverage:** every user-data/billing table has `enable row level security` — `scores` (151), `attempts` (152), `attempt_reviews` (107), `concept_mastery` (135), `concept_reports` (952), `subscriptions` (1313), plus internal tables `security_events` (932), `rate_limits` (1048), `item_difficulty` (1144). No user-data table with RLS off.
- **No forgeable `user_id`:** all SELECT policies are `(select auth.uid()) = user_id` (read-own). There is **no INSERT/UPDATE policy on any user table** — writes are impossible via PostgREST regardless of payload, and direct DML grants are revoked from `anon`/`authenticated` (`176-177`, `113`, `139-140`, `957`, `1317`). A signed-in user cannot PATCH their own (or anyone's) score/subscription. Verified the `migrate_guest_data` path captures `auth.uid()` internally (`schema.sql:251`) and never trusts a client-supplied uid.
- **SECURITY DEFINER + search_path:** **every** `security definer` function pins `set search_path = public` (or `''` for `_concept_key`, even stricter). No mutable-search_path privilege-escalation vector found. Verified across all of: `migrate_guest_data`, `save_progress_for`, `delete_user_data`, `bump_concept_mastery`, `submit_concept_report`, `rate_limit_hit/refund`, `bump_item_difficulty`, `leaderboard_tiers`, `upsert_subscription`, the concept-guide RPCs.
- **GRANTs:** `save_progress_for`, `bump_concept_mastery`, `upsert_subscription`, `leaderboard_tiers`, `rate_limit_*`, `bump_item_difficulty`, `seed/promote/refresh/dedupe` guide RPCs are all `revoke all from public, anon, authenticated` then `grant execute … to service_role` only. The two authenticated-callable RPCs (`migrate_guest_data`, `delete_user_data`, `submit_concept_report`) are self-scoped via `auth.uid()` and rate/size-bounded. No over-broad grant found.
- **Leaderboard does NOT leak PII:** `leaderboard_tiers` returns only anonymous aggregate band counts + the caller's own band/score. No `user_id`, name, or email in the output. It is a service-role-only function (not a writable/anon-readable view). The mandate's "writable leaderboard view" risk does not exist here.
- **Concept hub public read:** RLS scopes the public read to `visibility='public' and status='ready'` (`749-751`); auto-grown guides are forced `visibility='hidden'` (`promote_or_insert_guide`, `807`), and `0008` fixed the one prior spot that defaulted grader stubs to `public`. No PII column on this public table; the schema explicitly warns against adding one (`669-671`).
- **Subscriptions write path:** service-role-only `upsert_subscription`, signature-verified webhook, raw-status-stored-not-CHECK-enum (deliberate, well-reasoned, `0017:17-23`), `current_period_end` belt-and-suspenders in the predicate. The only real concern is the user-mapping trust (P1-3), not the storage model.
- **Atomicity / races:** per-user `pg_advisory_xact_lock(hashtextextended(uid,0))` serializes `save_progress_for` vs `delete_user_data` vs migrate; `submit_concept_report` uses lock slot `1`; optimistic-concurrency (`p_check_conflict`/`IS DISTINCT FROM`) handles the route-level read-grade-write window; `jti` partial-unique backs replay dedupe even if a caller skips the check; `bump_item_difficulty` deltas are commutative (no lock needed, correctly reasoned). `rate_limit_hit` is a single-statement atomic upsert. The concurrency engineering here is genuinely good.
- **FKs / ON DELETE:** `scores`, `attempts`, `attempt_reviews`, `concept_mastery`, `concept_reports`, `subscriptions` all FK `auth.users … on delete cascade`; `attempt_reviews → attempts on delete cascade`; `concept_guides (subject,topic) → concept_topics(subject,slug)`; `item_difficulty (subject,topic) → concept_topics`. No orphan-producing gaps found. (`subscriptions` is deliberately *not* deleted by `delete_user_data` — documented and correct: wiping progress ≠ canceling billing.)
- **Numeric overflow:** all int columns are clamped to int4 range in the RPCs (`greatest(-2147483648, least(2147483647, …))`); `attempts`/`item_difficulty.attempts` are `bigint`. No realistic overflow. (The missing CHECKs in P1-1/P1-2 are about *semantic* range, not int overflow.)
