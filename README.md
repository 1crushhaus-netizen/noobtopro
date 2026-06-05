# noobtopro

**Prove what you know. Climb from noob to pro.**

An assessment-first learning platform for math, physics, and chemistry. Instead of lessons-then-tests, noobtopro hands you problems, grades *how you reason* (not just the final answer) on a 0–100 scale per subject, and — when you're stuck — never hands over the solution. It nudges with a Socratic question and teaches only the concept you're missing.

What's in this repo:

- **Groq** powers question generation and reasoning-grading (server-side; the key never reaches the browser).
- A **Progress dashboard** charts points gained/lost, total points, and overall "PhD-level intelligence" over time.
- **Supabase** provides Google sign-in **and** durable, per-user storage. The app also runs as a guest (local storage) before Supabase is configured.

---

## Quickstart

**Prerequisites:** Node.js 18.18+ and a free Groq API key from <https://console.groq.com/keys>.

```bash
npm install
cp .env.example .env.local      # paste your GROQ_API_KEY
npm run dev                     # http://localhost:3000
```

This runs the full experience in **guest mode** (progress saved in your browser). To add Google sign-in and durable, cross-device storage, do the Supabase setup below and add the two `NEXT_PUBLIC_SUPABASE_*` values to `.env.local`.

> If `npm install` reports an unavailable version, run `npm install next@latest react@latest react-dom@latest @supabase/supabase-js@latest`.

---

## Architecture

```
Browser (components/)                Next.js server (app/api/)        Groq
  Noobtopro.jsx ───fetch──▶  /api/generate ──▶ lib/groq.js ──▶ api.groq.com
  ProgressDashboard.jsx      /api/grade    ──▶ lib/groq.js ──▶ (key from env)
  lib/store.js ──────────────┐
                             └───▶ Supabase (Postgres + Auth), RLS-scoped per user
                                   (falls back to localStorage for guests)
```

Two reasons the app has a backend:

1. **The Groq key must stay server-side.** If the browser called Groq directly, anyone could read the key. So the client posts to `/api/generate` and `/api/grade`, and only the server (reading `GROQ_API_KEY`) talks to Groq.
2. **User data needs an owner.** Supabase handles auth and storage. Reads/writes go straight from the browser to Supabase using the public anon key — which is safe because **row-level security** restricts every row to the signed-in user.

Key files:

| File | Purpose |
| --- | --- |
| `lib/groq.js` | Server-only Groq client + grading/generation prompts. |
| `app/api/{generate,grade}/route.js` | Groq-backed question generation and grading. |
| `lib/scoring.js` | Subjects, bands, score-blend, total points, PhD index. |
| `lib/supabase.js` | Browser Supabase client + Google sign-in/out. |
| `lib/store.js` | Data layer: Supabase when signed in, localStorage for guests. |
| `components/Noobtopro.jsx` | Diagnostic → scores → practice flow, nav, auth. |
| `components/ProgressDashboard.jsx` | Progress tab + charts. |

---

## Supabase setup (database + Google sign-in)

About 15 minutes. Google sign-in needs **your** Google OAuth credentials (only you can create those), which you paste into Supabase — no extra auth library required.

**1. Create a project** at <https://supabase.com> (free tier is fine).

**2. Create the tables** — open the project's **SQL Editor** and run:

```sql
create table scores (
  user_id uuid references auth.users on delete cascade,
  subject text check (subject in ('math','physics','chemistry')),
  score int not null default 0,
  weak_concepts text[] default '{}',
  comment text,
  updated_at timestamptz default now(),
  primary key (user_id, subject)
);

create table attempts (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  type text not null,                 -- 'baseline' | 'attempt'
  subject text,
  reasoning_score int,
  delta int,
  new_score int,
  total_after int,
  phd_after int
);

-- row-level security: each user can only touch their own rows
alter table scores   enable row level security;
alter table attempts enable row level security;
create policy "own scores"   on scores   for all using (auth.uid() = user_id);
create policy "own attempts" on attempts for all using (auth.uid() = user_id);
```

(The `using` clause is also enforced on insert, so a user can only write rows where `user_id = auth.uid()`. The app sets that automatically.)

**3. Enable Google** — in Supabase: **Authentication → Providers → Google**. It shows you a callback URL like `https://<project-ref>.supabase.co/auth/v1/callback`.

**4. Google Cloud Console** (<https://console.cloud.google.com>):
- Create a project → **OAuth consent screen** (External; add your email as a test user).
- **Credentials → Create credentials → OAuth client ID → Web application**.
- Authorized redirect URI: paste the Supabase callback URL from step 3.
- Copy the **Client ID** and **Client Secret** back into the Supabase Google provider form and save.

**5. Add a redirect URL for your app** — in Supabase **Authentication → URL Configuration**, add `http://localhost:3000` (and your production URL) to the allowed redirect/site URLs.

**6. Environment** — from Supabase **Settings → API**, copy into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

Restart `npm run dev`. The header button now reads **Sign in with Google**, and once signed in, scores and history persist to Supabase and follow you across devices.

> Guest (local) progress is not auto-migrated on first sign-in — a signed-in user starts from their own record.

---

## Groq notes

- **Default model:** `llama-3.3-70b-versatile` (production, strong reasoning). Override with `GROQ_MODEL`; `openai/gpt-oss-120b` is a stronger reasoning option.
- **JSON output:** requested via `response_format: { type: "json_object" }` with a robust-parse fallback.
- **Photo of work:** routed to a vision model (`GROQ_VISION_MODEL`, default Llama 4 Scout — preview tier), with graceful text-only fallback.
- **Rate limits / cost:** the free tier (~1K req/min on most models) is fine for prototyping. Model IDs rotate — check <https://console.groq.com/docs/models>.

---

## API rate limiting

`/api/generate` and `/api/grade` are guarded by a lightweight per-IP rate limiter (`lib/rateLimit.js`) — **30 requests/minute/IP**, returning `429` with a `Retry-After` header when exceeded. It blunts casual abuse and runaway loops that would otherwise burn the Groq quota.

It is intentionally a **best-effort stop-gap**: the counter is in-memory, so it's per–serverless-instance and resets on cold start, and IP keys can be rotated. Replace it with a durable, shared limiter (e.g. [`@upstash/ratelimit`](https://github.com/upstash/ratelimit) on Upstash Redis) and per-account limits once the product is monetized and abuse is worth defending against properly.

---

## How the Progress dashboard is computed

- **Total points** = sum of the three subject scores (0–300).
- **PhD-level intelligence** = mean of the three subject scores (0–100) — overall progress toward tri-subject mastery.
- **Points gained/lost** = per-attempt change in a subject score after grading.
- **Total points over time** = running total from your diagnostic baseline through every graded attempt.

These live in `lib/scoring.js` — change them there to weight subjects differently or redefine "PhD-level intelligence."

---

## Tests

Unit tests run on [Vitest](https://vitest.dev/):

```bash
npm test          # run once (CI uses this)
npm run test:watch
```

They cover the pure scoring logic (`lib/scoring.js`), the Groq client's JSON
parsing + graceful degradation (`lib/groq.js`), and both API routes' input
validation and model-output normalization (`app/api/*`) — including the
regressions hardened during review (score clamping, `band`/`blend` edge cases,
the image MIME allowlist, and free-text caps). API tests mock Groq's HTTP call,
so no key or network is needed.

CI (`.github/workflows/ci.yml`) runs `npm test` then `npm run build` on every
pull request. Enable branch protection on `main` and require the **Test and
build** check so nothing merges unless both pass.

---

## Deploy on Vercel

This app has a server side — the `/api/generate` and `/api/grade` route handlers that call Groq — so it needs a host that runs Node, not a static host like GitHub Pages. Vercel runs it as-is and keeps `GROQ_API_KEY` server-side.

1. **Import the repo** at <https://vercel.com> → *Add New… → Project*.
2. **Leave the Root Directory as the repo root** (the default). The Next.js app — its `package.json`, `app/`, `lib/`, etc. — lives at the root of the repository, so Vercel auto-detects the framework as **Next.js** with no Root Directory override. (If you previously deployed when the app was nested in a `noobtopro/` subfolder and set Root Directory to `noobtopro`, clear that setting back to the repo root, or the build will fail to find the app.)
3. **Add environment variables** (Project → Settings → Environment Variables), scoped to Production + Preview + Development — same names as [`.env.example`](./.env.example):
   - `GROQ_API_KEY` — required for the LLM features.
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — optional; enable Google sign-in + storage.
   - optional `GROQ_MODEL`, `GROQ_VISION_MODEL`.

   Env-var changes apply only to a **new** deployment — redeploy after editing them.
4. **Push to deploy.** Pushes to the production branch update production; every other branch/PR gets its own **preview URL**, which is ideal for testing fixes in isolation.

For Supabase + Google sign-in (including adding your Vercel URLs to Supabase's redirect allow list, with a `*.vercel.app` wildcard so preview deployments can sign in too), see the Supabase section above and [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) at the repo root.

---

## Push this to GitHub

Delivered as files (I can't push to your repo without your GitHub login, which I won't handle). From the unzipped folder:

```bash
cd noobtopro
git init && git add . && git commit -m "Initial commit: noobtopro full-stack scaffold (Groq + Supabase)"
git branch -M main
git remote add origin https://github.com/1crushhaus-netizen/noobtopro.git
git push -u origin main
```

The push prompts for your GitHub credentials (use a Personal Access Token or SSH key) — that's you authenticating, which is correct.

---

## Roadmap / known limitations

1. **Grading consistency is the real risk.** LLM scores drift attempt-to-attempt; production needs anchored rubric exemplars, multiple grading samples averaged, and difficulty-tagged questions.
2. **Adaptive diagnostic + a true score model (IRT)** so a 0–100 number is reliable, instead of one question per subject.
3. **A concept graph per subject** so "weak on X" routes to the right next problems.
4. **Local→account migration** so guest progress carries over on first sign-in.

---

## Appendix: why Supabase (and the alternatives considered)

The data is small and simple: three subject scores per user plus an append-only attempt log. The differentiators were how cleanly each option also handles Google sign-in, the free tier, and ops.

| Option | DB | Auth | Trade-off |
| --- | --- | --- | --- |
| **Supabase** (chosen) | Managed Postgres | Built-in (incl. Google) | One vendor; RLS has a small learning curve; free projects pause when idle. |
| Neon + Auth.js | Serverless Postgres | Auth.js (NextAuth) | You wire auth yourself and manage migrations. |
| Firebase | Firestore (NoSQL) | Firebase Auth | NoSQL is clunkier for time-series history and SQL-style aggregates. |
| Turso | SQLite at the edge | (separate) | Still need separate auth; smaller ecosystem. |

Supabase won because it collapses two of the three requirements (database + Google sign-in) into one Postgres service that maps cleanly to the history data.
