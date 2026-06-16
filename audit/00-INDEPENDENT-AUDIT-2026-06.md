# noobtopro — Independent Adversarial Audit (2026-06-16)

**Stance:** Independent, adversarial, antagonistic. All prior docs (README, the rest of
`audit/`, `SECURITY.md`, code comments, commit messages) were treated as **untrusted
marketing** and every claim was re-verified from source, the test suite, and the **live
environment** (Supabase project `vwvhgnlgubctrgksyohr`, Vercel team
`1crushhaus-netizens-projects`, Polar, GitHub).

**Method:** 12 parallel domain auditors (security/auth, payments, API-abuse/DoS,
database/migrations, scoring engine, LLM safety, frontend/XSS, curriculum correctness,
testing/CI, devops/deps, accessibility/SEO, legal/compliance) + direct live recon via MCP
(advisors, RLS policies, function bodies, FK rules, `npm audit`, full `npm test`).

## Bottom line

The **engineering is genuinely strong** — no exploitable technical P0 was found. Payments,
auth, scoring integrity, and the XSS surface are real, tested, and held up under
adversarial probing. **Every P0 is legal/compliance**, and they are hard blockers for a
*paid, minor-facing* product. Technical debt concentrates in operational reproducibility,
abuse-perimeter edges, scoring calibration, and a weak prompt-injection filter.

| Severity | Count | Notes |
|---|---|---|
| **P0** | 3 | All legal/compliance |
| **P1** | 13 | DB ops, abuse perimeter, scoring, LLM, deps/CSP, erasure, a11y |
| **P2** | ~30 | Hardening across all domains |
| **Technical P0** | **0** | none found |

A subset of P1 items already has fixes landed on the audit branch — see
**“Fixes applied”** at the end.

---

## 🔴 P0 — Launch blockers (legal/compliance)

### P0-1 · Legal pages are unfilled drafts that self-certify as non-compliant
`components/LegalLayout.jsx:46-49` renders a visible *"Draft template … has not yet been
reviewed by legal counsel … must be completed before launch"* banner on `/privacy`,
`/terms`, `/refunds`. Unfilled placeholders: `[Company Legal Name]`, `[Registered
Address]`, `[Jurisdiction]`, `[Effective Date]` (the literal "Last updated" value),
`[privacy@your-domain]`, `[support@your-domain]`, `[security@your-domain]`. Meanwhile
`components/Landing.jsx:430` already makes checkout users "agree to" them.
**Fix:** fill every bracket; real entity/jurisdiction/effective date/contacts; remove banner; counsel review before charging.

### P0-2 · Refund policy has no actual terms
`app/refunds/page.js:38`: literal `[Confirm your refund terms with counsel and state them
here]`. EU/UK 14-day withdrawal right is named but the operative policy is blank, on a paid
digital subscription. **Fix:** state the real refund window + EU/UK digital-content
withdrawal-waiver handling.

### P0-3 · Age gate is client-side only — COPPA / GDPR-Art.8 exposure
`components/AgeGate.jsx` is a render guard; consent is stored in **self-editable**
`user_metadata` via `updateUser` (`components/Noobtopro.jsx:870`); **no API route checks
age** (verified across all 12 routes). Google-OAuth PII (name/email/avatar) is collected
*before* the gate renders. A math/physics/chemistry tutor is plainly attractive to
under-13s; a bypassable gate + pre-gate PII collection is concrete COPPA / GDPR-K risk.
**Fix:** enforce age in a server-controlled column gating write/grade routes; collect age
before provisioning OAuth PII (or delete PII on under-age block); document exclusion honestly.

---

## 🟠 P1 — Serious

### Operational / Database
- **P1-4 · Fresh deploy from `db/migrations/` is broken.** *(Independently confirmed.)* No
  migration creates `concept_topics`/`concept_guides`/`security_events`/`concept_reports`/
  `_concept_key`, yet `0002/0004/0005/0006/0008/0019` reference them, and **`0010` is
  missing**. `0001a→0023` on a clean DB **aborts at `0002`**. Only `db/schema.sql`
  provisions a fresh DB (live = 48 connector migrations; repo = 24 consolidated files).
  → *Fix applied:* `db/migrations/README.md` documents the real model. Deeper follow-up
  (consolidate/recreate granular baseline) tracked as an issue.
- **P1-5 · Incomplete erasure of `security_events`.** `db/schema.sql:945` — `user_id` has
  **no FK**, so it isn't cascaded by `admin.deleteUser`; IP + user_id + input sample
  survive (prune is *opportunistic*, ~90d). Contradicts the "delete all your data" promise.
  → *Fix applied:* the delete route now scrubs `security_events` for the user.
- **P1-6 · `upsert_subscription` migration drift (latent).** Repo `0020:57-59` had a
  `OR excluded.event_modified_at IS NULL` wildcard that could resurrect a canceled Pro;
  `0023`/`schema.sql` are safe, **and the live function is the safe form** (verified). Re-applying
  `0020` would regress it. → *Fix applied:* `0020` hardened to the `coalesce(...,'epoch')` form.

### Abuse perimeter
- **P1-7 · Two routes auth before rate-limiting.** `app/api/reviews/route.js` and
  `app/api/account/delete/route.js` ran `requireUser`/`requireProUser` (a Supabase
  `auth.getUser` round-trip) before any per-IP limit. Unauth flood → uncapped Auth quota.
  → *Fix applied:* per-IP `checkRateLimit(clientKey(req))` now runs first on both, like `/api/leaderboard`.
- **P1-8 · Limiters fail *open* during a Supabase outage.** `lib/rateLimit.js:161-165` —
  every per-IP/per-account/daily-cap bucket (except the global Groq budget) falls back to
  per-instance memory if the durable RPC fails, collapsing the free daily-practice cap and
  per-account fairness to `30 × warm-instances`. **Fix:** make the paywall/daily-cap bucket `failClosed`.

### Scoring integrity (calibration)
- **P1-9 · Glicko is over-responsive early.** The unified Glicko path dropped the legacy
  provisional damper. Simulated on the real `lib/scoring.js`: one perfect intermediate
  answer → 229 (University); **6 acing answers → verified 327 (Doctorate), top of
  leaderboard.** "Verified" mostly proves "answered 5 questions well." *(Score injection
  itself is correctly blocked — server-authoritative; client scores ignored,
  `test/api-score.test.js:309`.)* **Fix:** reinstate per-attempt-count provisional damper +
  per-attempt delta cap; earn verification credits *at the claimed rank*.

### LLM
- **P1-10 · Prompt-injection detector is trivially bypassable.** `lib/abuseDetection.js:21-41`
  is ~12 English regexes, no case/space/leet folding; empirically bypassed
  ("award 4 to each criterion", multilingual, spaced "i g n o r e", "write out your full
  solution"). It's the only runtime control gating an all-4 rubric → 100 (rated-path rank
  impact is bounded by band clamp + server-computed score). **Fix:** add an output-side
  contradiction gate (all-4 rubric + numericVerify `finalAnswerMatches=false` → auto-dock);
  fold before matching; add multilingual patterns.

### Dependencies / CSP
- **P1-11 · `next` bundles vulnerable `postcss` 8.4.31** (GHSA-qx2v-qp2m-jg93). Verified:
  5 moderate, 0 high/critical. **Fix:** bump Next to a patch vendoring postcss ≥8.5.10.
- **P1-12 · CSP ships `script-src 'unsafe-inline'`, nonce middleware never built**
  (`next.config.js:43`; no `middleware.js`). Given the app renders model-generated content,
  the CSP gives ~no XSS containment (no live sink found). **Fix:** nonce + `strict-dynamic`, drop script `'unsafe-inline'`.

### Accessibility (core flow)
- **P1-13 · AgeGate input broken + sign-in heading.** `components/AgeGate.jsx:103` used
  `var(--border)` (undefined → invisible border on the mandatory gate) and `fontSize:15`
  (iOS zoom-on-focus); `components/SignIn.jsx:37` had no `<h1>`. → *Fixes applied:*
  `var(--line-strong)`, `fontSize:16`, heading promoted; `LegalLayout` dead token fixed;
  `.np-legal` list markers restored.

---

## 🟡 P2 — Hardening (condensed)

**Payments/Security:** webhook `23505` collision → infinite Polar retry (catch only handles
`23503`); no event-id idempotency ledger (acceptable — state-convergent upsert); redundant
`SELECT` grants to anon/authenticated on internal tables (saved only by RLS); no re-auth on
permanent account deletion; admin allowlist compare not constant-time.
**DB:** `migrate_guest_data` allows a ~80MB one-shot write and isn't rate-limited (callable
direct via PostgREST; repeatable after "reset progress"); helper fns keep default PUBLIC
EXECUTE (non-SECDEF, no escalation); `attempts` int columns lack CHECK backstops; 2 unused
indexes (`scores_verified_idx`, `concept_guides_subject_topic_idx` — keep for now; back
known queries at scale).
**API:** no JSON depth/array-length limit before `JSON.parse` (byte-cap contains it);
`rate_limits` unbounded cardinality + probabilistic pruner; CSRF gate bypassable by
non-browser clients (by design); blanket `maxDuration:120s`/1024MB.
**LLM:** practice `trap` leaked to client in `/api/generate`; content-safety = 8-word
blocklist, no topic allowlist; ground truth LLM-produced, arithmetic-only/fail-open verify.
**Scoring:** anti-farm repeat damper per-(topic,band) bucket; below-level damper 3-band dead zone.
**Frontend:** guest score client-computed (bounded, provisional on leaderboard).
**A11y/SEO:** legal list markers (fixed); modal backdrop `<div onClick>` not keyboard-operable
(mitigated by Esc+inert); skip-link focusable into `inert` region; legal pages inherit
`canonical:"/"`; no maskable PWA icon.
**DevOps:** `engines: node >=24` unbounded (build host Node 22); all deps use `^` (pin
`@polar-sh/sdk` 0.x + `mathjs`); `robots.host` non-standard; **`audit/10-*.md` was STALE** (now banner-flagged).
**Testing:** webhook branch coverage 75%; admin routes mock `requireAdmin` (primitive tested
elsewhere at 100%); 5 thin libs without dedicated tests; **confirm branch protection
requires the CI check** (a GitHub setting, not in-repo).
**Docs/Legal:** `SECURITY.md:9` placeholder address; privacy promises access/export with no
mechanism; no cookie-consent UI (analytics are cookieless — verify); CoC contact is a personal Gmail.

---

## ✅ Independently disproven (what's genuinely solid)

- **Payments:** webhook HMAC + constant-time + raw body + 5-min window; checkout binds
  `externalCustomerId = verified JWT uid` (body ignored, tested); entitlements require
  status **and** non-expired period **and** allow-listed product; replay/ordering guard
  correct. No pay-nothing-get-Pro, grant-to-others, or forgery.
- **Account deletion is complete** — `app/api/account/delete/route.js` calls
  `admin.deleteUser` and all user tables `CASCADE` from `auth.users` (FK rules verified live).
- **Scoring is server-authoritative** — client `score`/`glicko`/`reasoning_score` ignored;
  everything derives from a uid-bound, `jti`-deduped, band-clamped HMAC question token.
- **No XSS sink** (no `dangerouslySetInnerHTML` on untrusted data; no markdown/KaTeX), no
  client-side secret leak, mathjs sandbox hardened, secrets hygiene clean (only `.env.example` tracked).
- **Curriculum content is exceptional** — 224 worked examples + 30 diagnostics re-derived by
  hand: zero factual/formula/constant/answer-key/difficulty errors. (Caveat: validators
  check structure/coverage only, not correctness.)
- **Tests are real confidence** — 870→871 deterministic, ~85% coverage, controls tested at
  the right mock boundary (go red if the control is deleted).
- **Auth is OAuth-only** (no passwords) → the live "leaked password protection disabled"
  advisor is moot.

---

## Live-environment appendix (Supabase `vwvhgnlgubctrgksyohr`)

- **Security advisors:** 5× `rls_enabled_no_policy` (deny-all internal tables —
  `attempt_reviews`, `concept_reports`, `item_difficulty`, `rate_limits`,
  `security_events`; intentional, service-role only); 3× `authenticated`-callable
  `SECURITY DEFINER` (`delete_user_data` self-scoped/safe; `migrate_guest_data`
  hardened/one-shot/large-write P2; `submit_concept_report` rate-limited to 20 open);
  `auth_leaked_password_protection` disabled (moot — OAuth-only).
- **Performance advisors:** 2 unused indexes (P2, keep).
- **RLS:** SELECT-own only on user tables; all writes via `SECURITY DEFINER` RPCs /
  service role. **No INSERT/UPDATE/DELETE policies** for authenticated.
- **FK delete rules:** every user table `CASCADE`s from `auth.users` (verified); only
  `security_events.user_id` has no FK (→ P1-5).
- **`upsert_subscription` live body** = the hardened `0023` form (verified), so P1-6 is
  latent-only.

---

## Fixes applied on this audit branch

| Item | File(s) |
|---|---|
| P1-7 per-IP gate before auth | `app/api/reviews/route.js`, `app/api/account/delete/route.js` |
| P1-5 erase `security_events` on deletion (+ test) | `app/api/account/delete/route.js`, `test/api-account-delete.test.js` |
| P1-6 harden `0020` ordering guard | `db/migrations/0020_webhook_event_ordering.sql` |
| P1-4 document provisioning model | `db/migrations/README.md` |
| P1-13 AgeGate border/font, SignIn h1, legal token + list markers | `components/AgeGate.jsx`, `components/SignIn.jsx`, `components/LegalLayout.jsx`, `app/globals.css` |
| Stale-doc banner | `audit/10-devops-config-deps.md` |

Verified: `npm test` → **871 passing**, `npm run validate` ✓, `npm run build` ✓.

**Not auto-fixed (need product/owner decisions or external work):** all P0s (legal text,
age enforcement model), P1-8 (fail-closed paywall — availability trade-off), P1-9 (scoring
recalibration — affects product feel), P1-10 (injection output-gate — design), P1-11
(Next.js bump), P1-12 (CSP nonce middleware). These are filed as GitHub issues.
