# Audit 08 — Testing & CI/CD (Adversarial)

**Auditor stance:** Antagonistic. Assume the suite gives false confidence until proven otherwise.
**Date:** 2026-06-16
**Scope:** Vitest suite (48 files), `.github/workflows/ci.yml`, `vitest.config.js`, `test/setup.js`, `package.json` scripts, `scripts/*.mjs`.

---

## 1. ACTUAL `npm test` RESULT

Install: `npm ci` succeeded (162 packages) but printed `EBADENGINE` — the package requires Node `>=24` and this environment runs **Node v22.22.2**. CI itself pins Node via `.nvmrc` (`24`), so this mismatch is local-only (see P1-3 for the real-prod nuance).

```
Test Files  48 passed (48)
     Tests  811 passed (811)
  Duration  ~23.7s
```

- **Result: ALL 811 tests PASS across 48 files. Suite is runnable and green.**
- **Flakiness / warnings observed:**
  - Repeated `jsdom` noise: `Not implemented: HTMLCanvasElement's getContext()` in `test/noobtopro.test.jsx` (canvas npm package not installed). Tests still pass because the route has a fallback path, but the canvas-success path is therefore **never exercised under test** (the jsdom env can only test the fallback).
  - `npm audit` reports **10 vulnerabilities (1 critical, 2 high, 7 moderate)** — see P1-4. No audit gate exists in CI.
  - No timing/network flakiness detected; tests use injectable `now` and mocked `fetch`/Supabase.

**Bottom line:** The suite is real and broad — anti-cheat token crypto, entitlements, admin authz, Groq JSON handling, and Pro gates all have genuine adversarial tests. The danger is **not** a fake/failing suite; it is specific high-value paths that are either mocked away (webhook signature), structurally un-exercised (anti-farm damper, generate rate limiter), or have **no static-analysis/audit/coverage gate in CI at all**.

---

## 2. SUMMARY TABLE

| Sev | Title | Category |
|-----|-------|----------|
| P0 | Real Polar webhook signature verifier (`lib/polarWebhook.js`) has ZERO tests — mocked in every webhook test, so a forgery bug can't surface | Over-mocking / payment auth |
| P1 | Webhook upsert has no out-of-order/staleness guard AND no test for out-of-order delivery → revoke/active race can drop or resurrect Pro | Payment correctness |
| P1 | No product-ID validation: any active Polar subscription (any product) grants Pro; assumption untested | Entitlement gating |
| P1 | Anti-farm repeat damper is never behaviorally tested (`repeatFactor` pinned to 1 by the fixture) | Scoring anti-cheat |
| P1 | `/api/generate` own rate limiter + global Groq budget never driven to 429 in tests (DoS/cost surface unverified) | Rate limit / cost |
| P1 | CI has NO linter, NO typecheck/static analysis, NO `npm audit`/dependency scan, NO coverage gate | CI gap |
| P1 | `npm audit`: 1 critical + 2 high vulns shipped (vitest/vite/esbuild dev-chain) with no gate | CI / supply chain |
| P1 | Node engine `>=24` — dev runs on 22 here; no `engine-strict`, so a `<24` prod runner would not be caught early | CI / env |
| P2 | Admin per-action negative authz is spot-checked, not exhaustive (`hide`, review actions, 503 branch untested) | Authz coverage |
| P2 | No malformed/empty LLM-output test on `/api/generate` (could sign a blank question token) | LLM output validation |
| P2 | rateLimit fail-open WEAKNESS untested (per-instance multiplication / IP spoof / RPC-throw branch) | Rate limit |
| P2 | Single-job pipeline, no E2E, no coverage reporting; canvas path untestable in jsdom | CI / coverage |
| P2 | Orphaned `scripts/*.mjs` validators not wired into `package.json` or CI | CI hygiene |

---

## 3. FINDINGS

### [P0] Real Polar webhook signature verifier is never tested — the forgery path is mocked away

- **File(s):** `lib/polarWebhook.js:17` (the real `verifyPolarWebhook` / `validateEvent` wrapper); `test/api-webhook-polar.test.js:8-15` (mocks it for every case); no test file imports `lib/polarWebhook` directly.
- **Category:** Over-mocking that mocks away the thing under test / payment authentication.
- **Description:** The Polar webhook is the **entitlement WRITE path** and its only authentication is the Standard-Webhooks signature (`app/api/webhooks/polar/route.js:11-15` — "the signature IS the authentication"). Every webhook test replaces `verifyPolarWebhook` with `vi.fn()` (`test/api-webhook-polar.test.js:12`). The "403s an invalid signature" test (`:48`) only proves the route maps a thrown `WebhookSignatureError` to 403 — it does **not** prove the real verifier rejects a forged/tampered/replayed signature. `lib/polarWebhook.js` itself has no unit test. If `validateEvent` were ever called wrong (wrong arg order, header-casing bug, secret-format mismatch, or the SDK changing its error class so the `instanceof WebhookVerificationError` check at `lib/polarWebhook.js:21` silently rethrows as a 400/500 instead of 403), the suite stays green and an attacker could POST a forged `subscription.active` to self-grant Pro.
- **Impact:** A forged webhook = free Pro for anyone who can reach the public endpoint. This is the single highest-value untested money path. Contrast with `lib/questionToken.js`, whose real HMAC verifier IS tested adversarially (`test/questionToken.test.js:47-62`) — the webhook deserves the same and has none.
- **Recommended fix:** Add a `test/polarWebhook.test.js` that exercises the **real** `verifyPolarWebhook` against the `@polar-sh/sdk/webhooks` `validateEvent`: (a) a correctly-signed body with the real secret returns the parsed event; (b) a tampered body / wrong signature / wrong secret throws `WebhookSignatureError`; (c) the `instanceof WebhookVerificationError → WebhookSignatureError` mapping holds (pin the contract so an SDK upgrade that changes the error class fails the build). Optionally add one route-level test that does NOT mock the verifier, using a real signature, to prove end-to-end the 403 path is reachable.

---

### [P1] Webhook upsert has no out-of-order/staleness guard, and no test simulates out-of-order delivery

- **File(s):** `app/api/webhooks/polar/route.js:98-109`; `db/schema.sql:1324-1364` (`upsert_subscription`, `status = excluded.status` with no event-time comparison); `test/api-webhook-polar.test.js` (no out-of-order case).
- **Category:** Payment correctness / idempotency.
- **Description:** `upsert_subscription` unconditionally overwrites `status`, `current_period_end`, and `cancel_at_period_end` with whatever the **latest received** event carries — there is no comparison against a stored event timestamp or `updated_at`. Polar (Standard Webhooks) does **not** guarantee delivery order, and retries/backoff make reordering routine. So a `subscription.canceled` that arrives (or is retried) **after** a stale `subscription.active` would resurrect Pro for a churned user; conversely a late `active` arriving after a `canceled` could be clobbered. Replay of the same event is benign-by-overwrite, but reordering is not. There is no test for this: the suite only tests one event at a time (`test/api-webhook-polar.test.js:60-95`), never an active-then-stale-canceled or canceled-then-stale-active sequence.
- **Impact:** Revenue leak (resurrected entitlements for canceled subs) or paying-customer lockout (clobbered active), both silent. NEEDS VERIFICATION on Polar's exact ordering guarantees, but the safe assumption is "none," and the code assumes none is fine — untested.
- **Recommended fix:** Add a monotonic guard in `upsert_subscription` (e.g. only apply when the event's own timestamp/`modified_at` is `>=` the stored one, or carry the Polar event `created_at` and skip stale writes). Add tests: active→stale-canceled must NOT downgrade an already-newer state, and the inverse. Even without the guard, add the tests so the current "last-write-wins" behavior is at least documented and pinned.

---

### [P1] No product-ID validation — any active Polar subscription grants Pro

- **File(s):** `app/api/webhooks/polar/route.js:102` (stores `product_id` but never checks it); `lib/proStatus.js:28-38` (`isActiveSubscription` checks status + period end only, ignores `product_id`); `lib/polar.js:41` (`proProductId()` exists but is only used by checkout, not entitlement).
- **Category:** Entitlement gating.
- **Description:** The webhook records `product_id`, and the schema stores it, but **nothing ever compares the stored `product_id` to the configured Pro product**. `isActiveSubscription` grants Pro purely on `status ∈ {active, trialing}` and period end. If the Polar org ever sells a second product (a cheaper add-on, a one-off, a future tier), any active subscription to ANY of them would read as full Pro. Tests reinforce the gap: `test/entitlements.test.js:45-86` only ever asserts on `status`/`current_period_end`; no test feeds a non-Pro `product_id`.
- **Impact:** Entitlement over-grant the moment the catalog grows beyond one product. Today's blast radius is small (single product — NEEDS VERIFICATION that the org sells exactly one), but it is an untested invariant guarding money.
- **Recommended fix:** Have `isActiveSubscription` (or the server gate) additionally require `row.product_id === proProductId()` when a Pro product is configured, and add tests: active sub for the WRONG product is NOT Pro; active sub for the configured product IS Pro. At minimum add a test asserting the current single-product assumption so a catalog change trips the suite.

---

### [P1] Anti-farm repeat damper has no behavioral test

- **File(s):** `lib/scoring.js` (`repeatFactorFromRecent`); `app/api/score/route.js:503-520` (computes `repeatFactor` from the recent-(topic,band) window); `test/api-score.test.js:89` (`fakeAdmin` always returns `recentAttempts: []`), `:192` (`repeatFactor` hard-wired to 1 in the expected-score helper).
- **Category:** Scoring anti-cheat.
- **Description:** The repeat damper is a core anti-farm control: re-grinding the same (topic, band) bucket should yield diminishing rating gains. But the route-level test fixture never seeds the recent-attempts window — `fakeAdmin`'s `recentAttempts` knob (`test/api-score.test.js:89`) is unused, and the expected-score helper pins `repeatFactor = 1` (`:192`). So **no test ever asserts that a repeated bucket actually damps the gain.** A regression that disabled or inverted the damper would pass the entire suite. The `attemptCount` arg threaded at `:334`/`:342` is also silently ignored by the fixture, so the "attempt count influences rating/difficulty" intent passes for the wrong reason.
- **Impact:** A signed-in user could farm easy repeats to inflate Glicko/rank with the anti-cheat control silently broken and no test catching it. This is the highest-value scoring gap.
- **Recommended fix:** Extend `fakeAdmin` to return a populated recent-(topic,band) window and add a test asserting the resulting delta is strictly less than the un-damped case for the same outcome; also a direct unit test of `repeatFactorFromRecent` over an increasing repeat count.

---

### [P1] `/api/generate` rate limiter and global Groq budget are never driven to 429

- **File(s):** `app/api/generate/route.js:33` (`checkRateLimit(clientKey(req))`) and the `chargeGlobalGroq` charge; `test/api-generate.test.js:20,50` (`_resetRateLimits` in `beforeEach` actively prevents accumulation), `:117` (the only "429" is an upstream Groq error mapped to 500, not the route limiter).
- **Category:** Rate limiting / cost control.
- **Description:** Question generation is a paid Groq call on a **guest-reachable** route. Its own per-IP limiter and the platform-wide Groq budget are the cost/DoS guardrails — and **neither is ever exercised in `api-generate.test.js`.** `_resetRateLimits()` runs before each test, masking any accumulation, and the lone 429 reference is an upstream Groq HTTP 429 being masked to a generic 500. So a regression that removed the limiter or the budget charge from `/api/generate` would not fail the suite.
- **Impact:** Unbounded Groq spend / DoS via the generate endpoint with no test guarding the limiter. (The score route DOES test the global budget at `test/api-score.test.js:1081`/`:720`, so the gap is specific to generate.)
- **Recommended fix:** Add a test that issues > max generate requests from one `clientKey` and asserts a 429, and one that exhausts the global Groq budget and asserts the generate path 429s/degrades. Do not call `_resetRateLimits()` inside that specific test.

---

### [P1] CI has no linter, no typecheck/static analysis, no dependency scan, no coverage gate

- **File(s):** `.github/workflows/ci.yml:39-49` (only `npm test` + `npm run build`); `package.json:8-14` (scripts are `dev/build/start/test/test:watch` only); no `.eslintrc*` / `eslint.config.*` / `tsconfig.json` / `.prettierrc` anywhere in the repo.
- **Category:** CI gap.
- **Description:** This is a JavaScript (not TypeScript) project, so there is **zero static type checking**, and there is **no ESLint config or lint step** at all — the only `jsconfig.json` is a path-alias shim with no checks. CI runs tests and a build; that's it. There is no `npm audit`, no coverage threshold, no security/secret scan. For a project about to take payments, a whole class of defects (unused/undefined vars, missing `await` on a Supabase call, typos in env-var names, accidental client import of a server-only secret module) has no automated catch beyond whatever a test happens to cover.
- **Impact:** Regressions in untested code (and there is untested code — see the gaps above) ship silently. No floor on coverage means new critical paths can land with zero tests and CI stays green.
- **Recommended fix:** Add to CI, as separate fail-fast steps: (1) `eslint` with `eslint-plugin-react`/`next` (catches the server-only-import-in-client class via `import/no-restricted-paths`); (2) optional `tsc --checkJs --noEmit` with a minimal `tsconfig` + JSDoc, or at least `next lint`; (3) `npm audit --audit-level=high` (or `audit-ci`); (4) `@vitest/coverage-v8` with a coverage threshold gated on `lib/` and `app/api/` (the money/auth/scoring code), failing the build below the bar.

---

### [P1] Shipped dependency tree has 1 critical + 2 high vulnerabilities, ungated

- **File(s):** `package.json` devDependencies (`vitest ^2.1.9`); `npm audit` output.
- **Category:** CI / supply chain.
- **Description:** `npm audit` reports 10 vulns: **CRITICAL** in `vitest`→`@vitest/mocker`/`vite`/`vite-node` ("when Vitest UI server is listening, arbitrary file can be read and executed"), **HIGH** in `esbuild` (dev server SSRF / RCE-via-registry) and `vite` (path traversal / `server.fs.deny` bypass), plus moderate `postcss`/`next` XSS-in-stringify advisories. Most are dev-chain (vitest/vite/esbuild) and not in the production bundle, but they are real and **no CI step surfaces them**, so the count will only grow unnoticed.
- **Impact:** Mostly developer-machine / CI-runner exposure today (the critical requires the Vitest UI server, which the project doesn't run in CI). The `next`/`postcss` advisories touch the production framework and warrant a deliberate decision rather than silence. The core risk is that without a gate, a future *production-path* high/critical lands invisibly.
- **Recommended fix:** Add `npm audit --audit-level=high` to CI; triage the `next`/`postcss` advisories (bump `next` within the 15.x line); upgrade `vitest`/`vite` to patched versions. Don't `npm audit fix --force` blindly — it proposes `next@9` (a massive downgrade).

---

### [P1] Node engine `>=24` is not strictly enforced; dev/CI/prod drift is possible

- **File(s):** `package.json:5-7` (`"node": ">=24"`); `.nvmrc:1` (`24`); `.github/workflows/ci.yml:32-33` (`node-version-file: .nvmrc`); this environment runs **Node 22.22.2**.
- **Category:** CI / environment.
- **Description:** The three declared sources are actually consistent (engines `>=24`, `.nvmrc` `24`, CI reads `.nvmrc`), so CI and the engine declaration agree. The drift is real but two-fold: (1) **local/dev** ran the suite on Node 22 with only an `EBADENGINE` *warning* — `npm` does not error because there is no `engine-strict`, so a contributor on 22 gets a green local run that diverges from CI's runtime; (2) the deployment target (Vercel) is set elsewhere — if its Node version were ever `<24`, the `>=24` engine is advisory only and nothing in CI proves the **build+test ran on the same major** the prod runtime will use.
- **Impact:** A version-specific bug (Node 24 API used in source, or a 22-only behavior relied on in a test) could pass on one runtime and fail on another, and the warning-only enforcement means it's easy to miss. Lower severity than a hard mismatch, but a launch-time foot-gun.
- **Recommended fix:** Add `engine-strict=true` (`.npmrc`) so `npm ci` *fails* on the wrong major instead of warning; pin the Vercel project Node version to 24 to match `.nvmrc`; consider a CI matrix or an explicit assert that the build runtime equals the prod runtime.

---

### [P2] Admin per-action negative authz is spot-checked, not exhaustive

- **File(s):** `app/api/admin/action/route.js`; `app/api/admin/data/route.js:32` (503 branch); `test/api-admin.test.js:387` (401 tested only on `approve`), `:394` (403 tested only on `delete`).
- **Category:** Authz coverage.
- **Description:** The shared gate (`requireAdmin`) is well-tested in isolation (`test/adminAuth.test.js` — excellent negative coverage), and the admin routes test 401/403 once each. But the 401 deny is asserted only against `approve` and the 403 only against `delete`; `hide`, the `event`/`report` review actions, and the "storage not configured" 503 branch have no negative-authz/error test. A regression that left one action's gate off would pass.
- **Impact:** Low (the gate is structurally shared), but for an admin surface that deletes/hides public content it should be proven per-action.
- **Recommended fix:** Parameterize the 401/403 deny test across every admin action verb, and add a 503 test for the unconfigured-store branch.

---

### [P2] No malformed/empty LLM-output test on `/api/generate`

- **File(s):** `app/api/generate/route.js`; `test/api-generate.test.js` (every `mockGroqReturning` payload is well-formed).
- **Category:** LLM output validation.
- **Description:** All generate tests feed valid model JSON. There is no test for the model returning no `question`, a non-string/empty/whitespace question, or invalid JSON. Since `/api/score` later rejects an empty signed question (`app/api/score/route.js:255`), the generate side failing to validate before **signing** the token is a real gap — a blank-but-validly-signed question would round-trip to score and only fail there.
- **Impact:** Possible signed-but-useless questions; degraded UX; an untested failure mode on a paid LLM path.
- **Recommended fix:** Add tests for empty/malformed generator output asserting the route 500s (or regenerates) rather than signing a blank question.

---

### [P2] rateLimit fail-open WEAKNESS is untested

- **File(s):** `lib/rateLimit.js:149` (silent-downgrade `console.warn`), `:150` (RPC-throw catch), `:218` (refund-throw catch); `test/rateLimit.test.js:107` (only the resolved-`{error}` fallback is tested).
- **Category:** Rate limit.
- **Description:** The test confirms the durable→in-memory fallback *path* keeps the app up when the RPC returns an error. But: (a) the RPC-*throws* branch (`lib/rateLimit.js:150`) is untested; (b) the documented fallback weaknesses — per-instance multiplication and IP-spoofability — are never demonstrated (e.g. two distinct `clientKey`s defeating a per-IP cap); (c) the degradation `console.warn` (the only signal that protection silently weakened) is not asserted to fire.
- **Impact:** A silent downgrade to a weaker limiter during a Supabase hiccup is exactly when an attacker would strike, and the weakening is invisible and untested.
- **Recommended fix:** Add tests for the RPC-throw branch, assert the `console.warn` fires on downgrade, and add a test documenting the IP-key/per-instance limitation so a future "fix" that breaks the fallback is caught.

---

### [P2] Single-job pipeline, no E2E, no coverage reporting; canvas path untestable in jsdom

- **File(s):** `.github/workflows/ci.yml:22-43` (one `test` job); no `playwright`/`cypress`/`e2e`; `test/noobtopro.test.jsx` (canvas `getContext` not implemented in jsdom).
- **Category:** CI / coverage.
- **Description:** CI is a single linear job (lint/typecheck/audit/coverage all absent, per P1). There is no end-to-end test of the real purchase → webhook → entitlement loop or the auth flow against a running app — the riskiest launch paths are only unit-tested with mocks. The image-attach canvas-success path can't run in jsdom (it logs `Not implemented: getContext`), so only the fallback path is ever covered.
- **Impact:** No integration-level proof that the mocked boundaries (Polar, Supabase) actually wire together; the canvas image-prep happy path ships unverified.
- **Recommended fix:** Add a minimal E2E (Playwright) for sign-in and the Polar sandbox checkout→webhook loop; install the `canvas` package (or a jsdom canvas shim) so the success path is testable; emit coverage to surface untested lines.

---

### [P2] Orphaned `scripts/*.mjs` validators are not wired into `package.json` or CI

- **File(s):** `scripts/validate-diagnostic-items.mjs`, `scripts/validate-guides.mjs`, `scripts/eval-grading-ordering.mjs`, `scripts/seed-concept-hub.mjs`; `package.json:8-14` (none referenced); `.github/workflows/ci.yml` (none referenced).
- **Category:** CI hygiene.
- **Description:** Four maintenance/validation scripts exist and are documented in `README.md`/`RANKS_PLAN.md` but are not exposed as npm scripts or run in CI. The underlying logic IS covered by unit tests (`test/diagnostic-bank.test.js`, `test/guides.test.js`, `test/grading-ordering.test.js`), so this is not a hard coverage hole — but the CLI validators can silently rot (break on a content change) with nothing exercising them.
- **Impact:** Low. Content-data drift that the scripts would catch is mostly also caught by the tests; the risk is the scripts themselves bit-rotting.
- **Recommended fix:** Add `package.json` scripts (`validate:guides`, `validate:diagnostics`) and run them in CI, or delete the scripts if the tests fully supersede them.

---

## 4. WHAT IS GENUINELY WELL-TESTED (credit where due)

To avoid false alarms — these critical paths have real adversarial coverage and should NOT be flagged as gaps:

- **Question-token anti-cheat crypto** (`test/questionToken.test.js`): forged/tampered payload, wrong key, expiry, kind-separation (diag vs practice), fail-closed without a key, allow-list field stripping. This is the model the webhook verifier should follow.
- **Score-route anti-cheat** (`test/api-score.test.js`): forged token → 400, jti replay dedupe (both pre-grade and in `save_progress_for`), band/topic derived from token not body, prompt-injection docking, guest-cannot-score. (Gap: only the repeat damper, P1 above.)
- **Admin authz primitive** (`test/adminAuth.test.js`): deny-by-default allowlist, unconfirmed-email anti-squatting, id vs email branches, bearer parsing, getUser-throws.
- **Entitlements predicate** (`test/entitlements.test.js`): status allow-list, past-period-end revoke, deny-by-default no-store, 401/402/pass gating. (Gaps: product-id and out-of-order, P1 above.)
- **Checkout/portal authz** (`test/api-checkout-portal.test.js`): cross-site 403, 401 unauth, identity bound to verified uid not body, upstream-detail-never-leaks.
- **Groq JSON robustness** (`test/groq.test.js`): markdown fences, brace-in-string, truncated-envelope throws, fence-guard prompt-break, abort-signal timeout, retry-cost caps, vision-fallback rules.
- **Pro gates** (`test/api-pro-gates.test.js`): free daily cap 402, photo-of-work Pro-only, gates inert when Pro not sold.
- **Content safety** (`test/contentSafety.test.js`): URLs/emails/markup/zero-width-slur/emoji-dominated rejection.
