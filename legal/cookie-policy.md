# Cookie & Tracking Technologies Policy + Consent-Banner Spec — noobtopro

> **DRAFT for counsel — not legal advice.** Published at `/cookies`. Reconciled to the live page
> and the shipped `ConsentManager`.
>
> **Key finding (load-bearing):** under ePrivacy Art. 5(3) + EDPB Guidelines 2/2023, the legal
> trigger is *storing/accessing info on the device* — **regardless of the word "cookie" or whether
> the data is personal**. So **"cookieless" does NOT exempt a tracker** (Vercel and Ahrefs both
> read/write `localStorage`, e.g. `va-disable`). All three analytics tools are consent-required.
>
> **Banner reality:** analytics is a **single binary category** (Accept / Reject all analytics).
> There are **no per-category toggles** and **no "Cookie settings" second layer** — the earlier
> "choose by category / Accept all / Reject all / Manage settings" spec was dropped. Withdrawal is
> via **"Cookie preferences"** (footer **and** in-app), which reopens the banner. GPC is honored as
> a standing opt-out. Deny-by-default; nothing analytics-related runs pre-consent.
>
> (The ePrivacy *Regulation* was withdrawn Oct 2025 — the Directive + GDPR still govern. The
> Digital Omnibus cookie changes are **proposal-only** — don't design to them yet.)
>
> **Open questions for counsel (NOT for the published page):** verify each vendor's transfer
> mechanism/DPA (Vercel DPF; Ahrefs SCCs + TIA); confirm exactly which `localStorage` keys Vercel
> Speed Insights writes; Speed-Insights borderline-necessary classification (we treat it as
> consent-required, conservative); whether any "sale/share" occurs for a US-state notice; re-consent
> interval; global vs EEA/UK-only gating (current design applies globally + honors GPC).

**Last updated:** 19 June 2026 · **Controller:** noobtopro, a sole proprietorship
(Einzelunternehmen) under German law, Cologne (Köln), Germany.

## Per-tracker classification (internal — verified against the shipped app)
| Tracker | Stores/accesses on device | Art. 5(3) triggered? | Strictly necessary? | Verdict |
|---|---|---|---|---|
| **Supabase auth tokens** (localStorage) | Yes (localStorage) | Yes | **Yes** (authentication for the logged-in service) | **Exempt — no consent.** Still disclose. |
| **Consent record** `noobtopro:consent` (localStorage) | Yes (localStorage) | Yes | **Yes** (records the choice; needed to gate analytics) | **Exempt — no consent.** Disclose. |
| **Theme preference** (localStorage) | Yes (localStorage) | Yes | **Yes** (user preference) | **Exempt — no consent.** Disclose. |
| **Vercel Web Analytics** | Yes (script; reads/writes `va-disable` in localStorage) | Yes | No | **Consent-required.** Gate behind opt-in. |
| **Vercel Speed Insights** | Yes (beacon; may read/write localStorage) | Yes | Borderline (perf) → treated as No | **Consent-required** (conservative). |
| **Ahrefs Web Analytics** | Yes (third-party script; can read/write localStorage; IP+UA daily salted hash; **US transfer**) | Yes | No | **Consent-required** (+ Chapter V transfer). |

## Cookie & Tracking Policy (drop-in — matches the live page)
This Policy explains how noobtopro uses cookies and **similar technologies** (browser
**localStorage**, SDKs, beacons, device/network identifiers) and your choices. It supplements our
[Privacy Policy](/privacy). The legal test is the **act of storing or accessing information on
your device**, not the label "cookie", and it applies **whether or not** the information is
personal data — so a "cookieless" tool that reads/writes `localStorage` still needs consent.

**Categories.** (a) **Strictly necessary** (always on — Supabase auth, the consent record, theme;
no consent, disclosed below); (b) **Analytics** (off until you opt in — Vercel Web Analytics,
Vercel Speed Insights, Ahrefs Web Analytics); (c) Marketing/advertising — **not used**.

**Strictly-necessary storage (no consent).**
| Item | Provider | Purpose | On device | Duration |
|---|---|---|---|---|
| Supabase authentication | Supabase, Inc. | Keeps you signed in; secures the session | Auth tokens in `localStorage` | Until sign-out / session expiry |
| Consent record | noobtopro (first-party) | Remembers your analytics choice; gates analytics | `noobtopro:consent` in `localStorage` | Persistent until changed/cleared |
| Theme preference | noobtopro (first-party) | Remembers light/dark theme | Theme value in `localStorage` | Persistent until changed/cleared |

**Analytics technologies (consent-required).** Load only after you opt in; never for visitors who
decline.
| Tool | Provider | Purpose | On device | Data | Retention | Transfer |
|---|---|---|---|---|---|---|
| Vercel Web Analytics | Vercel, Inc. (USA) | Aggregate page-view analytics; no cross-site tracking | Script reads/writes `localStorage` (e.g. `va-disable`); no ad cookies | Aggregated page views, referrer, approx. location, device/browser | Aggregated, per Vercel terms | US — **EU–US DPF** (SCCs fallback) |
| Vercel Speed Insights | Vercel, Inc. (USA) | Anonymous performance measurement | Performance beacons; may read/write `localStorage` | Page-performance metrics; transient device/route id | Aggregated, per Vercel terms | US — **EU–US DPF** (SCCs fallback) |
| Ahrefs Web Analytics | Ahrefs Pte. Ltd. (Singapore) | "Cookieless" traffic analytics | Third-party `analytics.ahrefs.com` script can read/write `localStorage` | Aggregated traffic metrics; daily salted hash of IP+UA | Aggregated, per Ahrefs terms | **US (AWS)** — **SCCs + TIA** |

**Your consent and choices.** For everything **except strictly necessary** technologies, we ask
for your **prior, freely given, specific, informed consent** before they run. Analytics is a
**single choice** — the banner lets you **Accept** or **Reject** all analytics together; rejecting
is **as easy as accepting** and does **not** reduce access to the free or Pro tiers. You can change
or withdraw your choice anytime via **"Cookie preferences"** (in the footer **and** within the
app), which reopens the banner; withdrawal is as easy as giving consent. We honor **Global Privacy
Control (GPC)** as a standing opt-out — if your browser sends it, analytics stays off automatically.

**International transfers.** Our analytics providers process data in the **United States**: Vercel
under the **EU–US Data Privacy Framework** (SCCs fallback); Ahrefs (Singapore entity; data on AWS
in the US) under **Standard Contractual Clauses** + a Transfer Impact Assessment. See
`sub-processors.md`.

**Managing storage.** Use "Cookie preferences" or your browser settings (blocking
strictly-necessary storage may break login).

## Consent-banner functional spec (as shipped)
**Categories & defaults:** Strictly necessary = **ON, locked**; Analytics = **OFF** (deny-by-default).
**Single layer:** short notice + link to the Privacy Policy; **two equal-weight controls** —
**[Reject] [Accept]** — Reject one click, same prominence as Accept (CNIL/ICO/EDPB); **no consent
wall**, **no "continuing = consent"**. **No per-category toggles and no second "settings" layer** —
analytics is one binary category.
**Enforcement (load-bearing):** do **not** mount `@vercel/analytics`, `@vercel/speed-insights`, or
inject the Ahrefs `analytics.js` until consent is "granted"; Supabase auth loads unconditionally;
Ahrefs is injected once on grant and cannot be un-loaded mid-session, so it is only ever injected
after an explicit grant.
**Persistence:** store the consent record (`noobtopro:consent` = "granted"/"denied") in first-party
`localStorage`; always-available "Cookie preferences" control (footer + in-app) dispatches
`noobtopro:open-consent` to reopen the banner.
**GPC / DNT:** `navigator.globalPrivacyControl === true` (or DNT) is treated as a standing opt-out —
recorded as denied, no banner; an explicit later "Accept" overrides it.
**Geo-scoping:** applied **globally** ("assume strictest"); GPC honored either way.
**Accessibility / anti-dark-pattern:** keyboard-navigable; focus not trapped to Accept; no
size/colour asymmetry favouring Accept; no default-on toggles.
