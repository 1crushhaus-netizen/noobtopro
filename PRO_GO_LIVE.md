# Pro tier — go-live runbook (config only, no code)

Everything for the paid **Pro** tier is already built and merged-ready (see
`MONETIZATION_PLAN.md`). The code is **deny-by-default inert**: nothing a user sees changes
until you set the env below. This runbook takes it from "inert" → "selling Pro", **sandbox
first**, then production.

- **Price:** €9.99 / month (your Polar org's default presentment currency is EUR).
- **Production domain:** `https://noobto.pro`
- **Sandbox Pro product (already created):** id `213d56a6-fde8-4ad0-9167-91a5d2c8fb9b`

Do it in this order. Phases A–D get a **working sandbox** you can test with a fake card; Phase E
flips the same setup to real money.

---

## The env vars (one table to rule them all)

Set these in **Vercel → Project `noobtopro` → Settings → Environment Variables**. While testing,
scope them to **Production** (and **Preview** too if you want to test on a preview URL). Mark the
two secrets **Sensitive**.

| Variable | Sandbox value | Secret? | Notes |
|---|---|---|---|
| `POLAR_ACCESS_TOKEN` | *(sandbox org token, `polar_oat_…`)* | ✅ | Phase B1 |
| `POLAR_SERVER` | `sandbox` | – | Anything ≠ `production` ⇒ sandbox (typo-safe) |
| `POLAR_PRODUCT_ID_PRO` | `213d56a6-fde8-4ad0-9167-91a5d2c8fb9b` | – | Already created in sandbox |
| `POLAR_WEBHOOK_SECRET` | *(from the endpoint you create)* | ✅ | Phase B2 |
| `POLAR_SUCCESS_URL` | `https://noobto.pro/?checkout=success` | – | Absolute URL, **not** a path |
| `NEXT_PUBLIC_PRO_ENABLED` | `true` | – | **Build-time** → must **redeploy** to take effect |
| `FREE_DAILY_PRACTICE_CAP` | `5` *(optional)* | – | Free graded problems/day; Pro bypasses |
| `SUPABASE_SERVICE_ROLE_KEY` | *(already set)* | ✅ | The webhook writes entitlements through it |

> ⚠️ **`NEXT_PUBLIC_*` is inlined at build time.** Setting it is not enough — you must trigger a
> **redeploy** afterward (Phase C2) or the browser won't see `true`. The server-only `POLAR_*`
> vars are read at runtime, but Vercel still only exposes new env to a **new** deployment, so the
> single redeploy in Phase C2 covers everything.

---

## Phase A — Database (one-time)

> ⚠️ **Apply the WHOLE Pro-related migration set, not just `0017`.** A 2026-06 audit found that
> only `0017` had been applied to production while `0024` and `0025` had been merged into the
> repo but never pushed to the live DB — which (1) left the Pro "Progress trends" paywall
> bypassable (`attempts` was still client-readable via PostgREST) and (2) made the EU
> withdrawal/consent audit trail (`billing_audit`) silently no-op. **`db/schema.sql` is the
> source of truth and must match production.** Don't ship Pro until the live migration head
> equals the highest file in `db/migrations/`.

The Pro tier + its compliance backstops span **`0017` through `0025`**:

| Migration | What it provides | Required before… |
|---|---|---|
| `0017_pro_subscriptions.sql` | `subscriptions` table + service-role `upsert_subscription` RPC | any checkout |
| `0018_pro_gate_attempt_reviews.sql` | locks answer-history (`attempt_reviews`) to the Pro `/api/reviews` route | selling Pro |
| `0019_integrity_constraints.sql` | CHECK constraints + leaderboard/index backstops | selling Pro |
| `0020_webhook_event_ordering.sql` | webhook idempotency / out-of-order guard | selling Pro |
| `0021_verify_at_level.sql` | verified-badge at-level gate | selling Pro |
| `0022_security_data_retention.sql` | `prune_security_data` (90-day PII prune) | selling Pro |
| `0023_audit_round2_hardening.sql` | round-2 hardening | selling Pro |
| `0024_pro_gate_trends.sql` | **revokes client SELECT on `attempts`** → enforces the trends paywall at the DB | **selling Pro** |
| `0025_eu_withdrawal_audit.sql` | **`billing_audit`** — CRD Art. 16(a) consent + Art. 11a withdrawal records | **selling Pro (EU)** |

**A1.** Apply every migration newer than the live DB to your **production Supabase** project (the
same DB the live app uses — the webhook writes here regardless of sandbox vs production Polar):

- **Easiest:** Supabase dashboard → **SQL Editor** → paste the full contents of each
  `db/migrations/00NN_*.sql` not yet applied, in order → **Run**. (All are idempotent/safe to
  re-run.)
- **Or CLI:** `supabase db push` (if you track migrations with the CLI).
- **Or ask me** — I can apply them for you via the Supabase MCP (I'll confirm the project first).

> ⚠️ **Deploy order for `0024`:** ship the app code (the `/api/history` + `/api/trends` routes that
> read `attempts` via the service role) **before** applying `0024` — it's already shipped, so this
> is satisfied, but keep the ordering if you ever rebuild the environment.

**A2 — Release guard (verify the head matches the repo).** Before flipping `NEXT_PUBLIC_PRO_ENABLED`,
confirm production is fully migrated:

- SQL Editor → `select version, name from supabase_migrations.schema_migrations order by version desc limit 1;`
  — the latest **name** must correspond to the highest-numbered file in `db/migrations/`
  (currently `0025_eu_withdrawal_audit` → name `eu_withdrawal_audit`).
- Spot-check the two audit-flagged objects exist/are locked:
  - `select has_table_privilege('authenticated','public.attempts','select');` → **false** (0024 applied).
  - `select to_regclass('public.billing_audit') is not null;` → **true** (0025 applied).
- `select * from public.subscriptions limit 1;` should return an (empty) result, not an error (0017).

*(As of 2026-06-21 the live production DB is at `0025` — all of the above already pass. Re-verify
after any environment rebuild.)*

---

## Phase B — Polar **sandbox** (test environment)

Sandbox and production are **separate Polar orgs** with separate tokens, products, and webhook
secrets. Everything in this phase happens at **https://sandbox.polar.sh**.

**B1 — Organization Access Token →** `POLAR_ACCESS_TOKEN`
1. `sandbox.polar.sh` → your org → **Settings → Developers** (Access Tokens).
2. **New Token**, scope it to your org, copy the `polar_oat_…` value (shown once).
3. You'll paste it into Vercel in Phase C.

> The **product is already created** in sandbox (`POLAR_PRODUCT_ID_PRO` above) — skip product
> creation here. If you ever need to recreate it: Products → New → "Pro", **recurring monthly**,
> €9.99.

**B2 — Webhook endpoint →** `POLAR_WEBHOOK_SECRET`
1. `sandbox.polar.sh` → **Settings → Webhooks → Add Endpoint**.
2. **URL:** `https://noobto.pro/api/webhooks/polar`
3. **Format:** **Raw** (the standard event payload — *not* Slack/Discord).
4. **Events:** enable **all `subscription.*` events** (created, active, updated, canceled,
   uncanceled, revoked). The handler treats any `subscription.*` uniformly and ignores the rest.
5. Save, then copy the endpoint's **Signing Secret** → that's `POLAR_WEBHOOK_SECRET`.
   - *Want me to create this endpoint for you via the Polar MCP and hand back the secret? Just ask.*

---

## Phase C — Vercel env + redeploy

**C1.** Add every row from the env table above to the Vercel project (Production scope; mark
`POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET` **Sensitive**). Confirm `SUPABASE_SERVICE_ROLE_KEY`
is already present.

**C2.** **Redeploy production** so `NEXT_PUBLIC_PRO_ENABLED=true` is baked in and the new server
env is live: Vercel → **Deployments** → latest production deploy → **⋯ → Redeploy**.

**C3.** Smoke-check (no purchase yet): open `https://noobto.pro`, sign in, and confirm the **Pro
UI now appears** — the €9.99 card on the landing page, the "Upgrade to Pro" CTA, and the locked
trends/answer-history drawers on the dashboard. If you *don't* see them, `NEXT_PUBLIC_PRO_ENABLED`
didn't get baked in → re-check C2.

---

## Phase D — Verify the full loop (sandbox, fake card)

This proves purchase → webhook → entitlement → gate end-to-end **before** any real money.

1. **Sign in** at `https://noobto.pro` (Google).
2. **(optional) Confirm the free cap bites:** do `FREE_DAILY_PRACTICE_CAP` (5) graded practice
   problems; the next one should return a **402** and the app shows the **upgrade nudge** modal.
3. Click **Upgrade to Pro** → you land on the Polar **sandbox checkout**.
4. Pay with a **Stripe test card**: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
5. Checkout completes → Polar redirects back to `https://noobto.pro/?checkout=success` → the app
   shows the success banner.
6. **Within a few seconds the webhook fires** and flips your `subscriptions` row to `active`.
   Confirm any one of:
   - the **Pro badge** appears and the trends/answer-history drawers **unlock**;
   - Supabase → `select status, current_period_end from public.subscriptions;` shows `active`;
   - Polar → Webhooks → your endpoint → **Deliveries** shows `200`s for the `subscription.*` events.
7. **Manage / cancel:** click **Manage subscription** → opens the Polar **customer portal** →
   cancel. A `subscription.canceled`/`revoked` event flips the row, and Pro access closes at (or
   immediately on revoke) `current_period_end`.

If all of that works, the system is correct — only the *environment* changes for go-live.

---

## Phase E — Flip to production (real money)

Repeat B–C against the **production** Polar org at **https://polar.sh** (a *different* org, so
nothing here carries over from sandbox):

1. **Create the production Pro product:** `polar.sh` → Products → New → "Pro", recurring monthly,
   €9.99 → copy its **new** product id.
2. **Production org access token** (`polar.sh` → Settings → Developers).
3. **Production webhook endpoint** → `https://noobto.pro/api/webhooks/polar`, Raw, all
   `subscription.*` → copy its **new** signing secret.
4. In Vercel, **update** these to the production values and redeploy (C2):
   - `POLAR_SERVER` → **`production`**
   - `POLAR_ACCESS_TOKEN` → production token
   - `POLAR_PRODUCT_ID_PRO` → **production** product id (the sandbox id won't work in production)
   - `POLAR_WEBHOOK_SECRET` → production webhook secret
   - `POLAR_SUCCESS_URL`, `NEXT_PUBLIC_PRO_ENABLED` stay the same.
5. Do **one real low-risk purchase** (you can refund yourself in Polar) to confirm the live loop,
   then you're selling. Polar is Merchant-of-Record, so it handles VAT/tax + invoices for you.

---

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| No Pro UI at all (no €9.99 card / upgrade CTA) | `NEXT_PUBLIC_PRO_ENABLED` not `true` **or** not redeployed since setting it → set it + **redeploy** (C2). |
| Upgrade button → **503** "Checkout is not available" | `POLAR_ACCESS_TOKEN` or `POLAR_PRODUCT_ID_PRO` missing/empty → set both, redeploy. |
| Checkout → **502** "Could not start checkout" | Token belongs to the **wrong** Polar org (sandbox token while `POLAR_SERVER=production`, or vice-versa), or product id from the other org. Match token + product + `POLAR_SERVER`. |
| Paid, but Pro never unlocks | Webhook not delivering. Polar → Webhooks → **Deliveries**: `403` = wrong `POLAR_WEBHOOK_SECRET`; `503` = secret unset; `500` = `SUPABASE_SERVICE_ROLE_KEY` missing or migration `0017` not applied; `202 unmapped` = checkout didn't carry the uid (don't hand-craft test events — buy through the app so `externalCustomerId` is set). |
| **Manage subscription** → **404** "No subscription to manage" | That account has no Polar customer yet (never purchased). Expected for non-subscribers. |
| Free users getting capped on a deploy with no Pro | Can't happen — the cap only bites when Pro is *sellable* (`POLAR_ACCESS_TOKEN` + `POLAR_PRODUCT_ID_PRO` both set). Unset them to disable. |

---

## How it's wired (for reference)

- **`lib/polar.js`** — one configured Polar client; `proIsAvailable()` = token **and** product set.
- **`app/api/checkout`** — auth'd POST; binds the checkout to the **verified** `auth.uid()`
  (`externalCustomerId`), never the request body. Returns `{ url }`.
- **`app/api/webhooks/polar`** — **signature-verified** (`POLAR_WEBHOOK_SECRET`); resolves the
  user from the event and writes via the service-role `upsert_subscription` RPC. Stores the **raw**
  status; "is Pro" is decided in one place.
- **`lib/proStatus.js`** — `PRO_STATUSES = {active, trialing}` **and** not past
  `current_period_end`. A missed revoke can't extend access past the paid period.
- **`app/api/portal`** — auth'd POST → Polar customer-portal URL for the verified uid.
- **Gates:** free daily practice cap + Pro-only photo grading in `app/api/score` & `app/api/grade`;
  trends + answer-history in the dashboard.
