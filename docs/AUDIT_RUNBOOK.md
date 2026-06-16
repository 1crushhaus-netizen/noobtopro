# Audit & fleet-orchestration runbook

This is the operational runbook for the adversarial, multi-agent code audit we
run against noobtopro. It was extracted out of the main README (which is now an
onboarding doc — see the repo-root `README.md`); the shipped-history log and the
"how to re-run the audit" process live here so they don't bury the reference.

For the current state of the app (what's shipped, env vars, architecture), the
README is the source of truth. For accepted/known residual risks, see README §17.

---

## Shipped & live on `main` (history log)

> All merged: flatten-for-Vercel + audit hardening (PR #2–#29) · Concept Hub
> backend/admin/browse (#29–#31) · "Prove it" diagnostic (#32) ·
> server-authoritative scoring + reasoning radar (#34/#35) · fleet-audit fixes
> (#36) · diagnostic → 6 questions (#37) · durable per-account rate limiter
> (#38) · **Elo ranking + explainable anti-gaming grading + anonymous
> leaderboard (PR 3, #40)** · **Concept Hub public seed + canonical de-dup (PR
> 4, #44)** · **Learn-tab proof/derivation guides + stale-guide auto-heal (PR 5,
> #45)** · **detailed "how to reach 100" feedback + post-grade worked solution +
> answer review (PR 6, #43)** · **Concept Hub UI fixes (#46)** · **independent
> fleet-audit fix round (#48)** · **process-first typed-error grading — 9-axis
> weighted rubric + path-independent transparent score (#49)** · **curated
> 9-question diagnostic bank (3 levels, zero Groq) + time-locked "I don't know"
> skip (#51)** · **reasoning-rich practice questions + numeric verifier
> (#57/#58)** · **the Pro tier (Polar) + entitlement gates (migrations
> `0017`–`0021`)**.
>
> **Database:** the canonical schema is `db/schema.sql`; numbered delta
> migrations live in `db/migrations/`, starting at `0001a` (run
> `ls db/migrations/` for the current set). **There is no standalone `0010` — it
> was renumbered to `0012` (see the `0011`/`0012` headers); the numeric sequence
> skips it by design.** Treat `db/schema.sql` as the source of truth and apply
> any migrations newer than the live DB. Advisor baseline is the
> documented/accepted set (README §17). Run `npm test` for the current test count
> (the suite + `npm run build` are the merge gate). The
> Concept Hub is **fully seeded: 36/36 curated, proof-bearing guides live** (12
> per subject), plus hidden cache guides; the pending-stub backlog was purged
> and the auto-grow stub pipeline retired (#75).

### DONE — the grading redesign (practice questions + numeric verifier)

The grading **core** shipped: a process-first **9-axis weighted rubric** with a
transparent, path-independent score and a solve-first typed-error grader (#49),
plus a **curated, trap-rich 9-question diagnostic bank** and a time-locked "I
don't know" skip (#51). The redesign is now fully shipped:

- **Reasoning-rich PRACTICE questions shipped.** `PRACTICE_GEN_SYS` now REQUIRES a reasoning surface per band (no atomic single-substitution): it emits **`reasoningSurface`** (`multi-step` | `branch` | `trap`) + a short **`trap`** description, mirroring the curated `lib/diagnosticBank.js` schema. That metadata is threaded as **grader calibration context** into `PRACTICE_GRADE_SYS` (practice) and `DIAG_GRADE_SYS` (the diagnostic bank's existing surfaces) — *lightweight + deflate-only* (surface type + naive wrong path; it can only help the grader LOCATE a real error, never award credit; the grader still solves independently and stays path-independent, so neither a wrong generator nor a forged client trap can bias the grade). Validated/allow-listed in `lib/gradeInput.js#normalizeReasoningSurface`/`reasoningSurfaceContext`; the diagnostic surface is derived server-side from the bank (`diagnosticSurfaceFor`), never trusted from the client. *(`scripts/eval-grading-ordering.mjs` still documents WHY this lives in the generator: no rubric can measure thinking on an atomic question — the fix is the question, not the grader.)*
- **Numeric verifier shipped** (`lib/numericVerify.js`). The grader solves the problem itself first (the `solve` block) to tell a slip from a reasoning error, but its own arithmetic is fallible — so the grader now also emits **`solve.check`** (ONE self-contained calculator expression recomputing its finalAnswer) and **`learnerAnswer`** (the learner's final answer verbatim), and the server re-evaluates the check in a **sandboxed mathjs instance** (isolated instance + strict AST allowlist — constants, `+ - * / ^ !`, allow-listed functions, unit symbols; no assignment/property-access/arrays/ranges; escape hatches disabled — because the expression is model output influenced by learner text). A **PROVEN-wrong** grade re-grades **once** with the verified value injected as server context (budget-charged; the vision path is never re-fired), falling back to field-level correction; in every verified state `finalAnswerMatches` is recomputed against the machine value and — **raise-only, evidence-bounded** — a learner whose final answer provably matches gets `computation` restored to 4 and refuted final-number execution-slips dropped (verification never LOWERS an axis: a mismatched answer doesn't prove bad arithmetic). Unit-aware comparison (SI-normalized, ~1% relative tolerance for rounding, exact for integer-vs-integer); everything unprovable **fails open** (status `skipped`, grade untouched). The verdict (`verification: { status: skipped|confirmed|regraded|corrected, value, changed }`) rides the responses and the persisted attempt review. Runs on **all three grading paths** (signed-in practice, guest practice, diagnostic steps — where the corrected `computation` feeds placement quality and band routing). Pinned by `test/numericVerify.test.js` + route tests in `test/api-grade.test.js` / `test/api-score.test.js`.
- **Housekeeping:** ~~drop the now-unused `diagnostic_pool` table + `try_add_diagnostic` RPC~~ done (`0013_drop_diagnostic_pool.sql`, applied live). ~~Seed all 36 Concept Hub topics~~ done (36/36 curated guides live, 2026-06-11). ~~Drop the uncalled `register_concepts` RPC~~ done (`0014_drop_register_concepts.sql`, applied live).

### DONE — the independent fleet audit (merged, #48)

A full, adversarial, independent audit of the entire codebase was run (105-agent
Workflow fleet: finder lenses → per-finding adversarial verify → completeness
critic → second round, **plus** an orchestrator re-read of the whole trust
boundary/DB/routes and re-verification of every high-severity finding against
real `file:line` + the live DB). **Result: 0 P0; the confirmed P1/P2/P3 findings
were fixed and merged in #48** (migration `0008`):

- **P1** — image-only practice/diagnostic answers were docked to 3 without grading the photo (`preGradeDock` only sees text); the dock is now skipped when an image is attached, in `/api/score` (both paths) and `/api/grade`.
- **P2** — diagnostic single-tier inflation (a missing tier now counts as 0, not 100 — `diagnosticSubjectScore`); leaderboard `overall` now means over all 3 subjects (matches `phdIndex`); guest answer-reviews now survive first sign-in (`migrate_guest_data` carries them into `attempt_reviews`); the seed script now keeps the `whyItWorks` proof; the historical migrations got `save_progress_for` drop-guards; `concept_reports.concept_key` got a 200-char cap.
- **P3** — admin-email match now requires a confirmed email; sign-out clears sensitive state synchronously; preGrade no longer docks numeric answers; a11y focus ring + contrast; `register_concepts` stubs stored `hidden`; CSP/`X-Powered-By`; numerous stale-doc/comment corrections.
- **Re-judged accepted residuals (still valid):** the README §17 list holds; the diagnostic partial-failure re-weight is now conservative (a failed tier scores 0 rather than inflating). **Deferred by design:** the leaderboard tie/percentile convention + k-anonymity floor (tied to the owner's anonymous-tiers / future percentile-recut), and the preGrade one-word-term dock (structurally indistinguishable from an off-topic one-word answer).

---

## How to re-run the audit

**To re-run the audit:** spend **as many agents and as many tokens as you can**
to be exhaustive — find **everything** (security, network/API, UI, correctness)
at **every** severity. *Find-and-report first; don't change code until the owner
picks fixes.*

**Posture — be ruthlessly independent.** Treat **every** claim in this repo and
in code comments ("safe / verified / fixed / accepted / intended / 0 findings")
as **UNVERIFIED until you confirm it yourself** against the actual source **and
the live database**. Prior reviews were run by the same agent lineage that wrote
the code — assume they missed things. **Sub-agents hallucinate**, so **every
finding must be verified against the real file:line (and, for DB claims, the live
project) before it goes in the report.** Default a candidate finding to *refuted*
unless the source unambiguously confirms it.

**How to run it (use the fleet — `ultracode` is on).** Drive it with the
**Workflow tool**: fan out many finder agents in parallel across the dimensions
below, then **adversarially verify each finding** with independent skeptic
agents, then synthesize one classified report. Use loop-until-dry (keep spawning
finders until N rounds surface nothing new), multi-modal sweeps (search by route,
by table, by component, by data-flow), and a completeness critic at the end
("what dimension/file/claim did we not actually check?"). Run several Workflow
phases in sequence (understand → audit each dimension → verify → synthesize) so
you stay in the loop. Scale the fleet up — thoroughness over cost.

### Dimensions to cover

Comprehensive — every file under `app/`, `components/`, `lib/`, `db/`,
`scripts/`, config:

1. **Security / trust boundary.** JWT verification (`lib/adminAuth.js` `requireUser`/`requireAdmin`) on `/api/score`, `/api/leaderboard`, `/api/admin/*`, the Pro checkout/portal/webhook routes; can a client self-assert a score/rank, forge a Pro entitlement, or read another user's data by ANY path (PostgREST `PATCH`, forged/missing/expired token, RPC call). **RLS on every table** — `scores`, `attempts`, `attempt_reviews`, `concept_guides`, `concept_topics`, `subscriptions`, `security_events`, `concept_reports`, `rate_limits`, `item_difficulty`. **RPC EXECUTE ACLs** — confirm `save_progress_for`, `bump_item_difficulty`, `leaderboard_tiers`, `seed_curated_guide`, `dedupe_pending_stubs`, `refresh_guide`, `upsert_subscription`, `promote_or_insert_guide`, `rate_limit_hit` are **service-role only**, and `migrate_guest_data`/`delete_user_data` are self-scoped to `auth.uid()`. SECURITY DEFINER `search_path` pinning. The **curation-only invariant** (no client/automated path sets `visibility='public'`). The **worked-solution gate** (a docked/blank answer must NOT reveal the solution — `/api/score` + `/api/grade`). The **Polar webhook signature verification** (`POLAR_WEBHOOK_SECRET`) and that entitlements are written ONLY by the verified webhook. Secret leakage (`GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POLAR_*`, upstream Groq/DB error detail in responses or logs). Prompt-injection + SQL-injection surfaces. Admin allowlist (`ADMIN_EMAILS`/`ADMIN_USER_IDS`, deny-by-default).
2. **Network / API.** Same-origin + JSON guards (`lib/requestGuard.js`) on every route; rate limiting (`lib/rateLimit.js` — per-IP, per-account `acct:*`, `:img`/`:diag`/`:learn` budgets, the free daily practice cap) and whether any expensive path escapes a budget; **cost-amplification** on the Groq fan-out (diagnostic, vision grades, learn generation, stale-guide refresh); SSRF / arbitrary-bytes via the image `data:` URL (`lib/gradeInput.js` magic-byte sniff); security headers + the baseline **CSP** (`next.config.js`); `vercel.json` (region pinning, function tuning); whether any route that mutates is missing auth.
3. **UI bugs.** The `stage × view` state machine (`components/Noobtopro.jsx`) and the newer surfaces — the merged **Dashboard** (`Dashboard.jsx` bento grid + `Leaderboard.jsx` anonymous leaderboard + `ReviewList.jsx` Review drawer + `charts.jsx` trend drawer + the **guest gate** + the Pro badge/upgrade nudges), the **feedback card** ("what you did well / to reach 100" / collapsible worked solution), the **"Why it works"** section + Concept Hub **browse/search/filter** (LearnTab). Check: XSS in any rendered LLM/user/stored content (no `dangerouslySetInnerHTML`; React-escaping), accessibility (aria labels, live regions, focus trap on the save-progress modal **and the Dashboard drawers**, the guest-gate not fetching auth-only data, contrast), responsive layout (the Dashboard's no-scroll bento + its <1024px single-column collapse), loading/empty/error states, image-preview `URL.revokeObjectURL` leaks, the run-token guards (`practiceRun`/`diagRun`/`learnRun`) against stale writes, guest `localStorage` quota/sanitization.
4. **Correctness / non-severe bugs.** The scoring engine (`lib/scoring.js`: the unified Glicko-2 path + `scoreFromRubric`/`contributionBreakdown` transparent weighted headline + `rankFor`/`diagnosticPathScore`/`normalizeRubric` legacy coercion + null-NaN handling); the dock heuristics (`lib/preGrade.js`) for false positives/negatives + ReDoS; guest-vs-signed-in scoring parity; entitlement logic (`lib/entitlements.js`/`lib/proStatus.js` — period-end handling, missed-revoke); race conditions (the documented read-modify-write on `scores`, the bucket bump, single-flight migration, webhook event ordering); the data layer (`lib/store.js` clamps, `migrate_guest_data` ≤5000 cap, guest review cap); cache correctness (concept guides); taxonomy normalization (prototype-safety); off-by-ones; dead code; stale comments/docs (flag anything inaccurate).
5. **Database (use the Supabase MCP connector).** Run **`get_advisors` (security AND performance)**; inspect live **RLS, policies, GRANTs, function ACLs, search_path**; confirm `db/schema.sql` matches the live DB and each `db/migrations/NNNN_*.sql` is idempotent and consistent with `schema.sql`. (Connector project id: `vwvhgnlgubctrgksyohr`, region `us-east-1`.)

**Don't burn tokens re-reporting accepted residuals — but DO re-judge whether
each is still valid.** README §17 lists the documented/accepted residual risks +
the expected advisor baseline. Label these **"accepted residual (still valid?
y/n)"** rather than as new P-findings.

**Deliverable.** A single classified report: **P0 (critical) → P3 (trivial)**,
each with `file:line`, a concrete exploit/impact or repro, and a recommended fix;
an explicit **merge-blocker** list; and a clear split of **confirmed** vs
**could-not-confirm**. Note coverage gaps honestly (any file/dimension not
actually audited). Run `npm test` + `npm run build` as part of the audit. **Then
ask the owner which findings to fix** before touching code; fixes follow the dev
loop in CONTRIBUTING.md / README §15 (branch → PR → CI → adversarial re-review →
merge; DB changes get a numbered migration applied to live + a re-run of
advisors).

**Tooling notes.** `ultracode` is on (default to Workflow orchestration). The
**Supabase MCP connector** is available for the live DB. **Greptile's trial is
exhausted** — the agent fleet is the *only* review gate, so the audit's rigor
matters. The owner holds the Vercel/Supabase/Groq/Google/Polar dashboards — ask
if you need deeper infra checks.
