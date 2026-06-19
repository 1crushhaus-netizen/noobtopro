# noobtopro — Legal & Compliance Pack (counsel-ready drafts)

**Prepared:** 2026-06-18 · **Status:** DRAFTS for counsel review — **not legal advice.**

This folder holds counsel-ready drafts (with `[bracketed placeholders]`) and a compliance
analysis for launching noobtopro as a **paid, adults-only (18+)** educational service,
**established in the EU/EEA** and marketed to the **US, EU/EEA, UK, and worldwide**. They were
produced by a fleet of domain-specialised research agents, each grounding its conclusions in
primary sources (EUR-Lex, EDPB, ICO, CNIL, FTC, CPPA, US Code) and in this repo's actual code.

> **Sourcing caveat (read this).** During research, automated page-fetch was **blocked (HTTP
> 403)** on most primary-source portals (EUR-Lex, EDPB, ICO, CNIL, FTC, copyright.gov,
> gdpr-info.eu). Statutory wording was corroborated across multiple independent sources and is
> reliable for drafting, but **counsel must confirm every verbatim quotation, article number,
> and current status against the official source before publishing or relying on it.**

## Documents in this pack

| File | What it is | Maps to app route |
|---|---|---|
| `privacy-policy.md` | GDPR-first Privacy Policy (incl. UK, US/CCPA, transfers, retention, automated-decision) | `/privacy` |
| `terms-of-service.md` | Terms of Service / EULA (with EU/UK consumer carve-outs) | `/terms` |
| `refund-and-cancellation-policy.md` | Refund & cancellation + the EU 14-day withdrawal mechanics | `/refunds` |
| `subscription-and-billing-terms.md` | Auto-renewal terms, checkout consent copy, Merchant-of-Record disclosure | checkout / `/terms §7` |
| `cookie-policy.md` | Cookie/tracker policy + consent-banner functional spec | new `/cookies` |
| `sub-processors.md` | Sub-processor & third-party-recipient list (publish-ready table) | linked from `/privacy` |
| `accessibility-statement.md` | EAA / WCAG 2.1 AA accessibility statement | new `/accessibility` |
| `legal-notice-impressum.md` | Provider-identification (e-Commerce Art. 5 / Impressum) + DSA contacts | new `/legal` or footer |
| `ai-transparency-notice.md` | AI transparency & limitations notice + ToS AI clauses | new `/ai` or in `/terms` |
| `data-retention-and-incident-response.md` | Retention schedule + breach-response & DSAR runbooks (internal) | internal ops |

---

## ⏰ Time-sensitive / highest-priority findings

1. **EU "withdrawal button" is mandatory from 19 June 2026** (Art. 11a CRD, inserted by
   Directive (EU) 2023/2673). Online traders selling to EU consumers must show a prominent,
   always-available **"Withdraw from contract here"** function (+ a confirmation step)
   throughout the 14-day period. **This is the day after this pack was prepared — implement
   now or confirm Polar's checkout provides it.** See `refund-and-cancellation-policy.md`.

2. **Pro is a digital SERVICE, not "digital content."** Therefore the 14-day right of
   withdrawal **cannot be fully waived** by an "access begins now" checkbox. Use the **Art.
   16(a)** consent wording ("I lose my right of withdrawal once the service is *fully
   performed*") and refund any unused remainder **pro-rata** (Art. 14(3)) if a consumer
   withdraws within 14 days. The current checkout captures **no** consent at all. (This
   overturns the earlier audit's "immediate-performance waiver" assumption.)

3. **Consent banner is legally required (EU/UK) and missing.** Under ePrivacy Art. 5(3) +
   EDPB Guidelines 2/2023, **Vercel Web Analytics, Vercel Speed Insights, and Ahrefs are all
   consent-required** — "cookieless" does **not** exempt them. Only Supabase auth tokens are
   strictly-necessary/exempt. The site currently loads all three with **no banner**, and the
   Privacy Policy **does not disclose Ahrefs at all** (a material misstatement). See
   `cookie-policy.md` for the banner spec.

4. **US auto-renewal: the FTC "Click-to-Cancel" rule was VACATED** (8th Cir., *Custom
   Communications v. FTC*, 8 July 2025) — but **ROSCA + state ARLs (California, New York, …) +
   active FTC §5 enforcement remain binding.** The on-point precedent is **FTC v. Paddle**
   ($5M): being a Merchant of Record does **not** offload the seller's auto-renewal duties.
   See `subscription-and-billing-terms.md`.

5. **Polar is an independent CONTROLLER (Merchant of Record), not a sub-processor**, for
   payment/tax data. The Privacy Policy must point to Polar's own policy (controller-to-
   controller), not describe Polar as "our processor." See `sub-processors.md`.

---

## Applicability conclusions (with the decisions counsel must close)

- **GDPR / UK GDPR** — **apply** (EU-established controller + UK targeting). Lawful basis:
  account/auth and AI grading on **contract** (Art. 6(1)(b)); security on **legitimate
  interests**; analytics/marketing on **consent**.
- **EU AI Act** — the AI grader is **probably NOT "high-risk"** (the Annex III(3) "educational
  *institutions*" limiter + the Art. 6(3)(b) "improves a completed human activity" derogation
  + the explicitly non-accredited framing), **but it is a contested, close call** that hinges
  on whether the *relative rank* is "profiling." Document a 6(3) assessment and build to the
  **Art. 50 transparency** baseline now. If high-risk obligations ever apply, they're likely
  deferred to **2 Dec 2027** under the pending Digital Omnibus (confirm OJ adoption).
- **GDPR Art. 22 (automated decisions)** — **not triggered**: the rank has no legal/similarly-
  significant effect. Offer human-review/contest voluntarily anyway.
- **DSA (Reg. (EU) 2022/2065)** — noobtopro is a **small hosting provider, not an online
  platform**; the heavy platform/VLOP duties are **out of scope**. The minimal footprint that
  **does** apply: Art. 11 & 12 contact points, Art. 14 T&C content, and Art. 16/17 notice-and-
  action + statement-of-reasons. **No EU legal representative** needed (EU-established).
- **European Accessibility Act** — **applies** to this e-commerce service (live since 28 June
  2025); target **WCAG 2.1 AA via EN 301 549**. A **micro-enterprise exemption** (<10 staff
  AND ≤€2M turnover) *may* lift the EAA duty — **fact-dependent, fragile** — but **ADA Title
  III (US) and UK Equality Act exposure persist regardless**, so AA conformance is the
  recommended posture either way.
- **International transfers** — EU→US/Singapore transfers occur. **DPF valid** (under appeal
  C-703/25 P; keep SCCs as a fallback). Only **Vercel + Google** are DPF-certified; **Supabase,
  Groq (US), Ahrefs (Singapore)** rely on **SCCs + a Transfer Impact Assessment**. **Groq is
  the highest-risk flow** (handwriting photos to the US) → **enable Zero-Data-Retention** and
  consider a **DPIA**.

---

## Facts counsel/operator must supply (fills the placeholders everywhere)

`[Company Legal Name]` · legal form · `[Registered Address]` · EU **member state of
establishment** (sets governing law + lead supervisory authority + statutory tax-retention
period) · company/VAT registration numbers · monitored contact inboxes
(`support@`, `privacy@`, `legal@`, `security@`, `accessibility@`, `dmca@`/`abuse@`) ·
`[Effective Date]` · DPO appointment (likely **not** mandatory — document the decision) ·
**UK Art. 27 representative** (likely **required** for UK users — appoint) · whether a
**DMCA designated agent** will be registered (recommended for US users).

---

## Consolidated open questions for counsel (cross-domain)

1. **Member state of establishment** → governing law, lead DPA, one-stop-shop, tax-retention years.
2. **EU 14-day withdrawal**: confirm Pro is a "service" (Art. 16(a)); confirm **Polar's
   checkout captures the express consent + acknowledgement and the Art. 8(7) durable-medium
   confirmation**, and will disburse statutory/pro-rata refunds despite its "no refund after
   access" default. Implement the **Art. 11a withdrawal button** (live 19 June 2026).
3. **Consent banner**: confirm scope (global vs EEA/UK-only), the analytics-exemption posture
   (CNIL audience-measurement / UK DUAA), and that Ahrefs/Vercel are gated **before** load.
4. **Ahrefs disclosure**: add to the Privacy Policy processor list + Cookie Policy, or remove
   the script (the policy currently omits it — a material data-flow misstatement).
5. **AI Act high-risk determination** + the "relative rank = profiling?" question; prepare the
   Art. 6(3) non-high-risk assessment; confirm the Digital Omnibus deferral on OJ publication.
6. **Groq data handling**: enable **ZDR**, confirm no training/identification on inputs, put
   it in the DPA; assess whether a **DPIA** is required for the grading/ranking pipeline.
7. **US privacy applicability** (CCPA 100k-identifier / Colorado 25k+any-sale thresholds;
   Texas small-business status) and the **"sale/share"** classification of Vercel/Ahrefs →
   whether the **Do-Not-Sell/Share + GPC** mechanism is mandatory (recommended to publish + honor GPC regardless).
8. **US auto-renewal**: confirm ROSCA/CA-ARL/NY pre-checkout disclosure + separate consent +
   simple cancellation are actually delivered (by noobtopro or Polar), and consent records retained (CA: 3 years).
9. **ToS risk clauses**: governing-law/jurisdiction with the **mandatory EU/UK consumer
   carve-outs** (Rome I Art. 6, Brussels Ibis 17-19, CRA s.74); decide whether to run a
   **US-only arbitration/class-waiver** (and ensure clickwrap acceptance is logged). **Omit
   the dead EU ODR-platform link** (discontinued 20 July 2025).
10. **DSA**: confirm the leaderboard/report features are "minor and ancillary" (keeps platform
    duties out of scope); stand up the Art. 11/12 contacts + Art. 16 notice-and-action endpoint.
11. **UK Art. 27 representative**, **DPO** decision, **records of processing (Art. 30)**, and a
    **DPIA**.
12. **Accessibility**: confirm micro-enterprise status; name the EAA authority; fix the audit's
    contrast/`<h1>`/touch-target issues; publish the statement.

---

## Engineering changes the legal analysis requires (hand to dev)

- **Age**: ✅ server-enforced 18+ gate shipped (`/api/account/age` + `app_metadata.age_verified`,
  enforced on `/api/generate` + `/api/score`). Decide whether **guests** must also be age-gated.
- **Consent banner**: build it; gate Vercel Analytics, Speed Insights, and Ahrefs behind opt-in
  (default off); honor GPC; persist consent; re-prompt ≤ every 6 months.
- **Withdrawal button** (`/api/...`): add the Art. 11a "Withdraw from contract here" flow + a
  durable-medium confirmation email; capture the Art. 16(a) consent at checkout if Polar doesn't.
- **Ahrefs**: disclose in the Privacy Policy or remove the script.
- **Retention**: **schedule the `security_events`/`concept_reports` prune** (currently only runs
  on admin-dashboard load → IP logs grow unbounded); make **erasure complete** by purging/
  anonymising `security_events`/`rate_limits` rows by **IP**, not just `user_id`.
- **Accessibility**: fix Learn-page eyebrow contrast (math 3.81:1, physics 3.98:1), add the
  missing `<h1>`s, enlarge sub-44px touch targets.
- **EXIF**: strip image metadata (incl. precise geolocation) on photo upload.
- **DMCA/abuse**: stand up an `abuse@`/form endpoint (DSA Art. 16) that doubles as the DMCA channel.

---

*Per-domain detail, citations, and the full drafts are in the sibling files. Each carries its
own "open questions for counsel" and source list.*
