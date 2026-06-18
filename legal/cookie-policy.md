# Cookie & Tracking Technologies Policy + Consent-Banner Spec — noobtopro

> **DRAFT for counsel — not legal advice.** Fill `[placeholders]`. **Key finding:** under
> ePrivacy Art. 5(3) + EDPB Guidelines 2/2023, the legal trigger is *storing/accessing info on
> the device* — **regardless of the word "cookie" or whether the data is personal**. So
> "cookieless" does NOT exempt a tracker. Publish at `/cookies` (sibling to `/privacy`, `/terms`).
> (The ePrivacy *Regulation* was withdrawn Oct 2025 — the Directive + GDPR still govern. The
> Digital Omnibus cookie changes are **proposal-only** — don't design to them yet.)

**Last updated:** [DATE] · **Controller:** [Company Legal Name], [Registered Address], [country].

## Per-tracker classification (noobtopro)
| Tracker | Stores/accesses on device | Art. 5(3) triggered? | Strictly necessary? | Verdict |
|---|---|---|---|---|
| **Supabase auth tokens** (localStorage) | Yes (localStorage) | Yes | **Yes** (authentication for the logged-in service) | **Exempt — no consent.** Still disclose. ✅ |
| **Vercel Web Analytics** | Yes (script; reads `va-disable` in localStorage) | Yes | No | **Consent-required.** Gate behind opt-in. ❌-until-consent |
| **Vercel Speed Insights** | Yes (beacon; deviceId) | Yes | Borderline (perf) | **Treat as consent-required** (conservative). ❌-until-consent |
| **Ahrefs Web Analytics** | Yes (third-party script; IP+UA daily salted hash; **US transfer**) | Yes | No | **Consent-required** (+ Chapter V transfer issue). ❌-until-consent |

**Bottom line:** noobtopro currently loads **three consent-required trackers with NO consent
mechanism** — the core compliance gap. Only Supabase auth is exempt.

## Cookie & Tracking Policy (drop-in)
This Policy explains how noobtopro uses cookies and **similar technologies** (browser
**localStorage**, SDKs, pixels, device/network identifiers) and your choices. It supplements our
[Privacy Policy](/privacy). The legal test is the **act of storing or accessing information on
your device**, not the label "cookie", and it applies **whether or not** the information is
personal data.

**Your consent and choices.** For everything **except strictly necessary** technologies, we ask
for your **prior, freely given, specific, informed consent** before they run. You can **accept
all, reject all, or choose by category** at any time via **"Cookie settings"** ([LINK]).
Rejecting is **as easy as accepting**; refusing non-essential trackers will **not** reduce your
access to the free or Pro tiers. You can change or withdraw your choice anytime; withdrawal is
as easy as giving consent. We re-ask after **[6] months** or sooner on material change.

**Categories:** (a) **Strictly necessary** (always on — e.g. Supabase auth, consent record);
(b) **Performance & analytics** (off until you consent — Vercel Analytics, Vercel Speed
Insights, Ahrefs); (c) Marketing/advertising — **not used**.

**The technologies we use** — *[reproduce the per-tracker table above with provider, purpose,
storage type, duration, personal data, and international-transfer columns; verify each cell in
DevTools and against each vendor's DPA before publishing].*

**International transfers.** Vercel (US) and Ahrefs (Singapore/US) process data abroad; we rely
on **[SCCs / UK IDTA / DPF — specify]** (see `sub-processors.md`).

**Managing trackers.** Use "Cookie settings" ([LINK]) or your browser settings (blocking
strictly-necessary storage may break login). [If supported] We honour **Global Privacy Control
(GPC)**.

## Consent-banner functional spec
**Categories & defaults:** Strictly necessary = **ON, locked** ("Always active"); Performance &
analytics = **OFF**, **no pre-ticked toggles**.
**First layer:** short notice + links to Cookie & Privacy policies; **three equal-weight
controls** — **[Accept all] [Reject all] [Manage settings]** — Reject-all **one click**, same
prominence as Accept-all (CNIL/ICO/EDPB); **no consent wall**, **no "continuing = consent"**.
**Second layer:** per-category toggles (non-essential OFF by default) with vendor detail;
buttons **[Confirm choices] [Accept all] [Reject all]** (parity).
**Enforcement (load-bearing):** do **not** inject `@vercel/analytics`, `@vercel/speed-insights`,
or the Ahrefs `analytics.js` until consent is granted; Supabase auth loads unconditionally; on
withdrawal, stop loading on next navigation.
**Persistence:** store the consent record (categories + timestamp + policy version) in
first-party localStorage; **re-prompt ≤ every 6 months**; **do not re-prompt within 6 months
after a refusal**; always-available footer "Cookie settings" link.
**Geo-scoping:** Option A (recommended, "assume strictest") = apply globally; Option B =
EEA/UK-only banner with edge geolocation + a US notice/opt-out. Honour GPC either way.
**Accessibility / anti-dark-pattern:** keyboard-navigable; focus not trapped to Accept; no
size/colour asymmetry favouring Accept; no default-on toggles.

### Open questions for counsel
Speed Insights classification · whether to configure analytics to meet the **CNIL audience-
measurement exemption** (France-only) or the **UK DUAA** low-risk analytics exception · verify
each vendor's transfer mechanism/DPA · whether Ahrefs/Vercel write any localStorage · global vs
EEA/UK-only gating · re-consent interval · whether any "sale/share" occurs (US notice).
