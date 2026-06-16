# Independent Adversarial Audit — noobtopro (2026-06-16)

**Method.** Fully independent, source-of-truth audit. The README, the existing `audit/`
folder, `*_PLAN.md` docs, and code comments were treated as **untrusted** and every claim
was re-verified against actual source, the test suite, and the **live** environment
(Supabase advisors + tables + migrations, Vercel deployments). Eleven adversarial domain
auditors plus direct inspection. No production state was modified — read-only throughout.

**Baseline / production-state caveat (important).** This audit was performed against the
checkout at `23d5545` (PR #106). The **live production** deployment is one squashed commit
ahead — `9247a1b` (PR #121), a later red-team hardening pass. PR #121 touched only 11 files
and already resolves a few items below; each finding is tagged with its **production
status**. All findings not tagged "FIXED in #121" are **open in production**.

**Headline verdict.** This is a genuinely well-hardened codebase that has clearly survived
multiple prior audit rounds. The high-value technical invariants hold up under adversarial
review: **no auth bypass, no IDOR, no privilege escalation, no payment/webhook forgery, no
score self-grant, no SQL/RLS cross-user read-write, no stored XSS, no prompt-injection that
moves a grade, and factually correct curriculum content.** The full suite is green (52 files
/ 871 tests). There are **no confirmed P0s**. The residual risk is concentrated in
(1) a client-side-only paywall, (2) minor-facing content-safety posture, (3) legal/launch
readiness, and (4) a handful of conditional/operational hardening gaps.

---

## Severity legend
- **P0** — critical: exploitable breach, data loss, payment bypass, unshippable legal state.
- **P1** — high: should fix before/soon after launch; real user, money, or compliance impact.
- **P2** — medium: quality, hardening, UX, maintainability.

---

## Findings summary

| ID | Severity | Domain | Finding | Prod status |
|----|----------|--------|---------|-------------|
| F-01 | **P1** | Monetization | "Progress trends" Pro feature gated client-side only; `attempts` rows are unconditionally client-readable | OPEN |
| F-02 | **P1** | Legal | Paid product ships with unfilled `[Company Legal Name]` / `[support@your-domain]` and **no stated refund policy** | OPEN |
| F-03 | **P1** | SEO | Legal pages inherit `canonical:"/"` → de-indexed; directly contradicts `sitemap.js` | OPEN |
| F-04 | **P1** | Auth | Admin email-allowlist trusts provider-asserted email + broad `noobtopro-*.vercel.app` OAuth-redirect wildcard (conditional on a 2nd OAuth provider) | OPEN |
| F-05 | **P1** | DB / DR | Repo migrations are a changelog, not a runnable chain; live applied set is a *different* (timestamped) migration history → no replayable provisioning source | OPEN (documented) |
| F-06 | **P2** | LLM safety | Content safety is an 8-word blocklist (no self-harm/CSAM/violence/non-English); guest-facing diagnostic `comment` skips even that screen | OPEN |
| F-07 | **P2** | Minors | AgeGate is client-only, self-attested, server-unenforced; guests entirely ungated | OPEN |
| F-08 | **P2** | Scoring | Rank-LABEL coverage gate locks ordinary (un-tagged) practice users at "Elementary" regardless of score — live DB shows `concept_mastery = 0 rows`, i.e. *every* user is currently label-locked | OPEN |
| F-09 | **P2** | Scoring | Below-level farming reaches University rank (~3 bands), contradicting the documented "≤1 band" cap | OPEN |
| F-10 | **P2** | Cost/DoS | Global Groq budget bounds the *rate* (per-minute) but has no *cumulative* (daily/monthly) ceiling | PARTIAL (#121 split guest/auth pools; no cumulative cap added) |
| F-11 | **P2** | Auth | Guest-issued (uid-less) question tokens are replayable across different accounts | OPEN |
| F-12 | **P2** | A11y | AgeGate (the compliance screen) has no autofocus, no focus trap, inconsistent dialog role | OPEN |
| F-13 | **P2** | Frontend | `theme-color` hard-coded teal; wrong for the light & dark themes | OPEN |
| F-14 | **P2** | DevOps | GitHub Actions pinned to floating major tags (`@v6`), not SHAs | OPEN |
| F-15 | **P2** | DB | `prune_security_data` retention is opportunistic/unscheduled (pg_cron available but not installed); no email-erasure path | OPEN |
| F-16 | **P2** | Live auth | Supabase "leaked password protection" disabled (moot while OAuth-only; enable before any password provider) | OPEN |
| F-17 | **P2** | Frontend | Remote avatar `<img>` lacks width/height (CLS) and bypasses `next/image` | OPEN |
| — | FIXED | DevOps | CSP `script-src 'unsafe-inline'` → nonce-based CSP | **FIXED in #121** |
| — | FIXED | Cost/DoS | Unauth flood could 429 paying users (shared budget) → guest/auth pool isolation | **FIXED in #121** |
| — | FIXED | Auth | Token-signing secret silently coupled to service-role key → boot warning added | **FIXED in #121** |

---

## P1 findings (detail)

### F-01 — "Progress trends" Pro feature is enforced client-side only
**Domain:** Monetization. **Prod:** OPEN.
The answer-history Pro feature was correctly server-gated (migration 0018 revoked direct
`attempt_reviews` SELECT; `/api/reviews` uses `requireProUser`). The **trends/charts**
feature did not get the same treatment.
- The gate is pure client state: `proLocked = proEnabled && !isPro` (`components/Dashboard.jsx:349`);
  `isPro`/`proEnabled` are browser values (`components/Noobtopro.jsx:402,407`).
- The underlying data is unconditionally client-readable: `loadState()` runs
  `sb.from("attempts").select("*").eq("user_id", uid)` with **no entitlement check**
  (`lib/store.js:238-251`), and RLS keeps `attempts` SELECT open to the owner
  (`db/schema.sql:172-175`).
**Exploit:** a non-Pro signed-in user reads their full trends dataset directly from the
browser (devtools/console) or flips the React flag, obtaining the paid feature.
**Note:** the rows hold no sensitive content (scores/deltas/timestamps), so this is a
*feature* bypass, not a PII leak — hence P1, not P0.
**Fix:** mirror the 0018 pattern (Pro-gated server route + revoke client SELECT), or make
trends free.

### F-02 — Paid product ships with placeholder legal identity and no refund policy
**Domain:** Legal/business readiness. **Prod:** OPEN (verified on `origin/main`).
`app/refunds/page.js` still contains `[Confirm your refund terms with counsel and state them
here]` (§3, line 38), `[support@your-domain]` (lines 43, 66), and `[Company Legal Name]`
(line 67); the privacy/terms pages carry the same `[Company Legal Name]` placeholder.
For a product charging €9.99/mo with Polar as Merchant of Record, selling without a named
legal entity, a working support contact, and a concrete refund/withdrawal statement is a
real consumer-law exposure (EU 14-day digital-services withdrawal, auto-renewal disclosure).
**Fix:** fill the legal entity, support email, and an actual refund policy before charging.

### F-03 — Legal pages are de-indexed by an inherited canonical
**Domain:** SEO. **Prod:** OPEN (verified on `origin/main`).
Root metadata sets `alternates: { canonical: "/" }` (`app/layout.js:41`); `app/privacy`,
`app/terms`, `app/refunds` set only title/description, so Next inherits the canonical and
each legal page emits `<link rel="canonical" href="https://noobto.pro/">`. Meanwhile
`app/sitemap.js` lists all three as indexable — a self-contradictory signal that will
consolidate them onto the homepage and drop them from the index (exactly the pages users,
stores, and payment processors search for).
**Fix:** add a self-referential `alternates:{canonical:"/privacy"}` (etc.) to each page.

### F-04 — Admin allowlist trusts provider email + broad preview-redirect wildcard
**Domain:** Auth. **Prod:** OPEN. **Conditional** (latent while Google-only).
`isAdminUser` accepts an `email_confirmed_at`-stamped email match (`lib/adminAuth.js:44-54`).
That gate is correct for password signup but not against a federated provider that stamps an
unverified-by-provider address; `AUTH_PROVIDERS.md` actively encourages enabling GitHub/Discord.
Compounding: the Supabase redirect allowlist is `https://noobtopro-*.vercel.app/**`
(`AUTH_PROVIDERS.md`), and every preview shares the prod Supabase project/anon key, so a
token minted on any matching preview host is prod-valid.
**Fix:** prefer `ADMIN_USER_IDS` (UUID) as the only prod admin mechanism; if keeping email,
also check `app_metadata.provider` + per-identity `email_verified`; tighten the redirect
allowlist to the canonical production origin.

### F-05 — No replayable migration source of truth
**Domain:** DB / disaster recovery. **Prod:** OPEN (documented).
The repo's `db/migrations/0001a…0023` do not apply standalone (they reference base objects
only created in `db/schema.sql`; `0010` is intentionally absent). The **live** project's
applied history is a *different*, 48-entry timestamped Supabase-CLI migration set
(`list_migrations`), so neither the repo nor any single artifact is a replayable
provisioning chain — `schema.sql` is a hand-maintained mirror that can drift from production.
This is documented in `db/migrations/README.md`, which lowers urgency but doesn't remove the
DR/audit-trail risk.
**Fix:** adopt a single tool-managed migration history (commit the Supabase CLI migrations),
or add CI that asserts `schema.sql` applies cleanly to an empty DB and matches introspection.

---

## P2 findings (detail)

### F-06 — Content safety is a profanity blocklist, with a gap on the guest path
`lib/contentSafety.js` `BLOCKLIST` is ~8 words (profanity + 2 slurs + "porn"/"viagra"). The
obfuscation folding is good, but coverage excludes self-harm, sexual content involving
minors, grooming, violence, and any non-English text. Worse, the **diagnostic** grade
`comment` — the one LLM-authored, user-echoing field on the path open to **guests with no
age gate** — is returned unscreened (`app/api/grade/route.js:241`; stored unscreened at
`app/api/score/route.js:855,953`), whereas the practice path screens via `redactUnsafe`.
**Fix:** screen the diagnostic `comment` (and generated `topic`, `app/api/generate/route.js:239`);
for a minor-facing product route LLM output through a real moderation classifier (Groq's
Llama-Guard family) for CSAM/self-harm/violence.

### F-07 — AgeGate is advisory, not enforced
The gate is a client render guard; the acknowledgement is stored in user-editable
`user_metadata.age_ack_year` (`components/Noobtopro.jsx:870`) and **no server route reads
age**. Guests (the whole diagnostic/practice LLM flow) are never gated. The privacy policy's
"we ask age at sign-up" is only true for the OAuth path and is client-bypassable.
**Fix:** persist age in a server-controlled column and enforce server-side, or document the
gate as advisory and age-bound guest content by default.

### F-08 — Rank-label coverage gate traps ordinary-practice users at Elementary
`lib/promotion.js:63-85` requires GREEN mastery of the full lower-rank concept set before the
rank **label** advances, but mastery counters only bump for **concept-tagged** drills
(`app/api/score/route.js:349`); generic practice has no `conceptKey`. So a user can score 350
yet stay labeled "Elementary." **Live confirmation:** `concept_mastery` has **0 rows**, so
*every current user* is label-locked regardless of score. Matches a documented owner decision
but is a real product trap.
**Fix:** credit resolved weak-concepts of generic practice toward mastery, or surface that
only concept drills advance rank; at minimum communicate it in the UI.

### F-09 — Below-level farming exceeds its documented cap
`lib/scoring.js:913-926`: acing only beginner items drives the subject score to ~197–224
(High/University), ~3 bands above the practiced difficulty, not the "≈one band" the comment
claims (the damper only reaches 0 at gap = 3·ONE_BAND). Mitigated for the leaderboard because
such attempts fail `attemptVerifies`, so the inflated score is visible but not ranked.
**Fix:** tighten the ramp to reach 0 at ~2·ONE_BAND and correct the comment.

### F-10 — Global Groq budget caps rate, not cumulative spend
`lib/rateLimit.js` charges a 60-second fixed window; an attacker pacing to the per-minute
ceiling sustains maximum spend indefinitely with no absolute kill-switch. PR #121 split the
budget into isolated guest/auth pools (so a guest flood no longer 429s paying users — good),
but did **not** add a cumulative cap.
**Fix:** add a second fail-closed bucket with a 24h/30d window as a hard cumulative ceiling.

### F-11 — Guest question tokens replayable across accounts
`/api/generate` signs `uid` into the token only for authenticated callers
(`app/api/generate/route.js:280`); `/api/score` enforces the bind only when a uid is present
(`app/api/score/route.js:276`). A guest-issued (uid-less) token can be scored once per
account by different accounts (the jti dedupe is `(user_id, jti)`-scoped). Integrity/anti-farm
weakness, bounded by band-clamp and daily caps.
**Fix:** reject uid-less tokens on the authenticated practice path (guests can't reach it).

### F-12 — AgeGate a11y gaps
The compliance gate's primary form lacks `role="dialog"`/`aria-modal`, has no autofocus and
no focus trap — unlike every other modal in the app (`components/AgeGate.jsx:84`).
**Fix:** add dialog semantics + focus management consistent with the other modals.

### F-13 — `theme-color` hard-coded
`app/layout.js` sets a single teal `themeColor`; it clashes with both the white light theme
and black dark theme. **Fix:** use the `prefers-color-scheme` media-variant form.

### F-14 — GitHub Actions on floating tags
`.github/workflows/ci.yml` uses `actions/checkout@v6` / `actions/setup-node@v6`. A compromised
tag would run in CI (blast radius limited by `permissions: contents: read`).
**Fix:** pin to full commit SHAs (Dependabot updates SHA pins too).

### F-15 — Retention is unscheduled; no email erasure
`prune_security_data` actually deletes, but nothing schedules it (pg_cron is available in the
project but not installed); `delete_user_data` clears progress but not the `auth.users` email.
**Fix:** schedule prune via pg_cron; document/implement an account-erasure path.

### F-16 — Supabase leaked-password protection disabled
Security advisor WARN. Moot while OAuth-only; enable before adding any password provider.

### F-17 — Remote avatar images cause CLS
`components/TopNav.jsx:132`, `components/Dashboard.jsx:447` render remote avatars via raw
`<img>` with no width/height and no `next/image`. **Fix:** add explicit dimensions +
`loading="lazy"`/`decoding="async"`.

---

## Live-environment findings (read-only)

- **Supabase project** `vwvhgnlgubctrgksyohr` (Postgres 17, ACTIVE_HEALTHY).
- **RLS: all 11 public tables have RLS enabled.** Security advisor returns only:
  - INFO `rls_enabled_no_policy` on `attempt_reviews`, `concept_reports`, `item_difficulty`,
    `rate_limits`, `security_events` — intentional deny-by-default service-role tables (safe).
  - WARN `authenticated_security_definer_function_executable` on `delete_user_data`,
    `migrate_guest_data`, `submit_concept_report` — by design; each is rigorously self-scoped
    to `auth.uid()` (verified in source). No action required beyond awareness.
  - WARN leaked-password protection disabled → **F-16**.
- **Performance advisor:** two unused indexes (`scores_verified_idx`,
  `concept_guides_subject_topic_idx`) — expected at current tiny row counts; keep for scale.
- **Extensions:** only safe defaults installed (pgcrypto, uuid-ossp, vault, pg_stat_statements,
  plpgsql). No `http`/`pg_net`/`dblink`/fdw installed. `pg_cron` available but not installed
  (relevant to F-15).
- **Data volumes:** `scores=12`, `attempts=38`, `attempt_reviews=19`, `subscriptions=0`,
  `concept_mastery=0`. `concept_mastery=0` is the live confirmation of **F-08**.
- **Vercel:** latest production deploy `READY` on `9247a1b` (#121). Two historical `ERROR`
  deploys (#99, #100) are the superseded split Dependabot vitest-4 PRs (ERESOLVE peer
  conflict, fixed by the grouped #101) — benign, non-production.

---

## What is genuinely solid (verified, not assumed)

- **Auth:** identity via server-verified `supabase.auth.getUser(token)`; no endpoint trusts a
  client-supplied user id; admin deny-by-default; account deletion JWT-scoped; HMAC question
  tokens with constant-time compare + expiry + replay dedupe + (authed) account binding.
- **Payments:** Polar webhook signature verified (fail-closed on missing secret); idempotent
  + out-of-order-safe upsert (migration 0020/0023 epoch-coalesce guard); checkout/portal
  identity JWT-bound (no IDOR, no open redirect); one-subscription-per-account unique index;
  fail-closed to Free when env absent.
- **DB:** server-authoritative scoring (no client write path to `scores`/`attempts`); every
  SECURITY DEFINER function pins `search_path`; score range CHECK [0,350]; no callable
  self-grant RPC.
- **API/abuse:** durable DB-backed per-account rate limiter applied *before* the LLM call;
  fail-closed global spend ceiling; streamed body-byte caps; NaN/Infinity/prototype-pollution
  -safe input handling; no ReDoS (previously-quadratic regex now bounded); generic errors.
- **LLM:** score is server-computed from a clamped rubric (model emits no headline score);
  HIGH-confidence injection auto-docks to ~0; output schema-validated field-by-field; no LLM
  output rendered as HTML; Groq key server-only and never logged.
- **Scoring math:** Elo/Glicko/0–350 rescale verified correct (no off-by-one, NaN, overflow);
  mathjs numeric verifier is genuinely sandboxed (AST allowlist; eval/import disabled).
- **Curriculum content:** all 224 guides + 30 diagnostic items independently recomputed —
  zero factual/math errors.
- **Tests:** 52 files / 871 tests green; coverage gate enforced in CI; negative-path tests
  exist for webhook forgery, admin deny, fail-closed secrets.

---

## Recommended priority order
1. **F-02 / F-03** (legal identity + refund policy; legal-page canonical) — cheap, and they
   gate a lawful, indexable paid launch.
2. **F-01** (server-gate the trends paywall) — closes the only paid-feature bypass.
3. **F-06 / F-07** (minor-facing content safety + age-gate posture) — decide and document the
   real policy; screen the diagnostic path.
4. **F-04** (admin email/redirect hardening) — before enabling any second OAuth provider.
5. **F-08** (rank-label trap) — currently affects every user.
6. **F-05, F-09–F-17** — hardening and polish.

*All P0-class technical breaches were specifically hunted and not found; the live database and
production deployment corroborate the source review.*
