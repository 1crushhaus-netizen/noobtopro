# Security & Authentication Audit — noobtopro

**Auditor domain:** Security & Authentication
**Date:** 2026-06-16
**Scope:** lib/adminAuth.js, lib/supabase.js, lib/supabaseAdmin.js, lib/requestGuard.js, lib/entitlements.js, lib/polar.js, lib/polarWebhook.js, lib/proStatus.js, lib/questionToken.js, lib/rateLimit.js, lib/abuseDetection.js, lib/gradeInput.js, lib/numericVerify.js, all `app/api/*/route.js`, app/layout.js, components/SignIn.jsx, next.config.js, db/schema.sql + db/migrations/*.

## Summary

This is a **well-hardened codebase**. It carries the scars of an extensive prior audit program (P0–P3 markers throughout), and the highest-value attack surfaces — server-authoritative scoring, JWT verification, RLS lockdown, the payment/entitlement write path, prompt-injection — are genuinely defended, not just commented as defended. JWTs are verified server-side via `supabase.auth.getUser(token)`; identity is never trusted from the request body; RLS is SELECT-only with GRANT-layer revokes and SECURITY-DEFINER service-role-only write RPCs; the Polar webhook signature is verified and the entitlement write is service-role-only; the service-role key is never `NEXT_PUBLIC_`.

I found **no P0 (launch-blocker) defect** with a code basis. The findings below are P1/P2 hardening and defense-in-depth gaps, plus items requiring operational verification.

| Severity | Count |
|----------|-------|
| P0       | 0     |
| P1       | 3     |
| P2       | 7     |
| **Total**| **10**|

---

## P0 — Launch Blockers

None found. The classic launch-blocker classes were checked and are closed:

- **Auth bypass / client-trusted identity:** `requireUser`/`requireAdmin` derive identity ONLY from the verified JWT (`lib/adminAuth.js:85-111`). `/api/score`, `/api/checkout`, `/api/portal`, `/api/leaderboard` all bind to `auth.user.id`, never a body field.
- **Self-grant Pro / payment escalation:** the entitlement write is the Polar webhook only, signature-verified (`app/api/webhooks/polar/route.js:64-73` → `lib/polarWebhook.js`), writing via the service-role-only `upsert_subscription` RPC (`db/schema.sql:1320-1366`, revoked from anon/authenticated). `subscriptions` is SELECT-own; no client write path. Checkout binds `externalCustomerId = auth.uid()` server-side (`app/api/checkout/route.js:63`).
- **IDOR:** scores/attempts/attempt_reviews/concept_mastery/subscriptions are RLS SELECT-own (`db/schema.sql:151-177, 107-115, 135-140, 1313-1318`); all writes go through self-scoped (`auth.uid()`) or service-role RPCs. The leaderboard returns only aggregate tiers + the caller's own row, no cross-user identity (`db/schema.sql:1193-1285`).
- **Score self-assert:** RLS removed the client write policy; `save_progress_for` is service-role-only and the route computes the rating from server-stored state, binding it to a signed question token (`lib/questionToken.js`, `app/api/score/route.js:230-262`).
- **Service-role key leak:** `SUPABASE_SERVICE_ROLE_KEY` / `POLAR_*` / `GROQ_API_KEY` / `QUESTION_TOKEN_SECRET` are all non-`NEXT_PUBLIC_` and read only in server modules. No leak path found.
- **Injection (SSRF/code-exec):** the numeric-verifier sandbox (`lib/numericVerify.js`) uses an AST allowlist with `import/evaluate/parse/createUnit/simplify/derivative` disabled. The image path sniffs magic bytes and only forwards a `data:` URL to Groq — no attacker-controlled URL is fetched (`lib/gradeInput.js:54-83`). No `fetch`/URL is built from user input anywhere.

---

## P1 — High

### [P1] In-memory rate-limit fallback keys on spoofable IP headers — per-account caps are bypassable when the durable store is degraded
- **File(s):** `lib/rateLimit.js:93-99` (`clientKey`), `lib/rateLimit.js:128-155` (`checkRateLimit` fallback), `app/api/score/route.js:197-225` (per-account + free-daily caps)
- **Category:** Weak validation enabling abuse / cost & quota DoS / monetization bypass
- **Description:** `clientKey` derives the limiter key from `x-real-ip` then `x-forwarded-for` (first hop). On Vercel `x-real-ip` is platform-set and trustworthy, but `checkRateLimit` **silently falls back to the IP-keyed in-memory limiter** whenever the durable Postgres store errors or is unconfigured (`lib/rateLimit.js:145-154`). In that degraded mode an attacker who can reach the function with a chosen `x-forwarded-for` (e.g. any non-Vercel/self-hosted deploy, or a proxy that forwards the client header) gets `max × instances` Groq calls per minute by rotating the spoofed value. The **monetization gates** (FREE_DAILY_PRACTICE_CAP, the per-account `acct:<uid>` caps) are keyed by `uid` and thus NOT IP-spoofable — but they ALSO live behind the same `checkRateLimit` fallback, which for `acct:` keys degrades to a per-instance in-memory counter (still per-account, but per-instance, so the effective daily cap = `cap × instances`). A paying-tier’s "5/day free" promise can be exceeded by spreading requests across cold instances during any window where the durable RPC is down.
- **Impact:** The durable layer is the real protection; the fallback is explicitly weaker. For launch the risk is (a) Groq cost/quota DoS on the unauthenticated `/api/generate` and `/api/grade` if the durable store hiccups or the deploy isn’t behind Vercel’s `x-real-ip`, and (b) the free-daily-practice monetization cap multiplying by instance count under degradation. The global Groq budget (`chargeGlobalGroq`) is the backstop that bounds the absolute bill, which is why this is P1 not P0.
- **Recommended fix:** (1) Treat the durable-store outage as a hard availability event for the monetization caps specifically: when `acct:` keys can’t be enforced durably, fail closed (deny the over-cap call) rather than degrade to a per-instance counter. (2) Document/assert that production MUST run behind a trusted proxy that sets `x-real-ip` and that the app should NOT honor a client-supplied `x-forwarded-for` outside Vercel; consider stripping `x-forwarded-for` when `x-real-ip` is absent rather than using the client-controllable first hop. (3) Alert on the existing `console.warn("[rateLimit] durable store degraded …")` so degradation is operationally visible.

### [P1] `/api/generate` is unauthenticated and signs questions/diagnostic tokens — an anonymous client can mint unlimited valid score-bearing tokens (rating-inflation amplifier + free Groq)
- **File(s):** `app/api/generate/route.js:24-253`, `lib/questionToken.js:56-67` (`signQuestion`), `app/api/score/route.js:381-384` (band clamp)
- **Category:** Missing authz on a token-minting route / abuse amplification
- **Description:** `/api/generate` requires no auth (only the same-origin guard + IP/global rate limits) yet it returns a server-HMAC-signed `token` that `/api/score practice` accepts as authoritative for subject/question/band/topic/concept. The design mitigates the **rating** risk well: a generator prompt-injection that mints a trivial "phd" question is neutralized downstream by the band-clamp (`app/api/score/route.js:381-384`, opponent band ≤ stored level +1) and the rating math derives the score from the *answer*, not the claimed band. But the route still lets any anonymous caller (a) drive paid Groq generation at IP/global-budget scale, and (b) harvest a stockpile of valid 6-hour tokens for later use. The `conceptKey` drill path even performs an authenticated DB read (`concept_mastery`) when a token is present (`app/api/generate/route.js:120-143`) without rate-limiting that branch separately.
- **Impact:** Cost/quota abuse on the most expensive route (LLM generation), and the token TTL (6h, `lib/questionToken.js:28`) gives a wide replay/stockpile window. Real damage is bounded by the global Groq budget and the per-attempt jti-dedupe, so it’s an abuse/cost concern, not data theft.
- **Recommended fix:** Consider requiring auth for token-minting `/api/generate practice` (guests already can’t persist a score and `/api/score practice` 503s without the signing key). At minimum add a per-account durable cap to the generate route mirroring `/api/score`’s `acct:<uid>:practice`, and shorten `TOKEN_TTL_MS` to the smallest value that still outlasts a real session (6h is generous for a stockpiling attacker).

### [P1] CSRF / cost-DoS defense relies solely on `Sec-Fetch-Site`; the cost-incurring routes are otherwise unauthenticated
- **File(s):** `lib/requestGuard.js:26-36`, `app/api/generate/route.js:25-31`, `app/api/grade/route.js:26-31`
- **Category:** CSRF / forged-request cost DoS
- **Description:** `/api/generate` and `/api/grade` are unauthenticated and trigger paid Groq calls. The only same-origin gate is `isCrossSiteRequest`, which **allows** the request when `Sec-Fetch-Site` is absent/empty or `none` (`lib/requestGuard.js:28`). This is correct for genuine browsers (they always attach the header on cross-site fetches) but it deliberately lets through any **non-browser client** (curl, scripts, server-to-server) by design. Combined with no auth on these routes, a scripted attacker bypasses the "CSRF" gate entirely simply by not being a browser. The team clearly knows this (the comment calls it "defense-in-depth … not a substitute for a durable, per-account limiter").
- **Impact:** A determined attacker drives Groq cost via direct (non-browser) POSTs; the `Sec-Fetch-Site` gate only stops the *forced-cross-site-browser* (true CSRF) sub-case. Bounded by the global budget, so it’s availability/cost, not integrity.
- **Recommended fix:** Accept the residual (it’s explicitly an anti-CSRF, not anti-bot, control) but lean harder on the per-IP + global budgets, and consider gating `/api/grade` photo grading and `/api/generate` behind a lightweight proof (auth or a short-lived browser-issued nonce) before launch marketing drives traffic. Ensure `Origin` is also checked when present as a second signal (currently intentionally skipped — re-evaluate now that the CDN/proxy origin is known at build time, the same way `next.config.js` pins the Supabase host).

---

## P2 — Medium

### [P2] CSP keeps `script-src 'unsafe-inline'` — XSS payloads execute despite the otherwise-strong policy
- **File(s):** `next.config.js:39, 43`, `app/layout.js:53-64` (inline `THEME_INIT` script)
- **Category:** Weak CSP / defense-in-depth
- **Description:** `script-src 'self' 'unsafe-inline' …` and `style-src 'self' 'unsafe-inline' …`. The inline theme-init `<script dangerouslySetInnerHTML>` in `app/layout.js` plus Next’s hydration scripts are the cited reason. With `'unsafe-inline'` in `script-src`, the CSP provides no XSS mitigation for injected inline scripts — it’s an allow-list for connect/img/frame-ancestors only. The file’s own comment acknowledges a nonce-based policy is "the documented next step."
- **Impact:** If any reflected/stored XSS sink exists (none found in this audit, but the app renders model output and learner text extensively), the CSP would not contain it. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` are good and do bite.
- **Recommended fix:** Move to a nonce-based `script-src` via middleware (hash the `THEME_INIT` script or nonce it; Next 15 supports nonce propagation). Drop `'unsafe-inline'` from `script-src` once hydration scripts are nonce-tagged.

### [P2] `/api/admin/me` reflects the caller's verified email back even when not an admin, and is the only signal of admin membership
- **File(s):** `app/api/admin/me/route.js:26-27`
- **Category:** Minor info disclosure / consistency
- **Description:** The route returns `{ isAdmin, email: auth.user.email }`. `email` is the caller’s OWN verified email (not another user’s), so this is not cross-user leakage — but it returns the email on a route whose stated purpose is just the boolean UI hint. Returning more than `isAdmin` is unnecessary surface. It is correctly always-200 and re-verified on the privileged routes, so a spoofed `isAdmin` gains nothing (good).
- **Impact:** Low — the user already knows their own email. Noted for least-disclosure hygiene.
- **Recommended fix:** Return only `{ isAdmin }` unless the admin UI actually needs the email; if it does, that’s acceptable since it’s self-only.

### [P2] Admin allowlist email branch depends on `email_confirmed_at`; no admin allowlist by default means the admin surface is dark until configured — verify ADMIN_USER_IDS is used in prod
- **File(s):** `lib/adminAuth.js:44-54`
- **Category:** Auth hardening / configuration risk — **NEEDS VERIFICATION**
- **Description:** `isAdminUser` is deny-by-default and gates the email branch on `email_confirmed_at` (`lib/adminAuth.js:50-52`), correctly noting that an email/password provider (currently disabled) could otherwise let an attacker self-register an admin’s address. The app today offers OAuth-only (`lib/supabase.js:38-42`), and OAuth always sets `email_confirmed_at`, so this is safe **as long as email/password signup stays disabled in Supabase**. The stronger `ADMIN_USER_IDS` (UUID) branch can’t be spoofed by registering an address.
- **Impact:** If a future operator enables email/password auth in the Supabase project AND relies on `ADMIN_EMAILS`, the `email_confirmed_at` gate is the only thing standing between an attacker and admin — and Supabase can be configured to auto-confirm. This is a config-coupled risk, not a current code defect.
- **Recommended fix:** Prefer `ADMIN_USER_IDS` (UUIDs) for the production admin allowlist over `ADMIN_EMAILS`. Document that enabling email/password auth requires re-reviewing this gate. **Verify** in the live Supabase project that email/password signup is disabled and email auto-confirm settings are understood.

### [P2] Polar webhook acknowledges (202) unmappable events without persisting; replay/idempotency relies on Polar's signature timestamp window
- **File(s):** `app/api/webhooks/polar/route.js:82-115`, `lib/polarWebhook.js:17-24`
- **Category:** Replay / webhook robustness — **NEEDS VERIFICATION**
- **Description:** The webhook verifies the Standard-Webhooks signature (which includes `webhook-timestamp` and `webhook-id`) and upserts the latest subscription state. There is no application-level replay store (no `webhook-id` dedupe table); the route relies on `validateEvent` for both signature and timestamp-tolerance. The upsert is idempotent (state-overwrite by user), so a replay of the *same* event is harmless. A concern would be replay of an **older** `active` event after a `canceled` event to resurrect Pro — but `upsert_subscription` always writes the event’s own `current_period_end`, and `isActiveSubscription` re-checks `current_period_end <= now` (`lib/proStatus.js:31-36`), so a stale `active` whose period has elapsed reads as non-Pro. This closes the obvious resurrection path.
- **Impact:** Low given the period-end backstop, but a replayed not-yet-elapsed `active` event could briefly re-extend Pro after a cancel if Polar’s timestamp tolerance is wide and event ordering isn’t guaranteed.
- **Recommended fix:** **Verify** the `@polar-sh/sdk/webhooks` timestamp tolerance window. Optionally add a `webhook-id`/`updated_at`-monotonic guard in `upsert_subscription` (ignore an event whose `current_period_end`/event time is older than the stored one) to make ordering robust.

### [P2] `successUrl` honors `POLAR_SUCCESS_URL` env verbatim; origin-derived fallback is safe but the env value is unvalidated
- **File(s):** `lib/polar.js:59-64`, `app/api/checkout/route.js:49-67`
- **Category:** Open-redirect (low, operator-controlled)
- **Description:** The checkout success URL is either `POLAR_SUCCESS_URL` (used verbatim) or `${origin}/?checkout=success` where `origin` is the **request’s own** origin, not a body-supplied value (`app/api/checkout/route.js:51-54`) — so the client cannot point the redirect elsewhere. The only redirect-target control is the server env var, which is operator-set. This is not a user-facing open redirect.
- **Impact:** Negligible as a vulnerability (operator would have to misconfigure their own env). Listed for completeness because the audit mandate calls out POLAR_SUCCESS_URL.
- **Recommended fix:** Optionally validate that `POLAR_SUCCESS_URL` is same-origin / on an allow-listed host at startup, so a typo can’t silently redirect paying users off-site.

### [P2] OAuth `redirectTo: window.location.origin` is safe, but no explicit post-login `next`/return-path allow-list exists for future use
- **File(s):** `lib/supabase.js:44-52`
- **Category:** Open-redirect prevention (defense-in-depth)
- **Description:** `signInWithOAuth` sets `redirectTo: window.location.origin` — a fixed, same-origin destination with no user-controlled `next` parameter, so there is no open-redirect today. PKCE flow is used (`lib/supabase.js:24`), keeping tokens out of the URL fragment.
- **Impact:** None currently. Flagged so that if a "return to where you were" feature is later added, it must validate the return path against a same-origin allow-list rather than reflecting a query param into `redirectTo`.
- **Recommended fix:** Keep `redirectTo` fixed; if a return-path is added, allow only relative same-origin paths.

### [P2] `security_events`/`abuseDetection` stores client IP and matched snippets; the IP is from spoofable headers and snippets echo attacker text
- **File(s):** `lib/abuseDetection.js:116-135`, `lib/rateLimit.js:93-99`, `db/schema.sql:918-934`
- **Category:** Data hygiene / minor PII
- **Description:** Logged `ip` comes from `clientKey` (spoofable `x-forwarded-for` when `x-real-ip` is absent), so admin-visible IPs may be attacker-chosen and shouldn’t be treated as ground truth. The `sample` snippet is a capped slice of matched injection text (≤500 chars) — admin-only (service-role read, no client policy), which is correct, but it does persist attacker-supplied content into a table an admin renders. The table is RLS-on/no-policy (service-role only), so no client read path — good.
- **Impact:** Low. Risk is (a) misleading IP attribution and (b) stored-content rendering in the admin UI (ensure the admin dashboard renders `sample` as text, not HTML).
- **Recommended fix:** Note in the admin UI that logged IPs are best-effort/spoofable. Confirm the admin dashboard escapes `sample`/`concept` when rendering (React does by default; avoid `dangerouslySetInnerHTML`).

### [P2] `Strict-Transport-Security` includes `preload`; verify the apex domain is actually submitted/ready before launch
- **File(s):** `next.config.js:57`
- **Category:** Header configuration — **NEEDS VERIFICATION**
- **Description:** `max-age=63072000; includeSubDomains; preload`. `includeSubDomains` + `preload` is a strong, **hard-to-reverse** commitment: every current and future subdomain of `noobto.pro` must be HTTPS-only forever (preload removal takes months). If any subdomain (e.g. a marketing/staging host) needs plain HTTP during the launch push, this will break it and can’t be quickly undone.
- **Impact:** Operational lock-in, not a vulnerability. Correct and desirable IF all subdomains are HTTPS.
- **Recommended fix:** **Verify** every `*.noobto.pro` host is HTTPS before relying on `preload`, and that submission to the HSTS preload list is intended. Otherwise drop `preload` (keep `includeSubDomains`).

---

## Notes on things checked and found SOLID (no finding)

- **JWT verification:** `requireUser` validates the token via `supabase.auth.getUser(token)` against the project anon client (`lib/adminAuth.js:85-97`) — real server-side verification, not a decode-and-trust. Diagnostic optional-auth never silently downgrades a *present-but-bad* token to guest (`app/api/score/route.js:653-658`).
- **Token security:** question/diag tokens use HMAC-SHA256 with `timingSafeEqual` constant-time comparison, length caps, kind-separation (`k` field), expiry checked after MAC, and a `jti` replay-dedupe enforced under an advisory lock in `save_progress_for` (`lib/questionToken.js`, `db/schema.sql:531-541`).
- **RLS & GRANTs:** every per-user table is SELECT-own with `revoke insert,update,delete,truncate from anon,authenticated`; all writes are SECURITY DEFINER + service-role-only or self-scoped via `auth.uid()` with `set search_path` pinned. Pro `subscriptions` is SELECT-own, write-revoked.
- **Mass-assignment / prototype pollution:** subject checks use `ORDER.includes(...)` (not object lookup) specifically to block `__proto__`/`constructor` (`app/api/generate/route.js:93`, `app/api/grade/route.js:77`, `app/api/admin/action/route.js:50`). API responses are built explicitly, never spreading raw model JSON.
- **Body-size DoS:** `readJsonLimited` streams and aborts at a hard byte ceiling before buffering (`lib/requestGuard.js:72-101`).
- **Error leakage:** Groq/Polar/DB errors are logged server-side; routes return generic messages (`lib/groq.js:315-321` → caught in route catch blocks). `X-Powered-By` is disabled.
- **Image handling:** magic-byte sniffing + MIME allow-list + size cap; only a `data:` URL (never an attacker URL) reaches Groq — no SSRF (`lib/gradeInput.js:54-83`).
- **Numeric verifier sandbox:** AST allow-list with all mathjs escape hatches disabled on the instance (`lib/numericVerify.js:56-101`).
