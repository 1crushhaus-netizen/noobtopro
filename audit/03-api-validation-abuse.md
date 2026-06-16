# API / Input-Validation / Abuse / Resilience Audit — noobtopro

**Scope:** Every `app/api/*/route.js` (checkout, portal, webhooks/polar, generate, grade, score, leaderboard, admin/*), plus `lib/rateLimit.js`, `lib/requestGuard.js`, `lib/abuseDetection.js`, `lib/questionToken.js`, `lib/gradeInput.js`, `lib/preGrade.js`, `lib/numericVerify.js`, `lib/groq.js`, `lib/adminAuth.js`, `lib/entitlements.js`, `lib/polar*.js`, and `db/migrations/0003_durable_rate_limiter.sql`.

**Auditor posture:** Adversarial — assume every route is exploitable until proven otherwise. This codebase has clearly been through several prior audit rounds (P1-1, P2-x markers throughout), and the question-token integrity, body-size limits, and fail-open/fail-closed posture are genuinely strong. The findings below are the residual gaps, ordered by launch risk. I found **no P0** issues — the token forgery / score-manipulation / crash-the-server vectors that would normally be P0 are already closed.

---

## Summary

| Severity | Count |
|----------|-------|
| **P0 (Launch Blocker)** | 0 |
| **P1 (High)** | 4 |
| **P2 (Medium)** | 9 |
| **Total** | 13 |

**One-line P1 summary:**
- **P1-A** — Global Groq budget is a *single shared fixed-window counter*; one IP can starve all legitimate users (availability DoS) for the rest of every window at near-zero cost.
- **P1-B** — `chargeGlobalGroq` charges the global counter in a loop and, on a mid-loop denial, never refunds the slots it already consumed; combined with the diagnostic's per-request fan-out this leaks budget and accelerates P1-A.
- **P1-C** — `/api/generate` (paid LLM call, anonymous) has **no per-account or durable-per-identity binding** — only per-IP + the shared global budget. IP rotation gives an attacker `30/min × N IPs` paid generations until the global cap trips, and the global cap is itself the P1-A availability weapon.
- **P1-D** — Limiter is **fail-open**: when the durable Postgres limiter errors or returns a bad shape it silently downgrades to the per-instance in-memory limiter (effective limit = `max × instances`, IP-keyed/spoofable). A Supabase incident quietly removes the real protection on the exact routes that cost money.

---

## P1 — High

### [P1-A] Global Groq budget is a single shared counter — trivial cross-tenant cost/availability DoS
- **File(s):** `lib/rateLimit.js:176-189` (`chargeGlobalGroq`), consumed in `app/api/generate/route.js:165`, `app/api/grade/route.js:160`, `app/api/score/route.js:408,737`.
- **Category:** Rate limiting / cost & availability DoS.
- **Description:** The platform-wide budget is a **single global fixed-window counter** (`global:groq`, default 300/min; `global:img`, default 60/min). It is correctly designed to bound *spend*, but because it is one shared bucket, a single attacker who can issue ~300 cheap text-grade/generate requests per minute (achievable from one host, or a handful of rotated IPs each under the 30/min per-IP cap) **exhausts the global window and forces a 429 for every other user** — paying customers included — until the window rolls. The code itself documents this as the intended trade ("a bounded availability hit instead of an unbounded bill"), but at 300/min the availability floor is very low for a launching SaaS: a trivial script makes the product unusable for everyone at essentially zero attacker cost.
- **Impact:** Availability DoS affecting *all* users (including Pro), driven by one cheap attacker. The cost is bounded (good) but the availability is not protected (bad). This is the single most exploitable launch risk.
- **Recommended fix:** Don't rely on one global counter for fairness. Layer: (1) a *much* stricter durable **per-account** budget for authenticated routes (already partially present on `/api/score`); (2) keep the global counter only as a hard spend ceiling but raise it well above honest peak and pair it with anomaly alerting; (3) for the anonymous routes (`/api/generate`, `/api/grade`), gate behind a lightweight proof-of-work / Turnstile / signed-session challenge before charging Groq, so an unauthenticated flood can't reach the global bucket. At minimum, make the global cap env-tuned per environment and alert (not just `console.warn`) when it trips.

### [P1-B] `chargeGlobalGroq` leaks budget on mid-loop denial (no refund of partial charges)
- **File(s):** `lib/rateLimit.js:176-189`.
- **Category:** Rate limiting / budget accounting bug → accelerates P1-A.
- **Description:** `chargeGlobalGroq(n, {img})` charges the global Groq counter by calling `checkRateLimit("global:groq")` in a loop `n` times, then the image counter `img` times. If any iteration returns `!ok`, the function returns immediately — but the counters it *already* incremented in earlier iterations are **never refunded**. For the common `n=1` case this is harmless. But the numeric-verifier re-grade path and any future `n>1` caller can charge 1, then have the *image* sub-charge denied, leaving the Groq slot permanently consumed for the window. More importantly, every denied call that has `img:1` first burns a `global:groq` slot, then fails on `global:img` — so image-grade pressure double-counts against the text budget and is not given back (`refundGlobalGroq` is only invoked from the route `catch` blocks on an *exception*, not on a `!ok` charge return at `grade.js:161`, `score.js:409`, `score.js:738`). Over a sustained image-grade flood this bleeds the global text budget faster than intended, tightening the P1-A window.
- **Impact:** Global budget is consumed faster than the real Groq spend, lowering the availability floor for everyone and making the P1-A DoS cheaper to trigger.
- **Recommended fix:** Make `chargeGlobalGroq` atomic-or-refunding: track how many `groq`/`img` slots were actually charged, and if a later sub-charge is denied, refund the ones already taken before returning `!ok`. Alternatively charge img and groq in a single RPC that all-or-nothing.

### [P1-C] `/api/generate` has no durable per-identity binding — IP rotation = unbounded paid generations (up to the shared global cap)
- **File(s):** `app/api/generate/route.js:33` (per-IP `checkRateLimit(clientKey(req))`), `:165` (global charge). No `acct:` cap anywhere in this route.
- **Category:** Rate limiting gap / LLM cost abuse.
- **Description:** `/api/generate` is anonymous, fires a paid Groq generation (`groqJSON` at `:190`, ~1200 max tokens, temp 0.85), and is protected only by (a) the per-IP fixed window (`clientKey` derived from `x-real-ip`/`x-forwarded-for`, which is rotatable/spoofable per the limiter's own comments at `lib/rateLimit.js:90-99`) and (b) the shared global budget (P1-A). Unlike `/api/score` practice (which adds `acct:<uid>:practice` and a free daily cap), `/api/generate` has **no per-account or per-session binding at all** — even when the caller IS authenticated (it only reads auth to resolve drill mastery state, `:120`). So an attacker rotating IPs gets `30 generations/min/IP × N IPs` of paid Groq spend until the global cap trips — at which point it becomes the P1-A availability weapon against everyone.
- **Impact:** Direct uncontrolled LLM cost under IP rotation, and the overflow becomes a global-availability DoS. Generation is the *cheapest LLM call to abuse for cost* because it requires no valid token and no auth.
- **Recommended fix:** Same mitigations as P1-A. Specifically for generate: require a challenge token (Turnstile/PoW) for anonymous callers before the Groq call; for authenticated callers add an `acct:<uid>:generate` durable cap mirroring the practice cap. Consider lowering the per-IP generate cap below the general 30/min.

### [P1-D] Durable limiter fails OPEN to a weaker per-instance limiter on backend error
- **File(s):** `lib/rateLimit.js:128-155` (`checkRateLimit`), specifically the `console.warn` + `return rateLimit(...)` fallback at `:149-154`.
- **Category:** Resilience / fail-open rate limiting.
- **Description:** When `SUPABASE_SERVICE_ROLE_KEY` is set, `checkRateLimit` uses the durable Postgres counter (`rate_limit_hit`). If that RPC **errors, throws, or returns a malformed shape**, the function logs a `console.warn` and **falls back to the in-memory per-instance limiter** (`rateLimit`). That fallback's effective limit is `max × number_of_serverless_instances`, is keyed by spoofable client IP, and the global Groq budget (also routed through `checkRateLimit`) likewise degrades to per-instance — meaning the *platform-wide spend ceiling effectively disappears* during a Supabase incident. So the moment the rate-limit backend has trouble (exactly when you're under load / attack), the real protection silently weakens on every cost-incurring route. This is a deliberate "stay up" trade, but for routes that cost real money the fail-open direction is the wrong default.
- **Impact:** During a Supabase degradation, both per-request fairness AND the global spend ceiling weaken simultaneously and silently. An attacker who can induce limiter-backend errors (or who simply attacks during an incident) gets multiplied throughput and an uncapped bill.
- **Recommended fix:** For the *cost-bearing* charges (`chargeGlobalGroq`) specifically, consider fail-*closed* (deny the Groq call) when the durable store is configured-but-erroring, since a denied LLM call is cheap and a runaway bill is not. At minimum: emit a real alert (not `console.warn`), and make the global-budget fallback far stricter than the in-memory default so an incident can't lift the spend ceiling.

---

## P2 — Medium

### [P2-1] `/api/score` practice runs auth + DB reads + `chargeGlobalGroq` AFTER cheap IP limit but the pre-grade jti-replay DB read is unbounded per request
- **File(s):** `app/api/score/route.js:158-340`.
- **Category:** Resilience / ordering.
- **Description:** The route correctly checks the per-IP limit first (`:158`), then auth, then per-account caps. That ordering is right. However the replay pre-check (`:332-340`) and the two pre-grade `Promise.all` reads (`:349-352`) all hit Supabase *before* any global Groq charge and on *every* request that passes the IP gate. An authenticated attacker under the per-account cap (45/min practice) still drives 45×(several) Supabase queries/min. Minor vs P1, but it's DB load with no separate budget. NEEDS VERIFICATION on whether Supabase connection pooling absorbs this at launch scale.
- **Impact:** Amplified DB read load per authenticated abuser; not money-loss, but a resource-exhaustion contributor.
- **Recommended fix:** Acceptable as-is for launch given the per-account cap; revisit if DB CPU becomes a bottleneck.

### [P2-2] CPU-cost expressions reach the numericVerify sandbox (`factorial`, `^`, `pow`) — bounded but not free
- **File(s):** `lib/numericVerify.js:72-78` (`OP_ALLOW` includes `^`/`!`, `FN_ALLOW` includes `factorial`, `pow`, `nthRoot`), `:140-151` (`safeEvaluate`).
- **Category:** Resource exhaustion (CPU).
- **Description:** The sandbox is well-built (AST allowlist, no `eval`/property access/assignment, ASCII-only, 240-char cap) — there is **no code-injection or ReDoS** here. But the allowed `factorial` and `^` operators let a 240-char expression request a huge computation (e.g. nested `factorial(...)` or large `^` exponents). mathjs computes `170!` as a float (Infinity beyond), and large integer powers are bounded by float overflow, so a single expression can't truly hang — but the `check` string is *model-emitted*, deterministic (temp 0), and capped, so the practical risk is low. Flagging because the attack surface (model-influenced-by-prompt-injection expression → CPU) exists in principle.
- **Impact:** Low — bounded by float semantics and the 240-char cap; would require a successful generator-side injection to even influence the expression.
- **Recommended fix:** Optionally cap factorial/exponent magnitudes (reject `^` with a constant exponent > some N, reject `factorial` of > ~170) inside `validateNode`. Low priority.

### [P2-3] `/api/admin/action` uses raw `req.json()` with no body-size limit (inconsistent with every other route)
- **File(s):** `app/api/admin/action/route.js:37-42`.
- **Category:** Missing body-size limit / inconsistency.
- **Description:** Every other body-reading route uses `readJsonLimited(req, MAX_BODY_BYTES_*)` to enforce a hard byte ceiling before buffering. `/api/admin/action` instead calls `await req.json()` directly with **no size cap**. It's admin-gated (low exposure), but an authenticated admin — or a Next.js runtime that buffers the whole body before the handler — can post an arbitrarily large payload that is fully materialized in memory before the field caps (`.slice(0,200)`) run.
- **Impact:** Memory pressure from an oversized admin POST; low because it's behind `requireAdmin`, but it's an inconsistency that defeats the centralized body-size defense.
- **Recommended fix:** Replace `req.json()` with `readJsonLimited(req, MAX_BODY_BYTES_TEXT)` and the same 413/400 handling the other routes use.

### [P2-4] `/api/admin/action` and `/api/admin/me`/`data` do auth AFTER the per-IP rate-limit but read full body before validating `target`/`action` shape
- **File(s):** `app/api/admin/action/route.js:43-95`.
- **Category:** Input validation shape.
- **Description:** `target` and `action` are destructured and compared against string literals; `body.subject`, `body.concept_key`, `body.id` are coerced/validated before use (good — `ORDER.includes`, `Number.isInteger`, allowlist Set). The validation here is actually solid. The only gap: no explicit type guard that `body` is an object before destructuring (`const { target, action } = body || {}` handles null, but a JSON array/number body would destructure to `undefined` and fall through to the `Unknown target` 400 — safe). No real vuln; noting that the route's validation is consistent with the rubric and correct.
- **Impact:** None material.
- **Recommended fix:** None required; included for completeness of the admin-route review.

### [P2-5] `/api/leaderboard` and other routes call `requireUser` → `supabase.auth.getUser(token)` on every request with no auth-result caching or separate auth-call budget
- **File(s):** `lib/adminAuth.js:85-97`, called from every authenticated route (`score`, `leaderboard`, `checkout`, `portal`, `admin/*`).
- **Category:** Resilience / external-call amplification.
- **Description:** Each authenticated request makes a network round-trip to Supabase Auth (`getUser`). There's no caching of the verified user within a short window, so an attacker holding a valid token can drive one Supabase-Auth call per request up to the per-IP/account limit. The auth call is wrapped in try/catch and fails to 401 (good), but it's an unbudgeted external dependency on the hot path.
- **Impact:** Supabase Auth rate/quota pressure under load; a Supabase Auth slowdown stalls every authenticated route (bounded by the 90/120s `maxDuration`, so no infinite hang).
- **Recommended fix:** Acceptable for launch. If Auth becomes a bottleneck, cache verified `{token → user}` for a few seconds (token already carries its own expiry).

### [P2-6] Webhook resolves `event.data` fields with loose typeof guards but trusts `currentPeriodEnd` parsing path; unmappable events ACK 202 (correct) — minor status-code nit
- **File(s):** `app/api/webhooks/polar/route.js:77-87`.
- **Category:** Status codes / error handling.
- **Description:** Signature verification is correct (raw-body Standard Webhooks, 403 on bad sig, 400 on parse error). Subscription field extraction is defensively typed. The non-subscription-event branch returns **202** (`:78`) and the unmapped branch also **202** (`:86`) — but the success path returns plain **200** with `NextResponse.json({received:true})`. Mixing 200/202 for "we accepted it, stop retrying" is harmless but inconsistent. More notable: an unmappable subscription event (`:83-87`) ACKs without recording anything — correct to avoid infinite retries, but it means a checkout whose externalId/metadata both went missing **silently never grants Pro** and there's only a `console.error` to catch it.
- **Impact:** A paying customer whose event can't be mapped silently never gets entitled, with only a log line. Low likelihood (checkout always sets `externalCustomerId` and `metadata.user_id`), but a money/trust risk if it happens.
- **Recommended fix:** Keep the ACK, but escalate unmapped subscription events to a `security_events`/alert row (not just `console.error`) so a dropped entitlement is visible. Normalize the ACK status code.

### [P2-7] No request-body validation that `image.data` length matches a sane decoded size before forwarding to the vision model envelope
- **File(s):** `lib/gradeInput.js:54-83` (`normalizeImage`), `lib/requestGuard.js:50` (`MAX_BODY_BYTES_IMAGE = 10MB`).
- **Category:** Body-size / cost.
- **Description:** Defense is layered and mostly good: the 10MB body ceiling streams-and-aborts (`readJsonLimited`), `normalizeImage` caps base64 at 4MB chars and magic-byte-sniffs the real type. But the *body* ceiling (10MB) is set so a multi-photo diagnostic can carry several images — yet the adaptive diagnostic step (`/api/score` diagnostic) accepts only **one** `image` per request. So the 10MB ceiling is ~2.5× larger than any single legitimate image needs, leaving headroom for a max-size JSON envelope around a max-size image on every grade/score call. Combined with the `:img` cap of 10/min and the vision model's per-call cost, an attacker who is Pro (or when Pro isn't sellable, *anyone*, since the photo gate at `grade.js:106`/`score.js:286` only bites when `proIsAvailable()`) can push ~10 × 4MB vision grades/min/IP.
- **Impact:** Expensive vision-model spend; bounded by the `:img` 10/min per-IP cap and global img budget, but the per-IP img cap is IP-rotatable and (when Pro isn't yet sellable) ungated by payment.
- **Recommended fix:** Lower `MAX_BODY_BYTES_IMAGE` closer to the real single-image max (e.g. ~5.5MB), and add a durable per-account `:img` cap (mirroring the practice cap) so image-grade cost can't be IP-rotated. Confirm the photo-grade gate's "open to everyone when Pro isn't sellable" stance is intended for launch.

### [P2-8] `clientKey` trusts `x-forwarded-for` / `x-real-ip` blindly — limiter keys are attacker-controllable off-Vercel
- **File(s):** `lib/rateLimit.js:90-99`.
- **Category:** Rate-limit bypass (identity spoofing).
- **Description:** `clientKey` returns `x-real-ip` (Vercel-set) else the first hop of `x-forwarded-for` else `"unknown"`. On Vercel `x-real-ip` is trustworthy. But if the app is ever run behind a different proxy, locally, or if a request reaches the function without Vercel's header rewriting, an attacker can set `x-forwarded-for` to a random value per request and get a fresh per-IP bucket each time — fully defeating the per-IP layer (the durable per-account caps on `/api/score` still hold; `/api/generate`/`/api/grade` do not have those). The code's own comment acknowledges this is "best-effort."
- **Impact:** Per-IP rate limiting bypassable via header spoofing in any non-Vercel-edge deployment; combines with P1-C to make `/api/generate` cost-abuse trivial.
- **Recommended fix:** Document/assert the Vercel-only trust assumption, and prefer `x-real-ip` exclusively (ignore `x-forwarded-for`) in production. Treat `"unknown"` (all header-less callers share one bucket) as suspicious — that single shared bucket is also a self-inflicted DoS surface (all non-browser clients collide).

### [P2-9] `weakConcepts` / `recentQuestions` count+length caps exist but `recentQuestions` sanitizer and `concepts` join feed straight into the prompt (prompt-injection passthrough, flagged-not-blocked)
- **File(s):** `app/api/generate/route.js:150-159`, `app/api/grade/route.js:89-95`.
- **Category:** Injection passthrough (flag for the LLM-audit agent).
- **Description:** Free-text client fields (`weakConcepts`, `recentQuestions`, `reasoning`, `question`, `targetConcept`) are length/count-capped and run through `reportInjection` (logs + auto-docks HIGH-severity on the grading routes via `shouldDockForInjection`). On `/api/generate`, injection is **logged only, never docked** (`:159`) — generation has no rubric to protect, but a successful generator injection can still produce a question whose signed token then rides into `/api/score` (mitigated there by the band-clamp at `score.js:381-383`, which the code explicitly calls out as the injection-mint residual defense). This is the correct layered posture; flagging as passthrough per mandate. Deep LLM-prompt analysis is the separate agent's job.
- **Impact:** Prompt content reaches the model; rating impact is bounded by the band-clamp and rubric-mean scoring. No direct money/score-manipulation path found.
- **Recommended fix:** None new here — the band-clamp + auto-dock + fenceGuard layering is sound. Defer prompt-hardening to the LLM-audit agent.

### [P2-10] Diagnostic step path dereferences `pickDiagnosticItem(...).id` / `.band` — null-crash possible only if a future bank edit breaks the 2-per-cell invariant
- **File(s):** `app/api/score/route.js:807-816`, `lib/diagnosticBank.js:64-69`.
- **Category:** Unhandled exception (latent).
- **Description:** `handleDiagnosticStep` calls `pickDiagnosticItem(item.subject, nextBand, asked)` and immediately reads `nextItem.id`/`nextItem.band`/`nextItem.question`. `pickDiagnosticItem` returns `null` when the `(subject, band)` cell is empty. Today this is unreachable: `nextDiagBand` clamps to `BAND_LADDER`, and `test/diagnostic-bank.test.js:17-29` CI-enforces exactly 2 items per `(subject × band)` across all 5 bands × 3 subjects. So the invariant holds. But the route does **not** defensively null-check `nextItem`, so a future bank edit (removing items, adding a 6th band to `BAND_LADDER` without bank coverage) would turn this into a 500/unhandled-throw inside the try (caught at `:829`, returns generic 500 — so not a server crash, just a confusing error and a wasted-but-refunded Groq charge).
- **Impact:** Latent — currently unreachable; would degrade to a caught 500 if the invariant breaks, not a hard crash.
- **Recommended fix:** Add `if (!nextItem) return <restart error>` before the dereference at `score.js:809`, so a bank/ladder drift fails closed into a clean restart instead of a generic 500.

### [P2-11] `chargeGlobalGroq` env reads `Number(process.env[...]) > 0` — a misconfigured `0` or negative silently reverts to the default budget
- **File(s):** `lib/rateLimit.js:169` (`envBudget`), `app/api/score/route.js:214` (`FREE_DAILY_PRACTICE_CAP` same pattern).
- **Category:** Integer-parsing pitfall / config foot-gun.
- **Description:** `envBudget(name, dflt)` returns the env value only when `Number(env) > 0`, else the default. So setting `GLOBAL_GROQ_BUDGET_PER_MIN=0` (intending "block all Groq") silently applies the **default 300**, not 0. Same for `FREE_DAILY_PRACTICE_CAP` (`score.js:214`): `=0` reverts to 5. An operator trying to emergency-disable Groq spend via env would believe they had, while spend continues.
- **Impact:** Config-driven emergency throttle doesn't work as an operator would expect; could prolong a cost incident.
- **Recommended fix:** Distinguish "unset" (use default) from "explicitly 0" (honor it as a hard stop). Parse with `Number.isFinite` and allow `>= 0`.

---

## What was checked and found SOUND (no finding)

These are the high-value attack vectors I specifically tried to break and could not:

- **Question-token forgery / replay (P0 candidate):** `lib/questionToken.js` uses HMAC-SHA256 over a base64url payload with `timingSafeEqual`, a length cap (16384), kind-separation (`k:"diag"` rejected by `verifyQuestionToken` and vice-versa), `exp` checked after the MAC, and a `jti` deduped by `save_progress_for` *and* a cheap pre-check (`score.js:332`). Every rating-relevant field is derived from the verified payload, never the body. A client **cannot** forge a question, replay a grade, label an easy question `phd` (band-clamped at `score.js:381`), or mint a diagnostic walk. This is the strongest part of the codebase.
- **Diagnostic chain integrity:** Each step's server-computed grade is folded into the next HMAC-signed token; step coherence is validated (`score.js:692-702`: mid-run token, in-range step, item exists in bank under subject, exactly step−1 prior grades). Finalize requires exactly one completed chain per subject with full transcripts, and re-resolves every entry's item against the bank (`score.js:863-894`). No grade forgery, step-skip, or band self-selection.
- **Body-size limits:** `readJsonLimited` streams and aborts at the byte ceiling *before* full buffering (`requestGuard.js:72-101`) — handles spoofed/absent Content-Length. Text routes 64KB, image routes 10MB. Applied on generate/grade/score/leaderboard. (Gap: admin/action — see P2-3.)
- **Image validation:** Base64 alphabet check, 4MB char cap, MIME allowlist, **and magic-byte sniffing** with declared-vs-detected mismatch rejection (`gradeInput.js:54-83`). Arbitrary bytes / forged MIME cannot reach the vision model.
- **numericVerify sandbox:** AST allowlist (no assignment, property access, function-def, ranges, blocks), mathjs `evaluate/import/createUnit/parse` disabled on the instance, 240-char cap, ASCII-only. **No `eval`, no `new Function`, no ReDoS** (all regexes are linear, length-bounded). (Minor CPU note: P2-2.)
- **Upstream LLM controls:** 30s `AbortSignal.timeout` on the Groq fetch (`groq.js:311`), `max_tokens` defaulted (1200) and per-call capped (1800/3000), at-most-2-calls for image (vision tried once, text fallback once), hard-error (401/403/429/5xx) not retried, route `maxDuration` 90/120s bounds total hang. No uncontrolled LLM cost from retries or runaway tokens.
- **Method guards:** Routes export only `POST`; Next.js App Router auto-returns 405 for undeclared methods. No GET/PUT/DELETE leak.
- **Same-origin + content-type guard:** `Sec-Fetch-Site` + `application/json` requirement blocks CSRF-style cross-site cost abuse on the cost-bearing routes (`requestGuard.js:26-36`).
- **Identity binding:** checkout/portal bind Polar to the JWT-verified `uid` (never body); webhook resolves user from verified `externalId`; leaderboard/score use `auth.user.id` only. No cross-user entitlement or score write.
- **Error leakage:** Every route logs the real cause server-side and returns a generic message; Groq status/body never leaks. Status codes are largely consistent (403/415/413/400/429/402/409/500/503/502 used appropriately). Minor nit at P2-6.
- **Durable rate-limit RPC:** `rate_limit_hit` / `rate_limit_refund` are `security definer`, `search_path=public`, service-role-only granted, RLS-on no-policy table. Bucket key `left(p_bucket,200)` bounds key length. No SQL injection (parameterized RPC args).
- **Fail-closed where it matters:** Webhook 500s (Polar retries) when the store is down rather than dropping an entitlement; diagnostic start 503s without a signing key; `/api/score` practice 503s without service-role.

---

## Recommended launch-gate priority

1. **P1-A + P1-C + P1-D + P2-8** are one connected problem: the anonymous cost-bearing routes (`/api/generate`, `/api/grade`) are protected by an IP-keyed (spoofable) per-request limiter plus a single shared global counter that doubles as an availability weapon, and the whole thing fails open. **Add a challenge (Turnstile/PoW) or session-binding to the anonymous LLM routes before launch**, and make the global budget fail-closed for charges. This is the highest-leverage fix.
2. **P1-B** — fix the partial-charge budget leak (small, contained code change).
3. **P2-3, P2-10, P2-11** — small hardening (admin body cap, diagnostic null-check, env-0 honoring).
