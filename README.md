# noobtopro — engineering hand-off & reference

> ## 📌 This README is the source of truth — read it first, and keep it current
>
> **This is a hand-off document.** It is written so a brand-new contributor — **including any AI assistant or fresh Claude Code session** — can read it top-to-bottom and become productive with **no prior context**.
>
> **If you are an LLM / Claude Code session working on this repo:**
> 1. **Read this README fully before doing anything else** and treat it as the authoritative description of the platform, its architecture, its conventions (§6), and its current state (§2).
> 2. **Defer to this README** when it conflicts with your assumptions or general knowledge — it reflects decisions and gotchas (§16) specific to *this* project (e.g. why `vercel.json` pins the framework, why env vars must be project-level, why scoring uses a difficulty/confidence-weighted Elo-style blend (§11)).
> 3. **Follow the dev loop in §15** (branch → PR → CI "Test and build" → address Greptile → merge → verify) for every change.
> 4. **Keep this README up to date.** When you change architecture, env vars, the data model, status, or conventions, update the relevant section in the same PR. A stale hand-off doc is worse than none — the next session relies on it being accurate.
>
> New here? Jump to [**Where to start (next task: full independent fleet audit)**](#where-to-start-next-task-full-independent-fleet-audit).

**Prove what you know. Climb from noob to pro.**

---

## Table of contents

- ⭐ [**Where to start (next task: full independent fleet audit)**](#where-to-start-next-task-full-independent-fleet-audit)
1. [What it is & why](#1-what-it-is--why)
2. [Current status & live links](#2-current-status--live-links)
3. [Quickstart](#3-quickstart)
4. [Architecture](#4-architecture)
5. [Repo map](#5-repo-map)
6. [Conventions](#6-conventions)
7. [Environment variables](#7-environment-variables)
8. [Database & persistence](#8-database--persistence)
9. [Authentication](#9-authentication)
10. [Server API reference](#10-server-api-reference)
11. [Scoring model](#11-scoring-model-libscoringjs)
12. [Frontend (the state machine)](#12-frontend-the-state-machine)
13. [Testing](#13-testing)
14. [Build, CI & deploy](#14-build-ci--deploy)
15. [How we work (the dev loop)](#15-how-we-work-the-dev-loop)
16. [Troubleshooting & gotchas](#16-troubleshooting--gotchas)
17. [Roadmap & known limitations](#17-roadmap--known-limitations)
18. [Further reading](#18-further-reading)

---

## 1. What it is & why

**noobtopro is a reasoning-first assessment + learning platform for mathematics, physics, and chemistry.** The thesis: *real understanding is measured by **how you reason**, not whether you produced the right final answer.* A wrong answer with sound, well-explained reasoning scores **higher** than a correct answer with no reasoning.

It inverts the usual "learn then test" flow:

1. **Prove it** — for each subject, two open problems (easy + hard; 6 total). You solve them and explain every step. The per-subject baseline weights the harder question more (points proportional to difficulty), so one pass calibrates where you stand. *(2 per subject — down from 3 — because 9 simultaneous grades was tripping Groq's rate limit.)*
2. **Get ranked** — your *reasoning* is graded on a 5-part rubric and mapped to a **0–100 rank per subject**.
3. **Climb** — pick a subject, get problems calibrated to your level, and improve. Sound reasoning moves your score even when the final answer is wrong.

**The product rule: prove it first — the answer is never handed to you *before* you've genuinely attempted it.** While you're working a problem (and if you're stuck), the app gives a **Socratic hint** (one nudging question), a **micro-lesson** (the underlying *concept* in general terms, never the solution to your specific problem), and a **correctness note** (whether your conclusion holds, without revealing the answer). **After you submit a substantive answer and it's graded, the app DOES reveal the full worked solution** (plus "what you did well" and "to reach 100"), because by then you've made the attempt and the worked solution is how you learn (owner decision, PR 6). The lever that protects "prove it first": a non-attempt (empty / "I don't know" / off-topic) is **docked** and gets **no** worked solution — so you can't extract the answer by submitting "idk". The **Learn** tab teaches the concept's *proof / derivation / mechanism* in general terms (PR 5), and only the tab's own "try this" practice problem stays solution-free until you attempt it.

**The vision / where this is going.** A trustworthy, standardized "where do I actually stand, and how do I get better" engine for STEM reasoning — eventually monetized. Several current pieces are *first steps toward a fuller model* (the score-blend is now a difficulty/confidence-weighted Elo-style update; the next step is per-item IRT/Elo ratings rather than fixed difficulty-band midpoints). "Standardization across users" is an active goal — e.g. concept guides are generated once and **shared across all accounts**.

The three subjects (defined in `lib/scoring.js`):

| Subject | key | glyph | color |
|---|---|---|---|
| Mathematics | `math` | ∑ | `#F2B441` gold |
| Physics | `physics` | ∂ | `#5BD6C4` teal |
| Chemistry | `chemistry` | ⌬ | `#FF7E74` coral |

Score bands (global scale): **0–20** Absolute beginner · **20–40** Foundational · **40–60** Intermediate · **60–80** Advanced · **80–100** PhD-level.

---

## 2. Current status & live links

**Deployed and live in production.** Hosted on Vercel; database on Supabase; LLM via Groq.

| Thing | Value |
|---|---|
| **Production URL** | <https://noobtopro-umber.vercel.app> (also `noobtopro-1crushhaus-netizens-projects.vercel.app`, `noobtopro-git-main-…vercel.app`) |
| **GitHub repo** | `1crushhaus-netizen/noobtopro` (default branch `main`, protected) |
| **Vercel project** | `noobtopro` (team `1crushhaus-netizens-projects`); framework auto-detect is overridden by `vercel.json`; Node 24.x; **Deployment Protection is OFF** (public). Speed Insights enabled. |
| **Supabase project** | ref `vwvhgnlgubctrgksyohr`, region `us-east-1`, org `noobtopro` |
| **Supabase OAuth callback** | `https://vwvhgnlgubctrgksyohr.supabase.co/auth/v1/callback` (stable; set once per provider) |

**What works today:**
- ✅ **2-tier diagnostic** (easy + hard per subject, **6 questions**, difficulty-weighted baseline) → per-subject scoring → calibrated practice loop (Groq-backed). *(Reduced from 9 to ease Groq rate limits.)*
- ✅ **Server-authoritative scoring (signed-in users).** Practice + diagnostic for a signed-in user are graded, scored, and persisted **on the server** (`/api/score`, JWT-verified); the client can no longer self-assert a score — `scores`/`attempts` are **SELECT-only under RLS** and all writes go through a service-role-only RPC. Guests stay client-computed in `localStorage`. (§10, §11)
- ✅ **Item-as-opponent Elo ranking + 5 ranks + anti-gaming grading + anonymous leaderboard (PR 3).** The score is now a real, **non-additive** rating (`eloUpdate`): the *question* is the rated opponent and its difficulty **self-calibrates from the user population** per `(subject, topic, band)` bucket; a poor answer on an at-level item **loses** rating. Grading is hardened for consistency: a deterministic **pre-grade dock** (empty/"idk"/off-topic/gibberish → forced low, no LLM call), **anchored-exemplar** prompts at **temperature 0**, server-side **reconciliation** (the score can't contradict its rubric), and a persisted one-line **"why your rank moved"** rationale. The **5 ranks** are fixed score bands (`rankFor`, architected for a later percentile recut). The **Profile leaderboard** is **anonymous-by-design** (`/api/leaderboard` → service-role `leaderboard_tiers`): the 5-rank distribution + your own position, **no names/email/per-attempt data**. (§10, §11)
- ✅ **Deeper Learn guides (PR 5).** Concept guides teach the **proof / derivation / mechanism** (a `whyItWorks` "Why it works" section), not just a restated definition; the no-answer rule is scoped to the guide's own "try this" problem. Stale pre-PR-5 cached guides **auto-heal once** on next open via the service-role `refresh_guide`. (§10, §17)
- ✅ **Detailed feedback + worked solution + answer review (PR 6).** After a graded practice attempt the feedback panel shows **"what you did well" → "to reach 100" → a collapsible worked solution** — the solution is revealed **only after a substantive attempt** (a docked "idk"/blank gets none, so you can't extract the answer). Past answers are browsable in the **Progress → "Review your answers"** section (`attempt_reviews`, RLS own-rows-only; guests use local history). Product-rule boundary documented in §1. (§10, §12)
- ✅ **Per-subject reasoning rubric + radar chart.** Every subject gets a 5-dimension rubric profile (Conceptual grasp · Logical structure · Strategy · Execution · Communication), persisted in `scores.rubric` and shown as a hand-rolled inline-SVG **spider chart** in the Progress tab, with "what to work on" links into the Learn tab.
- ✅ **Diagnostic grading is one batched, bounded request** (server-side concurrency cap + retry-once-on-429 + `allSettled`) — the old 9-parallel-call burst that a single 429 could sink is gone.
- ✅ Photo-of-work grading (vision model, graceful text fallback).
- ✅ **Google sign-in** (configured + working), durable per-user storage with RLS.
- ✅ **Guest mode** (no login): full flow stored in `localStorage`. On first sign-in, guest progress **migrates** into the account.
- ✅ **Profile** tab (identity + stats + reset), **Progress** tab (charts), **Practice** + **Learn** tabs.
- ✅ "Save your progress" modal after the guest diagnostic.
- ✅ **Durable, per-account rate limiting** (`rate_limit_hit` RPC, shared across instances, keyed by `auth.uid()` / IP; in-memory fallback); same-origin + JSON request guards; security headers incl. a **baseline CSP**; error boundary; service-role-only privileged RPCs (PUBLIC/anon revoked).
- ✅ **Shared caches active** (`SUPABASE_SERVICE_ROLE_KEY` set): the concept-guide cache (each guide generated once, with a bundled "try this" question) and the baseline-diagnostic pool — both reused across users to cut Groq spend. Grading runs on the cheaper `openai/gpt-oss-120b` (`GROQ_GRADE_MODEL`).

- ✅ **Concept Hub (fully shipped, PR 4/5 + UI fix #46).** The universal, categorized concept directory (behind `NEXT_PUBLIC_ENABLE_CONCEPT_HUB`): the Learn tab is the searchable curated catalog; **curation-only** public model. **Public seed (PR 4):** the `service_role`-only `seed_curated_guide` RPC + `scripts/seed-concept-hub.mjs` — **9 curated, proof-bearing guides seeded live** across all 3 subjects (run the script to fill all 36). Conservative `dedupe_pending_stubs` housekeeping. The browse UI (visible filter chips, proper search input, left-aligned concept tags) was fixed in #46. **v1.1:** open to undiagnosed guests, `pg_trgm` fuzzy de-dup, `tags[]` (§17).

**Nothing is mid-flight** — `main` is fully merged and green. The next task is the independent audit (see "Where to start").

**Built but not yet activated (config only):**
- ⏳ **GitHub / Discord sign-in** — code is env-toggleable and ready; needs the OAuth apps + Supabase provider config + `NEXT_PUBLIC_ENABLE_*` flags (see `AUTH_PROVIDERS.md`).
- ⏳ **Admin dashboard** — an in-app, admin-only tab to **approve** auto-grown guides into the public hub and triage **abuse warnings** (prompt-injection attempts, rate-limit spikes) + user reports. Gated by a server-verified, **deny-by-default** `ADMIN_EMAILS` allowlist (see §7); set it in Vercel + redeploy to reveal the tab. All `/api/admin/*` routes verify the caller's Supabase JWT and re-check on every action.

**Env vars currently set in Vercel (project-level):** `GROQ_API_KEY` (Sensitive), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Sensitive). **Not set:** `NEXT_PUBLIC_ENABLE_GITHUB`, `NEXT_PUBLIC_ENABLE_DISCORD`.

> Dashboard access (Vercel, Supabase, Groq, Google Cloud) lives in the owner's accounts — ask the repo owner for access.

---

## 3. Quickstart

**The app boots with zero configuration** — it runs in guest mode (localStorage) and only shows a friendly error on the LLM features until you add a Groq key.

```bash
git clone https://github.com/1crushhaus-netizen/noobtopro.git
cd noobtopro
npm install
cp .env.example .env.local      # then paste your GROQ_API_KEY (see §7)
npm run dev                     # http://localhost:3000
```

- **Minimum to use the LLM features:** set `GROQ_API_KEY` in `.env.local` (free key at <https://console.groq.com/keys>).
- **To exercise auth + persistence locally:** also set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the local `.env.local` is gitignored; a copy already points at the live project).
- If `npm install` complains about versions: `npm install next@latest react@latest react-dom@latest @supabase/supabase-js@latest`.

Other commands: `npm test` (run tests once), `npm run test:watch`, `npm run build`, `npm start`. (There is intentionally no `lint` script yet — ESLint isn't configured; see §17.)

---

## Where to start (next task: full independent fleet audit)

> **Shipped & live on `main` (all merged):** flatten-for-Vercel + audit hardening (PR #2–#29) · Concept Hub backend/admin/browse (#29–#31) · "Prove it" diagnostic (#32) · server-authoritative scoring + reasoning radar (#34/#35) · fleet-audit fixes (#36) · diagnostic → 6 questions (#37) · durable per-account rate limiter (#38) · **Elo ranking + explainable anti-gaming grading + anonymous leaderboard (PR 3, #40)** · **Concept Hub public seed + canonical de-dup (PR 4, #44)** · **Learn-tab proof/derivation guides + stale-guide auto-heal (PR 5, #45)** · **detailed "how to reach 100" feedback + post-grade worked solution + answer review (PR 6, #43)** · **Concept Hub UI fixes (#46)**.
>
> **Live DB migrations `0001a`–`0007` are ALL applied** to the Supabase project (`vwvhgnlgubctrgksyohr`), so the live DB == `db/schema.sql`. Advisor baseline is the documented/accepted set (§17). **438 tests across 32 files + `npm run build` are green.** The Concept Hub has **9 curated, proof-bearing guides** seeded live (run `node scripts/seed-concept-hub.mjs` with the Groq + service-role keys to fill all 36 topics).

### 🔎 THE NEXT TASK — a comprehensive, independent, fleet audit of the ENTIRE codebase
The owner wants a **full, adversarial, independent audit** — spend **as many agents and as many tokens as you can** to be exhaustive. Find **everything**: security vulnerabilities, network/API vulnerabilities, UI bugs, and correctness/non-severe bugs, at **every** severity. This is a *find-and-report* task first; **do not change code until the report is delivered and the owner picks what to fix.**

**Posture — be ruthlessly independent.** Treat **every** claim in this README and in code comments ("safe / verified / fixed / accepted / intended / 0 findings") as **UNVERIFIED until you confirm it yourself** against the actual source **and the live database**. Prior reviews were run by the same agent lineage that wrote the code — assume they missed things. **Sub-agents hallucinate**, so **every finding must be verified against the real file:line (and, for DB claims, the live project) before it goes in the report.** Default a candidate finding to *refuted* unless the source unambiguously confirms it.

**How to run it (use the fleet — `ultracode` is on).** Drive it with the **Workflow tool**: fan out many finder agents in parallel across the dimensions below, then **adversarially verify each finding** with independent skeptic agents, then synthesize one classified report. Use loop-until-dry (keep spawning finders until N rounds surface nothing new), multi-modal sweeps (search by route, by table, by component, by data-flow), and a completeness critic at the end ("what dimension/file/claim did we not actually check?"). Run several Workflow phases in sequence (understand → audit each dimension → verify → synthesize) so you stay in the loop. Scale the fleet up — thoroughness over cost.

**Dimensions to cover (comprehensive — every file under `app/`, `components/`, `lib/`, `db/`, `scripts/`, config):**
1. **Security / trust boundary.** JWT verification (`lib/adminAuth.js` `requireUser`/`requireAdmin`) on `/api/score`, `/api/leaderboard`, `/api/admin/*`; can a client self-assert a score/rank or read another user's data by ANY path (PostgREST `PATCH`, forged/missing/expired token, RPC call). **RLS on every table** — `scores`, `attempts`, `attempt_reviews`, `concept_guides`, `concept_topics`, `diagnostic_pool`, `security_events`, `concept_reports`, `rate_limits`, `item_difficulty`. **RPC EXECUTE ACLs** — confirm `save_progress_for`, `bump_item_difficulty`, `leaderboard_tiers`, `seed_curated_guide`, `dedupe_pending_stubs`, `refresh_guide`, `register_concepts`, `promote_or_insert_guide`, `try_add_diagnostic`, `rate_limit_hit` are **service-role only**, and `migrate_guest_data`/`delete_user_data` are self-scoped to `auth.uid()`. SECURITY DEFINER `search_path` pinning. The **curation-only invariant** (no client/automated path sets `visibility='public'`). The **worked-solution gate** (a docked/blank answer must NOT reveal the solution — `/api/score` + `/api/grade`). Secret leakage (`GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, upstream Groq/DB error detail in responses or logs). Prompt-injection + SQL-injection surfaces. Admin allowlist (`ADMIN_EMAILS`/`ADMIN_USER_IDS`, deny-by-default).
2. **Network / API.** Same-origin + JSON guards (`lib/requestGuard.js`) on every route; rate limiting (`lib/rateLimit.js` — per-IP, per-account `acct:*`, `:img`/`:diag`/`:learn` budgets) and whether any expensive path escapes a budget; **cost-amplification** on the Groq fan-out (diagnostic, vision grades, learn generation, stale-guide refresh); SSRF / arbitrary-bytes via the image `data:` URL (`lib/gradeInput.js` magic-byte sniff); security headers + the baseline **CSP** (`next.config.js`); `vercel.json`; whether any route that mutates is missing auth.
3. **UI bugs.** The `stage × view` state machine (`components/Noobtopro.jsx`) and the newer surfaces — the **anonymous leaderboard** (ProfileTab), the **feedback card** ("what you did well / to reach 100" / collapsible worked solution), the **Review view** (ProgressDashboard), the **"Why it works"** section + Concept Hub **browse/search/filter** (LearnTab). Check: XSS in any rendered LLM/user/stored content (no `dangerouslySetInnerHTML`; React-escaping), accessibility (aria labels, live regions, focus trap on the save-progress modal, contrast — the chips/search were just restyled in #46), responsive layout, loading/empty/error states, image-preview `URL.revokeObjectURL` leaks, the run-token guards (`practiceRun`/`diagRun`/`learnRun`) against stale writes, guest `localStorage` quota/sanitization.
4. **Correctness / non-severe bugs.** The scoring engine (`lib/scoring.js`: `eloUpdate`/`eloK`/`eloExpected`/`reconcileReasoningScore`/`rankFor`/`diagnosticSubjectScore`/`blend` legacy path/null-NaN handling); the dock heuristics (`lib/preGrade.js`) for false positives/negatives + ReDoS; guest-vs-signed-in scoring parity; race conditions (the documented read-modify-write on `scores`, the bucket bump, single-flight migration); the data layer (`lib/store.js` clamps, `migrate_guest_data` ≤5000 cap, guest review cap); cache correctness (concept guides, diagnostic pool); taxonomy normalization (prototype-safety); off-by-ones; dead code; stale comments/docs (incl. this README — flag anything inaccurate).
5. **Database (use the Supabase MCP connector).** Run **`get_advisors` (security AND performance)**; inspect live **RLS, policies, GRANTs, function ACLs, search_path**; confirm `db/schema.sql` matches the live DB and each `db/migrations/NNNN_*.sql` is idempotent and consistent with `schema.sql`. (Connector project id: `vwvhgnlgubctrgksyohr`.)

**Don't burn tokens re-reporting accepted residuals — but DO re-judge whether each is still valid.** §17 lists the documented/accepted residual risks + the expected advisor baseline (the read-modify-write race; diagnostic re-baseline overwrite; SECURITY DEFINER owner not pinned; the two `authenticated_security_definer` WARNs on `migrate_guest_data`/`delete_user_data`; the `rls_enabled_no_policy` INFOs on the internal tables incl. `item_difficulty`; leaked-password protection off; `delete_user_data` not deleting the `auth.users` row; shared-device guest auto-migrate; nonce-based strict CSP not yet shipped). Label these **"accepted residual (still valid? y/n)"** rather than as new P-findings.

**Deliverable.** A single classified report: **P0 (critical) → P3 (trivial)**, each with `file:line`, a concrete exploit/impact or repro, and a recommended fix; an explicit **merge-blocker** list; and a clear split of **confirmed** vs **could-not-confirm**. Note coverage gaps honestly (any file/dimension not actually audited). Run `npm test` + `npm run build` as part of the audit. **Then ask the owner which findings to fix** before touching code; fixes follow the dev loop in §15 (branch → PR → CI → adversarial re-review → merge; DB changes get a numbered migration applied to live + a re-run of advisors).

**Tooling notes.** `ultracode` is on (default to Workflow orchestration). The **Supabase MCP connector** is available for the live DB. **Greptile's trial is exhausted** — the agent fleet is the *only* review gate, so the audit's rigor matters. The owner holds the Vercel/Supabase/Groq/Google dashboards — ask if you need deeper infra checks. The `greptile-trial-limit`, `ranking-grading-direction`, `leaderboard-privacy-decision`, and `handoff-pr3-pr4-shipped` auto-memories carry the relevant decisions/state.

### Backlog (after the audit — see [§17](#17-roadmap--known-limitations))
Percentile-recut rank tiers; per-item IRT/Elo (vs band-bucket difficulty); the full 36-topic seed run; Concept Hub v1.1 (`pg_trgm` fuzzy search/de-dup, `tags[]`, open the hub to undiagnosed guests, `times_opened` popularity); multi-sample grading median; nonce-based strict CSP; GitHub/Discord sign-in activation; ESLint in CI; `delete_user_data` doesn't delete the `auth.users` account.

---

## 4. Architecture

Next.js 15 (App Router) + React 19, deployed as serverless on Vercel. **Two reasons there is a backend:**
1. **The Groq key must stay server-side.** The browser never talks to Groq; it posts to `/api/*`, and only the server (reading `GROQ_API_KEY`) calls Groq.
2. **Per-user data needs an owner.** Supabase handles auth + storage; the browser talks to Supabase directly using the public anon key — safe because **Row-Level Security** scopes every row to its owner.

```
Browser (components/)                    Next.js server (app/api/)            Groq
  Noobtopro.jsx ───fetch────▶  /api/generate ──▶ lib/groq.js ──────▶ api.groq.com
  (SignIn/Profile/Learn/        /api/grade    ──▶ lib/groq.js          (GROQ_API_KEY,
   ProgressDashboard)           /api/learn    ──▶ lib/groq.js           server-only)
        │                            │  (rate-limited; reads/writes the
        │                            │   shared concept_guides cache via
        │                            │   lib/supabaseAdmin.js = service role)
        │
        └──lib/store.js──▶ Supabase (Postgres + Auth), RLS-scoped per user
                            (falls back to localStorage for guests)
```

- **Client → `/api/*`** for anything that needs the Groq key (question generation, grading, concept guides).
- **Client → Supabase** (via `lib/store.js`) for reads/writes of the signed-in user's own `scores`/`attempts` (RLS-protected). Guests use `localStorage`.
- **Server → Supabase (service role)** only inside `/api/learn`, to read/write the shared `concept_guides` cache (an internal table no end-user can touch).

---

## 5. Repo map

Everything lives at the **repo root** (the app was flattened out of a nested folder so Vercel needs no Root Directory override — see §16).

```
app/
  layout.js            Root layout; <SpeedInsights/>; <html>/<body>
  page.js              Renders <Noobtopro/>
  error.jsx            App Router error boundary (no white-screen on crashes)
  globals.css          All styles + design tokens (the .np-* system)
  api/
    generate/route.js  POST: diagnostic (9 Qs) or practice (1 Q) question generation
    grade/route.js     POST: grade reasoning (guest practice + low-level); image-aware
    score/route.js     POST: SERVER-AUTHORITATIVE scoring (signed-in) — dock+grade+reconcile+Elo+persist; diagnostic batch
    leaderboard/route.js POST: anonymous rank-tier distribution (JWT-verified → service-role leaderboard_tiers)
    learn/route.js     POST: Socratic concept guide; read-through shared cache
    admin/me/route.js     POST: is the caller an admin? (UI hint; re-verified per action)
    admin/data/route.js   POST: admin snapshot — approval queue + security events + reports
    admin/action/route.js POST: admin actions — approve/hide/delete a guide; resolve events/reports
components/
  Noobtopro.jsx        THE app — one big client component; stage×view state machine
  SignIn.jsx           OAuth sign-in menu (provider buttons; no email/password)
  ProfileTab.jsx       Identity card + stats + "Reset my progress"
  LearnTab.jsx         Weak-concept picker + Socratic guide renderer
  AdminDashboard.jsx   Admin-only tab: concept approval queue + abuse warnings + reports
  ProgressDashboard.jsx  Charts (total over time, per-attempt deltas, by-subject, reasoning radar + "what to work on")
lib/
  groq.js              Server-only Groq client + ALL system prompts (*_SYS)
  gradeInput.js        Shared input validators (capText/normalizeImage/difficulty/weakConcepts) for /api/grade + /api/score
  preGrade.js          Deterministic pre-grade DOCKING gate (empty/idk/off-topic/gibberish → forced low, no LLM)
  scoring.js           SUBJECTS/ORDER/bands + clampScore/band + Elo engine (eloUpdate/rankFor/reconcile/explainRankMove) + rubric helpers (radar)
  rateLimit.js         In-memory per-IP fixed-window limiter (used by all 3 routes)
  store.js             Data layer: Supabase when signed in, localStorage for guests
  catalog.js           Concept Hub browse: client-side reads of the public catalog + report write
  conceptKey.js        Pure concept→cache-key normalizer (client-safe; SQL-parity with _concept_key)
  supabase.js          Browser Supabase client + auth helpers + PROVIDERS
  supabaseAdmin.js     Server-only service-role client (concept cache); re-exports conceptKey
  taxonomy.js          Concept-hub Subject→Topic taxonomy (36 slugs; mirrors concept_topics) + SEED_CONCEPTS (one core concept per topic, for the public seed)
  contentSafety.js     isConceptSafe() gate for public concept-hub entries
  requestGuard.js      Same-origin (Sec-Fetch) + JSON content-type gate for the API routes
  adminAuth.js         Server-only: verify Supabase JWT + deny-by-default admin allowlist
  abuseDetection.js    Server-only: prompt-injection heuristic + security_events logging
db/
  schema.sql           CANONICAL database DDL (tables, RLS, all RPCs) — run this to provision
  migrations/          Numbered delta migrations vs a live DB (0001a … 0007); all applied to the live project
scripts/
  seed-concept-hub.mjs Concept Hub PUBLIC SEED (PR 4): batch-generate + publish a curated guide per of the 36 topics (run once, with keys)
test/                  Vitest suite (see §13)
.github/workflows/ci.yml   CI: "Test and build" (npm test → npm run build)
next.config.js         reactStrictMode + security headers
vercel.json            { "framework": "nextjs" } — pins the build (critical, see §16)
vitest.config.js       node env + @/ alias + automatic JSX runtime
jsconfig.json          @/* -> ./*  path alias
.nvmrc                 Node 24
.env.example           Documented env vars
DEPLOYMENT_PLAN.md     Vercel/Supabase/Google setup playbook
FEATURE_PLAN.md        Sign-in menu / Profile / Learn feature plan + decisions
AUTH_PROVIDERS.md      Step-by-step GitHub/Discord enablement
```

---

## 6. Conventions

- **Plain JavaScript — no TypeScript.** Files are `.js`/`.jsx`. Don't introduce TS without a deliberate decision.
- **Imports use the `@/` alias** (`@/lib/...`, `@/components/...`), mapped to repo root in `jsconfig.json` + `vitest.config.js`. Avoid relative `../../` imports.
- **Server-only modules:** `lib/groq.js` and `lib/supabaseAdmin.js` read secrets and must **never** be imported by client components. `lib/supabase.js` is browser-only (it returns `null` server-side).
- **Naming at the DB boundary:** Postgres columns are `snake_case` (`weak_concepts`, `reasoning_score`); the UI uses `camelCase` (`weakConcepts`, `reasoningScore`). `lib/store.js` maps between them (`rowToEvent`).
- **CSS:** one stylesheet (`app/globals.css`), all classes prefixed `np-`, driven by CSS custom-property design tokens in `:root` (`--bg #0a0d13`, `--panel`, `--line`, `--text #ECECE4`, `--muted`, `--math/--phys/--chem`, `--display` Fraunces, `--ui` Hanken Grotesk, `--mono` JetBrains Mono). Inline `style={{}}` is used for per-subject color theming.
- **Every change ships via a PR** that must pass the required **"Test and build"** check (§14, §15). `main` is protected.
- **Commits** end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. PRs end with the Claude Code generation footer.

---

## 7. Environment variables

NEXT_PUBLIC_* values are **inlined into the client bundle at build time** (a change requires a *redeploy*, not just a save). Non-prefixed values are **server-only secrets**. In Vercel, set everything at the **project level** (not Team/Shared — see §16) and scope to Production + Preview + Development.

| Variable | Secret? | Required | What it does |
|---|---|---|---|
| `GROQ_API_KEY` | **Yes** (mark Sensitive) | For LLM features | Server-side Groq key. Without it, `/api/*` return a friendly 500. |
| `GROQ_MODEL` | no | no | Override the text model used for **generation + Learn**. Default `llama-3.3-70b-versatile`. |
| `GROQ_GRADE_MODEL` | no | no | Override the **grading** model (the hottest path). Default `openai/gpt-oss-120b` (~3.9× cheaper input / ~1.3× output than the 70B; `reasoning_effort` pinned low). Set to `llama-3.3-70b-versatile` to roll back instantly. |
| `GROQ_VISION_MODEL` | no | no | Override vision model for photo grading. Default `meta-llama/llama-4-scout-17b-16e-instruct`. |
| `NEXT_PUBLIC_SUPABASE_URL` | no (public) | For auth/persistence | Supabase API URL. Without it + the anon key, the app runs guest-only. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no (public, RLS-protected) | For auth/persistence | Supabase anon key. Public by design; RLS scopes rows to their owner. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** (mark Sensitive) | no | Enables **both** shared read-through caches — the concept-guide cache (`/api/learn`) **and** the diagnostic pool (`/api/generate`). Server-only secret (Supabase → Settings → API → `service_role`). Unset = neither cache active (both features still work, regenerating each time). |
| `NEXT_PUBLIC_ENABLE_GITHUB` | no (public) | no | `"true"` shows the GitHub sign-in button. Set **only after** configuring GitHub in Supabase, else it errors on click. |
| `NEXT_PUBLIC_ENABLE_DISCORD` | no (public) | no | Same, for Discord. |
| `NEXT_PUBLIC_ENABLE_CONCEPT_HUB` | no (public) | no | `"true"` makes the Learn tab the browsable **Concept Hub** (curated catalog + search + report) instead of the weak-concept picker. Inlined at build → **redeploy** after changing. |
| `ADMIN_EMAILS` | **Yes** (mark Sensitive) | no | Comma-separated email allowlist for the **admin dashboard**, matched case-insensitively to the caller's verified Supabase JWT email. Server-only; **deny-by-default** (unset/empty = no admins). Needs `SUPABASE_SERVICE_ROLE_KEY` + the `NEXT_PUBLIC_SUPABASE_*` values. Redeploy after setting. |
| `ADMIN_USER_IDS` | **Yes** (mark Sensitive) | no | Optional fallback allowlist of Supabase auth user UUIDs (comma-separated). Use instead of / alongside `ADMIN_EMAILS`. |

---

## 8. Database & persistence

### Provisioning (canonical source: `db/schema.sql`)
To stand up the database from scratch (or reproduce it), **run `db/schema.sql` in the Supabase SQL Editor.** It is the single source of truth and contains the tables, RLS, and **all RPCs** — the app depends on the functions, not just the tables. (The live project is already provisioned; migrations were applied via the Supabase connector.) Then enable the redirect URLs / auth providers per `DEPLOYMENT_PLAN.md` / `AUTH_PROVIDERS.md`.

### Tables
- **`scores`** — `(user_id uuid, subject text check(math|physics|chemistry), score int, weak_concepts text[], comment text, rubric jsonb, updated_at)`, PK `(user_id, subject)`. `rubric` is the per-subject 5-dimension reasoning profile (`{conceptual_understanding, logical_structure, strategy, execution_accuracy, communication}`, 0–4 each) that powers the radar chart — **server-computed only** (see `save_progress_for`), `null` until a first graded result.
- **`attempts`** — `(id bigint identity PK, user_id, created_at, type text check('baseline'|'attempt'), subject, reasoning_score, delta, new_score, total_after, phd_after, rationale text)`. Indexed `(user_id, created_at, id)`. `rationale` is the persisted one-line **"why your rank moved"** explanation (server-computed, `≤500` chars; `null` for baselines / pre-0004 rows).
- **`attempt_reviews`** *(answer review — PR 6)* — `(attempt_id bigint PK → attempts(id), user_id, subject, question, answer, target_concept, difficulty, reasoning_score, delta, rubric jsonb, feedback jsonb, created_at)`. The per-practice-attempt detail powering the **Review** view (the question, the learner's answer, the rubric, and the post-grade feedback incl. the **worked solution** in `feedback`). A SIBLING of `attempts` (not extra columns) so the hot chart query stays lean and this heavy payload is fetched **lazily**. **RLS SELECT-own** (the learner reads their OWN reviews via PostgREST); all writes revoked — only `save_progress_for` (service-role) writes it, in the same transaction as the attempt. Guests keep the equivalent detail in `localStorage` (capped to the recent 25).
- **`item_difficulty`** *(internal — the Elo "opponent" rating)* — `(subject, topic, band, difficulty numeric, attempts bigint, updated_at)`, PK `(subject, topic, band)`, FK `(subject, topic) → concept_topics(subject, slug)`. The per-`(subject, taxonomy-topic-slug, band)` **self-calibrating question difficulty** (questions are generated fresh, so the *bucket* is calibrated, not a per-question id). Seeded lazily from the band midpoint and nudged toward what the population actually scores. **RLS on, NO policy** (service-role only — same lock as `diagnostic_pool`/`rate_limits`; the FK + `band` CHECK bound the key space). Holds NO per-user data. Written only by `bump_item_difficulty`.
- **`concept_topics`** *(taxonomy reference)* — `(subject, slug, label, sort)`, PK `(subject, slug)`. The curated 36-topic Subject→Topic tree (mirrors `lib/taxonomy.js`). **Public-readable** (`for select using (true)`) so the hub renders labels/ordering; writes service-role only.
- **`concept_guides`** *(the concept-hub catalog)* — `(subject, concept_key, concept, topic→concept_topics, content jsonb null, status 'ready'|'pending', visibility 'public'|'hidden', source 'grader'|'curated'|'user', level_band, times_opened, created_at, updated_at)`, PK `(subject, concept_key)`. **Publicly readable but read-only** — the policy `for select to anon, authenticated using (visibility='public' and status='ready')` exposes only vetted guides; **all writes stay service-role only**. `content` is `null` for a `pending` stub. **CURATION-ONLY public model (security):** auto-grown guides (`source` grader/user) are **always stored `visibility='hidden'`** — cached + servable to a direct opener, but **never publicly browsable**. Only `source='curated'` rows (the seed / explicit approval) are public, so attacker-influenced concept labels/content can never be broadcast to all users. ⚠️ This is a public object — **never add a PII/per-user column here.**
- **`diagnostic_pool`** *(internal cache)* — `(id bigint identity, content jsonb, created_at)`. A handful of full 3-subject baseline diagnostics, reused across users (standardized, like the guides). Same **RLS-on / NO-policies** service-role lock. `/api/generate` serves a random one with no Groq call once it reaches `DIAG_POOL_TARGET` (12); below that it self-fills via the **`try_add_diagnostic(p_content, p_target)`** RPC — an advisory-locked, count-gated insert (`service_role`-only) so concurrent cold-start fills can't overshoot the target.
- **`security_events`** *(admin / abuse monitoring)* — server-logged warnings (prompt-injection attempts, rate-limit spikes, user reports) shown in the admin dashboard. **RLS on, NO policy** (service-role only — same lock as `diagnostic_pool`); never written by the browser.
- **`concept_reports`** *(admin / abuse monitoring)* — a signed-in user's report about a public guide. RLS has an **insert-own** policy (`to authenticated with check (auth.uid() = reporter_id)`); reads are admin-only (service-role; no select policy). The user-facing report button ships with the browse UI. A partial unique index (`concept_reports_one_open_per_user`, `where status='open'`) caps report-flooding.
- **`rate_limits`** *(internal)* — `(bucket text PK, hits, reset_at, updated_at)`. The **durable rate limiter**'s shared fixed-window store. **RLS on, NO policy** (service-role only); written only by the **`rate_limit_hit(p_bucket, p_max, p_window_seconds)`** RPC (`service_role`-only, atomic increment + opportunistic prune). `lib/rateLimit.js#checkRateLimit` calls it; falls back to the in-memory limiter when the service-role key is unset.

`scores`/`attempts` are **SELECT-only under RLS** (`for select to authenticated using ((select auth.uid()) = user_id)`) — a user can READ only their own rows and can no longer **write** them directly (direct INSERT/UPDATE/DELETE grants are also revoked from `anon`/`authenticated`, defense-in-depth). This is the core of **server-authoritative scoring**: all writes go through `SECURITY DEFINER` functions (which bypass RLS, scoped server-side), so a signed-in user cannot self-assert a score by any path — not even a direct PostgREST `PATCH`.

### RPCs (Postgres functions, in `db/schema.sql`)
- **`migrate_guest_data(p_scores jsonb, p_attempts jsonb)`** — atomic, idempotent, advisory-locked per user; migrates guest progress (incl. the per-subject `rubric`) into an **empty** account in one transaction (first-writer-wins; never overwrites). Called on first sign-in. **`SECURITY DEFINER`** (so it can write under the SELECT-only RLS) but **self-scoped to `auth.uid()`** — a caller can only migrate their own data; granted to `authenticated`.
- **`delete_user_data()`** — atomic delete of the caller's scores + attempts (Profile → "Reset my progress"). `SECURITY DEFINER`, self-scoped to `auth.uid()`; granted to `authenticated`.
- **`save_progress_for(p_user uuid, p_scores jsonb, p_attempt jsonb, p_review jsonb default null)`** *(server-authoritative scoring)* — the ONLY write path for signed-in scores/attempts. Upserts the user's scores (incl. `rubric`) **and** appends the matching attempt (incl. the `rationale`, `≤500` chars) **and**, when `p_review` is supplied, writes the `attempt_reviews` detail keyed to the inserted attempt id — all in **one transaction** for the explicit `p_user`. `SECURITY DEFINER` and **`service_role`-only** (revoked from `public`/`anon`/`authenticated`) — `/api/score` calls it with the **JWT-verified** uid, so the client can never write an arbitrary score or another user's row. Values are clamped / type-allow-listed / guard-cast (PG16+ `pg_input_is_valid`). PR 6 dropped the old 3-arg signature and replaced it with this defaulted 4-arg one (the diagnostic's 3-arg call resolves to it with `p_review` null). (The old client-callable `save_progress(jsonb,jsonb)` was **dropped** earlier.)
- **`bump_item_difficulty(p_subject, p_topic, p_band, p_delta, p_seed)`** *(Elo calibration)* — atomic, clamped, FK-guarded upsert that nudges a `(subject, topic, band)` bucket's difficulty by the Elo `diffDelta` and increments `attempts` (seed-lazy from `p_seed` on first touch). Concurrent attempts commute (additive deltas), so no advisory lock is needed. `SECURITY DEFINER`, **`service_role`-only**. Returns the new difficulty; a non-taxonomy topic returns `null` (never violates the FK).
- **`leaderboard_tiers(p_uid uuid)`** *(anonymous leaderboard)* — `SECURITY DEFINER`, **`service_role`-only**, called by `/api/leaderboard` with the JWT-verified uid. Returns a jsonb of per-subject + `overall` **aggregate counts across the 5 rank bands** + the caller's own `{ band, score, above }`. Exposes **no** user identity (no email/name/user_id, no per-attempt rows) — the anonymity holds at the SQL layer. Qualifying users = those with ≥1 `scores` row.
- **`register_concepts(p_subject, p_concepts jsonb)`** *(concept hub)* — auto-grow: registers the grader's (server-normalized) weak concepts as **`pending` stubs** (hidden until generated). `SECURITY DEFINER`, `service_role`-only; `on conflict do nothing` so it never disturbs an existing row; a **best-effort global cap (50k pending stubs)** bounds catalog growth. Called non-blocking (`after()`) from `/api/grade`.
- **`promote_or_insert_guide(p_subject, p_concept, p_content, p_topic, p_level, p_safe)`** *(concept hub)* — on a `/api/learn` generation: **promotes** a `pending` grader stub to `ready`, else inserts a fresh user-originated guide. **Either way the guide is stored `visibility='hidden'`** (curation-only): cached + servable to a direct opener but **never publicly browsable**. `p_safe` is retained for backward-compat but **no longer grants public visibility** (only a `source='curated'` seed is public). **Never overwrites an existing `ready` guide** (first-writer-wins). `SECURITY DEFINER`, `service_role`-only.
- **`seed_curated_guide(p_subject, p_topic, p_concept, p_content, p_level)`** *(concept hub — PR 4)* — the sanctioned **BATCH public-publish path** (alongside the admin "approve" action): upserts a `source='curated', visibility='public', status='ready'` guide. **Idempotent + re-runnable** (re-running refreshes content); on conflict it also promotes any prior hidden row for the key to the curated public catalog. `SECURITY DEFINER`, **`service_role`-only** — a signed-in user can never self-publish, so the curation-only model holds (no automated/client path makes content public). Called by `scripts/seed-concept-hub.mjs` for each `SEED_CONCEPTS` entry.
- **`dedupe_pending_stubs()`** *(concept hub — PR 4)* — conservative housekeeping: deletes content-less grader **`pending` stubs** already subsumed by a `ready` guide in the same `(subject, topic)` (the stub's key is a substring of the ready guide's key). Touches **no** `ready`/`public`/`curated` row; a concept re-stubs if a later grade re-registers it. `SECURITY DEFINER`, `service_role`-only. (Fuzzy semantic merge of distinct-keyed near-duplicates is the v1.1 `pg_trgm` follow-on.)
- **`_concept_key(text)`** *(concept hub)* — SQL re-implementation of `conceptKey()` with **byte-for-byte parity**: both strip control/zero-width/BOM chars (the set where JS `\s`/`trim()` and Postgres `\s` disagree) and truncate to 200 by **code point** (`left()` ↔ `Array.from().slice()`). Pinned by `test/conceptKey.test.js` golden vectors + a live-DB equality check, so grader-registered keys always match generated ones.
- *(The hub's **reads** are browser-direct against the publicly-readable `concept_guides`/`concept_topics` via PostgREST — no RPC, no Groq.)*

### `lib/store.js` — the dual-mode data layer
The UI only ever calls these; they transparently use Supabase when signed in, else `localStorage` (`key "noobtopro:v1"`):
- `loadState()` — returns `{ scores, history }` (or `{ error }` on a DB failure, so the UI doesn't mistake an error for "new user").
- `saveProgress(scores, evt)` — **GUEST-only** write path now: a single `localStorage` write that persists the score change and its attempt **together**, returning the refreshed `{ history }`. Throws on a quota/blocked write (so the caller surfaces a banner) and **throws if called while signed in** — signed-in persistence is server-authoritative via `/api/score` (the browser can no longer write `scores`/`attempts`). `components/Noobtopro.jsx` branches: signed-in → `/api/score`, guest → grade + `saveProgress`.
- `migrateGuestToAccount()` — single-flight wrapper around the `migrate_guest_data` RPC; sends a clamped payload **capped to the most recent 5000 attempts** (the RPC's limit) so a heavy guest still migrates; clears the guest copy on success.
- `deleteAllUserData()` — calls the `delete_user_data` RPC.
- `resetAll()` — clears the local guest view only.

---

## 9. Authentication

**OAuth-only by design — there is no email/password and no manual sign-up.** Identity is delegated entirely to providers (Google live; GitHub/Discord ready) via Supabase, so we never store credentials or carry that PII responsibility.

- **`lib/supabase.js`** exports `PROVIDERS` (`google` always on; `github`/`discord` gated on `NEXT_PUBLIC_ENABLE_*`), `signInWithProvider(id)` (full-page OAuth redirect, `redirectTo: window.location.origin`), `signInWithGoogle`, `signOutUser`, `isSupabaseConfigured`, `getSupabase` (browser-only, lazy). The client uses the **PKCE** OAuth flow (`flowType: "pkce"`) so tokens are exchanged via an authorization code rather than exposed in the URL fragment.
- **Flow:** the **sign-in menu** (`stage: "signin"` → `SignIn.jsx`) shows a button per provider (disabled = "Coming soon"). After the OAuth redirect, `onAuthStateChange("SIGNED_IN")` runs `hydrate()`, which first calls `migrateGuestToAccount()` (guest → account) then `loadState()`. `onAuthStateChange` only re-hydrates on `SIGNED_IN`/`SIGNED_OUT` (not token refreshes).
- **Guest-first:** you can do the whole diagnostic without logging in; on completion a modal prompts you to sign in to save, and your guest results migrate over.
- **Enabling GitHub/Discord:** create the OAuth app (callback = the Supabase callback URL above), enable the provider in Supabase, then set `NEXT_PUBLIC_ENABLE_GITHUB`/`…DISCORD=true` and redeploy. Full steps in `AUTH_PROVIDERS.md`.

---

## 10. Server API reference

All three routes are `POST`, `dynamic = "force-dynamic"`, **same-origin-gated** (`lib/requestGuard.js`: rejects forced cross-site requests via `Sec-Fetch-Site` → `403`, and requires `Content-Type: application/json` → `415`, blunting CSRF-style cross-site cost/quota abuse), **rate-limited** (`lib/rateLimit.js#checkRateLimit`: a **durable, Postgres-backed shared counter** via the `rate_limit_hit` RPC — keyed by **account** (`acct:<auth.uid()>`) for signed-in callers, IP for guests, shared across all serverless instances; falls back to an in-memory per-instance limiter when `SUPABASE_SERVICE_ROLE_KEY` is unset; `429` + `Retry-After`; `/api/learn` tighter at 15/min, image grades a separate 10/min `:img` budget, the diagnostic a 4/min `:diag` budget), validate input (→ `400`), normalize model output, and return a **generic `500`** (the real Groq error is logged server-side, never leaked).

### `POST /api/generate`
- **Diagnostic:** `{ "kind": "diagnostic" }` → `{ questions: [{subject, topic, difficulty, question} × 6] }` — **2 per subject** at difficulty `foundational`/`advanced` (easy/hard). **Read-through `diagnostic_pool`:** once the pool holds `DIAG_POOL_TARGET` (12) valid full sets, returns a random one (`pooled:true`) with **no Groq call**; below that, generates fresh (gated by `isValidDiagnostic`) and self-fills the pool. `isValidDiagnostic` only accepts a set with **all 3 subjects × all 2 tiers** (6 questions). Skipped when `SUPABASE_SERVICE_ROLE_KEY` is unset (always generates).
- **Practice:** `{ "kind": "practice", "subject": "math"|"physics"|"chemistry", "score": int, "weakConcepts": string[] }` → `{ subject, topic, topicSlug, targetConcept, difficulty, question }`. Subject validated via `ORDER.includes` (prototype-safe); `weakConcepts` capped. `topicSlug` is the LLM-chosen **taxonomy slug** (normalized server-side via `normalizeTopic`) — it keys the per-`(subject, topic, band)` difficulty bucket the Elo engine calibrates (§11); the human-readable `topic` is unchanged.

### `POST /api/grade`
- `{ kind: "diagnostic"|"practice", subject, question, [targetConcept], [difficulty], [score], reasoning, [image: { mime, data(base64) }] }`. *(practice-only `difficulty` is the question's band, allowlist-validated and used only to calibrate the grader; unknown/missing → `(unspecified)`.)*
- **Deterministic pre-grade dock (no LLM call):** an empty / "idk" / off-topic-fragment / gibberish answer is caught by `lib/preGrade.js#preGradeDock` and graded as a single-digit score + all-zero rubric **without** a Groq call (`docked:true`) — the anti-"idk" lever, applied identically here (guests) and in `/api/score` (signed-in). **Reconciliation:** a returned score that contradicts its rubric mean is pulled toward the rubric (`reconcileReasoningScore`, §11) so the number can't diverge from the bars. Grading runs at **temperature 0** for determinism.
- Free-text fields capped (~12k chars); image validated (allowlisted MIME jpeg/png/webp/gif, base64, ~3 MB cap).
- **Diagnostic →** `{ subject, score(0–100), rubric{…}, weakConcepts[], comment }` — grades **one** question's reasoning, calibrated to its `difficulty` band. *(This single-grade mode is retained; the live diagnostic flow grades all 6 server-side via `/api/score` — see §10 `/api/score` — and combines the 2 per subject via `diagnosticSubjectScore`/`diagnosticSubjectRubric`, §11.)*
- **Practice →** `{ reasoningScore(0–100), rubric{conceptual_understanding, logical_structure, strategy, execution_accuracy, communication: 0–4}, correctnessNote, socraticHint, microLesson, weakConcepts[], newScoreSuggestion }`. All scores clamped, rubric normalized, `weakConcepts` coerced to a string array.
- **Concept-hub auto-grow:** after responding (`after()`, non-blocking), the server-normalized `weakConcepts` are registered as `pending` catalog stubs via `register_concepts` (no added grading latency; no-op without the service-role key).

### `POST /api/learn`
- `{ subject, concept }` (a `score` field is accepted but **ignored** — guides are level-neutral and standardized).
- **Read-through shared cache:** normalizes the concept to a key (`conceptKey`); on a hit returns the stored guide (`cached:true`) **without calling Groq**; on a miss generates via Groq, normalizes, and — **only if `isConceptSafe(concept)`** — writes via **`promote_or_insert_guide`** (`cached:false`), which always stores the guide **`hidden`** (curation-only; never auto-public) and never overwrites a `ready` guide. An **unsafe** concept is still generated and returned to the opener but is **never persisted** (so it can't be served to anyone else). The LLM also classifies the concept into a curated **`topic`** slug (validated against `lib/taxonomy.js`; unknown → `general_<subject>`). Cache only active when `SUPABASE_SERVICE_ROLE_KEY` is set — **the platform's biggest token saver: each safe guide is generated once and reused, forever.**
- **Stale-guide auto-heal (PR 5):** guides now include a **`whyItWorks`** proof/derivation (`LEARN_SYS` teaches the *mechanism*, not just a restatement — the no-answer rule is scoped to the learner's `tryThisQuestion`, never the general concept's proof). On a cache hit, a **non-curated** `ready` guide whose content lacks `whyItWorks` (i.e. predates PR 5) is regenerated and overwritten in place via **`refresh_guide`** — at most once each, then it's healed. **Curated** guides are author-vetted and served as-is (refreshed only by `scripts/seed-concept-hub.mjs`).
- **Response:** `{ subject, concept, topic, overview, keyIdeas[], whyItWorks, socraticQuestions[], pitfalls[], tryThis, tryThisQuestion, cached }`. `whyItWorks` is the proof/derivation/mechanism (rendered as the Learn tab's "Why it works" section). `tryThisQuestion` is a practice-ready `{ question, targetConcept, difficulty }` (or `null`) — a concrete "try this" problem **cached with the guide**, so the Learn tab can start a practice attempt from it with **no `/api/generate` call**.

### `POST /api/score` — server-authoritative scoring (the trust boundary)
The write path for **signed-in** users. Same same-origin + JSON guard + per-IP rate limiting as the public routes. The browser attaches its Supabase session token (`Authorization: Bearer <jwt>`); `lib/adminAuth.js#requireUser` verifies it server-side (`supabase.auth.getUser(token)`). Persistence is via the `service_role`-only `save_progress_for` RPC bound to the **verified `auth.uid()`** — the client supplies reasoning, never a score.
- **`{ kind: "practice", subject, question, targetConcept, difficulty, topicSlug, reasoning, [image] }`** — **auth REQUIRED** (`401` without a valid token; `503` if the service-role key is unset). Reads the user's **stored** subject rating, **prior attempt count** (sets the Elo K), and the **calibrated item difficulty** for the `(subject, topicSlug, band)` bucket — all server-side; the client supplies none of the values the new rating is computed from. Applies the **pre-grade dock**, **reconciles** the grader score against its rubric, then computes the new rating via the **item-as-opponent Elo** (`eloUpdate`, §11 — *non-additive*: a poor answer on an at-level item **loses** rating). Persists score + attempt + rubric atomically (with a one-line **`rationale`** — "why your rank moved" — and the **answer-review detail** via `save_progress_for`'s `p_review`) and calibrates the item-difficulty bucket (`bump_item_difficulty`, non-blocking). Returns `{ reasoningScore, rubric, strengths[], improvements[], workedSolution, correctnessNote, socraticHint, microLesson, weakConcepts, newScore, delta, rationale, docked, subjectScore, attempt }` (PR 6). `strengths`/`improvements` are the post-grade "what you did well / to reach 100" feedback; **`workedSolution` is the full solution, revealed only on a SUBSTANTIVE attempt** (empty on a dock — so "idk" can't extract the answer). A client-supplied `score`/`newScore` is **ignored**.
- **`{ kind: "diagnostic", answers: [{subject, question, difficulty, reasoning, [image]}] (≤9) }`** — **auth OPTIONAL** (an invalid token is still rejected; it is not silently downgraded to guest). Grades the answers **server-side with bounded concurrency (3) + retry-once-on-429 + `allSettled`** (the fix for the old 9-call burst), dedupes by `subject:difficulty`, aggregates each subject's difficulty-weighted baseline (`diagnosticSubjectScore` + `diagnosticSubjectRubric`). A **verified** user → persists the baseline + returns `{ scores, persisted:true, attempt }`; a **guest** → `{ scores, persisted:false, attempt:null }` for the client to store in `localStorage`. If every grade fails → retryable `503` (no all-zero baseline persisted). A stricter per-IP `:diag` budget (4/min) + the `:img` budget guard the Groq fan-out.

### `POST /api/leaderboard` — anonymous rank tiers
The Profile leaderboard. **Auth REQUIRED** (it's a signed-in surface; same same-origin + JSON guard + rate limiting). Verifies the caller's JWT (`requireUser`), then calls the **`service_role`-only** `leaderboard_tiers(p_uid)` RPC with the **verified uid** and returns `{ tiers }`. `tiers` is **anonymous by construction** — per subject + `overall`, the count of ranked learners in each of the 5 rank bands (`counts[5]`, `total`) plus the **caller's own** `{ band, score, above }` (how many rank strictly above them, for a "top X%" readout). **No display names, no email, no per-attempt rows, no other user's identity in any form** (the owner-chosen privacy model). Because the RPC is service-role-only it adds **no** `authenticated_security_definer` advisor and a client can't call the cross-user aggregate directly. The per-band counts are exactly what a later **percentile-recut** tiering would consume (architected for it; §17). `503` if the service-role key is unset.

### Admin API (`/api/admin/*`)
Like `/api/score`, these require a verified token, but additionally an **admin**. The browser attaches its Supabase session token (`Authorization: Bearer <jwt>`); `lib/adminAuth.js#requireAdmin` **verifies the JWT server-side** (`supabase.auth.getUser(token)`) and checks the verified user against a **deny-by-default** allowlist (`ADMIN_EMAILS` / `ADMIN_USER_IDS`). Re-verified on **every** call — the client is never trusted. Same same-origin + JSON guard + rate limiting. Privileged writes use the service-role client (`lib/supabaseAdmin.js`).
- **`POST /api/admin/me`** → `{ isAdmin, email }`. A UI hint only (reveals the Admin tab); always `200`.
- **`POST /api/admin/data`** → `{ counts, pendingGuides[], events[], reports[] }` — the curation queue (guides not yet `public`+`ready`, with a content preview), open `security_events`, open `concept_reports`. `401`/`403` if not an admin.
- **`POST /api/admin/action`** → `{ target, action, ... }`: `guide` **approve** (the only sanctioned path to publish: `visibility=public, status=ready, source=curated`, and only for a `ready` guide — a `content`-less stub yields `409`) / **hide** / **delete**; `event`/`report` → **reviewed**/**dismissed**. Subject allow-listed via `ORDER.includes`.

**Abuse monitoring (on the public + score routes):** `lib/abuseDetection.js#reportInjection` runs a high-precision prompt-injection heuristic over the user-supplied text in `/api/generate`, `/api/grade`, `/api/learn`, `/api/score` and, when flagged, logs a throttled `security_events` row **after the response** (`after()`, non-blocking — it flags for admin review, never blocks the learner). A `429` logs a throttled `rate_limit` event. Logging is a no-op without the service-role key.

### The Groq client (`lib/groq.js`)
- Models: **generation + Learn** use `llama-3.3-70b-versatile` (`GROQ_MODEL`); **grading** uses the cheaper `openai/gpt-oss-120b` (`GROQ_GRADE_MODEL`, via `groqJSON({grade:true})`, with `reasoning_effort` pinned low); **vision** (photo grading) uses `meta-llama/llama-4-scout-17b-16e-instruct` regardless. Every call logs `[groq] <model> in=… out=…` token usage to the server log for cost monitoring. All overridable via env.
- All system prompts live here: `DIAG_GEN_SYS`, `DIAG_GRADE_SYS`, `PRACTICE_GEN_SYS`, `PRACTICE_GRADE_SYS`, `LEARN_SYS`. Every grading/teaching prompt forbids revealing answers.
- `groqJSON({system, user, image})` — calls Groq (JSON mode, with a robust fallback that strips ``` fences and does a **balanced-brace, string-aware** extraction), and on an attached image uses the vision model with graceful text-only fallback.

---

## 11. Scoring model (`lib/scoring.js`)

- `clampScore(v)` — coerce to int `[0,100]`, or **`null`** for no-signal (null/`""`/NaN). Critical: prevents `Number(null)===0` from silently zeroing scores.
- `band(s)` — score → band name (robust to non-numbers).
- **`eloUpdate({ rating, difficulty, outcome, attemptCount })`** — the live rating engine: **item-as-opponent Elo with self-calibrating difficulty**. The *question* is the rated opponent; both ratings sit on the 0–100 scale. `expected = 1/(1+10^((difficulty−rating)/ELO_SCALE))`, `outcome = reconciledReasoning/100 ∈ [0,1]`, `rating += K·(outcome−expected)`, and `difficulty −= k·(outcome−expected)` (smaller `k`, returned as `diffDelta`). `K` (via `eloK(attemptCount)`) shrinks from provisional (≈24) toward stable (≈10) as the learner accrues attempts. **Non-additive by construction:** a low outcome on an at-level item *loses* rating — the property `blend()` couldn't give. Returns `{ newRating, newDifficulty, diffDelta, expected, k }`, all clamped/finite. `/api/score` reads the bucket difficulty from `item_difficulty`, applies this, persists `newRating`, and nudges the bucket via `bump_item_difficulty` (so difficulty **auto-calibrates from the user population**). Guests run the same engine with the static band anchor as the difficulty (no off-device calibration).
- `defaultDifficultyForBand(band)` — seeds an un-calibrated bucket from the band midpoint anchor (`beginner 10 … phd 90`, prototype-pollution-safe lookup).
- `rankFor(score, opts?)` — the **5 ranks**. Today returns the fixed `band()` name + index (0–4); `opts.cutoffs` (4 ascending score cutoffs) is the **architected hook** for the later percentile recut (§17). `RANKS` is the ordered name list.
- `reconcileReasoningScore(reasoningScore, rubric, tol=25)` — **consistency / anti-gaming**: clamps the headline score to within `tol` of the rubric-implied score (`rubricImpliedScore` = rubric mean / 4 × 100), so an all-zero rubric can't ship an 85 (nor all-4s a 10). A null/garbage score falls back to the rubric-implied value. Applied server-side after grading in both `/api/grade` and `/api/score`.
- `explainRankMove({ delta, reasoningScore, expected, difficultyBand, docked })` — the deterministic one-line **"why your rank moved"** rationale (persisted on `attempts.rationale`, shown in the feedback panel + Progress).
- `blend(prev, suggestion, opts?)` — the **legacy** damped update (difficulty/confidence-weighted, with an Elo surprise term). **Superseded by `eloUpdate` on every live path** (signed-in *and* guest) but kept for backward-compat + its regression tests; called with two args it still reproduces the exact `round(prev*0.65 + sug*0.35)`.
- `totalPoints(scores)` — sum of the three subject scores (0–300).
- `phdIndex(scores)` — mean of the three (0–100); the headline "PhD-level intelligence" number.
- `diagnosticSubjectScore(perQuestion)` — combines a subject's **two** diagnostic answers (easy + hard) into a 0–100 **baseline**, weighting each question's reasoning score by its difficulty anchor (foundational 30 / advanced 70 ≈ 3:7) — **points proportional to difficulty**. Acing both → ~100; acing only easy → ~30. Called by `/api/score` (no `blend()` — this is the baseline, not an update). The function is tier-count-agnostic; it just receives 2 now. Exported alongside `DIAGNOSTIC_DIFFICULTIES` (`["foundational","advanced"]`) and `DIFFICULTY_LABELS` (Easy/Intermediate/Hard).
- **Rubric helpers (powering the radar + "what to work on").** `RUBRIC_KEYS`/`RUBRIC_MAX` (the 5 dimensions in display order, scored 0–4). `normalizeRubric(r)` — coerce a model/stored rubric to a complete **integer** 0–4 object (per-attempt bars). `diagnosticSubjectRubric(perQuestion)` — difficulty-weighted per-subject rubric (the rubric analogue of `diagnosticSubjectScore`), kept as **floats** for resolution, `null` when empty. `blendRubric(prev, next, alpha=0.35)` — EWMA update of a subject's stored rubric toward an attempt's rubric (mirrors `blend`'s damping). `lowestRubricDimensions(r, n)` — the weakest dimension keys, for the "what to work on" guidance. All pure, so `/api/score` computes them exactly as the client would.

---

## 12. Frontend (the state machine)

The entire app is one big client component, **`components/Noobtopro.jsx`**, driven by two independent state variables:

- **`stage`**: `intro | signin | diagnostic | scoring | dashboard | practice` — *where you are in the core flow.*
- **`view`**: `practice | learn | progress | profile` — *which tab is selected.*

The render switch resolves in this order: `stage === "signin"` (sign-in menu, full-screen) → `view === "profile"` (ProfileTab) → `view === "learn"` (LearnTab) → `view === "progress"` (ProgressDashboard) → else the **Practice flow** (the `stage` machine: intro → diagnostic → scoring loader → dashboard "Where you stand" → practice Q&A + feedback).

Key flows / handlers:
- `beginDiagnostic()` → `/api/generate` (diagnostic) → **6 questions (2 per subject, easy + hard)** answered one at a time (ordered subject-major, easy→hard; answers keyed by `subject:difficulty`; a grouped progress bar of 3×2 pips + a difficulty label per question) → `submitDiagnostic()` sends all 6 answers to **`/api/score`** (one batched request — the server grades + aggregates) → dashboard. **Signed-in** → the server also persists the baseline (`authApi` attaches the JWT); **guest** → the returned scores are saved to `localStorage` and finishing pops the **"save your progress" modal** (dimmed `inert` background, scroll-lock, focus trap, Escape/backdrop close).
- `startPractice(subject)` / `submitPractice()` — **signed-in** → `/api/generate` + **`/api/score`** (server grades, computes the trusted score from the stored level, persists; the client renders the response and never blends/saves locally); **guest** → `/api/generate` + `/api/grade`, then `eloUpdate`/`blendRubric` locally + `saveProgress` to `localStorage`. Either way the feedback panel renders the rubric + **"what you did well" + "to reach 100"** + a collapsible **worked solution** (revealed post-grade on a substantive attempt; PR 6) + the Socratic hint/micro-lesson. `adminApi` was renamed `authApi` (token-attaching POST used by `/api/admin/*`, `/api/score`, `/api/leaderboard`).
- **Review view** (PR 6): the **Progress** tab's "Review your answers" section lazily loads past graded answers (`lib/store.js#loadReviews` — signed-in: own `attempt_reviews` via RLS; guest: from local history) and expands each to the question, the learner's answer, the rubric, the strengths/improvements, and the full worked solution, with "Learn this concept" / "Practice again" actions.
- `openLearn(subject, concept)` → switches to the Learn tab and fetches `/api/learn` (guarded by a monotonic `learnRun` token so rapid clicks can't show a stale guide). **Memoized per session** in `learnCacheRef` (`"subject::concept"` → guide), so revisiting a concept renders instantly with **no server round-trip**. Each guide carries a cached **"try this" question**: `startPracticeWithQuestion(subject, q)` enters practice using it directly (no generation), and `regenerateLearnQuestion()` fetches a fresh, level-calibrated one on demand (session-only — the shared cached guide is untouched).
- The dashboard's **"Work on" weak-concept tags are buttons** → they call `openLearn`.
- `hydrate()` (run-token guarded) loads state on mount + on `SIGNED_IN`/`SIGNED_OUT`; image previews use `URL.createObjectURL` and are revoked to avoid leaks.

Components: **SignIn** (provider buttons), **ProfileTab** (identity + stats + confirm-guarded reset), **LearnTab** (concept picker + guide sections), **ProgressDashboard** (dependency-free inline SVG charts).

---

## 13. Testing

**Vitest**, configured in `vitest.config.js` (node env by default; component tests opt into `jsdom` via a `// @vitest-environment jsdom` docblock; automatic JSX runtime; `@/` alias). Run with `npm test` (CI uses this) or `npm run test:watch`. **438 tests across 32 files**, all passing.

| File | Covers |
|---|---|
| `test/scoring.test.js` | clampScore/band/blend (legacy + weighted Elo path)/totalPoints/phdIndex incl. regressions **+ non-integer-score coercion** + **`diagnosticSubjectScore` difficulty-weighted baseline** (anchor 3:5:7, clamping, unknown-band fallback) + **rubric helpers** (`normalizeRubric` int 0–4, `diagnosticSubjectRubric` float difficulty-weight, `blendRubric` EWMA, `lowestRubricDimensions` ties) |
| `test/scoring-elo.test.js` | the **item-as-opponent Elo**: `eloExpected`/`eloK` (provisional→stable), `eloUpdate` (**non-additive** loss on a poor at-level outcome, bigger gain for an upset, settled<provisional, difficulty self-calibration, clamps), `defaultDifficultyForBand`, `rankFor` (fixed bands + percentile-cutoff hook), `reconcileReasoningScore`/`rubricImpliedScore`, `explainRankMove`, **+ a deterministic gold-set dock→reconcile→Elo pipeline** |
| `test/preGrade.test.js` | the **docking gate**: empty/whitespace, no-answer phrases (case/apostrophe-tolerant), too-short-off-topic, gibberish → dock; substantive/short-with-math reasoning passes through; complete all-zero verdict shape; determinism |
| `test/api-leaderboard.test.js` | **`/api/leaderboard`**: request-guard 403/415, auth-required 401, 503 w/o service-role, calls `leaderboard_tiers` with the **verified uid**, anonymity smoke-check (no identity in payload), generic 500 on RPC failure |
| `test/api-score.test.js` | **`/api/score`**: request guard 403/415; practice auth-required (401), 503 w/o service-role, **server-authoritative score** (computed from stored level), **client-supplied score IGNORED**, generic 500 on persist fail, retry-once-on-429; diagnostic guest grade-only vs signed-in persist, **invalid-token rejected (not downgraded)**, subject:difficulty dedupe, >9 rejected, allSettled resilience, all-fail → 503, **`:img` budget charged for vision grades** |
| `test/noobtopro-score.test.jsx` | signed-in practice routes to `/api/score` **with the Bearer token**, renders the server's trusted result, and **never calls `/api/grade` or `saveProgress`** |
| `test/groq.test.js` | JSON extraction (fences, prose, braces-in-strings), fallback retry **gating (no retry on hard HTTP errors)**, per-call `max_tokens`, **grade-model routing (gpt-oss + `reasoning_effort` low)**, errors |
| `test/rateLimit.test.js` | window limit, reset, per-key, memory bound (enforceCap) |
| `test/api-generate.test.js` | validation/400s, prototype-key rejection, non-leaking 500, weakConcepts cap, **diagnostic pool (warm-serve / cold self-fill via RPC / invalid-row + invalid-generated guards / read-error fall-through)** |
| `test/api-grade.test.js` | validation, MIME/base64, score/rubric normalization, difficulty-band threading, **valid-image → vision-model forwarding**, **request-guard 403/415**, non-leaking 500 |
| `test/api-learn.test.js` | validation, normalization, **cache hit/miss via `promote_or_insert_guide` / key-normalization (real `conceptKey`) / LLM-topic validation**, **request-guard 403/415**, tryThisQuestion shaping |
| `test/taxonomy.test.js` | the 36-topic Subject→Topic tree: 12/subject incl. `general_*`, `isValidTopic`/`normalizeTopic` (case-tolerant, prototype-safe, cross-subject reject), labels/slugs |
| `test/seed-concepts.test.js` | the **public seed** coverage: `SEED_CONCEPTS` covers every taxonomy topic exactly once (36), each slug valid for its subject, concepts non-empty + ≤200 chars, `allSeedConcepts` flattens to 36 rows |
| `test/contentSafety.test.js` | `isConceptSafe` accepts STEM labels (incl. accented/Greek); rejects links/emails/markup/blocklist/over-long/symbol-dominated **+ expanded TLDs + zero-width-split evasion** |
| `test/conceptKey.test.js` | `conceptKey` JS↔SQL parity golden vectors: control/zero-width/BOM strip, surrounding-quote strip, **code-point-safe 200-char truncation** (surrogate-safe) |
| `test/schema-invariants.test.js` | static guard on `db/schema.sql`: **curation-only invariant** (`promote_or_insert_guide` always `hidden`, never `public`; grader stubs `pending`; read policy = `public`+`ready`) + **`_concept_key` control/zero-width/BOM strip + `left(…,200)`** parity markers |
| `test/adminAuth.test.js` | `requireAdmin`/`isAdminUser`: **deny-by-default** (empty allowlist matches no one), no-token → 401, invalid token → 401, non-admin → 403, admin-by-email (case/space-tolerant) and admin-by-id → ok, missing-email rejected |
| `test/abuseDetection.test.js` | `scanForInjection` flags injection markers (override/system-prompt/role/jailbreak/medium) + passes normal STEM; `logSecurityEvent` field caps + **per-(kind:ip) throttle** + no-key no-op; `reportInjection` flag-and-log |
| `test/api-admin.test.js` | `/api/admin/{me,data,action}`: auth gating (401/403), request-guard 403/415, guide **approve→public / hide / delete** (+ prototype-key subject rejection, 409 on stub approve), event/report reviewed-or-dismissed |
| `test/admin-dashboard.test.jsx` | AdminDashboard renders the 3 sections, **Approve disabled for a pending stub**, action buttons hit `/api/admin/action` + refetch, empty states, error/retry |
| `test/store.test.js` | migration clamping + **single-flight dedup + >5000-attempt cap**, delete RPC, signed-in load/save paths + **user_id scoping** + data-wipe guard, **atomic `saveProgress`** incl. **guest quota-failure surfacing**, **guest-blob sanitization on read + weak_concepts ≤64 cap** (mocked Supabase) |
| `test/noobtopro.test.jsx` | the state machine: **diagnostic image-preview revoke on completion** + **`submitPractice` run-token guard** (stale grade after Restart doesn't persist or repopulate) |
| `test/noobtopro-reset.test.jsx` | the **"Restart" logo**: a signed-in user keeps persisted progress (re-hydrates, never blanks) while a guest's local session clears to the intro; **sign-out synchronously clears in-memory scores** (shared-device safety) |
| `test/progress.test.jsx` | ProgressDashboard stat summary + **SVG chart accessible names** + empty states |
| `test/headers.test.js` | `next.config.js` security headers: **baseline CSP directives + allow-listed origins**, `X-Frame-Options: DENY` (matches `frame-ancestors`), nosniff/HSTS |
| `test/error.test.jsx` | error-boundary logs the caught error + `reset()` on "Try again" |
| `test/signin.test.jsx` | provider buttons, OAuth-only (no password field), enabled-provider, **env-flag (`NEXT_PUBLIC_ENABLE_*`) gating** |
| `test/profile.test.jsx` | identity, empty state, stats, confirm-guarded reset |
| `test/learn.test.jsx` | empty state, concept select, loading/error **live regions**, guidance render, **try-this question: practice-reuse / regenerate / fallback** (flag-off weak-concept picker) |
| `test/learn-hub.test.jsx` | Concept Hub mode (flag on): topic-grouped catalog render, concept→`onSelect`, weak-concept shortcuts, **admin-only `*` overlay for unapproved**, report flow, debounced search |
| `test/catalog.test.js` | `lib/catalog`: `loadTopics`/`browsePublicConcepts` (subject filter, **ILIKE wildcard escaping**, errors), `reportConcept` (guest rejected, **key normalization**, subject validation, reason cap) |

**Mocking patterns:** Groq calls are mocked by stubbing global `fetch`; Supabase is mocked via `vi.mock("@/lib/...")` with `vi.hoisted`; components use `@testing-library/react`. No network or real keys are needed.

---

## 14. Build, CI & deploy

- **Stack:** Next 15 App Router, React 19, Node 24 (`.nvmrc`; Vercel uses 24.x).
- **`vercel.json`** pins `{ "framework": "nextjs" }` — **do not remove** (see §16).
- **`next.config.js`** sets `reactStrictMode` + security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS, `Permissions-Policy`, and a **baseline `Content-Security-Policy`**). The CSP locks down `object-src`/`base-uri`/`form-action`/`frame-ancestors`, adds `upgrade-insecure-requests`, and uses tight `default-/connect-/img-/font-/style-src` lists: Google Fonts; Supabase (pinned to this project's host at the production build, wildcard fallback when the env is unset); Vercel insights; `blob:`/`data:` image previews; and the OAuth providers' avatar CDNs for `img-src` (no bare `https:` wildcard). `script-src`/`style-src` still keep `'unsafe-inline'` because Next injects inline runtime scripts and the app uses inline style objects — a **nonce-based strict `script-src` via middleware is the documented next step** (§17).
- **CI** (`.github/workflows/ci.yml`): on every PR + push to `main`, the **"Test and build"** job runs `npm ci` → `npm test` → `npm run build` (build runs with empty secrets to prove guest mode works). Hardened with least-privilege `permissions: contents: read`, `concurrency` (cancel-in-progress on superseded pushes), and a `timeout-minutes`. **`main` is branch-protected to require this check.**
- **Deploy:** Vercel auto-deploys `main` to production and every branch/PR to a preview URL. **Env-var changes require a new deployment to take effect.**

---

## 15. How we work (the dev loop)

This project is built collaboratively with **Claude Code**, and the loop is worth following:

1. **Branch** off `main` (`feat/...`, `fix/...`). Never commit straight to `main` (it's protected).
2. **Implement + test locally** (`npm test`, `npm run build` both green).
3. **Open a PR.** CI runs the required **"Test and build"** check.
4. **Greptile** auto-reviews the PR (the `greptile-apps[bot]`). We **address every comment**, push the fix, then **reply on each thread and resolve it**. (For substantive features we *also* run an internal adversarial multi-agent review before opening the PR and fold its findings in.)
5. **Squash-merge** once CI is green and threads are resolved.
6. **Vercel auto-deploys**; we **verify on the live URL** (and re-check the Supabase advisors for DB changes).
7. Commit/PR trailers as in §6.

History of what's shipped is in `git log`: flatten-for-Vercel, audit hardening (multiple full-repo audits), rate limiting, the OAuth sign-in menu + Profile + guest→account migration, the save-progress modal, GitHub/Discord toggles, the Learn tab + `/api/learn`, the shared concept-guide cache, the cheaper grader (`gpt-oss-120b`) + shared diagnostic pool, server-authoritative scoring + reasoning radar (#34/#35), the 6-question diagnostic (#37), the durable per-account rate limiter (#38), **item-as-opponent Elo + anti-gaming grading + anonymous leaderboard (PR 3, #40)**, **Concept Hub public seed + de-dup (PR 4, #44)**, **proof/derivation Learn guides + stale-guide auto-heal (PR 5, #45)**, **detailed feedback + worked-solution reveal + answer review (PR 6, #43)**, and **Concept Hub UI fixes (#46)**. PRs #40/#43/#44/#45 each carried a numbered DB migration (`0004`–`0007`) applied to the live project + an adversarial pre-merge review (Greptile being exhausted).

---

## 16. Troubleshooting & gotchas

**Hard-won lessons — read these before debugging deploys/env:**

- **Vercel env vars must be at the PROJECT level, not Team/"Shared".** Team-level "Shared" vars don't reach the project build unless linked; symptom: the app behaves as if the vars are unset. Add them under the `noobtopro` *project's* Settings → Environment Variables.
- **NEXT_PUBLIC_* vars are baked in at BUILD time.** After changing one, you must **redeploy** — saving alone does nothing. Verify by grepping the deployed JS bundle for the value.
- **`vercel.json` framework pin is load-bearing.** Without `{ "framework": "nextjs" }` Vercel may treat the app as "Other" and fail with *"No Output Directory named 'public'"*. Keep it.
- **App must be at the repo root** (it is). If a Vercel project was ever configured with Root Directory = `noobtopro`, clear it.
- **Supabase free tier pauses when idle (~7 days)** → reads start failing; any dashboard activity wakes it. `loadState()` surfaces such errors instead of wiping the user to "new user".
- **Groq free tier ≈ 30 req/min / ~6K tokens/min** → rapid testing can `429`; back off a few seconds.
- **A GitHub/Discord button that errors on click** = the `NEXT_PUBLIC_ENABLE_*` flag was set before the provider was configured in Supabase. Do the Supabase step first.
- **Concept cache returns `cached:false` always** = `SUPABASE_SERVICE_ROLE_KEY` isn't set in Vercel.
- **`npm audit`** reports **7 vulnerabilities (6 moderate + 1 "critical")**, all **dev-only or transitive**: the "critical" is the Vitest **UI-server** advisory (arbitrary file read/exec *only when the Vitest UI server is listening* — we never launch it; CI uses `vitest run`), plus the esbuild/vite dev-server advisories and a transitive postcss-via-Next moderate. Every available "fix" is a breaking major (Next → v9, Vitest → v4), so we **accept** these rather than break the build. None affect the production bundle.

---

## 17. Roadmap & known limitations

**Activation (config only, no code):**
- Set `SUPABASE_SERVICE_ROLE_KEY` → turns on the shared concept-guide cache.
- Configure + enable GitHub & Discord providers → flip `NEXT_PUBLIC_ENABLE_*`.

**Concept Hub (v1 shipped — including the PR 4 public seed + PR 5 depth):**
- ✅ **Guide depth shipped (PR 5):** `LEARN_SYS` now teaches the **proof / derivation / mechanism** (a required `whyItWorks` field, rendered as the Learn tab's "Why it works" section) — fixing the "guides just restate the definition" feedback. The no-answer rule is scoped to the learner's `tryThisQuestion` only; proving the *general* concept is required. Existing shallow cached guides **auto-heal** on next open via `refresh_guide` (non-curated, no-`whyItWorks` → regenerate + overwrite once); the 9 live curated guides were re-seeded with proofs.
- ✅ **Public seed shipped (PR 4):** `seed_curated_guide` (the sanctioned, `service_role`-only, idempotent batch public-publish path) + `scripts/seed-concept-hub.mjs` over `SEED_CONCEPTS` (one core concept per of the 36 topics). **9 curated guides are seeded on the live project** across all 3 subjects; **run `node scripts/seed-concept-hub.mjs` (with the Groq + service-role keys) to publish all 36.** `dedupe_pending_stubs` does conservative pending-stub housekeeping.
- **PR 4 security stance:** the seed is the only *batch* public-publish path and is `service_role`-only (verified against the live ACLs: EXECUTE only to `postgres`+`service_role`); `dedupe_pending_stubs` only ever deletes `status='pending'` rows; both are `SECURITY DEFINER` with `search_path` pinned; migration `0005` added **no** new advisor. The curation-only invariant holds (a signed-in user cannot self-publish). XSS-safe: seeded content is rendered React-escaped by the existing `LearnTab`, same as any guide.
- v1.1: **`pg_trgm`** fuzzy/typo-tolerant search (available, not yet installed — ships as its own `create extension` migration; v1 uses plain `ILIKE`); a curated **`tags[]`** cross-cutting facet; **fuzzy/semantic canonical-merge** to de-duplicate distinct-keyed near-identical concepts (e.g. "energy" vs "conservation of energy" — v1 relies on the curated catalog being canonical by construction + `dedupe_pending_stubs`); open the hub to undiagnosed guests. `times_opened` is stored but inert until a batched popularity counter is designed.

**Product / model:**
- ✅ **Item-as-opponent Elo shipped (PR 3).** `eloUpdate` (§11) is the live, non-additive engine; item difficulty self-calibrates per `(subject, topic, band)` bucket (`item_difficulty`). **Remaining:** the **percentile-recut rank tiers** (flip `rankFor` to consume `opts.cutoffs` once there's a user base — the engine + leaderboard counts are already architected for it); per-**item** (vs band-bucket) difficulty; and tuning the constants (`ELO_SCALE`, `ELO_K_*`, `RECONCILE_TOLERANCE`) against logged attempts + the gold set (`test/scoring-elo.test.js`).
- ✅ **Anchored rubric exemplars + temperature-0 + reconciliation shipped (PR 3).** **Remaining (optional):** sample the grade N× and take the median for the diagnostic (deferred — it triples Groq cost and would re-pressure the rate limit that drove the 6-question reduction; temp-0 single-sample is the current call).
- Adaptive diagnostic; a **concept graph** per subject so "weak on X" routes to the right next problems.
- Data export; auto-resume into the diagnostic after the OAuth redirect (currently the redirect resets state).

**Security posture (an objective 81-agent audit ran on the concept-hub branch; findings fixed):**
- **Fixed this round:** concept hub is now **curation-only public** (auto-grown guides never auto-publish — closes attacker-influenced public content), unsafe concepts are never persisted, a **same-origin + JSON guard** on all API routes (CSRF/cross-site cost abuse), tighter per-route + image rate limits, the **vision fallback no longer double-calls** the model (cost amplification), **image magic-byte validation** (forged-MIME/arbitrary-bytes), a non-string-`reasoning` 500, guest-`localStorage` cleared on sign-out, forgeable-future `created_at` clamped, and **OAuth switched to PKCE** (§9).
- **Audit-fix round (a second full pre-merge audit of PR #29 — 8 finder lenses + adversarial verification — fixes applied to this branch):** `_concept_key`↔`conceptKey` made **true byte-for-byte parity** (control/zero-width/BOM strip + code-point truncation; live-verified) so the read-through cache can't miss on exotic input and the README parity claim is now accurate; **int4-range clamp** on every attempt field in `save_progress`/`migrate_guest_data` (a corrupt guest blob can no longer abort the whole migration); **`weak_concepts` capped at 64** (server RPCs + client); **best-effort 50k cap** on pending grader stubs; **sign-out synchronously clears in-memory scores/history** (shared-device peek); **practice image preview revoked on completion** (matching the diagnostic fix); **guest `localStorage` validated/clamped on read**; `totalPoints`/`phdIndex` coerce non-integer scores; `isConceptSafe` hardened (expanded TLDs, zero-width-split evasion, Unicode-letter count). New tests pin the **curation-only invariant** and **key parity** (`test/schema-invariants.test.js`, `test/conceptKey.test.js`) and add **request-guard 403/415** coverage on all three routes. The audit confirmed **0 P0/0 P1 / no merge-blockers**; everything fixed here was P2/P3.
- **Verified clean (not just claimed):** no cross-user data read/write (RLS bound to `auth.uid()`), no SQLi, no XSS sinks (all LLM/user content is React-escaped; no `dangerouslySetInnerHTML`), no secret leakage, SECURITY DEFINER RPCs are `service_role`-only, and **no RPC path yields a `public`+`ready` guide** (curation-only holds) — all checked against the live DB.
- **Elo ranking + grading + leaderboard round (PR 3 — a multi-agent adversarial review, 8 finder lenses + per-finding adversarial verification; verified against the live DB grants/advisors):** **0 P0 / 0 P1 / 0 P2, no merge-blockers.** The new trust-boundary surface holds: `/api/score`'s rating is computed from the **server-read** prev + attempt-count + item difficulty (the client supplies none of them); the pre-grade dock + reconciliation can't be gamed to inflate a rating; `bump_item_difficulty`/`leaderboard_tiers`/`save_progress_for` are **`service_role`-only** (live ACLs show EXECUTE granted only to `postgres`+`service_role`, all `SECURITY DEFINER` with `search_path` pinned); the leaderboard aggregate exposes **no** user identity (no email/name/user_id/per-attempt rows); `topicSlug` is prototype-safe (`normalizeTopic`); the dock regexes are bounded; the persisted `rationale` is length-capped; the new routes leak no upstream error detail; and the new UI renders model/user text React-escaped (no `dangerouslySetInnerHTML`). The **only** new advisor is one **INFO** `rls_enabled_no_policy` on `item_difficulty` — the same accepted pattern as `diagnostic_pool`/`rate_limits`/`security_events`. One **P3** was raised + accepted (below).
- **Server-authoritative scoring round (a 33-agent adversarial review, 6 lenses + per-finding verification; 1 P1 + several P2/P3 fixed, the rest accepted by decision):**
  - **RESOLVED — scores were client-computed / self-assertable.** Signed-in scoring is now server-authoritative: `/api/score` grades + computes from the **stored** level + persists via the `service_role`-only `save_progress_for` for the JWT-verified uid; `scores`/`attempts` are SELECT-only RLS + write grants revoked; client-callable `save_progress` dropped. A signed-in user can no longer self-assert by any path (verified against the diff + live grants). Guests stay client-computed (no account to protect).
  - **RESOLVED — the diagnostic's 9-call burst** is now ONE server request with bounded concurrency (3) + retry-once-on-429 + `allSettled`; a single 429 no longer sinks the set.
  - **P1 fixed:** the diagnostic vision grades now charge the per-IP `:img` budget (they previously bypassed it — a ~3.6× cost-amplification on the costliest Groq path). **P2 fixed:** `gradeOne` no longer retries image grades (avoids a second vision call); guest→account migration now carries the `rubric`. **P3 fixed:** `:diag` budget checked before the auth round-trip; service-role null-checked before grading; defensive client payload guard.
- **Accepted residual risks (documented, by decision):**
  - **Same-subject practice is a read-modify-write** (`/api/score` reads prev → blends → writes); two concurrent same-user grades on one subject could lose an update. Single-user, low-stakes, guarded by the one-question-at-a-time UI + run-token; revisit if scores gate paid features. (Commented at the read in `handlePractice`.)
  - **Re-taking the diagnostic re-baselines** (overwrites accumulated scores via upsert) — the same destructive semantics as before; guarded by the UI. A "merge vs replace" prompt is the future fix.
  - **Diagnostic partial-failure re-weights** a subject from its surviving graded answers (a transient miss on the hard tier slightly inflates that subject) — preferred over discarding a subject; retry-once covers most. All-fail → retryable 503 (no all-zero baseline).
  - **SECURITY DEFINER owner not pinned** via `ALTER FUNCTION ... OWNER TO` — relies on the migration being run as the table-owning role (same assumption as the existing concept-hub DEFINER RPCs); the revoked write grants make this robust regardless.
  - **(PR 3, P3 — accepted) Unindexed `attempts` count in `/api/score` practice.** The new attempt-count read filters `(user_id, subject, type='attempt')` but the index is `(user_id, created_at, id)`, so it scans only the caller's small partition and filters `subject`/`type` in memory. Per-user attempt counts are tiny and the per-account `:practice` cap (45/min) bounds frequency, so the cost is negligible; revisit with a `(user_id, subject) where type='attempt'` partial index if attempt volumes grow. (Surfaced by the PR 3 review's cost lens; refuted as a merge-blocker.)
  - **(PR 3) One new INFO advisor — `rls_enabled_no_policy` on `item_difficulty`** — the same accepted "RLS-on, no policy = service-role only" pattern as `diagnostic_pool`/`rate_limits`/`security_events`. The table holds NO per-user data and writes are revoked from `anon`/`authenticated`; reads are RLS-denied (no policy). Intentional/accepted; no new WARN/ERROR.
  - **Two expected Supabase advisor WARNs after the migration:** `authenticated_security_definer_function_executable` on `migrate_guest_data` and `delete_user_data` — they MUST be `authenticated`-callable (the client invokes them) AND `SECURITY DEFINER` (to write under the SELECT-only RLS), but each is **self-scoped to `auth.uid()`** (advisory-locked, `search_path` pinned), so a caller can only touch their OWN rows. Intentional/accepted. `save_progress_for`/`bump_item_difficulty`/`leaderboard_tiers` are correctly **not** flagged (service-role only). (Pre-existing INFO/WARNs — `diagnostic_pool`/`security_events` RLS-no-policy, leaked-password — are unrelated and tracked below.)
  - ✅ **RESOLVED — durable, per-account rate limiter.** `lib/rateLimit.js#checkRateLimit` is now backed by a Postgres `rate_limit_hit` RPC (shared across instances, keyed by `auth.uid()` for signed-in users / IP for guests), with an in-memory fallback when the service-role key is unset. `/api/score` adds per-account `:practice` (45/min) and `:diag` (6/min) caps so a single account can't burn the Groq budget by rotating IPs.
  - **`delete_user_data`** clears the user's scores/attempts but does **not** delete the `auth.users` account (needs an admin-API flow).
  - **Disable the Supabase email/password provider** (the app is OAuth-only) to clear the leaked-password advisor and close an unused signup surface; if kept, enable HIBP leaked-password protection.
  - **Quarantine/report flow** for a poisoned *hidden* guide served on direct open (shared-cache trade-off) — future, alongside the curation UI.
  - **Shared-device guest migration:** a guest's `localStorage` progress auto-migrates into the **first different account** that signs in on the same browser — but only into an *empty* account (the scores-exists guard blocks any populated account; no PII; RLS intact, write is correctly scoped to that account). Bounded and by-design for the guest→account flow; a future "merge your guest progress?" consent prompt (instead of silent auto-migrate) would close it.
- **Server-side auth enforcement.** The *public* routes (`/api/generate|grade|learn`) are same-origin-gated + rate-limited + RLS-scoped, but not per-user authenticated. **`/api/score` (signed-in writes) and `/api/admin/*` ARE per-user authenticated** — both verify the caller's Supabase JWT server-side (`lib/adminAuth.js#requireUser`; admin layers an allowlist on top via `requireAdmin`), re-checked on every call, never trusting the client. `/api/score` is the scoring trust boundary; the admin routes verify a deny-by-default `ADMIN_EMAILS`/`ADMIN_USER_IDS` allowlist, and the admin **approve** action is the only sanctioned path that publishes a guide (human-in-the-loop curation — no *automated* path makes content public). Prompt-injection/abuse signals are logged (non-blocking, field-capped) to `security_events` for review; the per-IP log throttle is best-effort. A focused adversarial security review of this surface found **no P0/P1/P2** (verified against the live DB: JWT-only identity, deny-by-default allowlist, RLS default-deny on both new tables, publish guardrails, no XSS, intact client/server boundary). Given it can publish content, re-review it at each change.
- **Atomicity:** the score + attempt write is one transaction via the `save_progress_for` RPC (signed-in) / one `localStorage` write (guest) — fixed. Diagnostic grading is **no longer all-or-nothing** — `/api/score` uses `allSettled` so one failed grade doesn't discard the others (all-fail → retryable 503).
- **Nonce-based strict CSP** — a baseline CSP now ships (§14); the next step is a middleware-generated nonce so `script-src`/`style-src` can drop `'unsafe-inline'`.
- **ESLint / CI lint enforcement** — not configured yet; the deprecated, unconfigured `next lint` script was removed (it only dropped into an interactive setup wizard). Wire up flat-config ESLint + `eslint-config-next` and run it in CI before any Next 16 upgrade.
- *(Done previously: guest-`localStorage`-full now surfaces an error instead of silently dropping the write; the 3 SECURITY INVOKER RPCs `REVOKE` PUBLIC/anon; the `submitPractice` stale-write guard; the diagnostic image-preview leak. The audit-fix round above closed the matching **practice** image-preview leak.)*

---

## 18. Further reading

- **`db/schema.sql`** — canonical database (tables, RLS, RPCs). Run this to provision.
- **`DEPLOYMENT_PLAN.md`** — full Vercel / Supabase / Google OAuth setup playbook (phased).
- **`AUTH_PROVIDERS.md`** — exact GitHub & Discord enablement steps.
- **`FEATURE_PLAN.md`** — the sign-in-menu / Profile / Learn feature plan + the decisions behind the guest-first flow.
- **`.env.example`** — documented env vars.
- **`git log`** (PRs #2–#29) — the full build history and rationale.
