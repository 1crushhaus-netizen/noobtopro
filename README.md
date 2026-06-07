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
> New here? Jump to [**Where to start (next task: durable rate limiter + grading consistency)**](#where-to-start-next-task-durable-rate-limiter--grading-consistency).

**Prove what you know. Climb from noob to pro.**

---

## Table of contents

- ⭐ [**Where to start (next task: durable rate limiter + grading consistency)**](#where-to-start-next-task-durable-rate-limiter--grading-consistency)
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

1. **Prove it** — for each subject, three open problems at escalating difficulty (easy → intermediate → hard; 9 total). You solve them and explain every step. The per-subject baseline weights the harder questions more (points proportional to difficulty), so one pass calibrates where you stand.
2. **Get ranked** — your *reasoning* is graded on a 5-part rubric and mapped to a **0–100 rank per subject**.
3. **Climb** — pick a subject, get problems calibrated to your level, and improve. Sound reasoning moves your score even when the final answer is wrong.

**The unbreakable product rule: never hand over the answer.** When you're stuck, the app responds with a **Socratic hint** (one nudging question), a **micro-lesson** (the underlying *concept*, taught in general terms, never the solution to your specific problem), and a **correctness note** (whether your conclusion holds, without revealing the answer). The **Learn** tab extends this: click a weak concept and get a Socratic concept guide that teaches the idea and method — never a worked answer.

**The vision / where this is going.** A trustworthy, standardized "where do I actually stand, and how do I get better" engine for STEM reasoning — eventually monetized. Several current pieces are explicitly *stop-gaps until monetization* (e.g. the in-memory rate limiter) or *first steps toward a fuller model* (the score-blend is now a difficulty/confidence-weighted Elo-style update; the next step is per-item IRT/Elo ratings rather than fixed difficulty-band midpoints). "Standardization across users" is an active goal — e.g. concept guides are generated once and **shared across all accounts**.

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
- ✅ **3-tier diagnostic** (easy/intermediate/hard per subject, difficulty-weighted baseline) → per-subject scoring → calibrated practice loop (Groq-backed).
- ✅ **Server-authoritative scoring (signed-in users).** Practice + diagnostic for a signed-in user are graded, scored, and persisted **on the server** (`/api/score`, JWT-verified); the client can no longer self-assert a score — `scores`/`attempts` are **SELECT-only under RLS** and all writes go through a service-role-only RPC. Guests stay client-computed in `localStorage`. (§10, §11)
- ✅ **Per-subject reasoning rubric + radar chart.** Every subject gets a 5-dimension rubric profile (Conceptual grasp · Logical structure · Strategy · Execution · Communication), persisted in `scores.rubric` and shown as a hand-rolled inline-SVG **spider chart** in the Progress tab, with "what to work on" links into the Learn tab.
- ✅ **Diagnostic grading is one batched, bounded request** (server-side concurrency cap + retry-once-on-429 + `allSettled`) — the old 9-parallel-call burst that a single 429 could sink is gone.
- ✅ Photo-of-work grading (vision model, graceful text fallback).
- ✅ **Google sign-in** (configured + working), durable per-user storage with RLS.
- ✅ **Guest mode** (no login): full flow stored in `localStorage`. On first sign-in, guest progress **migrates** into the account.
- ✅ **Profile** tab (identity + stats + reset), **Progress** tab (charts), **Practice** + **Learn** tabs.
- ✅ "Save your progress" modal after the guest diagnostic.
- ✅ Per-IP rate limiting; security headers incl. a **baseline CSP**; error boundary; service-role RPCs locked to `authenticated` (PUBLIC/anon revoked).
- ✅ **Shared caches active** (`SUPABASE_SERVICE_ROLE_KEY` set): the concept-guide cache (each guide generated once, with a bundled "try this" question) and the baseline-diagnostic pool — both reused across users to cut Groq spend. Grading runs on the cheaper `openai/gpt-oss-120b` (`GROQ_GRADE_MODEL`).

**In progress:**
- 🛠️ **Concept Hub** — the universal, categorized, auto-growing concept directory (see "Where to start"). **Backend shipped** (taxonomy + public read-only catalog + grader auto-grow + **curation-only** promotion). **Admin curation is live** (PR #30: approve→public / hide / delete + abuse warnings). The **browse UI + user report button are built** (behind `NEXT_PUBLIC_ENABLE_CONCEPT_HUB`): the Learn tab becomes the searchable curated catalog; unapproved guides are admin-only (marked `*`). Remaining v1.1: open the hub to undiagnosed guests, `pg_trgm` fuzzy search, `tags[]`, canonical-merge de-dup (see §17).

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

## Where to start (next task: durable rate limiter + grading consistency)

> **Shipped & live (all merged):** the **Concept Hub** — backend (PR #29) + admin dashboard / curation + abuse monitoring (PR #30) + browse UI & report button (PR #31, behind `NEXT_PUBLIC_ENABLE_CONCEPT_HUB`, which is ON) — and the **3-tier "Prove it" diagnostic** (PR #32). Each round was gated by an adversarial pre-merge review (see the dev-loop note at the end).
>
> **Just shipped on this branch — SERVER-AUTHORITATIVE SCORING + reasoning radar** (the previous "next task"; gated by a 33-agent adversarial security review, all confirmed findings fixed):
> - **Scoring is server-authoritative for signed-in users.** New `app/api/score/route.js` (JWT-verified via `lib/adminAuth.js#requireUser`) grades, computes the new score from the user's **stored** level, and persists it for the verified `auth.uid()` via the **service-role-only** `save_progress_for` RPC. `scores`/`attempts` are now **SELECT-only under RLS** + direct write grants revoked, and the client-callable `save_progress` is **dropped** — so a signed-in user cannot self-assert a score by any path. `migrate_guest_data`/`delete_user_data` are now `SECURITY DEFINER` (self-scoped via `auth.uid()`) so they still write under the stricter RLS. **Guests stay client-computed in `localStorage`, unchanged.**
> - **Per-subject rubric + radar:** `DIAG_GRADE_SYS` emits the 5-dim rubric; `lib/scoring.js` aggregates/blends it (`diagnosticSubjectRubric`/`blendRubric`/`lowestRubricDimensions`); it's persisted in `scores.rubric jsonb` and drawn as a hand-rolled inline-SVG spider chart in `ProgressDashboard`, with a "what to work on" panel linking weak concepts into the Learn tab.
> - **Diagnostic 429 fix:** the 9 grades run server-side in ONE request with bounded concurrency (3) + retry-once-on-429 + `allSettled`.
> - ⚠️ **DB migration is two-phase (zero-downtime).** The **additive** phase ([`db/migrations/0001a_scoring_additive.sql`](db/migrations/0001a_scoring_additive.sql) — adds the `rubric` column + `save_progress_for` + DEFINER `migrate`/`delete`) is **ALREADY APPLIED to the live project** and is backward-compatible with the currently-deployed client, so **merging + deploying this branch is seamless**. After the deploy is confirmed healthy, apply the **lockdown** phase ([`db/migrations/0001b_scoring_lockdown.sql`](db/migrations/0001b_scoring_lockdown.sql) — drops `save_progress`, makes `scores`/`attempts` SELECT-only, revokes write grants) to fully close the self-assert gap, then re-check Supabase advisors. `db/schema.sql` is the canonical final state.

### The next task — harden for public/competitive use
Server-authoritative scoring unblocks leaderboards / score-gated features, but two residuals should land first (both in [§17](#17-roadmap--known-limitations)):

**1. Durable, per-account rate limiter.** `lib/rateLimit.js` is in-memory + per-instance + IP-spoofable. It now guards a bigger surface: `/api/score` (diagnostic) fans ONE request out to up to 9 Groq calls (bounded by a stricter per-IP `:diag`/`:img` budget, but still per-instance). Replace it with a durable shared store (e.g. `@upstash/ratelimit` on Upstash Redis) keyed by **account** for signed-in users (IP for guests). Prerequisite for monetization / heavy public traffic.

**2. Grading consistency.** The LLM can return a `reasoningScore` that contradicts its own rubric (e.g. a high score with all-zero bars). Add anchored rubric exemplars to the grade prompts and/or average multiple samples; consider a server-side sanity reconciliation between `reasoningScore` and the rubric mean. This directly improves the trustworthiness the radar now exposes.

Then: **a leaderboard** (now safe — scores are server-trusted), and the deeper model work (per-item IRT/Elo).

### Key files (for the next task)
`lib/rateLimit.js` (swap the in-memory limiter) · `app/api/score/route.js` + `app/api/generate|grade|learn` (apply the durable limiter; `/api/score` is the heaviest fan-out) · `lib/groq.js` (`PRACTICE_GRADE_SYS`/`DIAG_GRADE_SYS` ← anchored exemplars) · `lib/scoring.js` (any reconciliation helper, kept pure).

### How to work (dev loop §15) — `/api/score` is a security-sensitive surface
It is the app's trust boundary for scores. Re-review it at every change like the admin dashboard. Be ruthlessly objective; treat README/code claims of "intended / safe / verified / fixed" as **not evidence** and confirm each against the actual source **and the live DB**. Run a focused adversarial **security review** before merge (forged/missing/expired token, can the client still self-assert a score, cross-user write, `save_progress_for` callable by anyone but service-role, cost-amplification on the Groq fan-out, secret leakage), fanning out finder agents and **verifying every finding** against source (sub-agents hallucinate). Run the Supabase **advisors** and inspect live **RLS / policies / grants / function ACLs**. **Note:** Greptile's trial review limit is exhausted — a manual/self review is the only gate. Classify findings **P0–P3**, list explicit merge-blockers; for DB changes edit `db/schema.sql` **and** the migration, apply to the live project, then re-check advisors.

### Also queued (lower priority — see [§17](#17-roadmap--known-limitations))
Concept Hub v1.1 (open the hub to undiagnosed guests; `pg_trgm` fuzzy search; `tags[]`; canonical-merge de-dup); nonce-based strict CSP; per-item IRT/Elo; GitHub/Discord sign-in; ESLint in CI.

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
    score/route.js     POST: SERVER-AUTHORITATIVE scoring (signed-in) — grade+score+persist; diagnostic batch
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
  scoring.js           SUBJECTS/ORDER/bands + clampScore/band/blend/totalPoints/phdIndex + rubric helpers (radar)
  rateLimit.js         In-memory per-IP fixed-window limiter (used by all 3 routes)
  store.js             Data layer: Supabase when signed in, localStorage for guests
  catalog.js           Concept Hub browse: client-side reads of the public catalog + report write
  conceptKey.js        Pure concept→cache-key normalizer (client-safe; SQL-parity with _concept_key)
  supabase.js          Browser Supabase client + auth helpers + PROVIDERS
  supabaseAdmin.js     Server-only service-role client (concept cache); re-exports conceptKey
  taxonomy.js          Concept-hub Subject→Topic taxonomy (36 slugs; mirrors concept_topics)
  contentSafety.js     isConceptSafe() gate for public concept-hub entries
  requestGuard.js      Same-origin (Sec-Fetch) + JSON content-type gate for the API routes
  adminAuth.js         Server-only: verify Supabase JWT + deny-by-default admin allowlist
  abuseDetection.js    Server-only: prompt-injection heuristic + security_events logging
db/
  schema.sql           CANONICAL database DDL (tables, RLS, all RPCs) — run this to provision
  migrations/          Delta migrations vs a live DB: 0001a additive (applied), 0001b lockdown (post-deploy)
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
- **`attempts`** — `(id bigint identity PK, user_id, created_at, type text check('baseline'|'attempt'), subject, reasoning_score, delta, new_score, total_after, phd_after)`. Indexed `(user_id, created_at, id)`.
- **`concept_topics`** *(taxonomy reference)* — `(subject, slug, label, sort)`, PK `(subject, slug)`. The curated 36-topic Subject→Topic tree (mirrors `lib/taxonomy.js`). **Public-readable** (`for select using (true)`) so the hub renders labels/ordering; writes service-role only.
- **`concept_guides`** *(the concept-hub catalog)* — `(subject, concept_key, concept, topic→concept_topics, content jsonb null, status 'ready'|'pending', visibility 'public'|'hidden', source 'grader'|'curated'|'user', level_band, times_opened, created_at, updated_at)`, PK `(subject, concept_key)`. **Publicly readable but read-only** — the policy `for select to anon, authenticated using (visibility='public' and status='ready')` exposes only vetted guides; **all writes stay service-role only**. `content` is `null` for a `pending` stub. **CURATION-ONLY public model (security):** auto-grown guides (`source` grader/user) are **always stored `visibility='hidden'`** — cached + servable to a direct opener, but **never publicly browsable**. Only `source='curated'` rows (the seed / explicit approval) are public, so attacker-influenced concept labels/content can never be broadcast to all users. ⚠️ This is a public object — **never add a PII/per-user column here.**
- **`diagnostic_pool`** *(internal cache)* — `(id bigint identity, content jsonb, created_at)`. A handful of full 3-subject baseline diagnostics, reused across users (standardized, like the guides). Same **RLS-on / NO-policies** service-role lock. `/api/generate` serves a random one with no Groq call once it reaches `DIAG_POOL_TARGET` (12); below that it self-fills via the **`try_add_diagnostic(p_content, p_target)`** RPC — an advisory-locked, count-gated insert (`service_role`-only) so concurrent cold-start fills can't overshoot the target.
- **`security_events`** *(admin / abuse monitoring)* — server-logged warnings (prompt-injection attempts, rate-limit spikes, user reports) shown in the admin dashboard. **RLS on, NO policy** (service-role only — same lock as `diagnostic_pool`); never written by the browser.
- **`concept_reports`** *(admin / abuse monitoring)* — a signed-in user's report about a public guide. RLS has an **insert-own** policy (`to authenticated with check (auth.uid() = reporter_id)`); reads are admin-only (service-role; no select policy). The user-facing report button ships with the browse UI.

`scores`/`attempts` are **SELECT-only under RLS** (`for select to authenticated using ((select auth.uid()) = user_id)`) — a user can READ only their own rows and can no longer **write** them directly (direct INSERT/UPDATE/DELETE grants are also revoked from `anon`/`authenticated`, defense-in-depth). This is the core of **server-authoritative scoring**: all writes go through `SECURITY DEFINER` functions (which bypass RLS, scoped server-side), so a signed-in user cannot self-assert a score by any path — not even a direct PostgREST `PATCH`.

### RPCs (Postgres functions, in `db/schema.sql`)
- **`migrate_guest_data(p_scores jsonb, p_attempts jsonb)`** — atomic, idempotent, advisory-locked per user; migrates guest progress (incl. the per-subject `rubric`) into an **empty** account in one transaction (first-writer-wins; never overwrites). Called on first sign-in. **`SECURITY DEFINER`** (so it can write under the SELECT-only RLS) but **self-scoped to `auth.uid()`** — a caller can only migrate their own data; granted to `authenticated`.
- **`delete_user_data()`** — atomic delete of the caller's scores + attempts (Profile → "Reset my progress"). `SECURITY DEFINER`, self-scoped to `auth.uid()`; granted to `authenticated`.
- **`save_progress_for(p_user uuid, p_scores jsonb, p_attempt jsonb)`** *(server-authoritative scoring)* — the ONLY write path for signed-in scores/attempts. Upserts the user's scores (incl. `rubric`) **and** appends the matching attempt in **one transaction** for the explicit `p_user`. `SECURITY DEFINER` and **`service_role`-only** (revoked from `public`/`anon`/`authenticated`) — `/api/score` calls it with the **JWT-verified** uid, so the client can never write an arbitrary score or another user's row. Values are clamped / type-allow-listed / guard-cast (PG16+ `pg_input_is_valid`). (The old client-callable `save_progress(jsonb,jsonb)` is **dropped**.)
- **`register_concepts(p_subject, p_concepts jsonb)`** *(concept hub)* — auto-grow: registers the grader's (server-normalized) weak concepts as **`pending` stubs** (hidden until generated). `SECURITY DEFINER`, `service_role`-only; `on conflict do nothing` so it never disturbs an existing row; a **best-effort global cap (50k pending stubs)** bounds catalog growth. Called non-blocking (`after()`) from `/api/grade`.
- **`promote_or_insert_guide(p_subject, p_concept, p_content, p_topic, p_level, p_safe)`** *(concept hub)* — on a `/api/learn` generation: **promotes** a `pending` grader stub to `ready`, else inserts a fresh user-originated guide. **Either way the guide is stored `visibility='hidden'`** (curation-only): cached + servable to a direct opener but **never publicly browsable**. `p_safe` is retained for backward-compat but **no longer grants public visibility** (only a manual `source='curated'` seed is public). **Never overwrites an existing `ready` guide** (first-writer-wins). `SECURITY DEFINER`, `service_role`-only.
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

All three routes are `POST`, `dynamic = "force-dynamic"`, **same-origin-gated** (`lib/requestGuard.js`: rejects forced cross-site requests via `Sec-Fetch-Site` → `403`, and requires `Content-Type: application/json` → `415`, blunting CSRF-style cross-site cost/quota abuse), **rate-limited per IP** (`lib/rateLimit.js`, in-memory; `429` + `Retry-After`; `/api/learn` is tighter at 15/min and image grades get a separate 10/min budget), validate input (→ `400`), normalize model output, and return a **generic `500`** (the real Groq error is logged server-side, never leaked). *(The in-memory limiter is per-instance/IP-spoofable — a durable, per-account limiter is still a pre-monetization TODO, see §17.)*

### `POST /api/generate`
- **Diagnostic:** `{ "kind": "diagnostic" }` → `{ questions: [{subject, topic, difficulty, question} × 9] }` — **3 per subject** at difficulty `foundational`/`intermediate`/`advanced` (easy/intermediate/hard). **Read-through `diagnostic_pool`:** once the pool holds `DIAG_POOL_TARGET` (12) valid full sets, returns a random one (`pooled:true`) with **no Groq call**; below that, generates fresh and self-fills the pool. `isValidDiagnostic` only accepts a set with **all 3 subjects × all 3 tiers** (9 questions). Skipped when `SUPABASE_SERVICE_ROLE_KEY` is unset (always generates).
- **Practice:** `{ "kind": "practice", "subject": "math"|"physics"|"chemistry", "score": int, "weakConcepts": string[] }` → `{ subject, topic, targetConcept, difficulty, question }`. Subject validated via `ORDER.includes` (prototype-safe); `weakConcepts` capped.

### `POST /api/grade`
- `{ kind: "diagnostic"|"practice", subject, question, [targetConcept], [difficulty], [score], reasoning, [image: { mime, data(base64) }] }`. *(practice-only `difficulty` is the question's band, allowlist-validated and used only to calibrate the grader; unknown/missing → `(unspecified)`.)*
- Free-text fields capped (~12k chars); image validated (allowlisted MIME jpeg/png/webp/gif, base64, ~3 MB cap).
- **Diagnostic →** `{ subject, score(0–100), weakConcepts[], comment }` — grades **one** question's reasoning, calibrated to its `difficulty` band (threaded into the prompt like practice). The client grades all 9 in parallel and combines the 3 per subject via `diagnosticSubjectScore` (see §11).
- **Practice →** `{ reasoningScore(0–100), rubric{conceptual_understanding, logical_structure, strategy, execution_accuracy, communication: 0–4}, correctnessNote, socraticHint, microLesson, weakConcepts[], newScoreSuggestion }`. All scores clamped, rubric normalized, `weakConcepts` coerced to a string array.
- **Concept-hub auto-grow:** after responding (`after()`, non-blocking), the server-normalized `weakConcepts` are registered as `pending` catalog stubs via `register_concepts` (no added grading latency; no-op without the service-role key).

### `POST /api/learn`
- `{ subject, concept }` (a `score` field is accepted but **ignored** — guides are level-neutral and standardized).
- **Read-through shared cache:** normalizes the concept to a key (`conceptKey`); on a hit returns the stored guide (`cached:true`) **without calling Groq**; on a miss generates via Groq, normalizes, and — **only if `isConceptSafe(concept)`** — writes via **`promote_or_insert_guide`** (`cached:false`), which always stores the guide **`hidden`** (curation-only; never auto-public) and never overwrites a `ready` guide. An **unsafe** concept is still generated and returned to the opener but is **never persisted** (so it can't be served to anyone else). The LLM also classifies the concept into a curated **`topic`** slug (validated against `lib/taxonomy.js`; unknown → `general_<subject>`). Cache only active when `SUPABASE_SERVICE_ROLE_KEY` is set — **the platform's biggest token saver: each safe guide is generated once and reused, forever.**
- **Response:** `{ subject, concept, topic, overview, keyIdeas[], socraticQuestions[], pitfalls[], tryThis, tryThisQuestion, cached }`. `tryThisQuestion` is a practice-ready `{ question, targetConcept, difficulty }` (or `null`) — a concrete "try this" problem **cached with the guide**, so the Learn tab can start a practice attempt from it with **no `/api/generate` call**.

### `POST /api/score` — server-authoritative scoring (the trust boundary)
The write path for **signed-in** users. Same same-origin + JSON guard + per-IP rate limiting as the public routes. The browser attaches its Supabase session token (`Authorization: Bearer <jwt>`); `lib/adminAuth.js#requireUser` verifies it server-side (`supabase.auth.getUser(token)`). Persistence is via the `service_role`-only `save_progress_for` RPC bound to the **verified `auth.uid()`** — the client supplies reasoning, never a score.
- **`{ kind: "practice", subject, question, targetConcept, difficulty, reasoning, [image] }`** — **auth REQUIRED** (`401` without a valid token; `503` if the service-role key is unset). Reads the user's **stored** subject score from the DB (never client-supplied), grades the attempt, computes the new score server-side (`blend` + `blendRubric`), persists score + attempt + rubric atomically, and returns `{ reasoningScore, rubric, correctnessNote, socraticHint, microLesson, weakConcepts, newScore, delta, subjectScore, attempt }`. A client-supplied `score`/`newScore` is **ignored**.
- **`{ kind: "diagnostic", answers: [{subject, question, difficulty, reasoning, [image]}] (≤9) }`** — **auth OPTIONAL** (an invalid token is still rejected; it is not silently downgraded to guest). Grades the answers **server-side with bounded concurrency (3) + retry-once-on-429 + `allSettled`** (the fix for the old 9-call burst), dedupes by `subject:difficulty`, aggregates each subject's difficulty-weighted baseline (`diagnosticSubjectScore` + `diagnosticSubjectRubric`). A **verified** user → persists the baseline + returns `{ scores, persisted:true, attempt }`; a **guest** → `{ scores, persisted:false, attempt:null }` for the client to store in `localStorage`. If every grade fails → retryable `503` (no all-zero baseline persisted). A stricter per-IP `:diag` budget (4/min) + the `:img` budget guard the Groq fan-out.

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
- `blend(prev, suggestion, opts?)` — difficulty- and confidence-weighted damped update, a step toward an IRT/Elo model. `new = round(prev + alpha*(sug - prev))`: the grader's `suggestion` sets the target/direction and `alpha` (learning rate, clamped to `[0.05, 0.6]`) is the legacy anchor `0.35` scaled by **confidence** (`reasoningScore` — a blank attempt barely moves the score, an excellent one moves it more) and an **Elo surprise** term (the gap between the attempt's outcome and the outcome expected from `prev` vs the question's difficulty anchor, aligned to the move's direction — beating an above-level item amplifies an upward move; an outcome that contradicts the suggested direction damps it). Difficulty bands map to midpoint anchors (`beginner 10 … phd 90`, prototype-pollution-safe lookup). **Backward-compatible:** called with two args — or `opts` lacking both signals — it reproduces the exact legacy `round(prev*0.65 + sug*0.35)`. Null-safety unchanged: a null/garbage suggestion keeps `prev` (0 if none); a literal `NaN`/out-of-range `prev` is clamped; output is always an int in `[0,100]`. Threaded from `submitPractice` in `components/Noobtopro.jsx` via `{ difficulty: pQuestion.difficulty, reasoningScore: r.reasoningScore }`.
- `totalPoints(scores)` — sum of the three subject scores (0–300).
- `phdIndex(scores)` — mean of the three (0–100); the headline "PhD-level intelligence" number.
- `diagnosticSubjectScore(perQuestion)` — combines a subject's **three** diagnostic answers (easy/intermediate/hard) into a 0–100 **baseline**, weighting each question's reasoning score by its difficulty anchor (foundational 30 / intermediate 50 / advanced 70 ≈ 3:5:7) — **points proportional to difficulty**. Acing all → ~100; acing only easy → ~20. Called by `/api/score` (no `blend()` — this is the baseline, not an update). Exported alongside `DIAGNOSTIC_DIFFICULTIES` (`["foundational","intermediate","advanced"]`) and `DIFFICULTY_LABELS` (Easy/Intermediate/Hard).
- **Rubric helpers (powering the radar + "what to work on").** `RUBRIC_KEYS`/`RUBRIC_MAX` (the 5 dimensions in display order, scored 0–4). `normalizeRubric(r)` — coerce a model/stored rubric to a complete **integer** 0–4 object (per-attempt bars). `diagnosticSubjectRubric(perQuestion)` — difficulty-weighted per-subject rubric (the rubric analogue of `diagnosticSubjectScore`), kept as **floats** for resolution, `null` when empty. `blendRubric(prev, next, alpha=0.35)` — EWMA update of a subject's stored rubric toward an attempt's rubric (mirrors `blend`'s damping). `lowestRubricDimensions(r, n)` — the weakest dimension keys, for the "what to work on" guidance. All pure, so `/api/score` computes them exactly as the client would.

---

## 12. Frontend (the state machine)

The entire app is one big client component, **`components/Noobtopro.jsx`**, driven by two independent state variables:

- **`stage`**: `intro | signin | diagnostic | scoring | dashboard | practice` — *where you are in the core flow.*
- **`view`**: `practice | learn | progress | profile` — *which tab is selected.*

The render switch resolves in this order: `stage === "signin"` (sign-in menu, full-screen) → `view === "profile"` (ProfileTab) → `view === "learn"` (LearnTab) → `view === "progress"` (ProgressDashboard) → else the **Practice flow** (the `stage` machine: intro → diagnostic → scoring loader → dashboard "Where you stand" → practice Q&A + feedback).

Key flows / handlers:
- `beginDiagnostic()` → `/api/generate` (diagnostic) → **9 questions (3 per subject, easy/intermediate/hard)** answered one at a time (ordered subject-major, easy→hard; answers keyed by `subject:difficulty`; a grouped progress bar of 3×3 pips + a difficulty label per question) → `submitDiagnostic()` sends all 9 answers to **`/api/score`** (one batched request — the server grades + aggregates) → dashboard. **Signed-in** → the server also persists the baseline (`authApi` attaches the JWT); **guest** → the returned scores are saved to `localStorage` and finishing pops the **"save your progress" modal** (dimmed `inert` background, scroll-lock, focus trap, Escape/backdrop close).
- `startPractice(subject)` / `submitPractice()` — **signed-in** → `/api/generate` + **`/api/score`** (server grades, computes the trusted score from the stored level, persists; the client renders the response and never blends/saves locally); **guest** → `/api/generate` + `/api/grade`, then `blend`/`blendRubric` locally + `saveProgress` to `localStorage`. Either way renders the rubric + Socratic hint + micro-lesson (no answer). `adminApi` was renamed `authApi` (token-attaching POST used by both `/api/admin/*` and `/api/score`).
- `openLearn(subject, concept)` → switches to the Learn tab and fetches `/api/learn` (guarded by a monotonic `learnRun` token so rapid clicks can't show a stale guide). **Memoized per session** in `learnCacheRef` (`"subject::concept"` → guide), so revisiting a concept renders instantly with **no server round-trip**. Each guide carries a cached **"try this" question**: `startPracticeWithQuestion(subject, q)` enters practice using it directly (no generation), and `regenerateLearnQuestion()` fetches a fresh, level-calibrated one on demand (session-only — the shared cached guide is untouched).
- The dashboard's **"Work on" weak-concept tags are buttons** → they call `openLearn`.
- `hydrate()` (run-token guarded) loads state on mount + on `SIGNED_IN`/`SIGNED_OUT`; image previews use `URL.createObjectURL` and are revoked to avoid leaks.

Components: **SignIn** (provider buttons), **ProfileTab** (identity + stats + confirm-guarded reset), **LearnTab** (concept picker + guide sections), **ProgressDashboard** (dependency-free inline SVG charts).

---

## 13. Testing

**Vitest**, configured in `vitest.config.js` (node env by default; component tests opt into `jsdom` via a `// @vitest-environment jsdom` docblock; automatic JSX runtime; `@/` alias). Run with `npm test` (CI uses this) or `npm run test:watch`. **356 tests across 28 files**, all passing.

| File | Covers |
|---|---|
| `test/scoring.test.js` | clampScore/band/blend (legacy + weighted Elo path)/totalPoints/phdIndex incl. regressions **+ non-integer-score coercion** + **`diagnosticSubjectScore` difficulty-weighted baseline** (anchor 3:5:7, clamping, unknown-band fallback) + **rubric helpers** (`normalizeRubric` int 0–4, `diagnosticSubjectRubric` float difficulty-weight, `blendRubric` EWMA, `lowestRubricDimensions` ties) |
| `test/api-score.test.js` | **`/api/score`**: request guard 403/415; practice auth-required (401), 503 w/o service-role, **server-authoritative score** (computed from stored level), **client-supplied score IGNORED**, generic 500 on persist fail, retry-once-on-429; diagnostic guest grade-only vs signed-in persist, **invalid-token rejected (not downgraded)**, subject:difficulty dedupe, >9 rejected, allSettled resilience, all-fail → 503, **`:img` budget charged for vision grades** |
| `test/noobtopro-score.test.jsx` | signed-in practice routes to `/api/score` **with the Bearer token**, renders the server's trusted result, and **never calls `/api/grade` or `saveProgress`** |
| `test/groq.test.js` | JSON extraction (fences, prose, braces-in-strings), fallback retry **gating (no retry on hard HTTP errors)**, per-call `max_tokens`, **grade-model routing (gpt-oss + `reasoning_effort` low)**, errors |
| `test/rateLimit.test.js` | window limit, reset, per-key, memory bound (enforceCap) |
| `test/api-generate.test.js` | validation/400s, prototype-key rejection, non-leaking 500, weakConcepts cap, **diagnostic pool (warm-serve / cold self-fill via RPC / invalid-row + invalid-generated guards / read-error fall-through)** |
| `test/api-grade.test.js` | validation, MIME/base64, score/rubric normalization, difficulty-band threading, **valid-image → vision-model forwarding**, **request-guard 403/415**, non-leaking 500 |
| `test/api-learn.test.js` | validation, normalization, **cache hit/miss via `promote_or_insert_guide` / key-normalization (real `conceptKey`) / LLM-topic validation**, **request-guard 403/415**, tryThisQuestion shaping |
| `test/taxonomy.test.js` | the 36-topic Subject→Topic tree: 12/subject incl. `general_*`, `isValidTopic`/`normalizeTopic` (case-tolerant, prototype-safe, cross-subject reject), labels/slugs |
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
- **`next.config.js`** sets `reactStrictMode` + security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, HSTS, `Permissions-Policy`, and a **baseline `Content-Security-Policy`**). The CSP locks down `object-src`/`base-uri`/`form-action`/`frame-ancestors` and tight `default-/connect-/img-/font-/style-src` lists (allow-listing Google Fonts, Supabase, Vercel insights, and `blob:` image previews); `script-src`/`style-src` still keep `'unsafe-inline'` because Next injects inline runtime scripts and the app uses inline style objects — a **nonce-based strict `script-src` via middleware is the documented next step** (§17).
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

History of what's shipped is in `git log` (PRs #2–#29): flatten-for-Vercel, audit hardening (rounds 2–3 + multiple full-repo audits), rate limiting, the OAuth sign-in menu + Profile + guest→account migration, the save-progress modal, GitHub/Discord toggles, the Learn tab + `/api/learn`, the shared concept-guide cache, the difficulty/confidence-weighted Elo-style score model, the cheaper grader (`gpt-oss-120b`) + shared diagnostic pool, dead-code removal, and the audit→cleanup round (the `submitPractice` run-token guard, image-preview-leak fix, RPC grant hygiene, baseline CSP, CI hardening, and the expanded test suite).

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

**Concept Hub (in progress — see "Where to start"):**
- v1 remaining: the hub **browse UI** (`LearnTab` rebuild + `lib/catalog.js`, behind `NEXT_PUBLIC_ENABLE_CONCEPT_HUB`) and the **curated seed** generation + **moderation report/hide/regenerate** flow.
- v1.1: **`pg_trgm`** fuzzy/typo-tolerant search (available, not yet installed — ships as its own `create extension` migration; v1 uses plain `ILIKE`); a curated **`tags[]`** cross-cutting facet; a **canonical-merge** tool to de-duplicate near-identical concepts (the live data already has clusters like 4 energy / 3 equilibrium — v1 clusters them by topic); a **durable rate limiter** before heavy public traffic. `times_opened` is stored but inert until a batched popularity counter is designed.

**Product / model:**
- **Extend `blend()` toward a full IRT/Elo model.** The shipped version already weights by question difficulty and per-attempt reasoning quality via an Elo *surprise* term (see §11); remaining work is per-item difficulty ratings (vs fixed band midpoints) and calibrating the constants (`ELO_SCALE`, the confidence range, the `alpha` cap) against logged attempts.
- Anchored rubric exemplars + multiple grading samples averaged (grading consistency is the real risk — LLM scores drift).
- Adaptive diagnostic; a **concept graph** per subject so "weak on X" routes to the right next problems.
- Data export; auto-resume into the diagnostic after the OAuth redirect (currently the redirect resets state).

**Security posture (an objective 81-agent audit ran on the concept-hub branch; findings fixed):**
- **Fixed this round:** concept hub is now **curation-only public** (auto-grown guides never auto-publish — closes attacker-influenced public content), unsafe concepts are never persisted, a **same-origin + JSON guard** on all API routes (CSRF/cross-site cost abuse), tighter per-route + image rate limits, the **vision fallback no longer double-calls** the model (cost amplification), **image magic-byte validation** (forged-MIME/arbitrary-bytes), a non-string-`reasoning` 500, guest-`localStorage` cleared on sign-out, forgeable-future `created_at` clamped, and **OAuth switched to PKCE** (§9).
- **Audit-fix round (a second full pre-merge audit of PR #29 — 8 finder lenses + adversarial verification — fixes applied to this branch):** `_concept_key`↔`conceptKey` made **true byte-for-byte parity** (control/zero-width/BOM strip + code-point truncation; live-verified) so the read-through cache can't miss on exotic input and the README parity claim is now accurate; **int4-range clamp** on every attempt field in `save_progress`/`migrate_guest_data` (a corrupt guest blob can no longer abort the whole migration); **`weak_concepts` capped at 64** (server RPCs + client); **best-effort 50k cap** on pending grader stubs; **sign-out synchronously clears in-memory scores/history** (shared-device peek); **practice image preview revoked on completion** (matching the diagnostic fix); **guest `localStorage` validated/clamped on read**; `totalPoints`/`phdIndex` coerce non-integer scores; `isConceptSafe` hardened (expanded TLDs, zero-width-split evasion, Unicode-letter count). New tests pin the **curation-only invariant** and **key parity** (`test/schema-invariants.test.js`, `test/conceptKey.test.js`) and add **request-guard 403/415** coverage on all three routes. The audit confirmed **0 P0/0 P1 / no merge-blockers**; everything fixed here was P2/P3.
- **Verified clean (not just claimed):** no cross-user data read/write (RLS bound to `auth.uid()`), no SQLi, no XSS sinks (all LLM/user content is React-escaped; no `dangerouslySetInnerHTML`), no secret leakage, SECURITY DEFINER RPCs are `service_role`-only, and **no RPC path yields a `public`+`ready` guide** (curation-only holds) — all checked against the live DB.
- **Server-authoritative scoring round (this branch — a 33-agent adversarial review, 6 lenses + per-finding verification; 1 P1 + several P2/P3 fixed, the rest accepted by decision):**
  - **RESOLVED — scores were client-computed / self-assertable.** Signed-in scoring is now server-authoritative: `/api/score` grades + computes from the **stored** level + persists via the `service_role`-only `save_progress_for` for the JWT-verified uid; `scores`/`attempts` are SELECT-only RLS + write grants revoked; client-callable `save_progress` dropped. A signed-in user can no longer self-assert by any path (verified against the diff + live grants). Guests stay client-computed (no account to protect).
  - **RESOLVED — the diagnostic's 9-call burst** is now ONE server request with bounded concurrency (3) + retry-once-on-429 + `allSettled`; a single 429 no longer sinks the set.
  - **P1 fixed:** the diagnostic vision grades now charge the per-IP `:img` budget (they previously bypassed it — a ~3.6× cost-amplification on the costliest Groq path). **P2 fixed:** `gradeOne` no longer retries image grades (avoids a second vision call); guest→account migration now carries the `rubric`. **P3 fixed:** `:diag` budget checked before the auth round-trip; service-role null-checked before grading; defensive client payload guard.
- **Accepted residual risks (documented, by decision):**
  - **Same-subject practice is a read-modify-write** (`/api/score` reads prev → blends → writes); two concurrent same-user grades on one subject could lose an update. Single-user, low-stakes, guarded by the one-question-at-a-time UI + run-token; revisit if scores gate paid features. (Commented at the read in `handlePractice`.)
  - **Re-taking the diagnostic re-baselines** (overwrites accumulated scores via upsert) — the same destructive semantics as before; guarded by the UI. A "merge vs replace" prompt is the future fix.
  - **Diagnostic partial-failure re-weights** a subject from its surviving graded answers (a transient miss on the hard tier slightly inflates that subject) — preferred over discarding a subject; retry-once covers most. All-fail → retryable 503 (no all-zero baseline).
  - **SECURITY DEFINER owner not pinned** via `ALTER FUNCTION ... OWNER TO` — relies on the migration being run as the table-owning role (same assumption as the existing concept-hub DEFINER RPCs); the revoked write grants make this robust regardless.
  - **Two expected Supabase advisor WARNs after the migration:** `authenticated_security_definer_function_executable` on `migrate_guest_data` and `delete_user_data` — they MUST be `authenticated`-callable (the client invokes them) AND `SECURITY DEFINER` (to write under the SELECT-only RLS), but each is **self-scoped to `auth.uid()`** (advisory-locked, `search_path` pinned), so a caller can only touch their OWN rows. Intentional/accepted. `save_progress_for` is correctly **not** flagged (service-role only). (Pre-existing INFO/WARNs — `diagnostic_pool`/`security_events` RLS-no-policy, leaked-password — are unrelated and tracked below.)
  - **Durable rate limiter** (e.g. `@upstash/ratelimit`) + per-account limits to replace the in-memory one — **now more load-bearing** (`/api/score` fans out to ~9 Groq calls/request). This is the **next task** — see "Where to start". Do before monetizing / heavy public traffic.
  - **`delete_user_data`** clears the user's scores/attempts but does **not** delete the `auth.users` account (needs an admin-API flow).
  - **Disable the Supabase email/password provider** (the app is OAuth-only) to clear the leaked-password advisor and close an unused signup surface; if kept, enable HIBP leaked-password protection.
  - **Quarantine/report flow** for a poisoned *hidden* guide served on direct open (shared-cache trade-off) — future, alongside the curation UI.
  - **Shared-device guest migration:** a guest's `localStorage` progress auto-migrates into the **first different account** that signs in on the same browser — but only into an *empty* account (the scores-exists guard blocks any populated account; no PII; RLS intact, write is correctly scoped to that account). Bounded and by-design for the guest→account flow; a future "merge your guest progress?" consent prompt (instead of silent auto-migrate) would close it.
- **Server-side auth enforcement.** The *public* routes (`/api/generate|grade|learn`) are same-origin-gated + rate-limited + RLS-scoped, but not per-user authenticated. **`/api/score` (signed-in writes) and `/api/admin/*` ARE per-user authenticated** — both verify the caller's Supabase JWT server-side (`lib/adminAuth.js#requireUser`; admin layers an allowlist on top via `requireAdmin`), re-checked on every call, never trusting the client. `/api/score` is the scoring trust boundary; the admin routes verify a deny-by-default `ADMIN_EMAILS`/`ADMIN_USER_IDS` allowlist, and the admin **approve** action is the only sanctioned path that publishes a guide (human-in-the-loop curation — no *automated* path makes content public). the admin **approve** action is the only sanctioned path that publishes a guide (human-in-the-loop curation — no *automated* path makes content public). Prompt-injection/abuse signals are logged (non-blocking, field-capped) to `security_events` for review; the per-IP log throttle is best-effort and shares the in-memory rate limiter's IP-spoofable residual (a durable store is the same pre-monetization TODO). A focused adversarial security review of this surface found **no P0/P1/P2** (verified against the live DB: JWT-only identity, deny-by-default allowlist, RLS default-deny on both new tables, publish guardrails, no XSS, intact client/server boundary). Given it can publish content, re-review it at each change.
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
