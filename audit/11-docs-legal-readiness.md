# Audit 11 — Documentation, Legal & Launch Readiness

**Scope:** noobtopro (Next.js 15 educational SaaS, about to monetize via Polar at €9.99/mo Pro).
**Posture:** Adversarial / antagonistic. Every doc claim treated as stale until verified against code at `file:line`.
**Date:** 2026-06-16
**Method:** Read all top-level docs (README.md, DEPLOYMENT_PLAN.md, FEATURE_PLAN.md, MONETIZATION_PLAN.md, PRO_GO_LIVE.md, RANKS_PLAN.md, AUTH_PROVIDERS.md, .env.example); cross-checked a sample of claims against actual source (`app/`, `components/`, `lib/`, `db/`, config) with grep/read.

> **Headline:** This product is about to take money from consumers (often minors — it markets to "Elementary"-level learners and kids) and handle their personal data, but it has **ZERO legal/trust artifacts**: no Privacy Policy, no Terms of Service, no Refund/Cancellation policy, no Cookie/consent notice (despite shipping Vercel Analytics), no LICENSE, no SECURITY.md, no CONTRIBUTING. There is no privacy/terms link anywhere in the app UI. The app already markets "your data is private, we don't sell it" with nothing to back it. These are hard **launch blockers** — Polar (Merchant of Record), Apple/Google if ever wrapped, and EU/UK/CA law all require them.

---

## Summary table

| ID | Sev | Title | File(s) |
|----|-----|-------|---------|
| F1 | P0 | No Privacy Policy (anywhere — repo or app) | MISSING |
| F2 | P0 | No Terms of Service / EULA | MISSING |
| F3 | P0 | No Refund / Cancellation policy for the paid tier | MISSING |
| F4 | P0 | Vercel Analytics shipped with no cookie notice / consent (GDPR / ePrivacy) | `app/layout.js:4-5,68-69` |
| F5 | P0 | No COPPA / age-gating / parental-consent handling for a kids-facing paid product | MISSING; `lib/scoring.js:119`, `RANKS_PLAN.md:47` |
| F6 | P0 | No account-deletion / right-to-erasure path; "reset" leaves `auth.users` + subscription; FAQ over-claims | `db/schema.sql:454-474`, `components/Landing.jsx:170`, `README.md:573` |
| F7 | P1 | "Data export" advertised as a paid Pro feature but not built | `components/Landing.jsx:95`, `MONETIZATION_PLAN.md:42` |
| F8 | P1 | No LICENSE file | MISSING |
| F9 | P1 | No SECURITY.md (vuln disclosure) for a product handling PII + payments | MISSING |
| F10 | P1 | Production-domain contradiction across docs/code (`noobto.pro` vs `noobtopro-umber.vercel.app`) | `app/layout.js:10`, `README.md:74`, `AUTH_PROVIDERS.md:16` |
| F11 | P1 | DEPLOYMENT_PLAN states wrong Node engines pin (doc↔code) | `DEPLOYMENT_PLAN.md:202` vs `package.json` |
| F12 | P1 | `QUESTION_TOKEN_SECRET` read by code but undocumented in `.env.example`/README | `lib/questionToken.js:37` |
| F13 | P2 | README is 613 lines / 136 KB and unusable as onboarding (embedded audit-runbook) | `README.md` |
| F14 | P2 | Three different, all-wrong test counts in the README | `README.md:139,467` |
| F15 | P2 | Stale migration references ("0001a–0009 applied", "migration 0010") | `README.md:127,330+` |
| F16 | P2 | No CONTRIBUTING / CODE_OF_CONDUCT | MISSING |
| F17 | P2 | DEPLOYMENT_PLAN / AUTH_PROVIDERS predate monetization; never mention Pro/Polar | docs |

**Counts:** P0 = 6, P1 = 6, P2 = 5.

---

## P0 — Launch blockers

### [P0] F1 — No Privacy Policy anywhere (repo or app)
- **File(s):** MISSING: Privacy Policy. Confirmed absent: no `privacy`/`terms`/`legal` route under `app/` (`find app -type d` shows none); the only "privacy" string in the codebase is the FAQ category label `cat: "Account and privacy"` (`components/Landing.jsx:165`). README has no privacy section (grep for "privacy policy|gdpr|coppa|data protection" → 0 hits).
- **Category:** Legal / trust artifact (required).
- **Description:** The app collects personal data (Google OAuth identity — `user.email`, name, avatar per `FEATURE_PLAN.md:37`; per-user scores/attempts in Supabase; IP-keyed rate-limit records; Vercel Analytics page telemetry) and is about to take payments. There is no published Privacy Policy describing what is collected, the legal basis, retention, sub-processors (Supabase, Groq, Vercel, Polar), or user rights. The app sends user-typed answers (and photos of handwritten work — potentially of minors) to a third-party LLM (Groq) with no disclosure.
- **Impact:** Illegal to operate for EU/UK (GDPR Art. 13/14), California (CCPA/CPRA), and many other jurisdictions. Polar as Merchant of Record and Stripe (its underlying processor) require a published privacy policy; any future app-store distribution mandates one. Sending children's work to a US LLM with zero disclosure is a serious data-protection exposure.
- **Recommended fix:** Publish a Privacy Policy as a real route (e.g. `app/privacy/page.js`), disclose all sub-processors (Supabase, Groq, Vercel Analytics, Polar/Stripe), data categories, retention, legal basis, and user rights incl. erasure. Link it in the footer and the sign-in screen. Do not flip `NEXT_PUBLIC_PRO_ENABLED=true` until this exists.

### [P0] F2 — No Terms of Service / EULA
- **File(s):** MISSING: Terms of Service. No `app/terms/*`; no ToS/EULA in repo (grep "terms of service|terms of use" → 0 hits in app/components/lib/README).
- **Category:** Legal / trust artifact (required).
- **Description:** A paid subscription product has no Terms of Service: no contract for the €9.99/mo subscription, no acceptable-use, no liability limitation/disclaimer, no governing law, no description of the recurring-billing terms, no statement that the rank "is not an accredited exam score" as a binding term (it's only an FAQ aside at `components/Landing.jsx:148`).
- **Impact:** No enforceable contract with paying users; no liability shield; payment processors and app stores require ToS for paid products. For an education tool used by minors, the absence of acceptable-use + disclaimers is acute.
- **Recommended fix:** Publish Terms of Service (`app/terms/page.js`), include subscription/auto-renewal terms (price, billing cadence, cancellation), disclaimers (educational tool, not accredited assessment), liability limits, governing law, and an acceptance checkpoint at checkout. Link in footer + checkout.

### [P0] F3 — No Refund / Cancellation policy for the paid tier
- **File(s):** MISSING: Refund/Cancellation policy. The only cancellation content is the operator runbook step `PRO_GO_LIVE.md:117-119` ("Manage / cancel → Polar customer portal"); there is no user-facing refund/cancellation policy. (Note: the codebase's many "refund" hits — e.g. `lib/rateLimit.js:202`, `app/api/score/route.js:625` — are Groq-budget bookkeeping, **not** money refunds.)
- **Category:** Legal / consumer protection.
- **Description:** A recurring €9.99/mo charge to consumers (incl. EU consumers with a statutory 14-day withdrawal right, and minors who may purchase without authority) ships with no refund or cancellation policy. Users are not told how to cancel, what happens to access after cancellation, or whether refunds are available.
- **Impact:** EU Consumer Rights Directive and many jurisdictions require pre-contract disclosure of cancellation/withdrawal rights; absence invites chargebacks, disputes, and processor penalties. Pro is being marketed already (`MONETIZATION_PLAN.md:31`) so this gap is live the moment Pro flips on.
- **Recommended fix:** Publish a Refund & Cancellation policy (price, renewal date, how to cancel via the Polar portal, access-until-period-end behavior matching `lib/proStatus.js`, EU withdrawal right). Surface it at checkout and in the footer.

### [P0] F4 — Vercel Analytics + Speed Insights shipped with no cookie notice or consent
- **File(s):** `app/layout.js:4-5` (`import { SpeedInsights }`, `import { Analytics }`), `app/layout.js:68-69` (`<SpeedInsights />`, `<Analytics />`); `package.json` deps `@vercel/analytics`, `@vercel/speed-insights`. No consent banner anywhere (grep for "consent|cookie banner" → none).
- **Category:** Privacy / GDPR / ePrivacy.
- **Description:** The app loads first-party analytics/telemetry on every page with no cookie/consent notice and no opt-in, while the FAQ assures users "Your data is private, and no, we do not sell it" (`components/Landing.jsx:170`). Even Vercel's cookieless mode requires disclosure under ePrivacy/GDPR; tracking minors compounds the risk.
- **Impact:** ePrivacy Directive + GDPR consent violation for EU/UK visitors; the unbacked "your data is private" claim becomes a misleading-statement exposure once analytics is running undisclosed.
- **Recommended fix:** Add a privacy/cookie notice describing analytics + a consent mechanism (or gate `<Analytics/>`/`<SpeedInsights/>` behind consent for EU traffic). At minimum disclose the telemetry in the Privacy Policy (F1) and reconcile the "private, not sold" FAQ wording with reality.

### [P0] F5 — No COPPA / age-gating / parental-consent for a kids-facing paid product
- **File(s):** MISSING: age gate / parental consent. Product explicitly targets young learners — rank "Elementary (0–69)" = "elementary-schooler knowledge" (`lib/scoring.js:119`, `RANKS_PLAN.md:47`), Landing markets cookie/recipe word-problems aimed at children (`lib/diagnosticItems/math.js`). No DOB collection, no age gate, no parental-consent flow (grep "age|coppa|parental|guardian|minor" → none in app/lib).
- **Category:** Legal / child safety (COPPA / GDPR-K / age-appropriate-design).
- **Description:** The product is plainly usable by (and marketed toward) children, sends their typed answers and photos of their handwritten work to a US LLM (Groq), and is about to charge subscriptions — yet there is no age verification, no parental-consent path, and no children's-privacy handling. COPPA (US, under-13), GDPR Art. 8 (EU, under-16/13-15 per state), and the UK Age Appropriate Design Code all apply.
- **Impact:** COPPA penalties are per-violation and severe; charging minors' accounts without parental authority invites chargebacks and regulatory action. This is the single most underweighted legal risk given the audience.
- **Recommended fix:** Decide and document the minimum-age policy. Add an age gate; if under-13 (or local threshold) are permitted, build verifiable parental consent and a children's-privacy notice; restrict who can be charged. Disclose LLM processing of submitted work. Treat as a go-live gate.

### [P0] F6 — No real account-deletion / right-to-erasure path; "reset" is partial; FAQ over-claims
- **File(s):** `db/schema.sql:454-474` (`delete_user_data()` deletes only `attempts`, `scores`, `concept_mastery`); `db/schema.sql:1297` comment: "delete_user_data deliberately leaves [subscriptions]"; `components/Landing.jsx:170` ("You can reset your progress anytime"); `README.md:573` & `README.md` backlog: "`delete_user_data` doesn't delete the `auth.users` account".
- **Category:** Legal (GDPR right to erasure) / truthful-claims.
- **Description:** The only deletion path is "Reset my progress" (`components/Noobtopro.jsx:756`), which wipes scores/attempts/mastery but **leaves the `auth.users` identity row and the `subscriptions` row intact** (the README itself flags both as known gaps). There is no way for a user to delete their account or their personal data (email/identity). The FAQ implies data control ("your data is readable only by you… You can reset your progress anytime") which a user could reasonably read as deletion — it is not.
- **Impact:** GDPR Art. 17 / CCPA deletion requests cannot be honored through the product; the operator has no documented manual erasure process either. Leaving identity + subscription rows after a "reset" is both a compliance gap and a billing-trust issue.
- **Recommended fix:** Build a true "Delete my account" path that removes the `auth.users` row (and cancels/cleans the subscription appropriately), or at minimum document a guaranteed manual erasure process in the Privacy Policy with a contact. Reword the FAQ so "reset" is not conflated with account/data deletion.

---

## P1 — High

### [P1] F7 — "Data export" advertised as a paid Pro feature but not built
- **File(s):** `components/Landing.jsx:89-96` (`PRO_FEATURES` includes `"Data export"`, rendered on the €9.99/mo card at `components/Landing.jsx:404-407`); `MONETIZATION_PLAN.md:42` ("Deferred from v1 | **Data export** (still marketed; gate it in a later pass)"); `README.md:573` lists data export as not-yet-built backlog. `lib/entitlements.js:69` only mentions it in a comment.
- **Category:** Truthful-claims / consumer protection / doc↔code mismatch.
- **Description:** The pricing card sells "Data export" as an included Pro benefit, but it is explicitly deferred and ungated — there is no export feature in the code. The monetization doc openly acknowledges it is "still marketed" while unbuilt.
- **Impact:** Charging €9.99/mo for a feature list that includes a non-existent feature is a false-advertising / consumer-protection exposure and a chargeback magnet. Ironically, "Data export" also touches the F6 erasure/portability gap (GDPR Art. 20).
- **Recommended fix:** Either build data export before flipping Pro on, or remove "Data export" from `PRO_FEATURES` until it ships. Do not advertise unbuilt paid features.

### [P1] F8 — No LICENSE file
- **File(s):** MISSING: LICENSE (no `LICENSE*`/`COPYING*`; `package.json` has no `license` field — confirmed `grep license package.json` → none).
- **Category:** Legal / IP.
- **Description:** The repo has no license. Absent a license, default copyright applies (all rights reserved). For a proprietary SaaS that's arguably intended, but it should be explicit, and the bundled curated educational content (224+ guides) and any third-party content needs a stated rights position.
- **Impact:** Ambiguous IP/usage rights; contributors and any partners have no clarity; some tooling/registries flag missing license.
- **Recommended fix:** Add an explicit LICENSE (proprietary "all rights reserved" if closed-source) and set `package.json` `"license"` (e.g. `"UNLICENSED"`).

### [P1] F9 — No SECURITY.md (vulnerability disclosure)
- **File(s):** MISSING: `SECURITY.md` / `.github/SECURITY.md` (only `.github/workflows/ci.yml` exists).
- **Category:** Trust / security process.
- **Description:** A product handling PII, children's data, and payments has no coordinated vulnerability-disclosure policy or security contact. There is no documented way for a researcher to report (e.g.) an RLS bypass or webhook-forgery issue.
- **Impact:** Vulnerabilities get disclosed publicly or sold rather than reported responsibly; payment/data-handling products are expected to have a disclosure channel.
- **Recommended fix:** Add `SECURITY.md` with a contact (email or form), scope, and response expectations.

### [P1] F10 — Production-domain contradiction across docs and code
- **File(s):** Canonical domain in code is `https://noobto.pro` (`app/layout.js:10` `SITE_URL`, used for `metadataBase`/OG; `PRO_GO_LIVE.md:9,29`; `MONETIZATION_PLAN.md`). But `README.md:74` lists Production URL as `https://noobtopro-umber.vercel.app`, and `AUTH_PROVIDERS.md:16` + `FEATURE_PLAN.md:96` hardcode `https://noobtopro-umber.vercel.app` as the production URL for OAuth/redirect setup.
- **Category:** Doc↔doc / doc↔code contradiction (operator-misleading at go-live).
- **Description:** Two different "production" URLs. `layout.js` declares `noobto.pro` (so OG images/canonical resolve there), the Pro runbook uses `noobto.pro` for the Polar success URL + webhook, yet the README's status table and the auth-setup doc point at the `*.vercel.app` URL. An operator following AUTH_PROVIDERS.md would configure OAuth/redirects for the wrong origin relative to where the OG/Pro flow expects the site to live.
- **Impact:** OAuth redirect-URL allow-list mismatches (sign-in fails on the real domain), Polar `POLAR_SUCCESS_URL` / webhook configured against `noobto.pro` while auth is set up for the vercel URL → broken go-live. Classic "works on one domain, breaks on the other."
- **Recommended fix:** Pick the canonical production domain and make every doc + the Supabase redirect-URL/OAuth callback + Polar URLs agree. Update README §2, AUTH_PROVIDERS.md, FEATURE_PLAN.md.

### [P1] F11 — DEPLOYMENT_PLAN states the wrong Node engines pin
- **File(s):** `DEPLOYMENT_PLAN.md:202` ("`package.json` declares `"engines": { "node": ">=20.19.0" }`") vs actual `package.json` `"engines": { "node": ">=24" }`; `.nvmrc` = `24`; README §14 (`README.md:517`) and CI (`.github/workflows/ci.yml` `node-version-file: .nvmrc`) correctly say Node 24.
- **Category:** Doc↔code mismatch (stale setup doc).
- **Description:** The deployment doc documents a Node pin that no longer matches the code. A reader provisioning a build environment from DEPLOYMENT_PLAN could target Node 20 and hit engine/build failures on `>=24`-only code.
- **Impact:** Misleads anyone reproducing the build; engine mismatch can block `npm ci`/build.
- **Recommended fix:** Update DEPLOYMENT_PLAN.md:202 to `>=24` (or stop quoting the literal value and reference `.nvmrc`).

### [P1] F12 — `QUESTION_TOKEN_SECRET` read by code but undocumented
- **File(s):** `lib/questionToken.js:37` (`process.env.QUESTION_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""`); `lib/questionToken.js:21` comment. Not present in `.env.example`, README §7, DEPLOYMENT_PLAN, or PRO_GO_LIVE (grep across docs → "NOT FOUND").
- **Category:** Doc↔code mismatch (undocumented env var / silent fallback).
- **Description:** The HMAC signing key for the question/step-token chain falls back to `SUPABASE_SERVICE_ROLE_KEY` when `QUESTION_TOKEN_SECRET` is unset. This dedicated secret is documented nowhere, so operators don't know it exists or that its default couples question-token signing to the service-role key (rotating the service-role key silently invalidates outstanding question tokens; and if neither is set the secret is `""`).
- **Category:** Doc gap with a security-config implication.
- **Recommended fix:** Document `QUESTION_TOKEN_SECRET` in `.env.example` and README §7 (purpose, that it's optional, the service-role fallback, and the empty-string degenerate case to avoid).

---

## P2 — Medium

### [P2] F13 — README is 613 lines / 136 KB and unusable as onboarding
- **File(s):** `README.md` (613 lines, 136 KB). It mixes genuine reference (§3 Quickstart, §7 env, §8 DB) with a large embedded **audit/fleet-orchestration runbook** ("Where to start", "How to run it (use the fleet)", "Posture — be ruthlessly independent", dimensions list) from `README.md:132` onward.
- **Category:** Doc usability.
- **Description:** A new engineer cannot onboard from this — the operational "how to run the adversarial audit fleet" content (hundreds of lines) is interleaved with the reference, and much of it is internal process noise (agent counts, memory names, Greptile trial status).
- **Impact:** High time-to-first-contribution; the genuinely useful Quickstart/env/DB sections are buried.
- **Recommended fix:** Split: keep a lean README (what it is, quickstart, env, architecture, deploy pointers); move the audit-runbook and historical PR logs to `docs/` or a CONTRIBUTING/AUDIT doc.

### [P2] F14 — Three different, all-wrong test counts in the README
- **File(s):** `README.md:139` ("512 tests across 36 files"), `README.md` "Where to start" ("512 tests across 36 files"), `README.md:467` ("**640 tests across 39 files**"). Actual: `ls test/` = **49 files** (test count NEEDS VERIFICATION via `npm test`, but the file count is provably wrong everywhere).
- **Category:** Stale doc / internal contradiction.
- **Description:** The README contradicts itself (512/36 vs 640/39) and neither matches reality (49 files).
- **Impact:** Erodes trust in the doc; signals the README isn't maintained alongside code.
- **Recommended fix:** Stop hardcoding test counts, or generate them; at minimum correct to the real numbers.

### [P2] F15 — Stale migration references
- **File(s):** `README.md:127` ("Live DB migrations `0001a`–`0009` are ALL applied … the live DB == `db/schema.sql`") — but migrations through `0017_pro_subscriptions.sql` exist in `db/migrations/`. README §8 repeatedly cites "migration 0010" for `concept_mastery` (`README.md` Tables/RPCs), but there is **no `0010_*.sql` file** — it was renumbered to `0012` (`db/migrations/0012_concept_mastery.sql:4`: "Renumbered 0010 → 0012"). Migration `0010` is also simply absent from the numeric sequence.
- **Category:** Stale doc.
- **Description:** The "0001a–0009 applied" line predates 0011–0017 (incl. the Pro subscriptions migration central to go-live), and the "migration 0010" citations point at a file that doesn't exist.
- **Impact:** An operator reproducing the DB from the README's migration claims would miss 0011–0017 (including `0017_pro_subscriptions.sql`, required for Pro). Misleading for the exact go-live the team is about to do.
- **Recommended fix:** Update the migration status to reflect 0011–0017; fix "migration 0010" → "0012" (or just reference `db/schema.sql` as canonical, which README §8 already calls the source of truth).

### [P2] F16 — No CONTRIBUTING / CODE_OF_CONDUCT
- **File(s):** MISSING (no `CONTRIBUTING*`, `CODE_OF_CONDUCT*`). The dev loop lives inside README §15 only.
- **Category:** Doc completeness.
- **Description:** No standalone contributor guide; the branch→PR→CI flow is buried in the README.
- **Impact:** Minor; relevant if outside contributors are ever expected. Low priority for a closed product.
- **Recommended fix:** Optional — add a short CONTRIBUTING.md pointing at the dev loop, if the repo will take contributions.

### [P2] F17 — DEPLOYMENT_PLAN / AUTH_PROVIDERS predate monetization and never mention it
- **File(s):** `DEPLOYMENT_PLAN.md` (marked "COMPLETE — historical", line 7) and `AUTH_PROVIDERS.md` contain the canonical deploy/redirect-URL setup but never mention Pro/Polar; the Pro runbook lives separately in `PRO_GO_LIVE.md`. The end-to-end go-live story is split across README + DEPLOYMENT_PLAN + AUTH_PROVIDERS + MONETIZATION_PLAN + PRO_GO_LIVE.
- **Category:** Doc fragmentation.
- **Description:** No single runbook covers "stand up a fresh production deploy *with* Pro." An operator must stitch five docs, two of which use a different production domain (F10).
- **Impact:** Increased chance of a misconfigured go-live (the F10 domain split is the concrete symptom).
- **Recommended fix:** Add a short "Full production go-live" index that orders the existing docs and resolves the domain canonically.

---

## Positive verifications (claims that DID hold)
- **Scoring scale 0–350** is consistent across docs and code: `lib/scoring.js:90` `SCORE_MAX = 350`, bands at `lib/scoring.js:119-123` match `RANKS_PLAN.md:47-51` and the Landing FAQ (`components/Landing.jsx:131`).
- **Pricing €9.99/mo** is consistent: `components/Landing.jsx:402`, `components/Noobtopro.jsx:1430`, `MONETIZATION_PLAN.md:15`, `PRO_GO_LIVE.md:8`.
- **`FREE_DAILY_PRACTICE_CAP` default = 5** matches docs (`app/api/score/route.js:214` vs `.env.example:87-91`, `PRO_GO_LIVE.md:31`).
- **Pro env-var names** (`POLAR_ACCESS_TOKEN`, `POLAR_SERVER`, `POLAR_PRODUCT_ID_PRO`, `POLAR_WEBHOOK_SECRET`, `POLAR_SUCCESS_URL`, `NEXT_PUBLIC_PRO_ENABLED`) match between `.env.example`, `PRO_GO_LIVE.md`, and the code (`grep process.env` confirms each is read).
- **PRO_GO_LIVE.md sandbox-first guidance is sound:** it pins `POLAR_SERVER=sandbox` first, notes "anything ≠ production ⇒ sandbox (typo-safe)" (matches the safe default), and Phase E flips to production explicitly — no doc step would push production Polar by mistake. The Polar-production-by-accident risk is *not* present in the docs.
- **CI workflow** matches its README description (`.github/workflows/ci.yml`: uses `.nvmrc`, runs `npm test` + build, read-only perms) — no dangerous default there.

## Coverage notes / NEEDS VERIFICATION
- Exact test *count* (512 vs 640) not run; only the **file count (49)** was verified, which already contradicts both README numbers (F14).
- Whether the live Supabase DB actually matches `db/schema.sql` was not checked against the live project (out of scope; read-only). README's "live DB == schema.sql" is **NEEDS VERIFICATION**.
- Whether a Privacy/Terms page exists at the live `noobto.pro` deployment (vs in-repo) was not fetched; repo + app source contain none, and there is no footer/UI link to one (`components/Landing.jsx:482-492` footer has only a copyright line) — so even if a hosted page existed, it is unlinked and unreachable from the UI.
