# noobtopro — Deployment & Integration Plan

**Goal:** get a live, testable URL of the web app where the LLM features actually work, plus Google sign-in and a real database — so you can hammer on it while Claude Code + Greptile keep fixing bugs.

**Chosen approach:** deploy to **Vercel** (you selected this). It hosts the existing Next.js app *as-is* — the two Groq routes run as real serverless functions, your Groq key stays server-side and secret, and every branch/push gets its own preview URL. That's a better fit for a bug-fixing cycle than GitHub Pages, which can't run this app's backend at all.

> **Status: COMPLETE — deployed and live.** This was the original deployment plan; all phases below were executed and the app is live in production (see README §2 for the live URLs). It is retained as a **historical record of how the deployment was done** — the future/"tell me to proceed" tense throughout reflects its origin as a pre-deploy plan. For current state, the README is the source of truth.

---

## 1. How to use this plan

The work splits in two:

- **You do** the account/dashboard steps (Vercel, Groq, Supabase, Google) — they require *your* logins, and that's correct: the secrets should only ever touch your accounts.
- **I do** all the code/repo edits (§11), give you exact click-by-click steps for each dashboard, and verify the result after each phase.

**Secrets policy:** I will never ask you to paste a secret key into this chat. Every key goes directly into a provider's dashboard (Vercel / Supabase / Google). The one value that's *meant* to be public — the Supabase **anon** key — is safe because Row-Level Security locks every row to its owner.

**Optional:** I can drive the *navigation* parts of the dashboards in your browser via Claude-in-Chrome, but you'll likely want to handle the actual secret-entry fields yourself. Your call.

---

## 2. What you'll have at the end

- A **stable production URL** (e.g. `https://noobtopro.vercel.app`) plus a **fresh preview URL on every push** — so you can test each bug-fix branch in isolation.
- **Working LLM features** — diagnostic generation, reasoning-grading, Socratic hints, and photo-of-work grading — with the Groq key held server-side.
- **Sign in with Google**, backed by Supabase.
- **Durable per-user storage** (scores + attempt history) that follows a user across devices, with guest/localStorage mode still working before sign-in.

---

## 3. Key facts about your repo (read this — one real gotcha)

- **The app now lives at the repo root.** It used to be nested in a `noobtopro/` subfolder, which required overriding Vercel's "Root Directory" — a common first-deploy tripwire. The project has since been flattened, so the Next.js app (`package.json`, `app/`, `lib/`, …) sits at the root of `1crushhaus-netizen/noobtopro`. **Leave Vercel's "Root Directory" at the default (repo root).** If an earlier Vercel project was configured with Root Directory = `noobtopro`, clear it back to the root.
- **Current branch:** `chore/vercel-deploy-prep` (the flatten + audit-hardening work). Deploy it as a preview first, then point "production" at `main` once it merges.
- **What already works in code** (verified): the Groq routes (`/api/generate`, `/api/grade`), the Supabase data layer with localStorage fallback, and the Google sign-in wiring (`onAuthStateChange` reloads data after redirect). So this is **mostly configuration, not rebuilding.**
- **Why not GitHub Pages:** both Groq routes are declared `dynamic = "force-dynamic"` — they must run on a server. GitHub Pages serves static files only, so it physically cannot run them; the LLM features would be dead on Pages unless we re-architected. Vercel avoids all of that.

---

## 4. Accounts & keys you'll need (all free)

| Service | What it's for | Cost | Sign-in shortcut |
| --- | --- | --- | --- |
| **Vercel** | Hosting + serverless API routes | Free (Hobby) | "Continue with GitHub" |
| **Groq** | LLM (question gen + grading) | Free tier, no card | console.groq.com |
| **Supabase** | Postgres DB + auth | Free tier | supabase.com |
| **Google Cloud** | OAuth credentials for "Sign in with Google" | Free | console.cloud.google.com |

---

## 5. Phase 1 — Deploy to Vercel (get a live URL first, in guest mode)

Goal: a working URL before any keys, to confirm the build + hosting are solid. The app runs in guest mode (localStorage) with LLM features showing a friendly error until Phase 2.

1. Go to **vercel.com** → **Add New… → Project** → **Continue with GitHub** → import `1crushhaus-netizen/noobtopro`.
2. **Leave Root Directory at the repo root** (the default — see §3; the app is no longer nested). Framework should auto-detect as **Next.js**.
3. Pick the branch to deploy (see §13). Click **Deploy**.
4. You get a URL. Open it — the app should load and run in guest mode.

*What I do:* nothing required here, but I'll add a `.env.example` and a one-line Node version pin first (§11) so the build is reproducible.

---

## 6. Phase 2 — Add Groq (turn the LLM features on)

1. **Get a key:** console.groq.com → **API Keys → Create**. Copy it once (you won't see it again).
2. **Vercel → your project → Settings → Environment Variables.** Add:
   - `GROQ_API_KEY` = *(paste your key)* — scope it to **Production, Preview, and Development**.
   - *(optional)* `GROQ_MODEL` to override the default `llama-3.3-70b-versatile`, or `GROQ_VISION_MODEL` for photo grading (default `meta-llama/llama-4-scout-17b-16e-instruct`). Both defaults are current as of June 2026; leave unset unless you want to experiment.
3. **Redeploy** (env-var changes only take effect on a new deployment). In Vercel: Deployments → ⋯ → Redeploy.
4. Test: run the diagnostic on the live site — three questions should generate, and a written answer should get graded.

*Heads-up on the free tier:* ~30 requests/min, **6,000 tokens/min**, 14,400/day. The 70B grader with a long answer can brush the per-minute *token* cap during rapid testing → occasional `429`s. That's expected; wait a few seconds, or add Groq billing for higher limits if it gets annoying.

---

## 7. Phase 3 — Supabase database (durable storage)

> **✅ DONE — provisioned via the Supabase connector.** A free-tier project
> **`noobtopro`** (ref `vwvhgnlgubctrgksyohr`, region `us-east-1`) was created and
> the schema below was applied as a migration (`init_scores_and_attempts`), with
> RLS enabled and the security advisor reporting no lints. The remaining step is
> to add the two `NEXT_PUBLIC_SUPABASE_*` env vars in Vercel (values below) and
> enable an auth provider (Phase 4) so users can sign in and persist data.
>
> - **Project URL:** `https://vwvhgnlgubctrgksyohr.supabase.co`
> - **anon key:** in `.env.local` (gitignored) and in the chat hand-off — it's a
>   public, RLS-protected value. Paste both into Vercel → Settings → Environment
>   Variables (Production + Preview + Development), then redeploy.

The full applied schema — **tables, RLS, and all RPCs** — lives in
[`db/schema.sql`](./db/schema.sql), which is the source of truth for reproducing
the database. Core RPCs include `migrate_guest_data`, `delete_user_data` (called by
`lib/store.js`), `save_progress_for` (**service-role only**, called by `/api/score`
for server-authoritative scoring — the old client-callable `save_progress` is dropped),
and `try_add_diagnostic`, plus the concept-hub functions. `scores`/`attempts` are
**SELECT-only under RLS** (writes go through the SECURITY DEFINER functions). The two
core tables (for quick reference — see `db/schema.sql` for the rest):

```sql
create table scores (
  user_id uuid references auth.users on delete cascade,
  subject text check (subject in ('math','physics','chemistry')),
  score int not null default 0,
  weak_concepts text[] default '{}',
  comment text,
  rubric jsonb,                 -- per-subject reasoning radar profile (server-computed)
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

alter table scores   enable row level security;
alter table attempts enable row level security;
create policy "own scores"   on scores   for all using (auth.uid() = user_id);
create policy "own attempts" on attempts for all using (auth.uid() = user_id);
```

3. **Settings → API** → copy the **Project URL** and **anon public** key.
4. **Vercel → Settings → Environment Variables** (Production + Preview + Development):
   - `NEXT_PUBLIC_SUPABASE_URL` = *(project URL)*
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *(anon key — safe to expose; RLS protects the data)*
5. **Redeploy.** The header button now reads **Sign in with Google** (it appears once Supabase env vars are present), though sign-in itself needs Phase 4.

*Note:* free Supabase projects **pause after ~7 days of no database activity** — a click in the dashboard or any query wakes them. Fine for testing.

---

## 8. Phase 4 — Sign in with Google

This is the most multi-step part because Google's OAuth and Supabase have to point at each other. Order matters.

**A. Supabase → Authentication → Providers → Google → Enable.** It shows a **callback URL** like `https://<project-ref>.supabase.co/auth/v1/callback`. Copy it.

**B. Google Cloud Console** (console.cloud.google.com):
1. Create/select a project.
2. **OAuth consent screen** → External → fill app name + your email → add **your email as a Test user** (keeps it in testing mode, no Google verification needed for you to log in).
3. **Credentials → Create credentials → OAuth client ID → Web application.**
4. Under **Authorized redirect URIs**, paste the **Supabase callback URL** from step A. *(This URL is stable — it does not change per Vercel deploy, so you only set it once.)*
5. Copy the **Client ID** and **Client Secret**.

**C. Back in Supabase → Google provider:** paste **Client ID** + **Client Secret** → Save.

**D. Supabase → Authentication → URL Configuration** (this is the part most people miss):
- **Site URL:** your stable production URL (e.g. `https://noobtopro.vercel.app`).
- **Redirect URLs (allow list):** add both —
  - `https://noobtopro.vercel.app/**` (production)
  - `https://noobtopro-*.vercel.app/**` (wildcard so **preview deployments** can sign in too — each push gets a unique URL)
  - `http://localhost:3000/**` (so local `npm run dev` works)

The app calls `signInWithOAuth` with `redirectTo: window.location.origin`, so it returns the user to whatever URL they're on — which is why the wildcard for previews matters.

**E. Test:** click **Sign in with Google** on the live site → Google consent → you land back signed in, and your scores/history now persist to Supabase.

> Guest progress **is** migrated into the account on first sign-in (atomic `migrate_guest_data` RPC; see `db/schema.sql`), so a guest who completes the diagnostic and then signs in keeps their results.

---

## 9. Phase 5 — End-to-end verification

I'll walk this checklist with you on the live URL and confirm each:

- [ ] App loads on the production URL (guest mode).
- [ ] Diagnostic generates 3 questions (Groq text model).
- [ ] A typed answer gets graded with score + Socratic hint + micro-lesson.
- [ ] A **photo of work** gets graded (Groq vision model) — or falls back to text-only gracefully.
- [ ] Sign in with Google succeeds and the header shows your email.
- [ ] Scores/attempts persist after refresh **and** appear in the Supabase table editor.
- [ ] Signing out returns to guest mode without errors.
- [ ] A preview deployment (push a trivial commit) gets its own URL and can also sign in.

---

## 10. Costs & limits to expect

- **Vercel Hobby:** free; fine for testing. (Don't put it behind paid features you don't need.)
- **Groq free tier:** 30 req/min, 6K tokens/min, 14,400/day, no card. Expect occasional `429` under rapid testing; back off a few seconds.
- **Supabase free:** 500 MB DB, 50K monthly active users, pauses after ~7 days idle (wakes on use).
- **Google OAuth:** free; staying in "testing" mode is fine as long as you add each tester's email.

---

## 11. Code / repo changes I'll make (small, before deploy)

These are minor and safe; I'll do them on a branch and show you the diff before anything is committed/pushed:

1. **Add `.env.example`** — ✅ done. Documents every variable (`GROQ_API_KEY`, optional `GROQ_MODEL` / `GROQ_VISION_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) with no real secrets.
2. **Pin the Node version** — ✅ done. `package.json` declares `"engines": { "node": ">=24" }` and a `.nvmrc` (Node 24) is present so Vercel and local builds match. Target Node 24.x — do not build on Node 20, which the engines pin rejects.
3. **Flatten the app to the repo root** — ✅ done. Removed the nested `noobtopro/` subfolder so Vercel needs no Root Directory override (§3).
4. **A short "Deploy on Vercel" section in the README**, replacing the GitHub-push-only instructions, so the repo documents the real workflow.
5. **(Only if you want it later)** local→account progress migration on first sign-in, and per-preview redirect handling if you adopt a custom domain.

I will **not** push to your GitHub without you — I'll prepare commits and you push (or approve me to, with your auth). No code change is required for sign-in to work; it's already wired.

---

## 12. Risks & gotchas (so nothing surprises you)

- **Root directory** — the app is now at the repo root, so leave Vercel's Root Directory at the default (§3). If a prior project pinned it to `noobtopro`, clear it, or the build won't find the app.
- **Env changes need a redeploy** — keys added in Vercel don't apply to the *current* deployment; redeploy after each change.
- **Preview-URL sign-in** — without the `noobtopro-*.vercel.app/**` wildcard in Supabase, sign-in works in production but fails on preview URLs.
- **Groq model drift** — Groq rotates model IDs; the two defaults are valid today, but if a call starts 400'ing, the model ID is the first suspect (override via env, no code change).
- **Guest data is migrated** into the account on first sign-in (atomic `migrate_guest_data` RPC).

---

## 13. Your call before I start

Tell me your preferences on these and I'll finalize:

1. **Production branch:** point production at `main` (recommended) and test `chore/vercel-deploy-prep` as a preview — or make `chore/vercel-deploy-prep` production for now?
2. **Custom domain** (e.g. `noobtopro.com`) now, or stick with the free `*.vercel.app` URL for testing?
3. **Groq model:** keep the `llama-3.3-70b-versatile` default, or start on the stronger `openai/gpt-oss-120b`?
4. **Vision/photo grading:** keep it on, or disable for now to conserve the free-tier token budget?
5. **Guest→account migration:** want it included now, or defer?
6. **Dashboard steps:** you drive them with my step-by-step guidance (default), or want me to navigate the non-secret parts via Claude-in-Chrome?

---

### Execution order once approved
Phase 1 (deploy) → 2 (Groq) → 3 (Supabase) → 4 (Google) → 5 (verify). I'll do the §11 code changes first, then guide + verify each phase with you.
