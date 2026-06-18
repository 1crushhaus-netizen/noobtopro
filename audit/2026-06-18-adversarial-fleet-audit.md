# noobtopro — Adversarial Fleet Audit (2026-06-18)

**Objective:** Independently re-verify the entire repository for P0/P1/P2 defects and
confirm whether the prior audit rounds' "fixed" claims actually hold — with special
scrutiny on the ~5,000 lines merged **since** the 2026-06-16 audit (PRs #122–#127: the
crawlable Learn library, the rank/mastery blend, SEO/AEO + HowTo structured data).

**Date:** 2026-06-18 · **Branch:** `claude/admiring-bohr-q0agp5` · **HEAD:** `5783e95`
· **Scope:** entire repo (~30K LOC) + live Supabase project (read-only).

**Method.** A fleet of **13 fully-independent, adversarial domain auditors** ran in
parallel, each instructed to (1) assume the code is broken, (2) treat README/`*_PLAN.md`/
code comments/commit messages **and the existing `audit/` folder as untrusted**, re-verifying
every claim against source, (3) ground every finding in `file:line`, (4) tag each finding
`[ACTIVE]` (exploitable/wrong now) vs `[LATENT]` (one config/feature-add away), and (5) make
no code changes (read-only scan). The orchestrator then de-duplicated across domains, ran a
live read-only Supabase **security + performance advisor** scan, and adjudicated the handful
of severity disagreements (noted inline). The testing auditor **executed** the suite, lint,
coverage, build, and `npm audit` rather than trusting documented numbers.

## Severity legend
- **P0** — critical: exploitable breach, auth/payment bypass, privilege escalation, data
  loss, secret exposure, or an **unshippable legal/compliance state** for a paid product
  marketed to minors.
- **P1** — high: real user/money/compliance/correctness impact; fix before or right after launch.
- **P2** — medium: quality, hardening, perf, UX, maintainability, minor correctness.

---

## 1. Headline verdict

The codebase remains **genuinely well-hardened and is more solid than a typical pre-launch
product** — the deep technical invariants survived a fresh adversarial pass and the live
environment corroborates the source review:

> **Zero P0 *technical* breaches were found.** No auth bypass, no IDOR, no privilege
> escalation, no payment/webhook forgery, no entitlement self-grant, no SQL/RLS cross-user
> read-write, no stored XSS, no SSRF, no prompt-injection that moves a grade, no numeric-verify
> sandbox escape, and a **factually clean curriculum** (all 224 guides + 30 diagnostic items
> independently recomputed → **0 content errors**). The test suite is **genuinely green
> (943/943)**, the production build passes, and lint/coverage/prod-audit gates are real and
> blocking.

**But it is still NOT ready to charge money.** Every launch-blocking P0 is concentrated in
**legal/compliance readiness** plus **one paid-feature paywall bypass** — not in the engine.
Additionally, PR #126 introduced a **rollout regression** that mass-demotes existing accounts
(P1), and the new Learn/SEO surface has a cluster of correctness/perf/contrast P1s.

**Net:** the engine needs nothing rebuilt; a focused legal + monetization-integrity sprint
(plus the PR #126 regression) clears the path to launch.

---

## 2. Consolidated counts (raw, per domain — before cross-domain de-duplication)

| # | Domain | P0 | P1 | P2 |
|---|---|:--:|:--:|:--:|
| 01 | Auth, Session & Admin Security | 0 | 1 | 2 |
| 02 | Payments & Monetization Integrity | 1 | 0 | 3 |
| 03 | API Validation / Abuse / Cost-DoS | 0 | 1 | 4 |
| 04 | Database / Migrations / RLS | 0 | 0 | 2 |
| 05 | Scoring & Ranking Engine | 0 | 1 | 1 |
| 06 | LLM / Content Safety / Minor Safety | 0 | 2 | 2 |
| 07 | Frontend / React / Perf | 0 | 0 | 5 |
| 08 | Curriculum Content Correctness | 0 | 0 | 0 |
| 09 | SEO / AEO / Structured Data | 0 | 2 | 2 |
| 10 | Learn Library (new) | 0 | 1 | 4 |
| 11 | Accessibility / Mobile / UX | 0 | 1 | 4 |
| 12 | Testing / CI / DevOps / Deps | 0 | 0 | 6 |
| 13 | Legal / Privacy / Compliance / Docs | 5 | 1 | 2 |
| — | Live Supabase advisor scan | 0 | 0 | 1* |
| | **TOTAL (raw)** | **6** | **10** | **38** |

\* operator config (leaked-password protection); moot while OAuth-only.

After de-duplication and orchestrator severity adjudication, the unique **launch-blocker set
is 5 items** (4 legal/compliance + 1 paywall bypass), with **~10 P1 themes**.

---

## 3. P0 — Launch blockers (de-duplicated)

> Note: every P0 below is a **legal/compliance or monetization-integrity** blocker. None is a
> technical breach. Two of them are orchestrator severity calls flagged with rationale.

### Cluster A — Legal / compliance (cannot lawfully charge)

**P0-1 · Legal pages still ship as self-declared DRAFTS with unfilled placeholders.**
*(ACTIVE)* `components/LegalLayout.jsx:46-49` renders a live "Draft template … not reviewed by
legal counsel … complete before launch … not legal advice" banner on all three legal pages,
and live `[bracketed]` placeholders remain: `[Company Legal Name]`, `[Registered Address]`,
`[privacy@your-domain]`, `[support@your-domain]`, `[Jurisdiction]`, `[Effective Date]`
(`app/privacy/page.js:17,108,121,149-150`, `app/terms/page.js:17,95,112,127`). A
payments/MoR review, EU consumer law, and ad networks all require a real trading entity,
support contact, governing law, and effective date before charging.
→ *Re-verifies prior P0-6/7/8 ("Fixed (draft)") and F-02 as STILL OPEN. "Drafted" ≠ "launch-ready."*

**P0-2 · No concrete refund policy on a paid EU product.** *(ACTIVE)*
`app/refunds/page.js:38-50` states the EU/UK 14-day right generically, then leaves the
operative offer as `[Confirm your refund terms with counsel and state them here]`. The EU
"begin-now / waive-withdrawal" consent for immediately-provisioned digital services is never
captured at checkout. → *Re-verifies F-02 OPEN.*

**P0-3 · Privacy Policy data-flow is materially false — undisclosed Ahrefs tracker (NEW).**
*(ACTIVE)* Privacy §3/§4 list only Supabase/Groq/Vercel/Polar and claim analytics are "Vercel
… only," but the root layout also loads **Ahrefs** Web Analytics
(`app/layout.js:162-170`, allow-listed in `lib/csp.js:62-65`), undisclosed anywhere. This
tracker was introduced by the recent SEO work and contradicts the shipped policy. *(Orchestrator
note: the legal auditor rated this P0; the fix is small — disclose or remove — but on a paid
child-product an active, undisclosed processor in the privacy notice is a genuine
misstatement, so it blocks an honest launch.)* → `app/privacy/page.js:80-84` vs `app/layout.js:165-170`.

**P0-4 · Privacy Policy promises a data-export right the product does not implement.**
*(ACTIVE)* Privacy §6 grants access/correct/**export**/delete, but no export feature exists
and `MONETIZATION_PLAN.md:42` explicitly defers it; the DSAR contact is the placeholder
`[privacy@your-domain]`. A verified portability request cannot be honored.
→ `app/privacy/page.js:99-101`. *(Fix: reword to a manual email DSAR with a real inbox, or build export.)*

### Cluster B — Child-safety posture (policy + engineering decision)

**P0-5 · COPPA: a child-marketed product is gated only by a client-side, self-attested,
server-unenforced age screen.** *(ACTIVE)* Age is stored in user-editable
`user_metadata.age_ack_year` (`components/Noobtopro.jsx:872-883`); there is **no age column**
in `db/schema.sql` and **no `app/api/*` route reads age**; guests are ungated yet still send
answers + photos to Groq. No verifiable-parental-consent path exists. The product is marketed
at "Elementary" level (`components/Landing.jsx:71,378`). *(Orchestrator note: prior audit
F-07 rated this **P2**; escalated here to **P0** because the product is explicitly
child-marketed and ships kids' free-text + photos to a third-party LLM. This is partly a
policy decision — the alternative remediation is to stop marketing to under-13s and age-bound
guest content by default.)* → `components/AgeGate.jsx:33-74`.

### Cluster C — Monetization integrity

**P0-6 · "Progress trends" is a sold Pro feature but enforced client-side only.** *(ACTIVE)*
The "answer history" half is correctly server-gated (migration 0018 + `/api/reviews` behind
`requireProUser`), but the **trends** half is not: `attempts` keeps a SELECT-own RLS policy
(`db/schema.sql:172-175`) with no entitlement check, `lib/store.js:240-251` loads the trend
columns (`total_after`, `delta`, `created_at`) client-side regardless of Pro, and the only
gate is `proLocked` swapping a button (`components/Dashboard.jsx:560-568`). A non-Pro user
reads the full paid dataset directly via PostgREST. *(Orchestrator note: the monetization
auditor rated this **P0** "false advertising of a paid feature"; prior audit F-01 rated it
**P1** because the rows hold no PII — a paywall bypass, not a data breach. Listed as a
blocker for monetization integrity; if launch treats paid-feature parity as non-blocking it
downgrades to P1.)* → `db/schema.sql:172-175`, `lib/store.js:240-251`, `components/Dashboard.jsx:441-451,560-568`, `components/Landing.jsx:94`.

---

## 4. P1 — High-priority themes (de-duplicated)

**T1 · PR #126 mastery-blend mass-demotes existing accounts on rollout.** *(ACTIVE, NEW
regression)* `effectiveSubjectScore = round(depth × green/total)`; on an **empty or failed**
mastery load the coverage fraction is `0`, so the **headline score and rank label** collapse
to "0/350 · Elementary." `refreshMastery` flips `masteryLoaded=true` in a `finally` even when
`loadMastery()` returns `{error}` (no `.mastery`), so a DB error / the live `concept_mastery=0`
condition applies the blend with an empty map. Generic practice never sets a `conceptKey`
(`app/api/generate/route.js:269`), so **every pre-PR126 account** craters until it re-masters
concepts two aces at a time. Display-only (leaderboard/stored depth untouched) → P1, not P0.
→ `lib/promotion.js:128-138`, `components/Noobtopro.jsx:609-621`, `lib/store.js:200`.
*Fix:* distinguish a failed load from a legitimately-empty one (only blend on a successful
`res.mastery`); grandfather demonstrated depth.

**T2 · Anonymous LLM spend has no cumulative ceiling.** *(ACTIVE)* Every global Groq/image
budget uses a 60-second fixed window (`lib/rateLimit.js:222-251`); there is no daily/monthly
cap anywhere. An attacker pacing just under the per-minute ceiling sustains ~432K guest
text-grade/generate calls/day + ~86K image calls/day indefinitely. The per-minute cap bounds
*burst*, not *bill*. → *Re-verifies F-10 / audit-03 P1-A as STILL OPEN.* *Fix:* add a second
fail-closed bucket with a 24h/30d window.

**T3 · Content safety is inadequate for minors, with screening gaps on the guest path.**
*(ACTIVE)* Two findings: (a) the safety filter is an **8-word profanity/spam blocklist**
(`lib/contentSafety.js:26`) with zero coverage of self-harm, sexual-content-involving-minors,
grooming, violence, or non-English — not a meaningful minor-safety classifier; (b) the
model-authored diagnostic **`comment`** (the guest/minor path) is carried, persisted, and
rendered to the child **unscreened** (`app/api/score/route.js:860,958,979`,
`app/api/grade/route.js:241` → `components/Noobtopro.jsx:2050`), while every other free-text
field is wrapped in `redactUnsafe`. The generated `topic` label is likewise unscreened
(`app/api/generate/route.js:254`). → *Re-verifies F-06 as STILL OPEN; T4 "Fixed" is
overstated.* *Fix:* route all learner-facing model output through a real moderation classifier
(e.g. Llama-Guard) fail-closed; at minimum screen the diagnostic `comment` and `topic`.

**T4 · Learn pages are forced into per-request dynamic rendering (no static gen / no
revalidate).** *(ACTIVE, NEW)* All five `app/learn/**` page modules read `headers()` (for the
nonce) with no `generateStaticParams`/`dynamic`/`revalidate`, so the ~240 sitemap'd concept
pages re-render server-side on every crawl/cache-miss — defeating the PR's "cheap, cacheable,
crawlable hub" goal and hurting indexing TTFB. → `app/learn/[subject]/[rank]/[concept]/page.js:67`
(+ siblings). *Fix:* `generateStaticParams` + `force-static`/`revalidate`; ld+json is
non-executable data so the nonce buys nothing here — drop the `headers()` dependency.

**T5 · New Learn pages fail WCAG AA contrast in light theme.** *(ACTIVE, NEW)* Eyebrow/meta
text uses the raw bright subject accents via `subjectColor()` instead of the accessible
`--math-text`/`--phys-text` tokens that exist for exactly this: **math 3.81:1, physics
3.98:1** on white (AA needs 4.5:1). Affects the entire public SEO funnel.
→ `app/learn/page.js:114`, `app/learn/[subject]/page.js:93`, `…/[rank]/page.js:92`, `…/[concept]/page.js:130`.

**T6 · Stale/contradictory SEO signals on the money surface.** *(ACTIVE/LATENT, NEW)*
(a) The FAQPage JSON-LD shipped in the homepage HTML tells answer engines "A Pro tier is
**planned**" while Pro is live at €9.99 (`components/Landing.jsx:102` → `:182-190`) — an AEO
self-contradiction that suppresses conversions. (b) The origin env-override
`NEXT_PUBLIC_SITE_URL` that every canonical/OG/sitemap/robots URL depends on is **undocumented
in `.env.example` and not Vercel-wired**, and the code never reads `VERCEL_URL`, so preview
deploys emit production canonicals/OG — the preview-safety the comments promise does not exist.
→ `app/layout.js:13`, `lib/learn/seo.js:23`, `app/robots.js:12`, `app/sitemap.js:9`.

**T7 · Admin allowlist trusts provider-asserted email without `email_verified`/provider check.**
*(LATENT — conditional on enabling a non-email-verifying OAuth provider)* `isAdminUser`
authorizes on `email_confirmed_at` + an `ADMIN_EMAILS` match without checking the per-identity
`email_verified` claim or the provider; GitHub/Discord (encouraged in `AUTH_PROVIDERS.md`,
currently gated off) can stamp an unverified email → admin takeover if `ADMIN_EMAILS` is the
configured path. → `lib/adminAuth.js:44-54`. *Fix:* prefer `ADMIN_USER_IDS` (UUID) as the only
prod admin mechanism; if keeping email, require `email_verified` + provider check.

**T8 · Consent/disclosure surface for analytics is incomplete for EU traffic.** *(ACTIVE)*
Vercel Analytics, Speed Insights, **and the undisclosed Ahrefs beacon** (see P0-3) mount
unconditionally with no first-visit notice; ePrivacy still requires informing users at
collection. → `app/layout.js:162-176`.

---

## 5. P2 — Hardening / quality backlog (by domain, abbreviated)

**Auth:** secret-coupling fallback (token key derives from service-role key) is advisory-only,
not fatal (`lib/questionToken.js:40-43`, `instrumentation.js:34-40`); CSP retains an
`'unsafe-inline'` script-src **fallback** when no nonce is passed — currently unreached but a
latent footgun (`lib/csp.js:47-49`).

**Payments:** unset `POLAR_PRODUCT_ID_PRO` falls back to status-only Pro grant (latent; checkout
503s without it) (`lib/entitlements.js:32-34`, `lib/proStatus.js:64-70`); deploy-window where
the 7-arg `upsert_subscription` fallback has no ordering guard (`app/api/webhooks/polar/route.js:129-131`);
client `isPro` predicate ignores the product allow-list (cosmetic only) (`components/Noobtopro.jsx:404`).

**API/Abuse:** guest (uid-less) question tokens replayable once-per-account (cap-dodge, not
rating exploit) (`lib/questionToken.js:60-71`, `app/api/score/route.js:276`); `MAX_BODY_BYTES_IMAGE`
10 MB is ~2.5× a single image (`lib/requestGuard.js:50`); `numericVerify` permits
unbounded-magnitude `factorial`/`^` (overflows, not hangs) (`lib/numericVerify.js:72-78`);
`clientKey` falls back to client-controllable `x-forwarded-for` off-Vercel (`lib/rateLimit.js:95-103`).

**Database:** Polar webhook doesn't catch a `23505` from the `polar_subscription_id` UNIQUE
index → poison-pill 500 retry loop (latent) (`app/api/webhooks/polar/route.js:121-146`);
numbered migrations are a changelog, not a replayable chain — `schema.sql` is the canonical
from-scratch source (documented; F-05) (`db/migrations/README.md:8-29`).

**Scoring:** mastery "green" has no at-level requirement, so coverage (and the blended headline)
can be driven to full via easy aces — bounded by the depth damper + verified-leaderboard
(`lib/mastery.js:79-89`).

**LLM:** semantic rubric-inflation injection passes the structural-only auto-dock (bounded by
server-computed rubric + band clamp; unproven as a grade-mover) (`lib/abuseDetection.js:21-41`).

**Frontend:** footer `getFullYear()` year-boundary hydration edge (`components/Noobtopro.jsx:2299`);
`themeColor` hard-coded teal, not theme-aware (F-13) (`app/layout.js:68`); no `app/global-error.jsx`
boundary; `SignIn` crashes if rendered without `providers` (unreached) (`components/SignIn.jsx:31`);
AdminDashboard mid-delete focus jump (`components/AdminDashboard.jsx:60-69`).

**SEO:** home canonical resolves to trailing-slash origin while og:url/sitemap use bare origin
(Google normalizes; comment is wrong) (`app/sitemap.js:26-30`); `LearningResource.isPartOf`
references a `#course` node not emitted on the concept page (valid JSON-LD, non-local ref)
(`app/learn/[subject]/[rank]/[concept]/page.js:113`). *(HowTo targets a Google-deprecated rich
result but is intentional AEO — not a defect.)*

**Learn:** underscore-form concept URLs resolve to a duplicate 200 (canonical dedupes)
(`…/[concept]/page.js:63`); URL builders don't `encodeURIComponent` (latent — call sites gated)
(`lib/learn/seo.js:166-187`); `[subject]` page validates subject but not "has ≥1 populated rank"
(latent on data) (`app/learn/[subject]/page.js:46`); `getConceptData` runs twice per request
(metadata + page) — wrap in React `cache()` (`…/[concept]/page.js:41,64`).

**Accessibility:** AgeGate lacks `<h1>`/`<main>`/dialog-role on the active form
(`components/AgeGate.jsx:84`, `components/Noobtopro.jsx:1574`); Admin view has no `<h1>`
(`components/AdminDashboard.jsx:100`); Learn-tab filter chips are 28px touch targets on mobile
(`app/globals.css:631`); grading result wraps the entire breakdown in one polite live region
(verbose SR announcement) (`components/Noobtopro.jsx:2186`).

**Testing/CI/DevOps:** GitHub Actions pinned to floating major tags, not SHAs (F-14)
(`.github/workflows/ci.yml:28,31`, `codeql.yml:36,39,45`); prod-bundle moderate postcss XSS via
`next` (below CI high-gate); dev-only HIGH `undici` via `jsdom` (T9 — not shipped); CodeQL
upload is best-effort and merge-blocking depends on unverifiable branch protection; a stale
coverage-threshold comment (`vitest.config.js:23`).

**Legal/Docs:** `SECURITY.md:9` / `LICENSE:3,7,39` carry placeholder contacts/holder;
`DEPLOYMENT_PLAN.md` still uses `*.vercel.app` example URLs (mitigated by a canonical note).

**Live env (operator):** Supabase leaked-password protection disabled (WARN) — moot while
OAuth-only; enable before any password provider.

---

## 6. Re-verification of prior "fixed" claims (independent confirmation)

**Confirmed genuinely FIXED (held up under adversarial re-test):**
- Nonce-based CSP (#121) — minted per request, stamped on all inline/loaded scripts, no
  `'unsafe-inline'` in the enforced policy. (`middleware.js`, `lib/csp.js`)
- Pro product-id gating (P0-1) — `isProSubscription` requires the configured product; a
  different product does not grant Pro (tested). (`lib/entitlements.js:64-66`)
- Webhook idempotency/ordering (0020/0023) — hardened against NULL-timestamp resurrection;
  signature verified over the raw body, fail-closed on missing secret. (`db/schema.sql:1422-1426`)
- Account deletion (P0-11) — revokes Polar **and** cascade-erases `auth.users` + all 7 FK'd
  tables (not just scores). (`app/api/account/delete/route.js`)
- DB integrity (0019) — `[0,350]` CHECKs on `scores.score`/`item_difficulty.difficulty`,
  UNIQUE on `polar_subscription_id`, verified-leaderboard + FK indexes all present.
- Ranking-gaming defenses (T3) — below-level damper reaches 0 at gap ≥ 210; verify-at-level
  gate (0021); bare-token pre-grade dock. **F-09 below-level farming appears CLOSED** at HEAD.
- `numericVerify` sandbox — AST allowlist; eval/import/parse hard-disabled; escapes (incl.
  `constructor`) rejected; length/ASCII caps. No escape found.
- Frontend T6 set — null-scores crash hardened, single mastery fetch, diagnostic recovery,
  in-app modals replace `window.confirm`, memoized composer (real INP fix). F-17 avatar CLS
  resolved via fixed CSS dimensions.
- SEO F-03 — legal pages now carry self-referential canonicals; SoftwareApplication/Offer was
  **correctly removed** rather than fabricating ratings.
- A11y T8 (mostly) — contrast tokens, skip-link, `<main>`, per-view `<h1>`s (except Admin),
  aria-live grading, focus-managed/inert modals, color-only-cue fixes all verified.
- Testing — webhook verifier now has a **real (unmocked)** signature test; suite green
  (943/943); lint/coverage/prod-audit gates real and blocking; no committed secrets; Node
  engine consistent.
- LLM core — score server-computed from a clamped rubric, band HMAC-bound, HIGH-confidence
  injection auto-docked, no LLM output rendered as HTML, Groq key server-only/unlogged.

**Confirmed STILL OPEN (claim was aspirational or partial):**
- F-01 trends paywall (now P0-6 above) · F-02 legal placeholders/refund (P0-1/P0-2) ·
  F-06 content-safety blocklist + diagnostic comment (T3) · F-07 age-gate unenforced (P0-5) ·
  F-10 cumulative budget (T2) · F-11 guest-token replay (P2) · F-13 themeColor · F-14 action
  SHA-pinning · F-16 leaked-password (operator).
- **F-08 label-trap — WORSENED:** PR #126 promotes it from a label-only gate to zeroing the
  **headline score** on empty coverage (T1).
- **T4 content-safety "Fixed" — overstated:** wiring is asymmetric (T3).

---

## 7. Recommended remediation sequence

**Phase 0 — before taking a single payment (P0-1..6):** fill all legal placeholders + remove
the draft banner after counsel review; state a real refund policy + capture EU withdrawal
consent at checkout; disclose or remove Ahrefs (and complete the analytics disclosure);
reword or build data export; decide + enforce the COPPA posture (server-side age or stop
under-13 marketing); server-gate (or free) the "Progress trends" feature.

**Phase 1 — before a marketing push (T1/T2/T4/T6):** ship the PR #126 blend-rollout fix
(do not mass-demote the base); add a cumulative Groq spend ceiling; make Learn pages static;
fix the stale FAQ structured data + document/wire `NEXT_PUBLIC_SITE_URL`.

**Phase 2 — integrity + compliance hardening (T3/T5/T7/T8):** route learner-facing LLM output
through a real moderation classifier; fix Learn-page AA contrast; prefer `ADMIN_USER_IDS` +
verify email/provider; complete the EU analytics disclosure/notice.

**Phase 3 — polish:** the P2 backlog in §5 (action SHA-pinning, webhook `23505` handling,
numericVerify magnitude caps, a11y h1s/touch-targets, hydration/themeColor, doc placeholders).

---

## 8. Confirmed strengths (verified, not assumed — usable in marketing)

- **Server-authoritative scoring**: HMAC question tokens, `jti` dedupe under advisory lock +
  unique index, optimistic concurrency, Glicko-2 numerically robust; the client never asserts
  correctness/score/difficulty.
- **Real data security**: RLS deny-all + SELECT-own everywhere (live-scan corroborated), direct
  DML revoked, writes funneled through `SECURITY DEFINER` RPCs with pinned `search_path` and
  self-scoped to `auth.uid()`; no IDOR; no client-exposed service-role key; no committed secrets.
- **Payment plumbing correct**: signature verified over the raw body; idempotent/out-of-order-safe
  upsert; checkout/portal JWT-bound; no open redirect.
- **No XSS / SSRF / sandbox escape**: all LLM/user output rendered as escaped React text; images
  are `data:`-only with magic-byte sniffing; numeric verifier sealed.
- **Factually clean content**: 224 guides + 30 diagnostic items independently recomputed → 0 errors.
- **943 green tests** with genuine adversarial coverage; real lint/coverage/prod-audit CI gates.
- **Accessibility above baseline**: focus traps, reduced-motion kill-switch, color-cue glyphs,
  44px targets (most), aria-live, skip-link, landmarks.

---

*Method: 13 independent adversarial domain auditors (assume-broken, cite `file:line`, docs
untrusted) + a live read-only Supabase advisor scan, de-duplicated and severity-adjudicated by
the orchestrator. Supersedes nothing in `audit/` — it independently re-verifies the
`2026-06-16` round and audits the PR #122–#127 deltas.*
