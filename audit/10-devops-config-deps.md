> ⚠️ **STALE — SUPERSEDED.** The `npm audit` figures below are **out of date**. As of
> 2026-06-16 the live tree has **5 moderate, 0 high, 0 critical** (all from `postcss`
> bundled inside `next` → GHSA-qx2v-qp2m-jg93). The "1 critical (vitest)" and
> "2 high (vite/esbuild)" reported here were resolved by the Vitest 4 migration
> (commit `b031ef9`) and no longer exist. See **`audit/00-INDEPENDENT-AUDIT-2026-06.md`**
> (§ DevOps / dependencies) for the current, verified state. Kept for history only.

# DevOps / Config / Dependency / Secrets-Hygiene Audit — noobtopro

**Auditor stance:** Adversarial. Assume config wrong / deps vulnerable until proven otherwise.
**Date:** 2026-06-16
**Scope:** dependencies, build/runtime config (Vercel, Next, postcss/tailwind, jsconfig, .nvmrc, CI), secrets hygiene.
**Network:** available — `npm audit` and `npm ci --dry-run` were run live.

---

## 1. `npm audit` Summary (live run)

```
Total: 10 vulnerabilities
  critical: 1
  high:     2
  moderate: 7
  low:      0
  info:     0
prod deps: 42 | dev deps: 176 | optional: 108 | total: 253
```

**Worst offenders (named):**

| Package | Severity | Direct? | Tree | Advisory |
|---|---|---|---|---|
| **vitest** | **CRITICAL (CVSS 9.8)** | yes (dev) | `vitest <3.2.6` | GHSA-5xrq-8626-4rwp — Vitest UI server can read & execute arbitrary files |
| **vite** | **HIGH** | no (dev) | via vitest | GHSA-fx2h-pf6j-xcff (`server.fs.deny` bypass) + 2 moderate |
| **esbuild** | **HIGH (CVSS 8.1)** | no (dev) | via vite | GHSA-gv7w-rqvm-qjhr (RCE via NPM_CONFIG_REGISTRY) + GHSA-67mh-4wv8-2f99 |
| @vitest/mocker | moderate | no (dev) | via vite | — |
| vite-node | moderate | no (dev) | via vite | — |
| **postcss** | moderate (CVSS 6.1) | no | via next | GHSA-qx2v-qp2m-jg93 (XSS via unescaped `</style>`) |
| **next** | moderate | yes (prod) | `next` | pulls vulnerable postcss; effects @vercel/* + geist |
| @vercel/analytics | moderate | yes (prod) | via next | — |
| @vercel/speed-insights | moderate | yes (prod) | via next | — |
| geist | moderate | yes (prod) | via next | — |

**Critical context:** The single CRITICAL and both HIGHs live entirely in the **dev/test toolchain (vitest → vite → esbuild)**. None of them ship in the production Vercel bundle, and none are reachable by an end user in prod. They are still real: a contributor running `vitest --ui` or building in an untrusted/CI context is exposed to file-read/RCE. `npm audit fix --force` resolves all three via `vitest@4.1.9` (a **semver-major** bump — needs a test pass to adopt).

The remaining 7 moderates chain off `next`'s bundled `postcss`. The `next` advisory range (`9.3.4-canary.0 - 16.3.0-canary.5`) is enormous and the suggested "fix" is a downgrade to `next@9.3.3` — that's npm audit being dumb. The real fix is to track Next patch releases.

`npm outdated`:
```
@supabase/supabase-js  2.107.0 -> 2.108.2   (patch behind)
@tailwindcss/postcss   4.3.0   -> 4.3.1     (patch behind)
tailwindcss            4.3.0   -> 4.3.1      (patch behind)
next                   15.5.19 -> 16.2.9     (major behind; 15.5.19 is latest 15.x)
vitest                 2.1.9   -> 4.1.9      (two majors behind — the CVE fix)
```

---

## 2. Summary Table

| ID | Sev | Title |
|----|-----|-------|
| P0 | — | *(none — no committed secret, no client-exposed server secret, build is reproducible)* |
| P1-1 | High | Node engine mismatch: `engines.node >=24` / `.nvmrc 24` vs actual runtime (Node 22) — can fail install/build |
| P1-2 | High | CRITICAL+HIGH dev-dep vulns (vitest 9.8 / esbuild 8.1 / vite) unpatched |
| P2-1 | Med | `next@15.5.19` carries moderate postcss XSS advisory; 7 moderate vulns chain off it |
| P2-2 | Med | No Dependabot / Renovate — deps will silently rot post-launch |
| P2-3 | Med | `vercel.json` has no region pinning (near Supabase) or function memory tuning |
| P2-4 | Med | Loose `^` ranges on all deps incl. security-sensitive (next, supabase-js) |
| P2-5 | Med | All prod deps a patch/minor behind (supabase-js, tailwind) — not pinned/refreshed |
| P2-6 | Low/Med | No Dependabot for GitHub Actions; minor CI/config smells (notes only — Testing agent owns CI depth) |

**Verified GOOD (no finding):**
- **No committed secret.** Grep for `sk_/gsk_/polar_oat_/whsec_/eyJ.../-----BEGIN/AKIA/ghp_` across tracked files returned only SQL `service_role` grants, test fixtures (`sk-secret-123`, `whsec_test`), and docs — zero live secrets.
- **No `.env` ever committed.** `git ls-files` shows only `.env.example`; `git log --all --name-only` finds no `.env*` beyond the example.
- **`.gitignore` correctly covers env files** (`.env`, `.env*.local`) — `git check-ignore .env.local .env` confirms both are ignored. Also covers `*.pem`, `.vercel`, `.claude/`.
- **Server secrets are NOT client-exposed.** `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `POLAR_*` are all read without `NEXT_PUBLIC_` prefix; `lib/supabaseAdmin.js` / `lib/groq.js` / `lib/polar.js` are server-only with explicit warning comments. No `NEXT_PUBLIC_*SERVICE_ROLE*` / `NEXT_PUBLIC_*GROQ*` / `NEXT_PUBLIC_*WEBHOOK_SECRET*` anywhere.
- **LLM/grading routes already set `maxDuration`** — `/api/grade` 120s, `/api/score` 120s, `/api/generate` 90s. This is the thing that usually bites Vercel deploys; it's handled.
- **Build is reproducible.** Lockfile committed (`package-lock.json`, lockfileVersion 3), `npm ci --dry-run` succeeds and is in sync with `package.json`.
- **CI exists** (`.github/workflows/ci.yml`): runs `npm ci` + `npm test` + `npm run build` on PR/push, least-privilege `contents: read`, uses `.nvmrc`.
- **jsconfig alias `@/* -> ./*`** is consistent with the vitest alias (`@ -> root`). No mismatch.
- **postcss/tailwind v4 config is correct** — `postcss.config.mjs` uses the v4 `@tailwindcss/postcss` plugin (not the old `tailwindcss`+`autoprefixer` pair). Versions of `tailwindcss` and `@tailwindcss/postcss` match (both 4.3.0).
- **Next config**: no `images.remotePatterns`/domains (app uses no `next/image` remote sources — img CDNs are allow-listed only in CSP), no risky `experimental` flags, no `output` override, `poweredByHeader:false`. Clean.

---

## 3. Findings

### [P1-1] Node engine mismatch — `engines.node >=24` may break install/build
- **File(s):** `package.json:5-7` (`"node": ">=24"`); `.nvmrc:1` (`24`); `.github/workflows/ci.yml:33` (`node-version-file: .nvmrc`); actual audit runtime = **Node v22.22.2**.
- **Category:** Runtime / build config mismatch.
- **Description:** `package.json` hard-declares `engines.node: ">=24"` and `.nvmrc` pins `24`. CI reads `.nvmrc`, so CI will use 24 — but the binding constraint at deploy time is **Vercel's** Node version, which is set per-project in the Vercel dashboard (Settings → Node.js Version), NOT from `.nvmrc` (Vercel ignores `.nvmrc` for the build runtime; it reads `engines.node` to *choose the major* but only from its supported set). Two failure modes:
  1. If Vercel's project Node version is still on an earlier major (18/20/22), npm may emit `EBADENGINE` warnings, and with `engine-strict` it would hard-fail `npm install`/`npm ci`.
  2. Node 24 was only recently added to Vercel's supported runtimes; pinning `>=24` removes all headroom and ties the build to one major. If 24 is not selected in the Vercel project, the deploy build runs on a Node that violates the declared engine.
- **Impact:** Production build/deploy can fail or run on an unintended Node major; CI (Node 24) and prod can silently diverge. NEEDS VERIFICATION of the actual Node version configured in the Vercel project dashboard — the repo cannot prove it.
- **Recommended fix:** Confirm Vercel project Node version == 24 (or relax to `>=22 <25` if you want to allow 22). Make all three agree: `package.json engines`, `.nvmrc`, Vercel dashboard. Prefer pinning a concrete supported major rather than open-ended `>=24`. Add an `npm ci` engine check to CI to catch drift.

### [P1-2] CRITICAL + HIGH dev-toolchain vulnerabilities unpatched (vitest / vite / esbuild)
- **File(s):** `package.json:32` (`"vitest": "^2.1.9"`, installed 2.1.9); transitive `vite`, `esbuild`, `@vitest/mocker`, `vite-node`.
- **Category:** Dependency vulnerability.
- **Description:** `npm audit` reports **1 critical** (`vitest <3.2.6`, GHSA-5xrq-8626-4rwp, CVSS 9.8 — arbitrary file read+execute when the Vitest UI server is listening) and **2 high** (`esbuild` GHSA-gv7w-rqvm-qjhr RCE CVSS 8.1; `vite` GHSA-fx2h-pf6j-xcff fs.deny bypass), all in the test toolchain pulled by `vitest@2.1.9`. Installed `vitest` is two majors behind (2.1.9 vs 4.1.9).
- **Impact:** Not in the prod bundle and not reachable by end users, so it is NOT a launch blocker for the deployed app. But it IS a real risk to any developer/CI machine: opening `vitest --ui`, or building in a context where the dev server binds, exposes file-read/RCE. Leaving a CVSS-9.8 in the toolchain into launch is unacceptable hygiene.
- **Recommended fix:** Upgrade `vitest` to `^4.1.9` (resolves vitest, vite, esbuild, @vitest/mocker, vite-node in one go — it is the `fixAvailable` for all five). This is a **semver-major** jump: run the full suite after upgrading and adjust any v4 config/API changes. Do NOT run `npm audit fix --force` blindly on launch day; do the major bump deliberately on a branch and let CI's `npm test`+`npm run build` gate it. (Per mandate: not applying the upgrade here.)

### [P2-1] `next@15.5.19` carries the moderate postcss XSS advisory; 7 moderates chain off it
- **File(s):** `package.json:22` (`"next": "^15.1.0"`, installed 15.5.19); transitive `postcss <8.5.10`.
- **Category:** Dependency vulnerability (prod).
- **Description:** Next 15.5.19 bundles `postcss <8.5.10` (GHSA-qx2v-qp2m-jg93, XSS via unescaped `</style>` in stringify output, CVSS 6.1). This cascades to `@vercel/analytics`, `@vercel/speed-insights`, and `geist` in the audit graph. The audit's literal "fix" (downgrade `next@9.3.3`) is wrong; the real remedy is a Next patch that bundles patched postcss. 15.5.19 is the latest 15.x; the XSS is only exploitable if attacker-controlled CSS flows through postcss stringify — low practical reachability for this app's static CSS, but it's a prod dep.
- **Impact:** Moderate; low real exploitability given the app's CSS is author-controlled. Still a flagged moderate in a prod dependency at launch.
- **Recommended fix:** Track Next 15.x patch releases (and evaluate the 16.x major post-launch). Re-run `npm audit` after each Next bump; confirm the bundled postcss reaches `>=8.5.10`. Consider an `overrides` entry to force `postcss@^8.5.10` if Next lags.

### [P2-2] No Dependabot / Renovate — dependencies will silently rot
- **File(s):** absent — no `.github/dependabot.yml`, no `renovate.json`/`.renovaterc`.
- **Category:** Dependency maintenance / supply chain.
- **Description:** There is no automated dependency-update mechanism. The repo already carries a CVSS-9.8 toolchain vuln and several patch-behind prod deps, which is exactly what Dependabot/Renovate exists to surface. Post-launch, with no automation, new CVEs in next/supabase-js/polar-sdk go unnoticed until something breaks.
- **Impact:** Vulnerabilities and breaking-version drift accumulate unmonitored after launch.
- **Recommended fix:** Add `.github/dependabot.yml` with `package-ecosystem: npm` (weekly) **and** `github-actions` (the workflow pins `actions/checkout@v4` / `setup-node@v4` — those should be watched too). Optionally enable GitHub's "Dependabot security updates" + secret scanning + push protection in repo settings.

### [P2-3] `vercel.json` has no region pinning or function memory/runtime tuning
- **File(s):** `vercel.json:1-4` (only `$schema` + `framework: nextjs`).
- **Category:** Vercel deploy config.
- **Description:** `vercel.json` is minimal. `maxDuration` is correctly set per-route in code (good), but there is **no `regions` setting**. The serverless functions (and their Supabase round-trips on `/api/score`, `/api/leaderboard`, `/api/admin/*`, the Polar webhook) will run in Vercel's default region (`iad1`/`us-east-1` for Hobby, or the project default). If the Supabase project lives in a different region, every DB call eats cross-region latency — and the LLM grading path already does multiple sequential Groq + Supabase calls under a 120s budget. There is also no function-level memory configuration; defaults may be tight for the vision/grading path. NEEDS VERIFICATION of the Supabase project's region vs Vercel's default.
- **Impact:** Avoidable latency on every authenticated/DB-backed request; potential timeout pressure on the grading path; no memory headroom for the vision model path.
- **Recommended fix:** Pin `vercel.json`'s `regions` to the Vercel region co-located with Supabase (e.g. `["iad1"]` if Supabase is us-east). Consider `functions` memory config for the heavy `/api/grade` and `/api/generate` routes. Confirm the Supabase region first.

### [P2-4] Loose `^` version ranges on all deps, including security-sensitive ones
- **File(s):** `package.json:15-33` — every dependency uses `^` (e.g. `"next": "^15.1.0"`, `"@supabase/supabase-js": "^2.45.0"`, `"@polar-sh/sdk": "^0.48.1"`).
- **Category:** Version pinning / build reproducibility.
- **Description:** All ranges are caret. Reproducibility is currently protected by the committed lockfile + `npm ci` (good), so a fresh CI/Vercel build is deterministic. The risk is a future `npm install` (no lockfile) or an intentional lockfile regen silently pulling a new minor of `next`/`supabase-js`/`@polar-sh/sdk` (auth/payments-critical). `@polar-sh/sdk@^0.48.1` is especially loose — a `0.x` package treats minors as potentially breaking, yet `^0.48.1` allows `0.48.x` only... actually `^0.48.1` in npm allows `>=0.48.1 <0.49.0`, so it's narrower than it looks for 0.x, but still floats patch on the payments SDK.
- **Impact:** Lockfile drift on regen can introduce behavior/security changes in payment/auth-critical libs without an explicit decision.
- **Recommended fix:** Keep `npm ci` as the only install path in CI/Vercel (already true). When bumping, do it deliberately and let CI gate. Consider tighter ranges (`~`) on `next`, `@supabase/supabase-js`, `@polar-sh/sdk`. Never commit a lockfile produced by `npm install` on a dev box without re-running the suite.

### [P2-5] Prod deps a patch/minor behind — refresh before launch
- **File(s):** `package.json` — `@supabase/supabase-js` 2.107.0→2.108.2, `tailwindcss`/`@tailwindcss/postcss` 4.3.0→4.3.1.
- **Category:** Dependency freshness.
- **Description:** `npm outdated` shows the auth/DB SDK and Tailwind a patch behind. Minor, but these are the libs you want current at launch (supabase-js patches often touch auth/session handling).
- **Impact:** Missing recent bugfixes; trivial to close.
- **Recommended fix:** Bump `@supabase/supabase-js` to 2.108.2 and Tailwind to 4.3.1, run the suite, redeploy. Low risk, do before launch.

### [P2-6] CI / config smells (notes only — Testing agent owns CI depth)
- **File(s):** `.github/workflows/ci.yml`.
- **Category:** CI / DevOps hygiene.
- **Description:** CI is solid for build gating (npm ci + test + build, least-privilege, .nvmrc-driven). Gaps relevant to *this* domain: (a) **no `npm audit` step** in CI, so the CVSS-9.8 went unflagged by automation; (b) **no lint step** (no eslint config present in repo root — NEEDS VERIFICATION whether `next lint` is wired); (c) GitHub Actions are pinned to mutable major tags (`@v4`) rather than commit SHAs — supply-chain hardening would pin SHAs (and Dependabot for actions, see P2-2). Deeper CI/test-coverage analysis is the Testing agent's remit.
- **Impact:** Vulnerable deps and lint regressions can land without CI noticing.
- **Recommended fix:** Add a non-blocking `npm audit --audit-level=high` step (or a Dependabot-driven flow). Consider SHA-pinning actions. Defer test-suite depth to the Testing agent.

---

## 4. Bottom line

No P0. Secrets hygiene is genuinely clean (no committed secret, no client-exposed server key, `.gitignore` correct), the build is reproducible (`npm ci` green), and the usual Vercel footgun — LLM route timeouts — is already handled via per-route `maxDuration`. The launch-relevant risks are: the **Node `>=24` engine pin** (verify it matches the Vercel project, or the build can fail), the **CVSS-9.8 vitest toolchain vuln** (dev-only but must be patched), and the lack of **dependency automation + region pinning**. Fix P1-1 and P1-2 before flipping to production.
