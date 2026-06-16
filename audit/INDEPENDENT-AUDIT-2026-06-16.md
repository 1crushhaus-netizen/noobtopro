# noobtopro — Independent Adversarial Audit (2026-06-16)

**Scope:** Full-stack, live-environment audit of the noobtopro product (Next.js 16 + React 19, Supabase Postgres, Polar billing, Groq LLM, Vercel hosting). Conducted independently by a fleet of 12 specialized adversarial agents plus direct inspection of the **live** Supabase project (`vwvhgnlgubctrgksyohr`) and **live** Vercel project (`prj_1wEB4Wr4xRGQJvgATCWb5H59Re4h`). Every claim from `README.md` and the pre-existing `audit/` folder was treated as **unverified** and re-checked against source and production state.

**Repo state:** branch `claude/hopeful-pasteur-ucqs88`, HEAD `4637a14`. Live production deployment = commit `4637a14` on `main`, state READY.

---

## The central finding (read this first)

The codebase is **genuinely well-engineered**. The auth model, server-authoritative scoring, payment trust boundaries, RLS, and SECURITY DEFINER function ACLs are all sound — most "obvious" attacks are already closed, and a prior self-audit (commit #95) clearly did real work. **The danger is not in the code. It is that the code's security/integrity fixes never reached production.**

> **The live database is 6 migrations behind the deployed application code.** Migrations `0016, 0018, 0019, 0020, 0021, 0022` are committed to the repo (and the deployed app depends on them) but were **never applied** to the live Supabase project, which stopped at `0017_pro_subscriptions`. This single operational gap is the root cause of every P0 below.

Independently verified via `supabase_migrations.schema_migrations` (history ends at `pro_subscriptions`), live grants, live column/constraint/function existence checks, and a production API log showing a recurring `prune_security_data → 404`.

Separately: **the production site is not publicly reachable** — `https://noobto.pro` and both `*.vercel.app` production aliases return **HTTP 403** (Vercel Deployment Protection appears to be enabled). So the audit's "live" exposure is currently gated to authenticated viewers; the items below become public-facing the moment protection is lifted.

---

## Severity summary

| # | Severity | Finding | Verified |
|---|----------|---------|----------|
| P0-1 | **P0** | Production schema drift: deployed code depends on 6 unapplied migrations | Live (DB history + grants + columns) |
| P0-2 | **P0** | Pro "answer history" (`attempt_reviews`) readable by any signed-in user → paywall bypass | Live (grants + policy) |
| P0-3 | **P0** | Legal pages are unshipped DRAFT templates (no controller identity/contact, no GDPR lawful basis, refund-right clause left as placeholder) | Source |
| P0-4 | **P0** | Minor data: age gate is client-only & self-asserted; EU market + minors' free-text/photos to US LLM, no parental consent | Source (3 agents) |
| P1-1 | P1 | Verified-leaderboard / guest-score-laundering defense absent in live DB | Live |
| P1-2 | P1 | Polar webhook replay/ordering guard absent in live → stale event can resurrect Pro | Live |
| P1-3 | P1 | Anonymous global Groq budget is a platform-wide DoS lever (can 429 paying users) | Source |
| P1-4 | P1 | Polar webhook reads unbounded request body before size check → memory-exhaustion DoS | Source |
| P1-5 | P1 | Missing-env landmine: no `SUPABASE_SERVICE_ROLE_KEY` silently disables the whole rate-limit/abuse/budget stack | Source |
| P1-6 | P1 | `/api/account/delete` has no rate limit; drives Polar + Supabase admin APIs | Source |
| P1-7 | P1 | DB integrity constraints + hot-path indexes absent in live (no `scores`/`item_difficulty` range CHECK; no `polar_subscription_id` uniqueness) | Live |
| P1-8 | P1 | Retention prune dead in prod (`prune_security_data` 404s) → PII-bearing logs grow unbounded | Live |
| P1-9 | P1 | False marketing: "a fixed model … identical work gives an identical score" (3 different models grade) | Source |
| P1-10 | P1 | Misleading marketing: FAQ says "Yes, snap a photo" but photo grading is Pro-gated (contradicts own pricing card) | Source |
| P1-11 | P1 | Production access: `noobto.pro` 403s publicly — intentional gate or launch blocker (needs decision) | Live |
| P1-12 | P1 | GDPR disclosure gaps: undisclosed sub-processors (GitHub/Discord OAuth), DOB/IP/stored-text not in policy, no transfer mechanism, erasure over-promised (Groq/Polar), no analytics consent | Source |
| P2-* | P2 | ~22 hardening/polish items (CSP `unsafe-inline`, postcss advisory, action SHA-pinning, diagnostic re-baseline laundering, band miscalibration, a11y contrast, robots, FORCE RLS, etc.) | Mixed |

**Net:** No exploitable P0 in the application *logic*. All four P0s are operational/legal: production deployment drift, an un-applied paywall lockdown, and launch-readiness of legal/minor-safety. The engineering core (auth, scoring integrity, payment trust boundaries, RLS, function ACLs, XSS posture) is solid and verified.

---

## P0 — Critical (fix before any public launch)

### P0-1 — Production schema drift (the root cause)
**Verified live.** `supabase_migrations.schema_migrations` ends at `20260616011532 pro_subscriptions` (repo `0017`). The following are committed but **not applied** to production, while the deployed app code already calls them:

| Migration | Missing live object (verified absent) | Consequence |
|---|---|---|
| `0016_verified_leaderboard` | `scores.verified`, `scores.server_graded`, `_reset_glicko_rd()`, verified-only `leaderboard_tiers` | P1-1 (leaderboard laundering) |
| `0018_pro_gate_attempt_reviews` | revoke + drop-policy never ran | **P0-2 (paywall bypass)** |
| `0019_integrity_constraints` | `scores_score_range`, `item_difficulty_range`, `subscriptions_polar_subscription_id_uniq`, indexes | P1-7 |
| `0020_webhook_event_ordering` | `subscriptions.event_modified_at`, 8-arg `upsert_subscription` | P1-2 |
| `0021_verify_at_level` | depends on 0016 | P1-1 |
| `0022_security_data_retention` | `prune_security_data()` (prod log shows `POST /rest/v1/rpc/prune_security_data → 404`) | P1-8 |

The app was written defensively (the webhook catches `PGRST202` and falls back to the 7-arg upsert; `store.js` falls back on `migrate_guest_data` arity), so nothing **crashes** — which is exactly why the drift went unnoticed. But the security/integrity controls the prior audit "shipped" are inert.

**Fix:** Apply `0016 → 0018 → 0019 → 0020 → 0021 → 0022` to the live project **in order** (0016 first; later ones reference its columns). Confirm 0019's CHECKs validate against existing data first (live data currently complies: scores observed 7..200, all in range). **This requires explicit authorization — it mutates the production database.**

### P0-2 — Pro "answer history" is readable for free (live paywall bypass)
**Verified live:** `attempt_reviews` has `SELECT` granted to **both `anon` and `authenticated`**, and the `read own attempt reviews` RLS policy (`auth.uid() = user_id`) is still present. `0018` was meant to revoke the grant and drop the policy.

Any signed-in (non-Pro) user can read their full review rows — `question`, `answer`, `rubric`, `feedback`, worked solution — directly via PostgREST using the **public anon key** baked into the client bundle:
```
GET /rest/v1/attempt_reviews?select=* (Authorization: Bearer <own JWT>)
```
This bypasses the `/api/reviews` Pro gate (which correctly returns 402). RLS still scopes to the user's own rows, so it is **not a cross-user breach** — it is a monetization-gate bypass of a paid feature. Becomes a hard P0 the moment Pro has paying users. **Fix:** apply `0018`.

### P0-3 — Legal pages are unshipped drafts; cannot lawfully run a paid EU service as-is
Every legal page carries `[bracketed]` placeholders (`LegalLayout.jsx` even renders a "Draft template … not legal advice" banner):
- **No data controller identity or contact** — `[Company Legal Name]`, `[privacy@your-domain]`, `[Registered Address]` (`app/privacy/page.js:12,103,116`, `app/terms/page.js:13,123`). GDPR Art. 13 + EU e-commerce law require these.
- **No GDPR Art. 6 lawful basis** stated anywhere; policy relies on invalid "by using the Service you agree" consent-by-use (`privacy/page.js:14-15`).
- **Refund terms are a placeholder** on the most sensitive clause: *"`[Confirm your refund terms with counsel and state them here]`"* (`app/refunds/page.js:34-41`), and checkout (`app/api/checkout/route.js`) captures no express "begin now + waive 14-day withdrawal right" consent required by the EU Consumer Rights Directive.

**Fix:** Fill real entity/contact/address, add lawful-basis mapping, state concrete refund terms, capture withdrawal-right consent at checkout — before going public.

### P0-4 — Minor data handling (COPPA/GDPR-Art.8) is unenforced
**Cross-confirmed by auth, frontend, and legal agents.** The 13+ age gate (`components/AgeGate.jsx`, `components/Noobtopro.jsx:862-874`) is **client-only**: the acknowledgement is written to Supabase `user_metadata.age_ack_year`, which **the user can self-write** (`sb.auth.updateUser`), and **no server route checks age**. A user can enter any DOB, call `updateUser({data:{age_ack_year:…}})`, or simply call `/api/score` / `/api/grade` / `/api/generate` directly with a valid JWT and never see the gate.

Pricing is **EUR**, so GDPR Art. 8 (digital-consent age **13–16**, varying by member state) applies — a flat 13 gate is insufficient — and the app ships minors' **free-text answers and photographs of work** to **Groq (US)** with no parental-consent mechanism and a US transfer mechanism that is not named. The privacy policy frames this only as COPPA ("under 13"), the wrong primary regime.

**Fix:** Enforce age server-side via a non-self-writable record (service-role-written profile row, gating the authenticated routes), keyed to the member-state consent age; implement a parental-consent path or put minors out of scope and enforce it.

---

## P1 — Serious

- **P1-1 — Guest-score laundering / verified leaderboard absent (live).** `scores.verified`/`server_graded` don't exist and live `leaderboard_tiers` ranks **all** rows with no verified filter. A hand-edited localStorage guest blob lands a top rank on first sign-in. Fixed by applying `0016`+`0021`. *(Verified live.)*
- **P1-2 — Webhook replay/ordering guard absent (live).** Live `upsert_subscription` is 7-arg (no `event_modified_at`) and overwrites on every event. An out-of-order/replayed `active` after a `cancel`/`revoke` can re-grant Pro until period end. Fixed by `0020`. After applying, note **P2** residuals: the ordering guard treats a NULL incoming timestamp as a wildcard (`db/migrations/0020_*.sql:58` — use `COALESCE(...,'epoch')`), and there is no `webhook-id` idempotency table. *(Verified live + source.)*
- **P1-3 — Anonymous global Groq budget = platform-wide DoS.** `lib/rateLimit.js:193-222` (wired in generate/grade/score). The shared `global:groq` window (default 300/min) is the anti-cost backstop; an attacker rotating cheap IPs can exhaust it and **429 every legitimate user, including paying Pro users**, indefinitely at $0 cost. Fix: reserve a sub-budget for authenticated/Pro traffic; key IP fairness on /24.
- **P1-4 — Unbounded webhook body read.** `app/api/webhooks/polar/route.js:61` does `await req.text()` with no size cap before signature verification (every other route uses `readJsonLimited`). Memory-exhaustion DoS on a public endpoint (Vercel's ~4.5 MB platform limit blunts it on Vercel; self-host is fully exposed). Fix: cap raw read (~1 MB) before verifying.
- **P1-5 — Missing-env landmine.** If `SUPABASE_SERVICE_ROLE_KEY` is absent in production, the durable rate limiter, abuse logging, **and** the global Groq spend cap all silently fall back to per-instance/no-op (`lib/rateLimit.js:113-166`), removing the entire anti-abuse stack with no startup guard. Fix: fail-fast at boot in production if the key is missing.
- **P1-6 — `/api/account/delete` has no rate limit.** Only `isCrossSiteRequest` + `requireUser`; each call drives a Polar `subscriptions.revoke` and a Supabase admin `deleteUser`. Add a durable `acct:<uid>:delete` cap.
- **P1-7 — DB integrity backstops + indexes absent (live).** No `scores_score_range`/`item_difficulty_range` CHECK (ranking columns unbounded at the DB layer), no `subscriptions_polar_subscription_id_uniq` (one Polar sub could map to two accounts), missing `concept_guides_subject_topic_idx`/`scores_verified_idx`; perf advisor flags unindexed `concept_guides_topic_fk`. Fixed by `0019` (apply with `0016`). *(Verified live.)*
- **P1-8 — Retention prune dead in prod.** `prune_security_data` 404s on every admin load (verified in prod API log); `security_events.sample` (≤500-char snippets of flagged text, PII-bearing) + `concept_reports.reason` grow unbounded. Fixed by `0022`. *(Verified live; current volume tiny.)*
- **P1-9 — False "fixed model / deterministic score" claim.** `components/Landing.jsx:119,128`: *"A fixed model, run at temperature 0 (identical work gives an identical score)."* Reality (`lib/groq.js:14,19,28,385`): text→`gpt-oss-120b`, photo→`llama-4-scout`, vision-failure→`llama-3.3-70b` (a third model), all env-overridable. Same work via text vs photo is graded by different models. Soften the claim or pin the model.
- **P1-10 — Photo grading advertised as free but is Pro-gated.** FAQ "Can I submit a photo of my work? **Yes.**" (`Landing.jsx:159-160`) and engine card contradict the page's own Pro pricing card (`Landing.jsx:92`); `app/api/grade/route.js:115` returns 402 for non-Pro. Disclose Pro-gating (the one-time diagnostic photo stays free).
- **P1-11 — Production returns 403 to the public.** `noobto.pro` + both prod `*.vercel.app` aliases 403 (Vercel Deployment Protection). If intentional pre-launch gating, all the SEO/OG/structured-data/marketing work is not yet serving; if unintentional, it's a launch blocker. **Needs an owner decision.**
- **P1-12 — GDPR disclosure gaps.** Undisclosed sub-processors (GitHub/Discord OAuth are wired in `SignIn.jsx`/`supabase.js` but only Google is disclosed); DOB/age, IP addresses, and stored text snippets are collected but absent from the policy's data inventory; international transfer (US) names no mechanism; erasure promises "all associated data" but reaches neither Groq nor Polar's own customer records and 503s without the service-role key; analytics + `track()` run with no EU consent gate.

---

## P2 — Hardening & polish (selected; ~22 total)

**Security / infra**
- CSP keeps `script-src 'unsafe-inline'` (no nonce) — no XSS second line of defense (`next.config.js:43`). Move to nonce-based via middleware. (No injection sink exists today; the one inline script is author-controlled.)
- `postcss < 8.5.10` moderate XSS advisory ships transitively via `next` (prod tree); the CI gate `--audit-level=high` can never catch it and its comment is now stale (`.github/workflows/ci.yml:44`). Track Next's patched line.
- GitHub Actions pinned to mutable `@v6` tags — pin to commit SHAs (`ci.yml:28,31`). (Blast radius limited: read-only token, empty secrets, plain `pull_request`.)
- Live: RLS enabled but not **FORCED** on all 11 tables; redundant `SELECT` grants to anon/authenticated on deny-all tables; expired `rate_limits` buckets never GC'd; Supabase leaked-password protection off (OAuth-only, minor).
- IP rate-limit key falls back to client-spoofable `x-forwarded-for` on non-Vercel deploys (`lib/rateLimit.js:95-103`); several authenticated routes omit the `application/json` content-type guard; `maxDuration` mismatch (code 90–120 vs `vercel.json` 60) can leak a charged global-budget slot on a platform kill.

**Scoring / content**
- Free diagnostic re-baseline overwrites the **displayed** score and resets Glicko RD (`app/api/score/route.js` finalize → `0021` unconditional `score = excluded.score`); launders a regressed displayed rank (never reaches the *verified* leaderboard). Use `max(prev, placement)`. Finalize also lacks the per-account cap the step path has.
- Fresh-account single beginner ace nudges the displayed score above the 175 midpoint (seed RD = max). Cosmetic; bounded by below-level/repeat dampers.
- Diagnostic band vs concept-rank miscalibration: `chemistry:beginner:1` uses a high-school concept key (`mole_molar_mass`) on a beginner item — off by 2 bands (`lib/diagnosticItems/chemistry.js:13`); four other off-by-1 items. Re-tag or document.
- Content-safety filter is a shallow 8-word substring blocklist trivially bypassed (leet/spacing/base64), and `/api/grade` output is unscreened (minor-safety relevant given the age gate) — `lib/contentSafety.js`. Strengthen markers / add a moderation pass.
- Validation scripts check **shape only**, never correctness — a future content edit introducing a wrong answer ships undetected (`scripts/validate-*.mjs`).

**Marketing / SEO / a11y**
- `robots.js` lacks `disallow: ["/api/"]`.
- Dark-theme chemistry accent `#9d685e` ≈ 4.4:1 on `#0a0a0a` — fails WCAG AA for small text (`app/globals.css`); favicon is off-brand black vs teal everywhere else.
- "Most popular" badge on a Pro plan described as "planned"; "with Google, in one tap" overstates the OAuth redirect; structured-data `Offer` advertises a priced Pro product that isn't sellable yet (Rich Results risk).
- FAQ category labels aren't headings (accordion ARIA is otherwise correct).

**Positive verifications worth recording:** Content is *scientifically* clean — all 30 graded diagnostic items and 224 guides were recomputed by a subject-matter agent with **zero** incorrect answer keys or false-science findings. Auth/JWT verification, payment trust boundaries (signature-before-write, JWT-bound external customer id, product-allowlist gate, atomic durable free-cap), server-authoritative scoring (model never supplies the headline score; HMAC-signed question/diagnostic tokens with constant-time MAC, expiry, jti dedupe, kind separation), the `numericVerify` mathjs sandbox, RLS SELECT-own policies, SECURITY DEFINER ACLs (all arbitrary-uid mutators are service-role-only; the 3 authenticated RPCs scope to `auth.uid()`), no client-reachable XSS sink, and secrets hygiene (no leaked secrets in full git history) were all **verified solid**.

---

## Recommended remediation order

1. **Decide the launch posture** (P1-11): is the 403 intentional? This gates urgency of the legal/minor items.
2. **Apply migrations `0016–0022` to production, in order** (P0-1, P0-2, P1-1, P1-2, P1-7, P1-8). Single highest-leverage action. *Requires explicit authorization — mutates prod DB.*
3. **Legal + minor-safety before public launch** (P0-3, P0-4, P1-12): real controller/contact, lawful basis, refund terms + checkout consent, server-enforced age gate, full sub-processor/transfer/erasure disclosures.
4. **Cost-DoS perimeter** (P1-3, P1-4, P1-5, P1-6): reserve auth budget, cap webhook body, fail-fast on missing service-role key, rate-limit account deletion.
5. **Truth-in-marketing** (P1-9, P1-10): fix the "fixed model/identical score" and "free photo grading" claims.
6. **P2 backlog** as capacity allows (nonce CSP, SHA-pin actions, FORCE RLS, re-baseline `max()`, content filter, band re-tag, a11y contrast, robots).

---

*Method note: 12 parallel adversarial agents (auth, payments, API-abuse, scoring, LLM-safety, DB/migrations, frontend/XSS, devops/deps/CI, legal/privacy, a11y/SEO/marketing, curriculum, live-environment) + direct live inspection of Supabase (read-only SQL), Vercel deployments, and the production site. Findings cross-checked and deduplicated; the live-DB drift was independently confirmed by the orchestrator, not taken on an agent's word.*
