# Contributing

noobtopro is a private, proprietary project (see `LICENSE`). This guide covers
the day-to-day dev loop. For deeper reference see the README (§14 Build/CI, §15
How we work) and `DEPLOYMENT_PLAN.md`.

## Running the app

This project targets **Node 24.x** (`.nvmrc`; `package.json` `engines` pins
`>=24`). Use `nvm use` to match it.

```bash
npm ci          # install exact dependencies from package-lock.json
npm test        # run the test suite (vitest); no network or real keys needed
npm run dev     # start the dev server at http://localhost:3000
```

Copy `.env.example` to `.env.local` and fill in your values for local work.
`.env.local` is gitignored and must never be committed. Without Supabase/Groq
keys the app still runs in guest mode.

## Branch & PR conventions

1. **Branch off `main`** using a `feat/...` or `fix/...` name. Never commit
   straight to `main` — it is branch-protected.
2. **Implement and test locally**: `npm test` and `npm run build` must both be
   green before you open a PR.
3. **Open a PR.** Address every review comment, push the fix, then reply on each
   thread and resolve it.
4. **Squash-merge** once CI is green and all threads are resolved.

## CI must pass

Every PR (and push to `main`) runs the **"Test and build"** check in
`.github/workflows/ci.yml`: `npm ci` → `npm test` → `npm run build`. `main`
requires this check to pass, so a PR cannot merge until CI is green.

If your change touches the database, also include the corresponding numbered
migration in `db/migrations/` and verify it against the live project.
