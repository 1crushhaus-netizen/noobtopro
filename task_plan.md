# noobtopro — DevOps / Platform Task Plan

**Author:** DevOps & Platform Engineering review
**Date:** 2026-06-16
**Stance:** KISS / YAGNI. This stack is **100% managed PaaS** (Vercel + Supabase +
Polar + Groq) — there is **no self-managed compute**, so there is **no Terraform,
Kubernetes, or Docker layer to author**, and none is proposed. The IaC surface is
the repo config (`vercel.json`, `.github/`, `package.json`, `.nvmrc`) plus
provider dashboard settings.

---

## 1. Analysis — current state

**Already solid (left untouched):**
- `vercel.json` — region pinned `iad1` (co-located with Supabase `us-east-1`),
  per-route `memory: 1024` + `maxDuration: 120`. LLM-route timeout footgun handled.
- `ci.yml` — `npm ci` (cached), prod `npm audit` gate (high/critical), full audit
  advisory, content validators, coverage-gated tests (80/80/70/70), prod build with
  empty secrets. Least-privilege `contents: read`, `concurrency` cancel-in-progress,
  15 m timeout, `.nvmrc`-driven Node.
- `dependabot.yml` — npm (grouped) + github-actions, weekly.
- `instrumentation.js` — fail-fast boot guard for missing prod secrets.
- Secrets hygiene clean; security headers (CSP/HSTS/…) in `next.config.js`.

**Live checks (verified this pass):**
- ✅ Vercel project `noobtopro` (`prj_1wEB4Wr4xRGQJvgATCWb5H59Re4h`) is on
  **`nodeVersion: "24.x"`** — matches `.nvmrc` (24) and CI. Canonical domain
  `noobto.pro` live; latest production deploy READY.
- ⚠️ **Branch protection** could not be read — the scoped GitHub MCP exposes no
  protection-read tool. Must be verified manually (see §4).
- ⚠️ **Public GitHub API blocked (403)** by the environment network policy → action
  commit SHAs could not be fetched, so SHA-pinning is documented, not shipped (see §4).

---

## 2. Scope (approved)

- Scope: **Full incl. live checks** (P1 + P2 hardening + Vercel/GitHub verification).
- Node policy: **bound range only** (`engines.node` `>=24` → `24.x`; no `engine-strict`).

---

## 3. Changes in this pass

| # | Change | File(s) | Risk | Why |
|---|--------|---------|------|-----|
| 1 | `engines.node` `">=24"` → `"24.x"` | `package.json` | none | Bound to the major CI/.nvmrc/Vercel already run (verified `24.x`). No `engine-strict`, so Node-22 dev still works (warning only). |
| 2 | Pin payment/critical deps exact: `@polar-sh/sdk@0.48.1`, `mathjs@15.2.0` | `package.json`, `package-lock.json` | low | A `0.x` SDK treats minors as breaking; pin the money path + keep Dependabot for deliberate bumps. |
| 3 | ESLint flat config + `lint` script | `eslint.config.mjs`, `package.json` | low | First static-analysis gate. High-signal correctness rules **plus** a server-only-secret import boundary (blocks `lib/groq` / `lib/supabaseAdmin` / `lib/polar*` from `components/**`). |
| 4 | CI `lint` step | `.github/workflows/ci.yml` | low | Fails the build on lint **errors** (warnings advisory for now). |
| 5 | CodeQL SAST workflow | `.github/workflows/codeql.yml` | none | GitHub-native static security scan on PR/push + weekly. |

**Deliberately minimal lint:** `eslint` + `@eslint/js` + `globals` only — no
`eslint-config-next` (its `core-web-vitals` rules would flood a never-linted, mature
codebase with churn). The gate enforces correctness + the security import boundary;
`no-unused-vars` is advisory (`warn`) so the gate is green today and can be ratcheted
later.

---

## 4. Documented, NOT shipped (needs verification / owner action)

- **SHA-pin GitHub Actions** (`actions/checkout`, `actions/setup-node`,
  `github/codeql-action`). Standard supply-chain hardening, but the commit SHAs
  could not be verified here (API 403). Procedure when network allows:
  `gh api repos/actions/checkout/commits?sha=v6 --jq '.[0].sha'` → replace
  `@v6` with `@<sha> # v6`. Dependabot (github-actions) already updates SHA pins +
  the trailing comment. *Until then, the major tags + Dependabot are the mitigation.*
- **Branch protection on `main`** — confirm it **requires the `Test and build`
  status check** before merge (GitHub → Settings → Branches). Not in-repo; verify
  in the dashboard.
- **Secret scanning + push protection** — enable in repo Settings → Code security
  (GitHub-native; complements CodeQL).

---

## 5. Out of scope (YAGNI — explicitly not doing)

- Terraform / Pulumi / OpenTofu — no self-managed infra to model.
- Kubernetes / Docker / Compose — serverless on Vercel; nothing to orchestrate.
- `engine-strict` — rejected per Node policy (would break Node-22 dev/CI sandboxes).
- `eslint-config-next` / Prettier / full TypeScript migration — deferred to avoid
  large churn on a working, well-tested codebase.

---

## 6. Validation (all passed)

| Check | Command | Result |
|-------|---------|--------|
| ESLint config parses | `node --check eslint.config.mjs` | ✅ OK |
| Lint gate (errors) | `npm run lint` | ✅ exit 0 — **0 errors**, 23 advisory warnings |
| Found a real bug | `react-hooks/rules-of-hooks` | ✅ caught latent conditional-`useMemo` in `Dashboard.jsx`; **fixed** (hooks hoisted above early returns) |
| Unit suite | `npm test` | ✅ **871 passed (871)** / 52 files |
| Workflow YAML | `yaml.safe_load` ci/codeql/dependabot | ✅ all OK |
| Manifest JSON | parse package/vercel/lock | ✅ all OK |
| Lockfile ↔ manifest | `npm ci --dry-run` | ✅ in sync (CI's `npm ci` won't break) |
| Prod dep audit gate | `npm audit --omit=dev --audit-level=high` | ✅ PASS (0 high/critical) |
| Content validators | `npm run validate` | ✅ PASS |

> Constraint honored: sandbox runs Node 22 (project/prod = Node 24), so a faithful
> `npm run build` would run on the wrong major — build validation is deferred to
> CI/Vercel (both on 24, verified). Everything validatable here was validated.
> `terraform validate` / `kubectl --dry-run` are N/A (no IaC/K8s in this PaaS stack).
