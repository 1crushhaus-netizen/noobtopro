# noobtopro — Monetization Plan: the paid "Pro" tier (Polar.sh)

**Status: IMPLEMENTED (pending config + a sandbox verification pass).** The full Pro loop is
built: the entitlement foundation (the `subscriptions` table + `upsert_subscription` RPC in
`db/schema.sql` / migration `0017`, the `lib/entitlements.js` gate) PLUS the checkout route
(`app/api/checkout`), the signature-verified Polar webhook (`app/api/webhooks/polar` →
`lib/polarWebhook.js`), the customer portal (`app/api/portal`), the server-enforced gates
(free daily practice cap + Pro-only photo grading in `app/api/score` & `app/api/grade`), and
the UI (Landing `$9.99/mo` card, Dashboard Pro badge + Manage/Upgrade + the trends/history
gate, the 402 upgrade nudge). The `@polar-sh/sdk` is wired through `lib/polar.js`.

**It is INERT until configured.** Deny-by-default: the gates only bite when Pro is actually
sellable (`POLAR_ACCESS_TOKEN` + `POLAR_PRODUCT_ID_PRO` set), and the client only shows Pro UI
when `NEXT_PUBLIC_PRO_ENABLED=true`. So nothing a user sees changes until the owner flips those
on. **Decided pricing: $9.99/month, monthly-only, built against Polar SANDBOX first.**

### What's left to go live (owner / config — no more app code)
1. **Create the Pro product in Polar (sandbox)** → copy its id to `POLAR_PRODUCT_ID_PRO`.
   (A monthly `$9.99` recurring product. This is the one step that needs the Polar dashboard
   or the Polar MCP `polar_products_create`.)
2. **Set the env** in Vercel (Sensitive): `POLAR_ACCESS_TOKEN`, `POLAR_SERVER=sandbox`,
   `POLAR_PRODUCT_ID_PRO`, `POLAR_SUCCESS_URL=https://<domain>/?checkout=success`,
   `NEXT_PUBLIC_PRO_ENABLED=true`. (`SUPABASE_SERVICE_ROLE_KEY` is already required.)
3. **Create the webhook endpoint** in Polar → `https://<domain>/api/webhooks/polar`, subscribe
   the `subscription.*` events → put its signing secret in `POLAR_WEBHOOK_SECRET`.
4. **Apply migration `0017`** to Supabase (the `subscriptions` table + `upsert_subscription`).
5. **Verify the sandbox loop** (test card → webhook flips the row → gates open; cancel → close),
   then create the production product, set `POLAR_SERVER=production` + prod token/secret, redeploy.

The marketing for Pro was already live (`components/Landing.jsx`); this change turns that
promise into a working product.

---

## 1. Decisions (made with the owner)

| # | Decision | Choice |
|---|---|---|
| 1 | Payment provider | **Polar.sh** (Merchant of Record — handles tax/VAT) |
| 2 | What Pro unlocks in **v1** | **(a) Unlimited graded practice** (free is capped/day), **(b) Photo-of-work grading**, **(c) Progress trends + answer history** |
| 3 | Deferred from v1 | **Data export** (still marketed; gate it in a later pass) |
| 4 | Identity / entitlement store | Supabase `subscriptions` table, written ONLY by the Polar webhook (service-role), read by the server gate + SELECT-own by the client UI |
| 5 | Build order | Everything against Polar **sandbox** first; flip `POLAR_SERVER=production` only after the full loop verifies |
| 6 | Deny-by-default | No `POLAR_*` / no `SUPABASE_SERVICE_ROLE_KEY` ⇒ everyone is Free (nothing breaks) |

**Still owner's call:** the **price point** (e.g. `$X/month`), and whether to offer an annual plan.

---

## 2. ⚠️ The prerequisite: the free limit isn't real yet

The landing page advertises **"~5 graded practice problems / day"** for Free, but **nothing
enforces a daily cap today.** `lib/rateLimit.js` only does a per-minute *abuse* limiter
(30 req/min) — so free users currently have *unlimited* practice. Until the daily cap exists,
"Pro = unlimited practice" unlocks nothing. **Building the free daily cap is the real first
lever**, and `checkRateLimit` already supports per-account keys + custom windows, so it's a
small addition (a 24h window keyed `acct:<uid>:practice:day`, with Pro bypassing it).

---

## 3. What this change shipped (the foundation)

- **`db/migrations/0017_pro_subscriptions.sql`** + the same DDL appended to **`db/schema.sql`**
  (canonical): a `subscriptions` table (one row/user; the source of truth for "is Pro?")
  and a service-role-only `upsert_subscription` RPC for the webhook. RLS SELECT-own; all
  client writes revoked — same lock-down pattern as `scores`/`concept_mastery`.
  - `status` is **length-bounded free text, not a CHECK enum** — a future Polar status can't
    make the webhook upsert abort and silently drop an entitlement.
  - `delete_user_data` ("Reset my progress") deliberately **does not** touch `subscriptions` —
    wiping your scores doesn't cancel a paid subscription.
- **`lib/entitlements.js`** (server-only): `isActiveSubscription(row)` (the single "is Pro"
  decision — active status AND not past `current_period_end`), `isProUserId(id)`,
  `proStatusFromRequest(req)` (non-erroring branch helper for routes that *gate softly*), and
  `requireProUser(req)` (hard gate → 402 for Pro-only routes). Deny-by-default.
- **`.env.example`**: the documented `POLAR_*` block.
- **Tests**: `test/entitlements.test.js` (the gate logic) + new invariants in
  `test/schema-invariants.test.js` (RLS lock-down, service-role-only RPC, no-enum status,
  reset-keeps-Pro).

---

## 4. Remaining steps (the next changes)

Recommended order. Steps 4.1–4.3 are Polar-dashboard / config; 4.4+ are code.

### 4.1 Create the Pro product in Polar (sandbox)
`sandbox.polar.sh` → Products → New Product → "Pro", a **recurring** monthly price. Copy the
**Product ID** → `POLAR_PRODUCT_ID_PRO`.

### 4.2 Credentials
Organization Access Token → `POLAR_ACCESS_TOKEN`. (Webhook secret comes with 4.5.) Set
`POLAR_SERVER=sandbox`, `POLAR_SUCCESS_URL=https://<preview-domain>/?checkout=success`. Add to
Vercel (Sensitive). `SUPABASE_SERVICE_ROLE_KEY` must already be set (the webhook writes through it).

### 4.3 Install the SDK
`npm i @polar-sh/nextjs` (the official Next.js adapter: `Checkout`, `CustomerPortal`, `Webhooks`).

### 4.4 Checkout route — `app/api/checkout/route.js`
`Checkout({ accessToken, successUrl, server })`. Pass the **signed-in user's id** as the Polar
customer external-id / metadata so the webhook can map the purchase back to the account. Flip
the landing "Join the waitlist" button → "Upgrade to Pro" → this route.

### 4.5 Webhook — `app/api/webhooks/polar/route.js`
`Webhooks({ webhookSecret, onSubscriptionActive, onSubscriptionRevoked, onSubscriptionUpdated })`.
Resolve `user_id` from the event (customer external-id / metadata) and call the
`upsert_subscription` RPC via the service-role client. Create the endpoint in Polar pointing at
this URL → its signing secret → `POLAR_WEBHOOK_SECRET`. (Tunnel with ngrok for local testing.)

### 4.6 Enforce v1 gating
- **Free daily practice cap** (§2): in `/api/grade` (or `/api/generate`), `proStatusFromRequest(req)`
  → non-Pro callers get a 24h per-account practice cap; Pro bypasses it. Return a clear
  402/"limit reached" the UI can show as an upgrade nudge.
- **Photo-of-work grading**: `requireProUser` on the image-grading path (the `image` branch of
  `/api/grade`).
- **Progress trends + answer history**: gate the Dashboard trend charts + answer-review drawers
  behind Pro (`components/Dashboard.jsx`), reading the SELECT-own `subscriptions` row for the UI.

### 4.7 UI surfacing
Pro badge + "Manage subscription" (the Polar **Customer Portal** via a `CustomerPortal` route) in
the Profile/Dashboard; upgrade nudges at each gate.

### 4.8 Go live
Verify the full sandbox loop (test purchase → webhook → row flips → gate opens; cancel → revoke →
gate closes). Then create the production product, set `POLAR_SERVER=production` + production token/secret,
redeploy.

---

## 5. Verification

`npm test` + build → PR (CI gate) → merge → deploy. Then on the live URL: a signed-in non-Pro
user hits the daily cap; checkout completes in sandbox; the webhook flips the row; the gates open;
canceling closes them. The entitlement is **server-enforced** — the client gate is only UX
(every Pro-only route checks `requireProUser` / `proStatusFromRequest` server-side, exactly like
the admin and server-authoritative-scoring boundaries).
