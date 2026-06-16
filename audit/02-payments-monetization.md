# Audit 02 — Payments / Billing / Entitlements (noobtopro Pro tier, Polar.sh)

**Auditor stance:** adversarial. Assume billing is broken until proven otherwise.
**Scope:** checkout, customer portal, Polar webhook, entitlement read path, the
free-daily-practice cap, photo-grading gate, the dashboard trends/answer-history
gate, and the DB entitlement store + RLS.
**Date:** 2026-06-16. **Commit:** `263a546` (Pro tier landed in `45a1c3e`).

## Verdict

The core money path is meaningfully better than a typical first-pass: webhook
signatures are verified against `POLAR_WEBHOOK_SECRET` over the raw body, checkout
binds identity to the server-verified `auth.uid()` (never the client body), the
entitlement table is SELECT-own RLS with all writes funnelled through one
service-role RPC, and the two *cost-incurring* gates (free daily practice cap,
photo-of-work grading) are enforced **server-side**. Deny-by-default is correct
throughout (no Polar env / no service-role key ⇒ everyone Free).

But there are real holes. The single most important one: **a Pro entitlement is
granted on ANY active subscription in the Polar org — the Pro `product_id` is
stored but NEVER checked.** And one marketed Pro feature (progress trends + answer
history) is enforced **client-side only** — the data is freely readable by a
non-Pro user via PostgREST. There is also no webhook event-ordering / replay
guard, so a stale `active` event delivered after a cancel can resurrect access.

## Summary table

| Severity | Count |
|---|---|
| P0 (launch blocker) | 2 |
| P1 (high) | 4 |
| P2 (medium) | 6 |
| **Total** | **12** |

---

# P0 — Launch blockers

### [P0] Entitlement is granted on ANY product — the Pro `product_id` is never verified
- **File(s):** `lib/proStatus.js:28-38` (`isActiveSubscription`); `lib/entitlements.js:33-53` (`getSubscriptionRow`/`isProUserId`); `app/api/webhooks/polar/route.js:98-109` (upsert stores but does not gate on `productId`); `db/migrations/0017_pro_subscriptions.sql:69-109` (`upsert_subscription` writes `product_id` but nothing reads it back as a gate).
- **Category:** Wrong-product entitlement / granting Pro on the wrong product ID.
- **Description:** The "is this user Pro?" decision is made entirely by `isActiveSubscription`, which checks only `row.status ∈ {active,trialing}` and `current_period_end`. It does **not** check `row.product_id` against `POLAR_PRODUCT_ID_PRO`. The webhook fires for *every* `subscription.*` event in the org (see `SUBSCRIPTION_EVENT = /^subscription\./`) and upserts the row regardless of which product the subscription is for. So if the Polar org ever has more than one product — a cheaper tier, a one-off, an add-on, a future "Team" plan, a $0 / free product, a test product, or a discounted/coupon product — an active subscription to *any* of them flips the user to full Pro. There is no `proProductId()` comparison anywhere in the read or write path.
- **Impact:** A user can obtain the €9.99 Pro feature set by subscribing to *any other* (potentially cheaper or free) product the org offers, now or later. Today the org has one product, so the live blast radius is "latent" — but this is a one-checkout-link-away revenue bypass the moment a second product exists, and there is zero defense in code. For a money-critical launch this must be closed before any second product is created.
- **Recommended fix:** Add a `product_id` check to the entitlement decision. Either (a) in `isActiveSubscription`, require `row.product_id === proProductId()` (pass the expected id in, keeping the predicate pure/dependency-free), or (b) in the webhook, only upsert an *active* status when `sub.productId === proProductId()` and write a non-Pro status otherwise. Option (a) is safer because it fails closed on historical rows too. Add a test asserting an `active` row with a non-Pro `product_id` is NOT Pro.

### [P0] Progress trends + answer history (a marketed Pro feature) are gated CLIENT-SIDE ONLY
- **File(s):** `components/Dashboard.jsx:327` (`proLocked = proEnabled && !isPro`), `:489-506` (lock is just which button renders); `lib/store.js:158-189` (`loadReviews` reads `attempt_reviews` via SELECT-own RLS — no Pro check), `lib/store.js:233-272` (`loadHistory` reads `attempts` directly — no Pro check); `db/migrations/0017` / RLS on `attempt_reviews`/`attempts` is SELECT-own, not Pro-gated.
- **Category:** Missing server-side gate / client-only enforcement of a paid feature.
- **Description:** MONETIZATION_PLAN.md Decision #2(c) sells "Progress trends + answer history" as a Pro unlock, and PRO_GO_LIVE.md C3 lists "locked trends/answer-history drawers" as the Pro UI. But the enforcement is purely cosmetic: when `proLocked`, the Dashboard simply renders a lock-icon button that calls `onUpgrade` instead of `setDrawer(...)`. The underlying data is the user's OWN `attempts` / `attempt_reviews` rows, exposed to the authenticated user by SELECT-own RLS for legitimate reasons (the score engine, the leaderboard, etc.). `loadReviews()` and `loadHistory()` issue plain PostgREST reads with **no entitlement check** server-side. A non-Pro user can read their full answer history and reconstruct trends by: calling `loadReviews()`/`loadHistory()` from the console, querying PostgREST directly with their anon JWT, or flipping the React `isPro`/`proLocked` flag in devtools. The "drawer's data is never fetched" comment at `Dashboard.jsx:487` is true of the UI path only — it does nothing to stop a direct read.
- **Impact:** A core marketed Pro feature is obtainable for free by any signed-in user. Unlike the trends *charts* (which arguably are just a render of data the user already owns), the **answer-history/review detail** is real Pro content (full worked solutions, feedback, rubric per past attempt) handed out with no payment. Revenue leak on one of the three v1 Pro pillars.
- **Recommended fix:** Decide the product intent. If trends/history are genuinely Pro-gated, move the read behind a server route that calls `requireProUser(req)` (e.g. `/api/reviews`, `/api/history`) and tighten the RLS so the heavy review payload isn't directly SELECT-able by non-Pro users — or accept that "your own data" can't truly be withheld and reposition this as a UX-only convenience (not a paywall). At minimum, do not market it as a paid unlock while it is freely readable. NEEDS PRODUCT DECISION on whether withholding a user's own data is even tenable.

---

# P1 — High

### [P1] No webhook event-ordering / replay guard — a stale `active` event can resurrect access after cancel/revoke
- **File(s):** `app/api/webhooks/polar/route.js:81-109`; `db/migrations/0017_pro_subscriptions.sql:100-107` (upsert overwrites `status`/`current_period_end`/`cancel_at_period_end` unconditionally from `excluded`).
- **Category:** Subscription lifecycle hole / replay / out-of-order delivery.
- **Description:** Every `subscription.*` event overwrites the row wholesale (`status = excluded.status`, `current_period_end = excluded.current_period_end`, etc.) with no comparison against the currently-stored state, no event-id dedupe, and no event-timestamp ordering. Webhook delivery is at-least-once and **not** ordered. If Polar re-delivers an older `subscription.active` (or `subscription.updated` with an `active` status) *after* a `subscription.canceled`/`subscription.revoked`, the stale event flips the row back to `active`, re-granting Pro. The same is true for an attacker who can capture a single valid signed `active` delivery and replay the exact bytes+headers later (Standard Webhooks signatures are valid as long as the timestamp tolerance allows; there is no per-event-id idempotency table here). The belt-and-suspenders `current_period_end <= now` check in `isActiveSubscription` only saves you if the stale event's period end is already in the past — a stale event mid-period still re-grants until period end.
- **Impact:** Keep-access-after-cancel / replay-grants-access. A canceled user can regain Pro from a re-delivered or replayed older event; severity depends on Polar's redelivery behavior (NEEDS VERIFICATION of Polar's ordering/retry guarantees and its signature timestamp tolerance window).
- **Recommended fix:** Add monotonicity: store the event's own `modified_at`/`created_at` (or a per-subscription sequence) and have `upsert_subscription` apply the update only when the incoming event is newer than the stored `updated_at`/event time (`where excluded.event_time > s.event_time`). Optionally add a `processed_webhook_events(event_id)` dedupe table written in the same transaction to drop exact replays. At minimum, never let an older event downgrade a newer state.

### [P1] Customer/external-id is trusted from the event with no binding check, and the metadata fallback can map to an arbitrary uid
- **File(s):** `app/api/webhooks/polar/route.js:43-49` (`resolveUserId`), `:82-87`.
- **Category:** Trusting event-supplied identity for the entitlement write.
- **Description:** `resolveUserId` takes `sub.customer.externalId` first, then `sub.metadata.user_id`. Both are values that *Polar* relays back, originally set at checkout. The route never re-verifies that the resolved uid actually owns the Polar customer, nor that the subscription's product/customer was created by *this* app's checkout. The signature proves the event came from Polar, but Polar will faithfully relay whatever `metadata.user_id` / `externalCustomerId` was attached to a checkout. If checkouts can be created by other means in the org (Polar dashboard, another integration, a Polar-hosted product link that allows arbitrary metadata, or a future API call), an `active` event carrying `metadata.user_id = <victim uid>` would grant Pro to the victim's account — or, combined with the P0 product gap, grant Pro from an unrelated product. The checkout route binds `externalCustomerId` correctly for *its own* flow, but the webhook has no way to distinguish an app-originated subscription from any other.
- **Impact:** Entitlement can be written for an arbitrary uid if any subscription path other than this app's checkout can set metadata/external-id. Also a griefing vector (grant Pro to someone else's account to confuse support/billing). Severity is gated on whether non-app checkout paths exist in the org. NEEDS VERIFICATION.
- **Recommended fix:** Combine with the P0 product check (only honor the configured Pro product). Prefer `externalCustomerId` exclusively and stop honoring `metadata.user_id` as a grant source unless you also confirm the customer's external id matches. Consider validating the resolved uid exists in `auth.users` (the FK already enforces this on write — good — but a bogus uid then just 500s/CASCADEs harmlessly; still, log it).

### [P1] No authentication/CSRF guarantee that survives the `Sec-Fetch-Site` heuristic on checkout/portal — but they DO require a JWT (verify the guard can't be bypassed by a non-browser client to spend on someone else)
- **File(s):** `app/api/checkout/route.js:23-39`; `app/api/portal/route.js:22-37`; `lib/requestGuard.js:26-29` (`isCrossSiteRequest`).
- **Category:** Authz/abuse surface on the billing routes.
- **Description:** Both routes correctly require a verified JWT (`requireUser`) and bind to `auth.uid()`, so a caller can only ever start *their own* checkout/portal — that part is solid and prevents the "checkout for arbitrary user" class. The residual concern is abuse/cost: the same-origin defense is `Sec-Fetch-Site` only, which a non-browser client simply omits (`isCrossSiteRequest` returns false when the header is absent — "non-browser requests are allowed"). So the cross-site guard is bypassable by any direct client, leaving only the per-IP rate limit (`max: 12`) and the JWT as protection. Creating Polar checkout sessions and customer sessions is a Polar API call (cost/quota, and clutters the Polar org with sessions). With a valid JWT an authenticated user can mint up to 12 checkout/portal sessions per minute per IP.
- **Impact:** Bounded API-spend / Polar-quota abuse and session-spam by an authenticated user; not a direct money/entitlement bypass (identity is still verified). Lower than the other P1s, but it is the authz/abuse posture on the billing routes specifically called out in the mandate.
- **Recommended fix:** Accept this is mostly fine (JWT-bound), but consider a per-account (not per-IP) rate limit on `:checkout`/`:portal` (`acct:<uid>:checkout`) so a single account can't rotate IPs, mirroring the per-account caps already used on `/api/score`. Optionally short-circuit `/api/portal` to a 404 when the user has no local `subscriptions` row, avoiding a Polar round-trip per spam request.

### [P1] Free daily practice cap is consumed before the duplicate/dock checks, but is NOT refunded — and the window is a rolling fixed window that never truly "resets daily"
- **File(s):** `app/api/score/route.js:213-225` (cap charged here), `:332-340` (jti pre-dedupe AFTER the cap is already charged), `:565-572` (duplicate path returns without refunding the cap); `db/migrations/0003_durable_rate_limiter.sql:36-42` (window only resets on the *next hit after* `reset_at`).
- **Category:** Free-cap correctness / edge cases (direction: harms the free user, not the wallet — but it's a billing-fairness/UX correctness bug).
- **Description:** The `acct:<uid>:practice:day` counter is incremented at line 215 **before** the jti duplicate check (332) and before grading. So a network retry, a duplicate-delivered request, a docked non-attempt (blank/"idk"/gibberish — which costs no Groq), or a request that later errors all *consume* a free daily slot, and none of them is refunded (the global-Groq budget IS refunded on failure, but the daily-cap counter is not). Additionally, the durable window is a fixed window that only rolls when a request arrives *after* `reset_at`; combined with the 24h window this means the "daily" cap is really "5 per rolling 24h measured from first use," which can feel like a longer-than-a-day lockout to a user who front-loads their attempts. This is the *opposite* of a revenue leak (free users get fewer free uses than the "~5/day" the landing page promises), so it is a fairness/trust bug, not a bypass — but it can drive false "I paid and still got capped"-style support load and refund requests.
- **Impact:** Free users can be denied free practice they were promised (docks/retries burn the quota); potential refund/chargeback driver from frustrated converts. No money loss to the platform, but it undermines the conversion funnel and the "~5/day" marketing claim.
- **Recommended fix:** Charge the daily cap only on a *substantive, successfully-graded* attempt (after the dedupe + dock decision), or refund `acct:<uid>:practice:day` in the duplicate/dock/error paths the way the global Groq budget is refunded. Document that the cap is rolling-24h, or switch to a calendar-day key (`acct:<uid>:practice:YYYY-MM-DD`) if "resets at midnight" is the intended UX.

---

# P2 — Medium

### [P2] Webhook acknowledges (202) an unmapped subscription event and never reconciles it
- **File(s):** `app/api/webhooks/polar/route.js:82-87`.
- **Category:** Observability / dropped entitlement.
- **Description:** When `resolveUserId` returns null (no external id, no metadata uid) the route logs and returns 202, so Polar stops retrying. A legitimately-paid subscription whose mapping is missing (e.g. a checkout that didn't carry the uid, or a dashboard-created sub) is then silently un-entitled forever with only a console line. There is no dead-letter / alert.
- **Impact:** A paying customer can be left without Pro and the only trace is a log line. Support/chargeback risk.
- **Recommended fix:** Persist unmapped events to a table for manual reconciliation, and/or alert. Consider keying off the Polar customer email to attempt a best-effort match.

### [P2] No structured observability for payment failures (checkout 502 / webhook 403/500 / upsert errors)
- **File(s):** `app/api/checkout/route.js:72-79`; `app/api/portal/route.js:49-58`; `app/api/webhooks/polar/route.js:71,94,113`.
- **Category:** Observability of payment failures.
- **Description:** All failure paths `console.error` and return a generic message. There is no metric, alert, or audit row for "checkout failed," "webhook signature rejected," or "entitlement upsert failed." For a money path you want to *know* when these spike (a wrong secret after a redeploy 403s every event, a service-role outage 500s every event). The README's `security_events` table exists for abuse logging but billing failures aren't routed there.
- **Impact:** A silent billing outage (e.g. webhook secret mismatch) could persist unnoticed until users complain they paid and got nothing.
- **Recommended fix:** Emit a billing-specific event (to `security_events` or a dedicated table / monitoring) on webhook 403/500, checkout 502, and upsert errors; alert on rate.

### [P2] `successUrl` falls back to a request-derived origin — confirm the proxy can't spoof it into an off-domain redirect
- **File(s):** `lib/polar.js:59-64`; `app/api/checkout/route.js:49-66`.
- **Category:** Redirect correctness.
- **Description:** When `POLAR_SUCCESS_URL` is unset, the success URL is derived from `new URL(req.url).origin`. On Vercel behind the platform proxy `req.url` is server-derived (not body-supplied), so this is low risk, but if any deployment trusts an inbound `Host`/`X-Forwarded-Host` to construct `req.url`, the post-checkout redirect could be pointed at an attacker origin (carrying the success state). PRO_GO_LIVE.md mandates setting `POLAR_SUCCESS_URL` explicitly, which avoids this — but the fallback exists.
- **Impact:** Low; only a post-success redirect, and only if Host is attacker-controllable. Mitigated by always setting `POLAR_SUCCESS_URL`. NEEDS VERIFICATION of how `req.url` host is resolved on the target deploy.
- **Recommended fix:** Always require `POLAR_SUCCESS_URL` in production (fail closed if unset when Polar is live), or validate the derived origin against an allowlist.

### [P2] Entitlement read has no caching and no negative protection — every gated request is a fresh service-role round-trip
- **File(s):** `lib/entitlements.js:33-53` (`getSubscriptionRow`), called per-request from `app/api/score/route.js:192` and `app/api/grade/route.js:107`.
- **Category:** Cost/perf edge of the read path (and a subtle correctness note).
- **Description:** `isProUserId` does a DB read on every practice grade. This is correct (fresh = no stale-Pro), but it adds a service-role read to the hot path and, on a transient DB error, `getSubscriptionRow` returns null → treated as **not Pro** (deny-by-default). That means a DB blip can momentarily *cap a paying Pro user* (deny their unlimited practice / photo grading). Deny-by-default is the right call for "grant," but for an *existing paying customer* a transient error flipping them to Free mid-session is a trust hit.
- **Impact:** A Supabase hiccup can transiently downgrade a paying Pro user to the free cap / block their photo grading. No money loss; conversion/trust risk.
- **Recommended fix:** Distinguish "no row" (genuinely not Pro) from "query errored" (unknown) and, for the *known-paying* hot path, fail toward the last-known-Pro state with a short TTL cache rather than hard-denying on a transient error. Keep deny-by-default for the unknown/never-seen case.

### [P2] `cancel_at_period_end` is stored but the gate ignores it — fine today, but it's a silent dependency on Polar continuing to send `current_period_end`
- **File(s):** `lib/proStatus.js:28-38`; `db/migrations/0017_pro_subscriptions.sql:46-47`.
- **Category:** Lifecycle edge / code clarity.
- **Description:** The gate relies solely on `status` + `current_period_end`. A "canceled at period end" subscription stays `status=active` with a future `current_period_end`, so the user correctly keeps Pro until it lapses — but ONLY if Polar reliably populates `current_period_end` AND eventually sends a `revoked`/`canceled` event at period end. If Polar ever omits `current_period_end` on an `active` row (the predicate treats null as "open-ended Pro"), a canceled-but-not-yet-revoked sub with a null period end would be Pro forever until a revoke arrives. The `cancel_at_period_end` flag that would let you defend against this is stored but never read.
- **Impact:** Edge-case keep-access if a revoke event is missed and the period end is null. Belt-and-suspenders is incomplete.
- **Recommended fix:** Treat `cancel_at_period_end = true` with a null/absent `current_period_end` as suspicious (don't extend indefinitely), and/or add a periodic reconciliation job that re-pulls subscription state from Polar for rows last updated long ago.

### [P2] No idempotent guard against concurrent first checkout creating two Polar customers / duplicate subscriptions
- **File(s):** `app/api/checkout/route.js:57-67`.
- **Category:** Race / double-charge surface.
- **Description:** Two near-simultaneous checkout POSTs for the same uid (double-click, multi-tab) each call `polar.checkouts.create` independently. Polar's `externalCustomerId` should dedupe the *customer*, but nothing in this app prevents a user from completing *two* checkouts and ending up with two active subscriptions (and two charges). The webhook upsert is keyed on `user_id`, so the second subscription would simply overwrite the first's row — the app would show one Pro, but Polar would be billing two subscriptions. There's no app-side "you already have an active subscription, go to the portal" guard before starting checkout.
- **Impact:** Possible double-charge / duplicate active subscription → chargeback/refund and support load. Mitigation depends on Polar's own duplicate-subscription behavior for the same customer+product. NEEDS VERIFICATION of whether Polar blocks a second active subscription to the same product for one customer.
- **Recommended fix:** Before creating a checkout, check the user's local `subscriptions` row; if already `active`/`trialing`, route them to the portal instead of a new checkout. Make the upgrade button idempotent client-side (disable during the round-trip — `upgradeBusy` partly does this, but a fresh page/tab bypasses it).

---

## What is correctly handled (so it isn't re-litigated)

- **Signature verification:** every event is verified via Standard Webhooks over the **raw** body; no secret ⇒ 503 (deny-by-default, visible in Polar's delivery log); bad signature ⇒ 403. `app/api/webhooks/polar/route.js:51-73`, `lib/polarWebhook.js`.
- **Identity binding on checkout/portal:** identity is the **verified** `auth.uid()`, never the request body — closes "checkout/portal for an arbitrary user." `app/api/checkout/route.js:37-66`, `app/api/portal/route.js:35-45`.
- **Cost-incurring gates are server-side:** free daily cap and photo-of-work grading are enforced in `/api/score` and `/api/grade` server-side, only when Pro is sellable (`proIsAvailable`), with deny-by-default. `app/api/score/route.js:206-225,286-291`, `app/api/grade/route.js:106-114`.
- **Free cap is per-account + durable (Postgres), not localStorage/IP** — can't be reset by clearing localStorage or rotating IPs. `app/api/score/route.js:215`, `db/migrations/0003`.
- **Scoring replay/idempotency:** the question-token `jti` has a unique index and is deduped under an advisory lock in `save_progress_for` (status `duplicate`). `db/schema.sql:80-82,537-540`.
- **Entitlement store lockdown:** `subscriptions` is RLS SELECT-own, all writes revoked, only the service-role `upsert_subscription` RPC writes it (SECURITY DEFINER, pinned search_path, service-role grant only). A user cannot self-grant Pro via any client path. `db/migrations/0017`.
- **Reset keeps Pro:** `delete_user_data` does not touch `subscriptions` (a paying customer who wipes progress stays Pro). Verified by `test/schema-invariants.test.js:403-405`.
- **Status is free text, not an enum:** an unknown future Polar status can't abort the upsert and silently drop an entitlement; it simply reads as non-Pro.
- **Typo-safe server selection:** anything ≠ `"production"` ⇒ sandbox (`lib/polar.js:22-24`).

## Cross-cutting recommendations (priority order)

1. **Gate the entitlement on the Pro `product_id`** (P0 #1). One comparison, fully closes the wrong-product bypass.
2. **Decide and enforce trends/answer-history server-side or stop marketing it as Pro** (P0 #2).
3. **Add webhook monotonicity + event-id dedupe** (P1 #1) before live money.
4. **Combine product check with stricter identity resolution in the webhook** (P1 #2).
5. **Refund/relocate the free-cap charge** so docks/retries don't burn free quota (P1 #4).
6. Add **billing observability/alerts** and an **unmapped-event reconciliation** path (P2 #1, #2).
