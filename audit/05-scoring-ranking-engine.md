# Audit 05 — Scoring & Ranking Engine (Adversarial)

**Scope:** `lib/scoring.js`, `lib/mastery.js`, `lib/promotion.js`, `lib/numericVerify.js`, `lib/preGrade.js`, `app/api/score/route.js`, `app/api/grade/route.js`, `app/api/leaderboard/route.js`, the Glicko/Elo/rescale/leaderboard/mastery migrations (0004, 0009, 0011, 0012, 0015, 0016), the question-token trust boundary (`lib/questionToken.js`), the diagnostic bank routing (`lib/diagnosticBank.js`), and the guest scoring path (`components/Noobtopro.jsx`).

**Auditor stance:** assume exploitable + wrong until proven otherwise.

**Bottom line:** The trust boundary is genuinely strong. For signed-in users the server independently grades, computes the rating from server-stored Glicko state, binds every rating-relevant field to an HMAC-signed question token, dedupes via `jti`, uses optimistic concurrency, and excludes laundered guest scores from the leaderboard until 5 server-graded attempts ("verified"). The Glicko-2 math is numerically robust (no NaN/Infinity reachable for any input I could construct; everything clamps). **However, there is one real, confirmed rank-inflation vector: acing easy questions pays positive rating forever**, so a learner who only ever demonstrates beginner-level competence can grind their way to University rank and beyond. The anti-farm damper slows this but does not stop it and is trivially bypassed by rotating topics. There are also several P2 precision/staleness/documentation issues.

---

## Summary table

| ID | Sev | Title | File(s) |
|----|-----|-------|---------|
| P1-1 | P1 | Easy-question farming: acing the easiest band pays positive rating without bound (anti-farm damper only slows, and is topic-rotation-bypassable) | `lib/scoring.js:639,793-803,895-906`; `app/api/generate/route.js:233-237`; `app/api/score/route.js:381-384` |
| P1-2 | P1 | Verification threshold counts diagnostic-derived rank: 5 trivial graded attempts "verify" a (capped-290) baseline that itself never needed real difficulty | `db/migrations/0016_verified_leaderboard.sql:278-313`; `app/api/score/route.js:941-946` |
| P1-3 | P1 | `looksLikeGibberish`/dock bypass: any single digit or math operator disables the entire dock, so trivial low-effort spam reaches the grader and is graded normally | `lib/preGrade.js:36,62-68,108-119` |
| P2-1 | P2 | Stale/incorrect anti-gaming comments vs. actual constants (`DIAGNOSTIC_FULL_WEIGHT`=455 not 130; "beginner 10/intermediate 50/advanced 70" but anchors are 35/175/245) | `lib/scoring.js:304,324-327,338-342,472-478` |
| P2-2 | P2 | Two divergent diagnostic-anchor weighting schemes documented; `diagnosticSubjectScore` floor far stronger than its own comment claims (untested edge) | `lib/scoring.js:347-362` |
| P2-3 | P2 | `blend()` returns a wrong value for `NaN`/`Infinity` prev (treats it as 0, not "no prev"), inconsistent with its own contract — dead path today but a latent trap | `lib/scoring.js:221-241` |
| P2-4 | P2 | Glicko display squash saturates: ratings far apart map to the same 0–350 score; round-trip `ratingFromScore(350)` ≠ band, so a "350" can re-seed at a rating that re-derives below 350 | `lib/scoring.js:645-674` |
| P2-5 | P2 | Diagnostic step tokens have no `jti` dedupe and a 6h TTL; a guest can re-walk/parallelize steps freely (acknowledged, but the per-IP/account caps are the only real bound) | `lib/questionToken.js:131-170`; `app/api/score/route.js:671-838` |
| P2-6 | P2 | `_valid_glicko` admits ratings up to 5500 (→ subject score 350) for migrated guest blobs; only the "verified" gate, not validation, stops a laundered max rating from being visible | `db/migrations/0011_audit_fix_round_2.sql:226-235`; `db/migrations/0016_verified_leaderboard.sql:38-52` |
| P2-7 | P2 | `item_difficulty` calibration uses one global bucket per (subject,topic,band) with no min-attempts floor — a single user can drag a shared bucket's difficulty before the population corrects it | `app/api/score/route.js:587-590`; `lib/scoring.js:1000-1004`; `db/migrations/0004:46-68` |
| P2-8 | P2 | Test coverage gap: "repeated easy aces asymptote" only checks one point (n=40 < 280); no test asserts a true upper bound, so P1-1 slipped through | `test/scoring-glicko.test.js:61-65` |

---

## P0 — Launch blockers

**None found.** The most-feared P0 classes were checked and are genuinely closed:

- **Server does NOT trust a client-asserted score/correctness/difficulty for signed-in users.** `/api/score` practice reads the prior rating from `scores.glicko` server-side (`route.js:508-521`), grades via Groq, and computes the new score from the rubric the grader emits — never from the request body. Subject, question text, band, topic, surface, trap, and conceptKey all come from the HMAC-signed token (`questionToken.js`, `route.js:248-318`), not the client. The pre-deploy "loose body" shape is explicitly rejected (`route.js:242-247`).
- **No client `score`/`reasoningScore`/`rubric` is accepted on the rated path.** `/api/grade` (the GUEST path) *does* return a model-derived score the client trusts, but guest scores are client-side by design and are quarantined: migrated guest scores land `verified=false`, are excluded from the leaderboard, and have their Glicko RD reset (`0016:92-117`).
- **Double-count / replay is closed.** `jti` dedupe under an advisory lock + a partial unique index (`0011:35-37`, `0016:246-252`), plus a cheap pre-grade dup check (`route.js:332-340`), plus optimistic-concurrency conflict retry (`0016:260-269`, `route.js:500-575`).
- **Glicko/Elo math does not produce NaN/garbage for normal use.** Verified empirically: 50 consecutive wins/losses, NaN/Infinity opponents, `prev=NaN`, out-of-range inputs — all clamp, none NaN (`scoring.js:720-803`, `662-664`, `598-609`).
- **Leaderboard is not directly fakeable.** It is an anonymous aggregate over `verified=true` rows only, computed by a service-role RPC keyed on the JWT-verified uid (`leaderboard/route.js`, `0016:372-462`).

The findings below are real but bounded — hence P1/P2, not P0.

---

## P1 — High

### [P1-1] Easy-question farming: acing the easiest band pays positive rating without bound
- **File(s):** `lib/scoring.js:639` (`E_HI = 1 - 1e-6`), `lib/scoring.js:793-803` (`updateAxisGlicko`), `lib/scoring.js:895-906` (`updateAxisRatings`); `app/api/generate/route.js:233-237` (concept drills emit `beginner`/`foundational` bands); `app/api/score/route.js:381-384` (band clamp caps only the UPPER band)
- **Category:** Rank inflation / Elo-math design flaw / farming
- **Description:** In Glicko, the expected score `E` is clamped to `E_HI = 1 - 1e-6` (line 639) so it can never equal a perfect rubric outcome of exactly `1.0`. Therefore for ANY question, no matter how far below the learner's rating, `outcome - E ≈ 1e-6 > 0`, and every perfect answer produces a small but strictly positive rating step. Compounded, this lets a learner who only ever answers the EASIEST band perfectly climb arbitrarily high. Measured directly:
  - 40 perfect beginner (anchor 35) aces, **no damping** → score **211 (University)**; 200 aces → **278**.
  - 400 perfect beginner aces under **maximum anti-farm damping (repeatFactor floor 0.2)** → score **226 (University)**, still climbing monotonically.
  - Even at score 278, acing a single beginner item still yields **+1** (`expected 0.998`, outcome `1.0`).

  The anti-farm `repeatFactor` (`scoring.js:801`) damps only POSITIVE steps and only when the same `(topic, band)` recurs within the last 20 attempts (`repeatFactorFromRecent`, `scoring.js:990-994`). It is bypassed entirely by rotating topics — and beginner-level concept drills naturally span many topics. The server band-clamp (`route.js:381-384`) caps the question at ≤1 band ABOVE the learner's level but places NO floor, so a high-rated learner can always request and ace beginner concept drills.
- **Impact:** The core product promise ("noob to pro" = rank reflects demonstrated ability) is violated. A user who has only ever shown beginner competence can reach University on the leaderboard purely by volume on trivial items. With the free daily cap (5/day) this is slow for free users, but a Pro user (unlimited graded practice) can farm to University in a few hundred trivial submissions, and the per-account cap is 45/window. The leaderboard's `verified` gate does NOT help — these ARE server-graded attempts.
- **Recommended fix:** Make winning a far-below-level item yield ≈0, not a tiny positive. Options: (1) before computing the step, attenuate the positive rating gain by `max(0, expected_margin)` so a question rated well below the learner contributes ~0 (e.g. multiply the positive step by `(1 - expectedAgg)` where `expectedAgg = eloExpected(prevScore, difficulty)`); (2) clamp the per-attempt positive step to 0 when the item rating is more than ~1 band below the learner; (3) raise the anti-farm damper to apply across `(band)` regardless of topic for at-or-below-level items, with a much lower floor for below-level wins. Add a test that hundreds of easy aces converge to a bounded ceiling at most ~1 band above the item's band.

### [P1-2] "Verified" rank is unlocked by 5 trivial attempts on top of a diagnostic baseline
- **File(s):** `db/migrations/0016_verified_leaderboard.sql:278-313` (verification = `server_graded >= 5`, baselines excluded), `app/api/score/route.js:941-946` (baseline persist), `lib/scoring.js:938-971` (`diagnosticSeedFromReasoning`, ceiling 290)
- **Category:** Weak verification / leaderboard integrity
- **Description:** The diagnostic baseline can place a learner up to `DIAG_PLACEMENT_CEILING = 290` (low Doctorate) on the 0–350 scale (`scoring.js:953`). The baseline is server-graded and signed-chain-bound, so the placement itself is legitimate. But verification ("appears on the leaderboard") then requires only 5 `type:'attempt'` practice grades (`0016:278-313`). Combined with P1-1, those 5 attempts can be 5 trivial beginner aces. So the path to a leaderboard-visible University+ rank is: one diagnostic sitting (capped at 290) + 5 easy aces — with NO requirement that any of the 5 be at the learner's claimed level. The "verified" badge thus certifies "5 graded attempts happened", not "5 at-level attempts confirmed the placement".
- **Impact:** The verification gate is marketed/coded as the anti-laundering defense (`0016` header), but it does not constrain the DIFFICULTY of the 5 attempts, so it doesn't actually confirm the placement. A high baseline + 5 trivial attempts = a verified high rank not backed by at-level evidence.
- **Recommended fix:** Require the verifying attempts to be at-or-near the learner's band (e.g. count only attempts whose clamped `bandKey` is within 1 band of the score-derived band toward verification), or require RD to drop below a threshold (Glicko already tracks confidence) before flipping `verified`. Pair with P1-1's fix so the 5 attempts can't themselves inflate.

### [P1-3] Pre-grade dock is disabled by a single digit or operator — low-effort spam is graded normally
- **File(s):** `lib/preGrade.js:36` (`HAS_MATH_OP`), `lib/preGrade.js:62-68` (gibberish escape), `lib/preGrade.js:108-119` (too-short escape)
- **Category:** Anti-gaming weakness (bounded)
- **Description:** Both the "too short / off-topic" branch (`preGrade.js:111-114`) and `looksLikeGibberish` (`preGrade.js:68`) bail out the instant the raw text contains any digit or any of `= + - * / ^ √ ∫ ∑ ∂ π Δ < > %` (or "mol"/"mole"). So `"1"`, `"x=1"`, `">"`, `"5%"`, `"a+b"`, `"0 mol"` all skip the dock and go to the paid LLM grader. The dock's stated job is to FORCE a low outcome on non-substantive answers so spamming blanks costs rating; this escape means the cheapest gaming input (one operator) sidesteps the deterministic low-outcome path and instead relies entirely on the LLM grader to score it low.
- **Impact:** Bounded — the LLM grader should still score `"x=1"` near zero, and the rubric-weighted-mean headline can't be high for an empty rubric. But it (a) burns a Groq call the dock was meant to save, and (b) removes the deterministic floor, so the outcome now depends on grader behavior on adversarial trivial input (which is exactly where graders are least reliable). It also weakens the "blank/idk costs rating" guarantee for near-blank inputs.
- **Recommended fix:** Only treat digits/operators as substantive when accompanied by enough surrounding content (e.g. require ≥N non-operator word characters, or a minimum total length, before the digit/operator escape applies). Keep docking a bare `"1"` / `">"` / `"5%"`.

---

## P2 — Medium

### [P2-1] Stale/incorrect anti-gaming comments vs. actual constants
- **File(s):** `lib/scoring.js:304` ("beginner 10 / intermediate 50 / advanced 70"), `:324-327` (`DIAGNOSTIC_FULL_WEIGHT` comment says "= 130"), `:338-342`, `:472-478` ("foundational 30 / intermediate 50 / advanced 70 ≈ 3:5:7")
- **Category:** Documentation / maintainability (correctness risk on future edits)
- **Description:** Multiple comments describe diagnostic difficulty weights that do not match `DIFFICULTY_ANCHORS` (beginner 35, intermediate 175, advanced 245). `DIAGNOSTIC_FULL_WEIGHT` is actually `35+175+245 = 455`, not the "130" the comment claims. The ratio is ~1:5:7, not "3:5:7". The behavior is internally consistent (anchors are the single source), but every comment reasoning about anti-gaming magnitudes is wrong, which is dangerous: a future maintainer "fixing" the floor based on the comment would re-open a gaming hole.
- **Impact:** No live bug; high risk of a future regression because the documented invariants are false.
- **Recommended fix:** Update the comments to reflect the 0–350-scale anchors, or derive the comment numbers from the constants. Add a CI assertion pinning `DIAGNOSTIC_FULL_WEIGHT`.

### [P2-2] `diagnosticSubjectScore` floor is far stronger than its comment, and the divisor semantics are subtle
- **File(s):** `lib/scoring.js:347-362`
- **Category:** Precision / unclear logic / missing tests
- **Description:** The comment (`:340-342`) claims "a single aced easy answer would score 100 (30·100/30)" without the floor. With the real anchors, a beginner-only aced submission scores **8** (`35·100 / 455`), and advanced-only aced scores **54**. The anti-gaming floor is therefore MUCH more aggressive than documented (a legitimate partial diagnostic is heavily penalized). This is safe against inflation but may unfairly deflate a learner who legitimately only completed some tiers (e.g. a network failure mid-diagnostic). The behavior is correct for the adversarial case but the asymmetry is undocumented and untested at the boundary.
- **Impact:** A learner whose diagnostic is truncated gets placed far below their demonstrated level; no test covers single-tier or two-tier truncation values.
- **Recommended fix:** Document the real values; add boundary tests for 1-tier and 2-tier submissions; consider whether the adaptive (path-weighted, no-floor) path should be the only diagnostic and `diagnosticSubjectScore` retired.

### [P2-3] `blend()` mishandles `NaN`/`Infinity` prev
- **File(s):** `lib/scoring.js:221-241`
- **Category:** Edge-case math
- **Description:** `blend(NaN, 90)` returns **31**, not 90. Because `typeof NaN === "number"` is true, the `typeof prevNum !== "number"` no-prev branch (`:225`) is skipped; `p` is then clamped to 0 (`:230`), and the legacy path returns `round(0·0.65 + 90·0.35) = 31`. Same for `Infinity`. The JSDoc says a non-number prev "means no previous score and seeds from the suggestion" — but `NaN`/`Infinity` ARE numbers and get treated as 0, contradicting the contract. `blend()` is NOT on any live scoring path today (grep shows only tests reference it; the unified Glicko engine replaced it), so this is latent.
- **Impact:** None live (dead code). A future reuse of `blend()` would silently anchor garbage prev to 0 and drag scores down.
- **Recommended fix:** Guard `Number.isFinite(prevNum)` for the no-prev decision, or delete `blend()` if it is truly dead (and its tests).

### [P2-4] Display squash saturation breaks the score↔rating round-trip near the ends
- **File(s):** `lib/scoring.js:645-674` (`RATING_BOUND`, `scoreFromRating`, `ratingFromScore`)
- **Category:** Float precision / rescale clamping
- **Description:** `scoreFromRating` is a logistic squash, so distinct high ratings collapse to the same display score: `scoreFromRating(5500) = scoreFromRating(100000) = 350`. Conversely `ratingFromScore(350) = 5299` but `ratingFromScore(349) = 3110` — a ~2200-rating gap between adjacent display scores at the top. Re-seeding a user from a stored display score of 350 (`seedGlickoFromRubric(null, 350)`) lands them at rating 5299, which `scoreFromRating` maps back to 350, so it round-trips at exactly 350 but the band is razor-thin: any tiny negative step drops them many display points. Continuity tests (`scoring-glicko.test.js:103-131`) check mid-range round-trips, not the saturated extremes.
- **Impact:** Cosmetic instability at the very top (a Doctorate user can see a large display drop from one slightly-imperfect answer); no integrity bug.
- **Recommended fix:** Document the saturation; if smooth top-end movement matters, widen `DISPLAY_D` or cap the seed rating below `RATING_HI` with margin. Add extreme-end round-trip tests.

### [P2-5] Diagnostic step tokens: no `jti` dedupe, 6h TTL, parallelizable
- **File(s):** `lib/questionToken.js:131-170`; `app/api/score/route.js:671-838`
- **Category:** Replay / determinism (acknowledged)
- **Description:** Diagnostic step/finalize tokens carry a `jti` but it is never enforced (comment at `questionToken.js:123-126` acknowledges this). Replaying a step re-grades the same item; the only persistence is at finalize, which is an idempotent baseline upsert. So a guest can fork the walk at any step, grade many variants, and finalize the best-scoring path — the placement is "best of many tries" rather than "one cold sitting". Bounded only by the per-IP `:diag` (40/min) and per-account (60) caps.
- **Impact:** A motivated user can inflate their diagnostic BASELINE up to the 290 ceiling by retrying steps and finalizing the best chain. Since the baseline is excluded from verification (P1-2) this doesn't directly leaderboard-launder, but it sets a high starting score and feeds P1-1.
- **Recommended fix:** Bind the walk to a single signed session id and reject finalize unless the three chains share it and were issued in order; or record consumed step `jti`s for signed-in users. At minimum, document that the diagnostic is "best-effort placement, not anti-gamed" and rely on practice to correct it.

### [P2-6] `_valid_glicko` admits a laundered max rating (5500 → score 350)
- **File(s):** `db/migrations/0011_audit_fix_round_2.sql:226-235`; `db/migrations/0016_verified_leaderboard.sql:38-52` (`_reset_glicko_rd`)
- **Category:** Client-trusted input (bounded by verification)
- **Description:** A migrated guest glicko blob passes `_valid_glicko` if every axis rating is in `[-2500, 5500]`. `subjectScoreFromGlicko` of an all-axis-5500 blob = **350**. So a hand-edited localStorage blob CAN import a maxed rating into `scores.glicko`/`scores.score`. The only thing stopping leaderboard abuse is `verified=false` on migration (`0016:112-117`) plus the RD reset to 350 (`0016:38-52`) so subsequent server-graded attempts can correct it. The user still SEES the laundered 350 (provisional), and it's only corrected over 5 attempts.
- **Impact:** Self-displayed (provisional) rank can be faked to 350; not leaderboard-visible until 5 verified attempts, by which point RD-reset + real grading pulls it toward truth. So bounded — but a screenshot of "Doctorate 350 (provisional)" is trivially forgeable.
- **Recommended fix:** Tighten `_valid_glicko`'s rating band to the realistic engine range used by honest play, or clamp the migrated subject `score` to a low ceiling until verified (mirror the RD reset). Don't display a provisional score above, say, the diagnostic ceiling.

### [P2-7] Shared `item_difficulty` bucket has no min-attempt floor before it's trusted
- **File(s):** `app/api/score/route.js:387-391,587-590`; `lib/scoring.js:1000-1004` (`itemDifficultyDelta`); `db/migrations/0004:46-68` / `0015:316-338` (`bump_item_difficulty`)
- **Category:** Calibration poisoning (bounded)
- **Description:** The per-`(subject, topic, band)` difficulty is a single global value nudged by `ELO_K_DIFFICULTY = 4` per attempt with no floor on contributing attempts. The first user to hit a fresh bucket moves it by up to ±4 immediately and it's used as the opponent rating for the next user. A user over-performing drives the bucket DOWN (item rated easier), which then makes that item give EVERYONE less rating — or, gamed the other way, repeatedly under-performing then the attacker (or colluders) drives it up. Because the band-clamp limits which buckets a user faces, and `k` is small, the effect is slow, but there is no `attempts >= N` gate before the calibrated value supersedes the band anchor.
- **Impact:** A learner can nudge a shared item's difficulty, very slightly affecting other learners' rating gains on that bucket. Low magnitude per attempt; cumulative under sustained abuse.
- **Recommended fix:** Only use the calibrated `difficulty` once `item_difficulty.attempts >= N` (e.g. 20); below that, use the band anchor. Bound the per-attempt nudge and consider per-user contribution caps.

### [P2-8] Test gap let P1-1 through: "asymptote" test checks one point, not a bound
- **File(s):** `test/scoring-glicko.test.js:61-65`
- **Category:** Missing edge-case test
- **Description:** The test named "repeated easy aces asymptote well below the max" only asserts `subjectScoreFromGlicko < 280` after exactly 40 aces with no damping. It does not assert convergence or any true upper bound, so the unbounded climb (P1-1) — University+ over hundreds of attempts — is invisible to CI. The anti-farm tests likewise only check `repeatFactor` arithmetic and a single first-vs-repeated comparison, never a long farm.
- **Impact:** The headline anti-gaming property is asserted by a test that does not actually test it.
- **Recommended fix:** After the P1-1 fix, add a test that N (e.g. 500) easy aces converge to a ceiling ≤ ~1 band above the item band, both with and without the repeat damper, and across rotated topics.

---

## Areas checked and found SOUND (no finding)

- **Glicko-2 volatility update** (Illinois/regula-falsi, `scoring.js:754-787`): bracketing, convergence cap (100 iters), `VOL_CAP`, and `vInv > 0` guard are all correct; no division by zero, `newVol` falls back to `sigma` if non-finite.
- **`clampScore`/`clampSubjectScore`/`coerceRubric`** correctly distinguish "no signal" (null) from a real zero (`scoring.js:98-115`, `416-455`) — prototype-safe (`hasOwnProperty`), so `__proto__`/`constructor` rubric keys can't leak.
- **`scoreFromRubric`** is a transparent weighted mean with a constant positive denominator; all-4 → exactly 100; never NaN (`scoring.js:1043-1052`).
- **`save_progress_for`** idempotency: advisory lock + `jti` dedupe + partial unique index + optimistic-concurrency conflict (`0016:240-269`). All-or-nothing (raises, not silent WHERE-drop). Verified.
- **Leaderboard**: anonymous aggregate, verified-only counts, service-role-only, JWT-keyed `p_uid`; `above` = strictly-greater count (ties share rank — correct). `overall = round(sum/3)` matches `phdIndex`, and a missing subject counts as 0 so you can't out-rank by scoring only your best subject (`0016:388`).
- **Rank/band boundaries**: 70/140/210/280 cutoffs are off-by-one-clean (`<70`→Elementary, `70`→Middle, etc.); `rankFor` matches `band`.
- **`nextDiagBand`**: `quality >= 55` up / below down, clamped to ladder ends; unknown band re-centers on start — can't walk off the ladder.
- **Numeric verifier sandbox** (`numericVerify.js`): AST allowlist (no assignment/property-access/function-def), disabled escape hatches (`import`/`evaluate`/`parse`/`createUnit`), length cap, ASCII-only, fail-open, and crucially **RAISE-ONLY** (`applyLearnerCorrection` never lowers a rubric axis) — so even a malicious check expression can only restore `computation` to 4 on a provably-correct final answer, never inflate reasoning axes.
- **Mastery counters**: green is sticky/monotonic by design (documented §11.6); `green_hits` capped at `attempts` on migration; quality is always server-computed; allowlist drops junk keys. The diagnostic dock correctly marks a skipped concept red.
- **Promotion gate** (`promotion.js`): display-layer only (owner decision Option B), monotonic coverage, empty ranks don't block — correct and can only ever LOWER a displayed label, never raise it.
