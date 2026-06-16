# noobtopro — Master Audit Report

**Objective:** Find every P0/P1/P2 issue blocking **monetization** and **marketing**
launch, diagnosed objectively by an adversarial review fleet so the whole repo can be
fixed before going live.

**Date:** 2026-06-16 · **Branch:** `claude/nice-shannon-68zw9u` · **Scope:** entire repo (~30K LOC) + live Supabase project (read-only)

**Method:** 13 specialized antagonistic agents (each told to assume the code is broken
and ground every finding in `file:line`), one per domain, plus a live read-only Supabase
advisor scan. Per-domain detail lives in the sibling `audit/NN-*.md` files; this document
de-duplicates and prioritizes across them.

---

## 1. Verdict

The codebase is **substantially more solid than a pre-launch product usually is** —
server-authoritative scoring, real RLS, verified webhook signatures, no XSS/SSRF/IDOR
found, 811 green tests, and a **factually clean content corpus** (a genuine marketing
asset). It has clearly been through prior security rounds.

**But it is NOT ready to charge money or run a paid campaign.** The blockers are
concentrated in three areas that the engineering hardening did not cover:

1. **Monetization integrity** — Pro is sold but partly unenforced, partly unbuilt, and
   gated on the wrong condition (any Polar product grants Pro).
2. **Legal/trust artifacts** — none exist (Privacy, ToS, refunds, consent, age-gating,
   account deletion) for a paid product marketed to children.
3. **Marketing measurement & surface** — zero funnel analytics, and missing
   crawler/share/PWA basics.

None of these are exotic; all are fixable in a focused sprint. The deep engine
(scoring, DB, auth) needs hardening, not rebuilding.

---

## 1b. P0 remediation status (fixed in this PR)

All 12 launch-blocker P0s are addressed on `claude/nice-shannon-68zw9u` (full suite green
at 841 tests; production build passes). P1/P2 remain for follow-up PRs.

| P0 | Status | How |
|---|---|---|
| P0-1 product-id check | ✅ Fixed | Server gate requires the sub to be the configured `POLAR_PRODUCT_ID_PRO` (comma-list supported) — `lib/proStatus.js`, `lib/entitlements.js` |
| P0-2 answer history client-gated | ✅ Fixed | New Pro-gated `/api/reviews`; client SELECT on `attempt_reviews` revoked (migration 0018) |
| P0-3 worked solutions free | ✅ Fixed | `workedSolution`/`improvements` withheld server-side from non-Pro on `/api/score` + `/api/grade`; upgrade nudge; FAQ copy corrected |
| P0-4 "data export" unbuilt | ✅ Fixed | Removed the bullet from the Pro card |
| P0-5 webhook verifier untested | ✅ Fixed | `test/polarWebhook.test.js` exercises the real verifier (forgery/replay/wrong-secret) |
| P0-6 no Privacy Policy | ✅ Fixed (draft) | `/privacy` — fill placeholders + counsel review |
| P0-7 no Terms | ✅ Fixed (draft) | `/terms` — fill placeholders + counsel review |
| P0-8 no Refund policy | ✅ Fixed (draft) | `/refunds` — fill placeholders + counsel review |
| P0-9 analytics w/o consent | ✅ Fixed | Cookieless analytics disclosed in Privacy Policy (no blocking banner needed) |
| P0-10 no age gate | ✅ Fixed | `AgeGate` neutral self-declared age screen at sign-up (13+) |
| P0-11 no account deletion | ✅ Fixed | `/api/account/delete` (cancels Polar + cascades erasure) + Dashboard "Delete account" |
| P0-12 no funnel analytics | ✅ Fixed | `track()` for diagnostic/sign-in/checkout-start/checkout-success |

**Deploy / operator actions required before this is live:**
1. **Apply DB migration `0018`** — but only AFTER deploying the app code (it revokes
   client SELECT on `attempt_reviews`; the new `/api/reviews` route must be live first, or
   the review drawer breaks for Pro users). See the migration header.
2. **Fill the legal placeholders** (`[Company Legal Name]`, `[Jurisdiction]`, contact
   emails, `[Effective Date]`) and have counsel review `/privacy`, `/terms`, `/refunds`.
3. **Set `POLAR_PRODUCT_ID_PRO`** in production (already required for checkout) — the P0-1
   product check is enforced whenever it is set.
4. **Note the intended behavior change:** worked solutions + "how to reach 100" are now
   Pro-only (guests/free no longer receive them); existing accounts without an age
   acknowledgement will see the age screen once on next sign-in.

## 1c. P1 remediation status (fixed in this PR)

The P1 themes are addressed (full suite green at 854 tests; production build passes). Two
items are intentionally deferred with rationale.

| Theme | Status | How |
|---|---|---|
| T1 webhook idempotency/ordering | ✅ Fixed | `upsert_subscription` records `event_modified_at` + ignores out-of-order/replayed events (migration 0020); UNIQUE on `polar_subscription_id` |
| T2 anonymous-LLM cost/DoS | ✅ Fixed | `chargeGlobalGroq` refunds partial charges; global budget **fail-closed**; `clientKey` prefers platform IP; per-account cap on `/api/generate` |
| T3 ranking gaming | ✅ Fixed | below-level farm damper; verify-at-level gate (migration 0021); bare-token pre-grade dock |
| T4 content safety | ✅ Fixed | `isContentSafe` wired on `/api/generate`; docstring corrected; photo grading Pro-gated |
| T5 DB integrity | ✅ Fixed | CHECK on scores.score & item_difficulty.difficulty; indexes (migration 0019) |
| T6 frontend correctness/perf | ✅ Fixed | null-scores crash; single mastery fetch; diagnostic recovery; modal instead of window.confirm; memoized composer |
| T7 marketing surface | ✅ Fixed | robots, sitemap, manifest, apple-icon, 404, canonical/env |
| T8 accessibility (WCAG AA) | ✅ Fixed | contrast tokens; aria-live; landmarks+skip link; h1s; file-input label |
| T9 deps (dev CVE chain) | ⚠️ Deferred | dev-only (vitest/vite/esbuild), not in the prod bundle; needs a semver-major vitest 4 migration (changes async test timing) — its own PR. Prod deps gated in CI. |
| T10 CI gates | ◑ Partial | dependency-scan gate (prod high/critical) + coverage gate (≈86%/82%/79%) added. ESLint/typecheck gates deferred (large cleanup on a never-linted, untyped 30K-LOC repo). |
| T11 docs/legal | ✅ Fixed | LICENSE, SECURITY.md, CONTRIBUTING, domain consistency, Node pin, env docs |
| Free-cap fairness (02 P1-4) | ✅ Fixed | daily-practice slot refunded on duplicate/dock |
| Checkout/portal caps (01/02 P1-3) | ✅ Fixed | durable per-account cap on `/api/checkout` + `/api/portal` |
| Live env (T14 leaked-password) | ☐ Operator | enable Supabase leaked-password protection in the dashboard + prefer `ADMIN_USER_IDS` — config toggle, not code |

**Additional deploy/operator actions (P1):** apply migrations **0019, 0020, 0021**; set
`NEXT_PUBLIC_SITE_URL` for preview deploys; enable Supabase leaked-password protection.

## 2. Consolidated counts

Raw per-domain counts (before cross-domain de-duplication):

| # | Domain | P0 | P1 | P2 | Detail |
|---|---|:--:|:--:|:--:|---|
| 01 | Security & Auth | 0 | 3 | 7 | `audit/01-security-auth.md` |
| 02 | Payments & Monetization | 2 | 4 | 6 | `audit/02-payments-monetization.md` |
| 03 | API / Validation / Abuse | 0 | 4 | 9 | `audit/03-api-validation-abuse.md` |
| 04 | Database / Migrations / RLS | 0 | 4 | 10 | `audit/04-database-migrations.md` |
| 05 | Scoring / Ranking Engine | 0 | 3 | 8 | `audit/05-scoring-ranking-engine.md` |
| 06 | LLM / Content Safety | 0 | 3 | 6 | `audit/06-llm-content-safety.md` |
| 07 | Frontend / React / Perf | 0 | 5 | 10 | `audit/07-frontend-react-perf.md` |
| 08 | Testing / CI | 1 | 7 | 5 | `audit/08-testing-ci.md` |
| 09 | Marketing / SEO / Conversion | 3 | 7 | 5 | `audit/09-marketing-seo-conversion.md` |
| 10 | DevOps / Config / Deps | 0 | 2 | 5 | `audit/10-devops-config-deps.md` |
| 11 | Docs / Legal / Readiness | 6 | 6 | 5 | `audit/11-docs-legal-readiness.md` |
| 12 | Accessibility / Mobile / UX | 0 | 6 | 11 | `audit/12-accessibility-mobile-ux.md` |
| 13 | Curriculum / Content Correctness | 0 | 0 | 5 | `audit/13-curriculum-content-correctness.md` |
| 14 | Live Supabase advisor scan | 0 | 1 | 4 | `audit/14-live-environment-supabase.md` |
| | **TOTAL (raw)** | **12** | **55** | **96** | |

After de-duplication the unique P0 set is **12 launch blockers** in three clusters
(below). Many P1s collapse into ~11 themes.

---

## 3. P0 — Launch blockers (de-duplicated)

> "Latent" = no live exploit today but one config/feature-add away. "Active" = exploitable/wrong right now.

### Cluster A — Monetization integrity (must fix before charging)

**P0-1 · Pro entitlement is granted on ANY Polar product (no product-ID check).** *(Latent)*
`isActiveSubscription` gates only on `status` + `current_period_end`; the stored
`productId` is never compared to `POLAR_PRODUCT_ID_PRO`. The day a second/cheaper/free
product exists, any active sub grants full €9.99 Pro.
→ `lib/proStatus.js:28-38`; corroborated by DB (`audit/04` P1-3) and Testing (`audit/08` P1).

**P0-2 · "Progress trends + answer history" (sold Pro feature) is enforced client-side only.** *(Active)*
`loadReviews()`/`loadHistory()` read the data under SELECT-own RLS with **no server
entitlement check**; the UI only swaps which button renders. A free user reads the full
feature via devtools/PostgREST.
→ `lib/store.js:158-272`, `components/Dashboard.jsx:489-506`; corroborated by `audit/09` P0-3.

**P0-3 · "Full worked solutions / how to reach 100" sold as Pro but returned to everyone.** *(Active)*
`/api/score` returns `workedSolution`/`improvements` to every attempt regardless of Pro;
`ReviewList` renders them unconditionally. The Pro bullet is effectively false and the
upgrade incentive is undercut.
→ `app/api/score/route.js:479`, `components/ReviewList.jsx:97-107`.

**P0-4 · "Data export" is sold on the Pro card but does not exist.** *(Active — false advertising)*
Listed on the €9.99 card with no implementation anywhere.
→ `components/Landing.jsx:95`; deferred per `MONETIZATION_PLAN.md:42`; corroborated `audit/09` P0-2, `audit/11` F7.

**P0-5 · The Polar webhook signature verifier has ZERO tests (mocked in every test).** *(Risk on the money-write path)*
Signature verification is the only authentication on the entitlement-write endpoint, yet
`lib/polarWebhook.js:17` is mocked everywhere — a forgery/SDK-error-mapping bug cannot
surface. (The verifier code itself reads correct; it is simply unverified.)
→ `test/api-webhook-polar.test.js:12`.

### Cluster B — Legal / trust (hard requirements for payments + ad networks + app stores)

**P0-6 · No Privacy Policy** — app sends users' (and children's) answers + photos to Groq with no disclosure. → `audit/11` F1.
**P0-7 · No Terms of Service / EULA** for the €9.99/mo subscription. → `audit/11` F2.
**P0-8 · No Refund / Cancellation policy** for the paid tier. → `audit/11` F3.
**P0-9 · Analytics + Speed Insights ship with no cookie/consent notice** (GDPR/ePrivacy), while the FAQ claims "we don't sell your data" — a contradiction. → `app/layout.js:4-5,68-69`, `components/Landing.jsx:170`; `audit/11` F4.
**P0-10 · No COPPA / age-gating / parental consent** for a product explicitly marketed to "Elementary"-level kids. → `audit/11` F5.
**P0-11 · No real account deletion / right-to-erasure** — `delete_user_data()` wipes scores only, deliberately leaving `auth.users` + `subscriptions`; FAQ over-claims data control. → `db/schema.sql:454-474`; `audit/11` F6.

### Cluster C — Marketing measurement

**P0-12 · Zero funnel analytics.** `@vercel/analytics` mounts pageviews only; nothing
fires for diagnostic start, signup, checkout start, or purchase. A paid campaign cannot
be attributed or optimized — you would be flying blind on spend.
→ `app/layout.js:69`, `app/api/checkout/route.js`, `components/Noobtopro.jsx:549-578,674-691`; `audit/09` P0-1.

---

## 4. P1 — High-priority themes (de-duplicated)

**T1 · Webhook resilience.** No replay / out-of-order / idempotency guard; upsert
overwrites wholesale; event-supplied identity (`externalCustomerId`) trusted with no
ownership/product re-check → a stale `active` after cancel resurrects Pro, and a changed
externalId could move Pro to another account. → `audit/02` P1-1/P1-2, `audit/04` P1-3, `audit/08` P1.

**T2 · Anonymous LLM cost / availability DoS.** The unauthenticated paid routes
(`/api/generate`, `/api/grade`) are guarded by an IP-spoofable limiter that **fails open**
to per-instance counters on a Supabase hiccup, plus a single shared global Groq budget
(300/min) that doubles as a DoS weapon and **leaks budget on mid-loop denial**.
`/api/generate` also mints HMAC score-tokens with no per-account cap. Net: cheap to run up
the Groq bill and/or 429 every learner. → `audit/01` P1-1/2/3, `audit/03` P1-A/B/C/D, `audit/06` P1-3.

**T3 · Ranking can be gamed.** Easy-question aces always yield a positive Glicko step
(expected-score clamp), so a learner can grind beginner items to University+; the
"verified" leaderboard badge requires 5 attempts but **not 5 at-level** attempts; and the
deterministic pre-grade dock is bypassed by a single digit/operator. → `audit/05` P1-1/2/3.

**T4 · Content safety for minors.** The content-safety filter `isConceptSafe` is **dead
code** (never called), and photo/vision grading has **no OCR-injection scan and no content
gate** — any image from a child is graded unchecked. Ties directly to the COPPA blocker. → `audit/06` P1-1/2.

**T5 · DB integrity backstops.** `scores.score` and `item_difficulty.difficulty` have **no
CHECK constraints** (the [0,350] bound lives only in RPC clamps), and there is no index on
`scores.verified` (the leaderboard's hottest filter full-scans). → `audit/04` P1-1/2/4.

**T6 · Frontend correctness & perf.** A **reachable crash** indexing `null` scores on the
partial-baseline path; the 1878-line client monolith re-renders on every keystroke
(typing jank / poor mobile INP); per-concept mastery fetched twice per session; a
diagnostic dead-end; blocking `window.confirm`. → `audit/07` P1-1..5.

**T7 · Marketing surface.** No `robots.txt`, no `sitemap`, no web manifest, no
`apple-touch-icon`, no `not-found.js`, and canonical origin hardcoded with no env (preview
deploys emit prod origin). → `audit/09` P1-2..7.

**T8 · Accessibility (WCAG AA + legal exposure).** `--faint` and small subject-accent text
fail AA contrast in light theme; grading result has no `aria-live`; no `<main>`/skip-link
on Landing; signed-in pages have no `<h1>`; work-photo file input has no programmatic
label. → `audit/12` P1-1..6.

**T9 · Dependencies & runtime.** 10 npm vulns (1 critical: `vitest`<3.2.6 CVSS 9.8, plus
`esbuild`/`vite` high) — dev-only but unpatched and ungated; Node engine mismatch
(`engines.node >=24` vs runtime 22, warning-only). → `audit/10` P1-1/2, `audit/08` P1.

**T10 · CI gaps.** No linter, no typecheck/static analysis at all (JS project, no eslint/
tsconfig), no `npm audit` gate, no coverage gate. → `audit/08` P1.

**T11 · Free-cap fairness + missing trust docs.** Free daily cap is charged before
dedupe/dock and never refunded, and the window is rolling-24h not "daily"; plus missing
`LICENSE`, `SECURITY.md`, and a production-domain contradiction (`noobto.pro` vs
`noobtopro-umber.vercel.app`) that would break OAuth/Polar redirects at go-live.
→ `audit/02` P1-4, `audit/11` F8/F9/F10.

(Plus the live-env P1: enable Supabase leaked-password protection / confirm OAuth-only,
because the admin allowlist is only safe while password auth is disabled — `audit/14`.)

---

## 5. Recommended remediation sequence

**Phase 0 — Cannot take a single payment until done (P0-1..11):**
add `product_id` check + server-side entitlement gate on trends/history and worked
solutions; either build "data export" or remove the claim; add a real test against the
unmocked webhook verifier; ship Privacy Policy, ToS, Refund policy, cookie consent banner,
age-gate/parental-consent, and complete account deletion (extend `delete_user_data`).

**Phase 1 — Before a marketing push (P0-12 + T1/T2/T7/T9 hot items):**
wire funnel analytics events; add webhook idempotency/ordering; put a challenge
(Turnstile/PoW) or session-binding on anonymous Groq routes and make the global budget
fail-closed; add robots/sitemap/manifest/apple-touch-icon/not-found/canonical; bump
`vitest` to ^4 behind CI; align Node version.

**Phase 2 — Integrity + compliance hardening (T3/T4/T5/T8/T10):**
fix easy-farming + verified-badge difficulty + pre-grade dock; wire the content-safety
filter and add a photo content/OCR-injection gate; add DB CHECK constraints +
`scores.verified` index; fix AA contrast, aria-live, landmarks, h1s, file-input label; add
eslint + typecheck + `npm audit` + coverage to CI.

**Phase 3 — Polish (T6/T11 + the P2 backlog):**
fix the null-scores crash and split the monolith; free-cap fairness; LICENSE/SECURITY.md;
domain consistency; the 96 P2s in the per-domain reports.

---

## 6. Confirmed strengths (do not re-litigate; use in marketing)

- **Server-authoritative scoring**: HMAC question tokens, `jti` dedupe under advisory
  lock + unique index, optimistic concurrency, Glicko-2 numerically robust (no NaN/garbage
  ranks reproducible). Client never asserts correctness/score/difficulty. (`audit/05`)
- **Real data security**: RLS deny-all + SELECT-own everywhere, direct DML revoked,
  writes funneled through `SECURITY DEFINER` RPCs with pinned `search_path`; JWT
  server-verified; no IDOR; no client-exposed service-role key; no committed secrets. (`audit/01`, `audit/04`, `audit/10`)
- **Payment plumbing basics correct**: webhook signature verified over the raw body;
  checkout/portal bind to `auth.uid()`, never the client body. (`audit/02`)
- **No XSS / no SSRF**: all LLM/user output rendered as escaped React text; images are
  inline `data:` only with magic-byte sniffing; numeric verifier sandboxed. (`audit/06`)
- **Content is factually clean**: 224 guides + 30 diagnostic items validated; 70+ worked
  examples hand-checked, **0 wrong answers**. (`audit/13`) — a credible "accurate" claim.
- **811 tests green**, with genuine adversarial coverage in many areas. (`audit/08`)
- **Accessibility above baseline**: focus traps, reduced-motion kill-switch, chart text
  alternatives, 44px targets, pre-paint theme script. (`audit/12`)
- **Good security headers / CSP**, deny-by-default admin + Pro. (`audit/01`)

---

*Per-domain detail, with full code citations and recommended fixes, is in the
`audit/01`–`audit/14` files.*
