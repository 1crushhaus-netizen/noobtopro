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
> New here? Jump to [**Where to start (first three tasks)**](#where-to-start-first-three-tasks).

**Prove what you know. Climb from noob to pro.**

---

## Table of contents

- ⭐ [**Where to start (first three tasks)**](#where-to-start-first-three-tasks)
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

1. **Diagnose** — three open problems (one per subject). You solve them and explain every step.
2. **Get placed** — your *reasoning* is graded on a 5-part rubric and mapped to a **0–100 score per subject**.
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
- ✅ Diagnostic → per-subject scoring → calibrated practice loop (Groq-backed).
- ✅ Photo-of-work grading (vision model, graceful text fallback).
- ✅ **Google sign-in** (configured + working), durable per-user storage with RLS.
- ✅ **Guest mode** (no login): full flow stored in `localStorage`. On first sign-in, guest progress **migrates** into the account.
- ✅ **Profile** tab (identity + stats + reset), **Progress** tab (charts), **Practice** + **Learn** tabs.
- ✅ "Save your progress" modal after the guest diagnostic.
- ✅ Per-IP rate limiting; security headers; error boundary.

**Built but not yet activated (config only):**
- ⏳ **Shared concept-guide cache** — code shipped; **inactive until `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel.** Without it `/api/learn` still works but regenerates each time.
- ⏳ **GitHub / Discord sign-in** — code is env-toggleable and ready; needs the OAuth apps + Supabase provider config + `NEXT_PUBLIC_ENABLE_*` flags (see `AUTH_PROVIDERS.md`).

**Env vars currently set in Vercel (project-level):** `GROQ_API_KEY` (Sensitive), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Not set:** `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_ENABLE_GITHUB`, `NEXT_PUBLIC_ENABLE_DISCORD`.

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

Other commands: `npm test` (run tests once), `npm run test:watch`, `npm run build`, `npm start`, `npm run lint`.

---

## Where to start (first three tasks)

If you (human or LLM) are picking this up cold, these are the three highest-value, well-scoped next tasks — ordered easy → meaningful. Each links to the section/doc you'll need. Follow the dev loop in [§15](#15-how-we-work-the-dev-loop) for all of them.

### Task 1 — Turn on the shared concept-guide cache *(ops, ~15 min)*
The code is shipped but inactive because `SUPABASE_SERVICE_ROLE_KEY` isn't set. A good first task to learn the env/deploy loop.
- Add `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API → `service_role`) in **Vercel → noobtopro project → Settings → Environment Variables** (mark **Sensitive**, all environments), then redeploy. See [§7](#7-environment-variables), [§16](#16-troubleshooting--gotchas).
- **Verify:** `POST /api/learn` twice for a fresh concept (e.g. `{"subject":"math","concept":"chain rule"}`) — the second response should be `"cached": true`. Relevant code: `app/api/learn/route.js`, `lib/supabaseAdmin.js`.

### Task 2 — Stand up GitHub & Discord sign-in *(integration)*
The sign-in menu is already provider-agnostic and env-toggleable; this is configuration, not app code.
- Follow **`AUTH_PROVIDERS.md`** end-to-end: create each OAuth app (callback = the Supabase callback URL in [§2](#2-current-status--live-links)), enable the provider in Supabase, then set `NEXT_PUBLIC_ENABLE_GITHUB` / `NEXT_PUBLIC_ENABLE_DISCORD = "true"` in Vercel and redeploy.
- **Verify:** the "Continue with GitHub/Discord" buttons go from "Coming soon" to live and complete an OAuth round-trip. See [§9](#9-authentication). *(Do the Supabase step before flipping the flag, or the button errors on click.)*

### Task 3 — Replace the placeholder score model *(core product code)* ✅ **shipped**
The biggest product win, now done. `blend(prev, suggestion, opts)` in `lib/scoring.js` is a difficulty- and confidence-weighted **Elo-style** update (a step toward an IRT/Elo model): the grader's `newScoreSuggestion` sets the target/direction, and a bounded learning rate `alpha` (anchored at the legacy `0.35`) is scaled by the per-attempt `reasoningScore` (confidence) and an Elo *surprise* term over the question's `difficulty` band. It stays backward-compatible with the legacy 65/35 two-arg call and preserves `clampScore`/null-safety. The validated `difficulty` band is also threaded through `/api/grade` so the grader calibrates `reasoningScore`/`newScoreSuggestion` to the item's level. See [§11](#11-scoring-model-libscoringjs). Covered by 20 new tests (17 in `test/scoring.test.js` for the weighted blend, 3 in `test/api-grade.test.js` for difficulty-band threading); 103 total, all green.
- **Follow-ups:** replace fixed band midpoints with per-item difficulty ratings (true IRT/Elo); tune `ELO_SCALE` / the confidence range / the `alpha` cap against logged attempt data.

> Smaller good-first-issues if you want to warm up: surface a "Learn this" shortcut from the practice feedback's "Concept you're missing" card; make the Profile tab's by-subject rows clickable into Learn; add a strict CSP (see §14).

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
    generate/route.js  POST: diagnostic (3 Qs) or practice (1 Q) question generation
    grade/route.js     POST: grade reasoning (diagnostic or practice); image-aware
    learn/route.js     POST: Socratic concept guide; read-through shared cache
components/
  Noobtopro.jsx        THE app — one big client component; stage×view state machine
  SignIn.jsx           OAuth sign-in menu (provider buttons; no email/password)
  ProfileTab.jsx       Identity card + stats + "Reset my progress"
  LearnTab.jsx         Weak-concept picker + Socratic guide renderer
  ProgressDashboard.jsx  Charts (total over time, per-attempt deltas, by-subject)
lib/
  groq.js              Server-only Groq client + ALL system prompts (*_SYS)
  scoring.js           SUBJECTS/ORDER/bands + clampScore/band/blend/totalPoints/phdIndex
  rateLimit.js         In-memory per-IP fixed-window limiter (used by all 3 routes)
  store.js             Data layer: Supabase when signed in, localStorage for guests
  supabase.js          Browser Supabase client + auth helpers + PROVIDERS
  supabaseAdmin.js     Server-only service-role client (concept cache) + conceptKey()
db/
  schema.sql           CANONICAL database DDL (tables, RLS, all RPCs) — run this to provision
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

---

## 8. Database & persistence

### Provisioning (canonical source: `db/schema.sql`)
To stand up the database from scratch (or reproduce it), **run `db/schema.sql` in the Supabase SQL Editor.** It is the single source of truth and contains the tables, RLS, and **all RPCs** — the app depends on the functions, not just the tables. (The live project is already provisioned; migrations were applied via the Supabase connector.) Then enable the redirect URLs / auth providers per `DEPLOYMENT_PLAN.md` / `AUTH_PROVIDERS.md`.

### Tables
- **`scores`** — `(user_id uuid, subject text check(math|physics|chemistry), score int, weak_concepts text[], comment text, updated_at)`, PK `(user_id, subject)`.
- **`attempts`** — `(id bigint identity PK, user_id, created_at, type text check('baseline'|'attempt'), subject, reasoning_score, delta, new_score, total_after, phd_after)`. Indexed `(user_id, created_at, id)`.
- **`concept_guides`** *(internal cache)* — `(subject, concept_key, concept, content jsonb, created_at)`, PK `(subject, concept_key)`. **RLS enabled with NO policies** → only the service role (server) can touch it; no end-user can read or pollute it.
- **`diagnostic_pool`** *(internal cache)* — `(id bigint identity, content jsonb, created_at)`. A handful of full 3-subject baseline diagnostics, reused across users (standardized, like the guides). Same **RLS-on / NO-policies** service-role lock. `/api/generate` serves a random one with no Groq call once it reaches `DIAG_POOL_TARGET` (12); below that it self-fills via the **`try_add_diagnostic(p_content, p_target)`** RPC — an advisory-locked, count-gated insert (`service_role`-only) so concurrent cold-start fills can't overshoot the target.

`scores`/`attempts` have RLS: `for all to authenticated using ((select auth.uid()) = user_id) with check (...)` — each user only ever sees/writes their own rows.

### RPCs (Postgres functions, in `db/schema.sql`)
- **`migrate_guest_data(p_scores jsonb, p_attempts jsonb)`** — atomic, idempotent, advisory-locked per user; migrates guest progress into an **empty** account in one transaction (first-writer-wins; never overwrites). Called on first sign-in. (Service-invoker → RLS applies.)
- **`delete_user_data()`** — atomic delete of the caller's scores + attempts (Profile → "Reset my progress").
- **`save_progress(p_scores jsonb, p_attempt jsonb)`** — atomic per-update write: upserts the caller's scores **and** appends the matching attempt in **one transaction** (capturing `auth.uid()` once), so a partial failure can't persist a score without its attempt. Values are clamped / type-allow-listed / guard-cast (PG16+ `pg_input_is_valid`) like the migration RPC. (Service-invoker → RLS applies.) Drives `saveProgress` for the diagnostic baseline and every practice attempt.
- *(The concept cache is written/read by the server directly using the service role, not via RPC.)*

### `lib/store.js` — the dual-mode data layer
The UI only ever calls these; they transparently use Supabase when signed in, else `localStorage` (`key "noobtopro:v1"`):
- `loadState()` — returns `{ scores, history }` (or `{ error }` on a DB failure, so the UI doesn't mistake an error for "new user").
- `saveProgress(scores, evt)` — **the write path** for the diagnostic + practice flows: one atomic `save_progress` RPC (signed-in) or a single `localStorage` write (guest) that persists the score change and its attempt **together**, then returns the refreshed `{ history }`. Throws on failure so callers surface a banner.
- `saveScores(scores)` / `recordAttempt(evt)` — the lower-level single-table primitives (the app's write path now goes through `saveProgress`; these remain for completeness and tests).
- `migrateGuestToAccount()` — single-flight wrapper around the `migrate_guest_data` RPC; sends a clamped payload; clears the guest copy on success.
- `deleteAllUserData()` — calls the `delete_user_data` RPC.
- `resetAll()` — clears the local guest view only.

---

## 9. Authentication

**OAuth-only by design — there is no email/password and no manual sign-up.** Identity is delegated entirely to providers (Google live; GitHub/Discord ready) via Supabase, so we never store credentials or carry that PII responsibility.

- **`lib/supabase.js`** exports `PROVIDERS` (`google` always on; `github`/`discord` gated on `NEXT_PUBLIC_ENABLE_*`), `signInWithProvider(id)` (full-page OAuth redirect, `redirectTo: window.location.origin`), `signInWithGoogle`, `signOutUser`, `isSupabaseConfigured`, `getSupabase` (browser-only, lazy).
- **Flow:** the **sign-in menu** (`stage: "signin"` → `SignIn.jsx`) shows a button per provider (disabled = "Coming soon"). After the OAuth redirect, `onAuthStateChange("SIGNED_IN")` runs `hydrate()`, which first calls `migrateGuestToAccount()` (guest → account) then `loadState()`. `onAuthStateChange` only re-hydrates on `SIGNED_IN`/`SIGNED_OUT` (not token refreshes).
- **Guest-first:** you can do the whole diagnostic without logging in; on completion a modal prompts you to sign in to save, and your guest results migrate over.
- **Enabling GitHub/Discord:** create the OAuth app (callback = the Supabase callback URL above), enable the provider in Supabase, then set `NEXT_PUBLIC_ENABLE_GITHUB`/`…DISCORD=true` and redeploy. Full steps in `AUTH_PROVIDERS.md`.

---

## 10. Server API reference

All three routes are `POST`, `dynamic = "force-dynamic"`, **rate-limited per IP** (`lib/rateLimit.js`: 30 req/min/IP, in-memory; returns `429` + `Retry-After`), validate input (→ `400`), normalize model output, and return a **generic `500`** (the real Groq error is logged server-side, never leaked).

### `POST /api/generate`
- **Diagnostic:** `{ "kind": "diagnostic" }` → `{ questions: [{subject, topic, question} × 3] }` (one per subject). **Read-through `diagnostic_pool`:** once the pool holds `DIAG_POOL_TARGET` (12) valid full sets, returns a random one (`pooled:true`) with **no Groq call**; below that, generates fresh and self-fills the pool (only valid 3-subject sets). Skipped when `SUPABASE_SERVICE_ROLE_KEY` is unset (always generates).
- **Practice:** `{ "kind": "practice", "subject": "math"|"physics"|"chemistry", "score": int, "weakConcepts": string[] }` → `{ subject, topic, targetConcept, difficulty, question }`. Subject validated via `ORDER.includes` (prototype-safe); `weakConcepts` capped.

### `POST /api/grade`
- `{ kind: "diagnostic"|"practice", subject, question, [targetConcept], [difficulty], [score], reasoning, [image: { mime, data(base64) }] }`. *(practice-only `difficulty` is the question's band, allowlist-validated and used only to calibrate the grader; unknown/missing → `(unspecified)`.)*
- Free-text fields capped (~12k chars); image validated (allowlisted MIME jpeg/png/webp/gif, base64, ~3 MB cap).
- **Diagnostic →** `{ subject, score(0–100), weakConcepts[], comment }`.
- **Practice →** `{ reasoningScore(0–100), rubric{conceptual_understanding, logical_structure, strategy, execution_accuracy, communication: 0–4}, correctnessNote, socraticHint, microLesson, weakConcepts[], newScoreSuggestion }`. All scores clamped, rubric normalized, `weakConcepts` coerced to a string array.

### `POST /api/learn`
- `{ subject, concept }` (a `score` field is accepted but **ignored** — guides are level-neutral and standardized).
- **Read-through shared cache:** normalizes the concept to a key (`conceptKey`: lowercase/trim/collapse-space/strip-quotes); on a hit returns the stored guide (`cached:true`) **without calling Groq**; on a miss generates via Groq, normalizes, and stores first-writer-wins (`cached:false`). Cache only active when `SUPABASE_SERVICE_ROLE_KEY` is set — **this is the platform's single biggest token saver: each guide (and its bundled practice question) is generated once and reused for every user, forever.**
- **Response:** `{ subject, concept, overview, keyIdeas[], socraticQuestions[], pitfalls[], tryThis, tryThisQuestion, cached }`. `tryThisQuestion` is a practice-ready `{ question, targetConcept, difficulty }` (or `null`) — a concrete "try this" problem **cached with the guide**, so the Learn tab can start a practice attempt from it with **no `/api/generate` call**.

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

---

## 12. Frontend (the state machine)

The entire app is one big client component, **`components/Noobtopro.jsx`**, driven by two independent state variables:

- **`stage`**: `intro | signin | diagnostic | scoring | dashboard | practice` — *where you are in the core flow.*
- **`view`**: `practice | learn | progress | profile` — *which tab is selected.*

The render switch resolves in this order: `stage === "signin"` (sign-in menu, full-screen) → `view === "profile"` (ProfileTab) → `view === "learn"` (LearnTab) → `view === "progress"` (ProgressDashboard) → else the **Practice flow** (the `stage` machine: intro → diagnostic → scoring loader → dashboard "Where you stand" → practice Q&A + feedback).

Key flows / handlers:
- `beginDiagnostic()` → `/api/generate` (diagnostic) → answer each → `submitDiagnostic()` grades all three in parallel → dashboard. As a guest, finishing pops the **"save your progress" modal** (dimmed `inert` background, scroll-lock, focus trap, Escape/backdrop close).
- `startPractice(subject)` / `submitPractice()` → `/api/generate` + `/api/grade`; blends the new score; renders the rubric + Socratic hint + micro-lesson (no answer).
- `openLearn(subject, concept)` → switches to the Learn tab and fetches `/api/learn` (guarded by a monotonic `learnRun` token so rapid clicks can't show a stale guide). **Memoized per session** in `learnCacheRef` (`"subject::concept"` → guide), so revisiting a concept renders instantly with **no server round-trip**. Each guide carries a cached **"try this" question**: `startPracticeWithQuestion(subject, q)` enters practice using it directly (no generation), and `regenerateLearnQuestion()` fetches a fresh, level-calibrated one on demand (session-only — the shared cached guide is untouched).
- The dashboard's **"Work on" weak-concept tags are buttons** → they call `openLearn`.
- `hydrate()` (run-token guarded) loads state on mount + on `SIGNED_IN`/`SIGNED_OUT`; image previews use `URL.createObjectURL` and are revoked to avoid leaks.

Components: **SignIn** (provider buttons), **ProfileTab** (identity + stats + confirm-guarded reset), **LearnTab** (concept picker + guide sections), **ProgressDashboard** (dependency-free inline SVG charts).

---

## 13. Testing

**Vitest**, configured in `vitest.config.js` (node env by default; component tests opt into `jsdom` via a `// @vitest-environment jsdom` docblock; automatic JSX runtime; `@/` alias). Run with `npm test` (CI uses this) or `npm run test:watch`. **134 tests across 11 files**, all passing.

| File | Covers |
|---|---|
| `test/scoring.test.js` | clampScore/band/blend (legacy + weighted Elo path)/totalPoints/phdIndex incl. regressions |
| `test/groq.test.js` | JSON extraction (fences, prose, braces-in-strings), fallback retry **gating (no retry on hard HTTP errors)**, per-call `max_tokens`, **grade-model routing (gpt-oss + `reasoning_effort` low)**, errors |
| `test/rateLimit.test.js` | window limit, reset, per-key, memory bound (enforceCap) |
| `test/api-generate.test.js` | validation/400s, prototype-key rejection, non-leaking 500, weakConcepts cap, **diagnostic pool (warm-serve / cold self-fill via RPC / invalid-row + invalid-generated guards / read-error fall-through)** |
| `test/api-grade.test.js` | validation, MIME/base64, score/rubric normalization, difficulty-band threading, non-leaking 500 |
| `test/api-learn.test.js` | validation, normalization, **cache hit/miss/write-fail/key-normalization** (filter-aware mock), tryThisQuestion shaping |
| `test/store.test.js` | migration clamping, delete RPC, signed-in load/save/record paths + data-wipe guard, **atomic `saveProgress`** (mocked Supabase) |
| `test/error.test.jsx` | error-boundary logs the caught error + `reset()` on "Try again" |
| `test/signin.test.jsx` | provider buttons, OAuth-only (no password field), enabled-provider |
| `test/profile.test.jsx` | identity, empty state, stats, confirm-guarded reset |
| `test/learn.test.jsx` | empty state, concept select, loading/error **live regions**, guidance render, **try-this question: practice-reuse / regenerate / fallback** |

**Mocking patterns:** Groq calls are mocked by stubbing global `fetch`; Supabase is mocked via `vi.mock("@/lib/...")` with `vi.hoisted`; components use `@testing-library/react`. No network or real keys are needed.

---

## 14. Build, CI & deploy

- **Stack:** Next 15 App Router, React 19, Node 24 (`.nvmrc`; Vercel uses 24.x).
- **`vercel.json`** pins `{ "framework": "nextjs" }` — **do not remove** (see §16).
- **`next.config.js`** sets `reactStrictMode` + security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, HSTS, `Permissions-Policy`). A strict CSP is a deliberate TODO.
- **CI** (`.github/workflows/ci.yml`): on every PR + push to `main`, the **"Test and build"** job runs `npm ci` → `npm test` → `npm run build` (build runs with empty secrets to prove guest mode works). **`main` is branch-protected to require this check.**
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

History of what's shipped is in `git log` (PRs #2–#15): flatten-for-Vercel, audit hardening (rounds 2–3 + a full-repo audit), rate limiting, the OAuth sign-in menu + Profile + guest→account migration, the save-progress modal, GitHub/Discord toggles, the Learn tab + `/api/learn`, and the shared concept-guide cache.

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
- **`npm audit`** shows dev-only (vitest/esbuild) and a transitive postcss-via-Next moderate; the "fix" downgrades Next to v9, so we **accept** these rather than break the build.

---

## 17. Roadmap & known limitations

**Activation (config only, no code):**
- Set `SUPABASE_SERVICE_ROLE_KEY` → turns on the shared concept-guide cache.
- Configure + enable GitHub & Discord providers → flip `NEXT_PUBLIC_ENABLE_*`.

**Product / model:**
- **Extend `blend()` toward a full IRT/Elo model.** The shipped version already weights by question difficulty and per-attempt reasoning quality via an Elo *surprise* term (see §11); remaining work is per-item difficulty ratings (vs fixed band midpoints) and calibrating the constants (`ELO_SCALE`, the confidence range, the `alpha` cap) against logged attempts.
- Anchored rubric exemplars + multiple grading samples averaged (grading consistency is the real risk — LLM scores drift).
- Adaptive diagnostic; a **concept graph** per subject so "weak on X" routes to the right next problems.
- Data export; auto-resume into the diagnostic after the OAuth redirect (currently the redirect resets state).

**Hardening / infra (deferred, documented):**
- **Durable rate limiter** (e.g. `@upstash/ratelimit`) + per-account limits to replace the in-memory one — do before monetizing / before heavy public traffic.
- **Server-side auth enforcement** on the API routes (today they're rate-limited + RLS-scoped, but not per-user authenticated).
- **Atomicity:** the score + attempt write is now one transaction via the `save_progress` RPC (resolving identity once, server-side) — fixed. Remaining: diagnostic grading is all-or-nothing (one failed grade discards the others) — known/low-severity.
- **Strict CSP**; CI lint enforcement (ESLint isn't configured yet); guest-localStorage-full signalling.

---

## 18. Further reading

- **`db/schema.sql`** — canonical database (tables, RLS, RPCs). Run this to provision.
- **`DEPLOYMENT_PLAN.md`** — full Vercel / Supabase / Google OAuth setup playbook (phased).
- **`AUTH_PROVIDERS.md`** — exact GitHub & Discord enablement steps.
- **`FEATURE_PLAN.md`** — the sign-in-menu / Profile / Learn feature plan + the decisions behind the guest-first flow.
- **`.env.example`** — documented env vars.
- **`git log`** (PRs #2–#15) — the full build history and rationale.
