# noobtopro — Legal Document Compliance Review (cited)

**Date:** 19 June 2026 · **Method:** 13 parallel cited-research agents, one per legal document plus a cross-cutting pass. Each agent read the markdown source **and** the rendered page, researched current (2026) law with web citations, and reported gaps by severity.

> **Not legal advice.** This is a good-faith, research-backed gap analysis to brief qualified counsel before launch. Severities: **BLOCKER** (fix before launch / unlawful as-is) · **HIGH** · **MEDIUM** · **LOW**.

---

## Executive summary

**Overall verdict:** the *engineering* of consumer-law compliance is genuinely strong and, in places, ahead of the field — the Art 16(a) immediate-access consent is captured and version-stamped before checkout, the **Art 11a withdrawal button is implemented** (live today, 19 Jun 2026), the **Art 8(2)** pay-button label complies, the **age gate is server-authoritative**, the pro-rata refund logic is correct, the EU-US **DPF is still valid** (verified), and the published **sub-processor stack matches the real code**. The problems are almost all **content and registration**, not architecture — and they cluster into a handful of root causes.

**Severity tally across 13 documents:** ~5 BLOCKER · ~20 HIGH · ~22 MEDIUM · ~15 LOW. No finding requires re-architecting the product.

### The 5 root-cause fixes (each clears many findings)

1. **BLOCKER — Fill the real registered address (+ VAT status) in `lib/legal.js`.** A placeholder renders verbatim on the Impressum → §5 DDG breach + German *Abmahnung* risk. This single field also unblocks Terms, Privacy, Accessibility, US-privacy and Sub-processor identity gaps. *(Needs the actual business registration — your real-world input.)* [§5.1, §13.1, and every "[address]" finding]

2. **BLOCKER/HIGH — Port the protective `legal/*.md` drafts into the thinner rendered `app/*/page.js` pages.** The rendered pages are what bind users, and several silently drop mandatory content the drafts already contain: **Terms** loses the BGB §309 never-excluded-liability list + the Brussels Ia home-forum right (two BLOCKERs); **Privacy** loses Art 6 legal bases, retention periods, transfer mechanisms, and the **Art 22 automated-grading section** (also fixing a *broken cross-reference* from the AI page); **Data-Retention** loses concrete retention periods; **Sub-processors** loses DPA links + change-notice. [§1, §2, §6, §9, §13.4]

3. **HIGH — Standardize the Merchant-of-Record story and *verify the Polar contract*.** Stop calling Polar a "payment provider/processor" in Privacy/Terms/Data-Retention (it's the **seller of record / independent controller**). And because "Polar handles it" does **not** discharge your trader duties (FTC v. Paddle), confirm in the Polar MSA + live checkout that Polar actually delivers: the Art 8(7) durable-medium confirmation, EU VAT/OSS, statutory/pro-rata refund disbursement, and ARL consent-record retention. [§4.1-4.3, §8.4, §13.2-13.3]

4. **HIGH — Close the "no first-party mailer" gaps.** (a) Stop claiming "**we** send" renewal/price/confirmation emails — re-attribute to Polar and verify. (b) **Send the Art 11a durable-medium *acknowledgement of receipt*** after a withdrawal — currently the flow only shows an on-screen "print it yourself" panel, which does **not** satisfy the mandatory send. This is the one *new functional* legal gap. [§4.1, §8.1]

5. **HIGH/MED — Correct the over- and under-claims of applicability.** You currently **over-state** two obligations you likely don't have: the **EAA** accessibility duty (micro-enterprise *exempt* — frame as voluntary) and **US state privacy** laws (you meet *no* threshold; Texas exempts SBA small businesses — reframe as voluntary, but DO add the "no sale/share of sensitive data without consent" line). And resolve the **AI high-risk/Art 22 assessment** — likely out of scope, but the **leaderboard/relative-rank may be "profiling,"** which is the one thing that could flip it. [§7.1, §10.1-10.2, §11.1-11.2]

### Things you got right (don't touch / good news)
- Impressum cites the **current §5 DDG** (not the repealed TMG) — the most common post-2024 defect, avoided.
- **DPF valid in June 2026** (Latombe dismissed Sept 2025, appeal pending) — your US-transfer basis holds; keep SCCs as documented fallback.
- **You are likely EAA-exempt and outside all US state privacy laws** — relax those, don't add work.
- Age gate, Art 11a button, Art 8(2) label, pro-rata math, consent capture, anonymous leaderboard, sub-processor accuracy: all sound.

### Important caveats
- **Not legal advice.** Have German consumer/IT counsel confirm before launch, especially the Polar MoR allocation, the AI profiling/high-risk call, and the Impressum.
- **Source access:** the research agents' `WebSearch` worked, but direct `WebFetch` of several primary sources (EUR-Lex, EDPB PDFs, some vendor pages) returned HTTP 403, so a number of statutory quotes rest on search-result extracts. Counsel should confirm verbatim statutory text against the official sources before relying on it.
- **Date context:** today, **19 June 2026**, is the day Art 11a CRD becomes applicable — relevant to launch timing.

Cross-cutting theme: **rendered pages diverge from the protective markdown drafts** — the rendered artifact is what binds users, so every finding checks the page, not just the `.md`.

---

## 1. Terms of Service — `legal/terms-of-service.md` + `app/terms/page.js`

**Headline:** the markdown draft is strong and self-aware; the **rendered page is materially weaker** and drops carve-outs the draft marks mandatory. The page binds users, so these are real.

**Strengths:** draft's never-excluded liability list, consumer override, home-forum carve-outs, and the correct avoidance of the dead EU ODR link (Reg. (EU) 2024/3228 repealed the ODR platform eff. 20 July 2025). MoR split (Polar = seller of record) consistent across ToS/Refund/Billing drafts.

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 1.1 | **BLOCKER** | Rendered §9/§11 omits BGB §309 No. 7 "never-excluded" liability (death/injury, gross negligence, intent) + the "loss of data" exclusion is exposed; opaque saver clause won't cure it (Transparenzgebot, BGB §307). | Port draft §11.1–11.4 verbatim into the page. |
| 1.2 | **BLOCKER** | Rendered §11 names "venue in Cologne" with no consumer carve-out → strips EU/EEA consumer's **Brussels Ia Arts 17–19 home-forum** right (the "mandatory protections" line only covers Rome I governing law, not jurisdiction). | Port draft §15.2–15.5 (sue/be sued only at consumer's domicile). |
| 1.3 | HIGH | Rendered §5 mislabels Polar "payment provider… acting as MoR" — understates the seller-of-record split (who the consumer contracts with). | Use draft wording: "Polar … the seller of record for your transaction." |
| 1.4 | HIGH | Rendered page has **no VSBG §36/§37 consumer-ADR statement**. Likely §36(3) exempt (≤10 staff) but should be stated knowingly; §37 still applies post-dispute. | Add complaints/ADR section (draft §16); no ODR link. |
| 1.5 | HIGH | Page never signposts the **14-day withdrawal right**; change-of-terms clause ("continued use = acceptance" for material changes) risky under BGB §308 No. 4. | Add withdrawal signpost to §5; replace §12 with draft §14 (advance notice + cancel-before-effective). |
| 1.6 | MED | Trader identity on page is city-only — §5 DDG needs geographic address (+ VAT ID if held). Pre-launch placeholder OK; **launch blocker if shipped live**. | Populate `lib/legal.js` address before launch. |
| 1.7 | LOW | DSA: not an "online platform" (no public dissemination) + micro-enterprise exempt → no DSA clause needed. Revisit if leaderboards expose user content. | None now. |

**Key sources:** [Taylor Wessing — BGB §309 No.7 liability](https://www.taylorwessing.com/de/insights-and-events/insights/2018/06/liability-exclusions-under-german-law) · [Kennedys — Rome I / Brussels Ia](https://www.kennedyslaw.com/en/thought-leadership/article/jurisdiction-and-governing-law-rome-i/) · [Bird & Bird — ODR platform ended 20 Jul 2025](https://www.twobirds.com/en/insights/2025/global/the-end-of-the-european-online-dispute-resolution-platform) · [Noerr — VSBG §36/§37](https://www.noerr.com/en/insights/alternative-und-online-streitbeilegung) · [§5 DDG imprint](https://www.mth-partner.de/en/internet-law-imprint-obligation-according-to-the-german-gdpr-create-a-legally-compliant-imprint/)

---

## 2. Privacy Policy — `legal/privacy-policy.md` + `app/privacy/page.js`

**Headline:** the **live `/privacy` page is not Art 13-compliant** and is the operative notice; the `.md` draft is close but unpublishable until placeholders are resolved. Transfer analysis is substantively correct and current.

**Strengths:** draft has a per-purpose Art 6 legal-basis table, full Art 15–22 rights, Art 77 complaint right, named transfer mechanisms; correct lead authority (**LDI NRW**). DPF reliance for Vercel/Google + SCCs for Groq/Supabase/Ahrefs is the right call.

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 2.1 | **BLOCKER** | Live page omits most Art 13 info: no Art 6 legal bases, no retention periods, no named transfer safeguard, no Art 22/profiling disclosure, no controller address. | Port the `.md` draft's content to the live page. |
| 2.2 | **BLOCKER** | Live page opens "By using the Service you agree to this Policy" — mis-frames a notice as a contract / implies consent as the basis (EDPB: invalid). | Replace with "this is a notice, not a contract." |
| 2.3 | HIGH | `.md` still full of `[Company Legal Name]`/`[Registered Address]`/`[privacy@…]`/`[DATE]`; `lib/legal.js` address placeholder. | Fill all before publishing; unify contact on `russellrozario@noobto.pro`. |
| 2.4 | HIGH | OAuth drift: live page says only Google; draft lists Google/GitHub/Discord. | Align to the providers actually enabled. |
| 2.5 | HIGH | Live page never discloses AI/automated grading or the Art 22 position. | Port draft §11 (profiling + "no significant effect" reasoning + human review). |
| 2.6 | HIGH | UK Art 27 representative left "[likely required — confirm]". No **EU** rep needed (EU-established); **UK** rep is the real question. | Decide + state; no EU rep, resolve UK rep. |
| 2.7 | MED | DPO line unresolved — **not required** (§38 BDSG thresholds unmet). | State affirmatively "no DPO required." |
| 2.8 | MED | DPF presented as settled — valid today but Latombe appeal pending (C-703/25 P). | Keep DPF + note SCC fallback maintained. |
| 2.9 | MED | Polar/Ahrefs/OAuth mis-roled as "processors" (Polar + OAuth are independent **controllers**); Ahrefs location (Singapore)/mechanism missing on live page. | Split processors vs controllers; name Ahrefs SCCs. |
| 2.10 | MED | Live retention section gives no periods ("while active / as required"). | Port concrete figures (30d post-delete, 90d logs, ~10y billing). |
| 2.11 | LOW | DOB drift: draft "birth year only" vs live "date of birth"; confirm actual practice. | Align to what sign-up stores. |

**Key sources:** [GDPR Art 13](https://gdpr-info.eu/art-13-gdpr/) · [Art 22](https://gdpr-info.eu/art-22-gdpr/) · [EDPB DPF FAQ v2.0 (Jan 2026)](https://www.edpb.europa.eu/system/files/2026-01/edpb_dpf_faq-for-businesses_v2_en.pdf) · [EBG — DPF survives challenge (Sept 2025)](https://www.workforcebulletin.com/adequacy-of-the-eu-u-s-data-privacy-framework-survives-challenge) · [§38 BDSG DPO — DLA Piper](https://www.dlapiperdataprotection.com/index.html?t=data-protection-officers&c=DE)

---

## 3. Cookie Policy — `legal/cookie-policy.md` + `app/cookies/page.js` (+ ConsentManager)

**Headline:** the **gate implementation is genuinely strong**; the gaps are all in the *document* and in spec-vs-code drift. No hidden trackers found.

**Strengths:** correct "cookieless ≠ exempt" framing (EDPB Guidelines 2/2023); opt-in deny-by-default is real (`<Analytics/>` only on grant); GPC/DNT honored; `track()` suppressed pre-consent; accept/reject parity; no ad/marketing tags anywhere.

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 3.1 | HIGH | Published page gives no **per-tracker table** (provider/purpose/storage/duration/transfer) — the spec flagged it as a placeholder never carried over. | Add the per-tracker disclosure table to `app/cookies/page.js`. |
| 3.2 | HIGH | "Cookieless" stated without disclosing the tools read/write `localStorage` (`va-disable`) — Art 5(3) still triggered. | Disclose device-storage access; "cookieless ≠ no consent." |
| 3.3 | MED | Withdrawal control ("Cookie preferences") exists only on the public Landing footer — **absent inside the signed-in app** (Art 7(3): withdrawal as easy as giving). | Add the button + /cookies link to the in-app footer. |
| 3.4 | MED | Policy/spec promise granular "choose by category"/"Cookie settings" but the banner is binary (granted/denied). | Drop the "by category" copy **or** build the layer. |
| 3.5 | MED | Consent record is a bare `"granted"|"denied"` — no timestamp/version, so Art 7(1) proof + the promised 6-month re-ask aren't backed. | Store `{choice, timestamp, policyVersion}`. |
| 3.6 | LOW | Transfer disclosure generic; Ahrefs jurisdiction inconsistent (Singapore vs US) across docs. | Name per-vendor location + mechanism; reconcile. |

**Key sources:** [EDPB Guidelines 2/2023 (Art 5(3) scope)](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf) · [German TDDDG §25 — Piwik PRO](https://piwik.pro/glossary/ttdsg/) · [EDPB Opinion 08/2024 (withdrawal)](https://www.edpb.europa.eu/system/files/2024-04/edpb_opinion_202408_consentorpay_en.pdf) · [CNIL — dark patterns in banners](https://www.cnil.fr/en/dark-patterns-cookie-banners-cnil-issues-formal-notice-website-publishers)

---

## 4. Subscription & Billing Terms — `legal/subscription-and-billing-terms.md` + `app/legal/billing-terms/page.js`

**Strengths:** auto-renewal clearly disclosed; tax-inclusive price (CRD Art 6(1)(e)); VAT correctly attributed to Polar (MoR); cancel-as-easy-as-subscribe; the `.md` already knows Click-to-Cancel was vacated (8th Cir, Jul 2025) and FTC v. Paddle (MoR doesn't offload seller duties).

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 4.1 | HIGH | Page says "**we** or Polar send" renewal/price-change/confirmation notices — but there's **no first-party mailer**; FTC v. Paddle: the seller owns the duty even with an MoR. | Re-attribute every notice to Polar **and contractually verify** Polar sends them in the right windows/channels. |
| 4.2 | HIGH | Billing page punts the **Art 11a withdrawal button** (in force **today**) entirely to the refund policy; checkout runs on Polar's interface — must verify Polar provides it. | Reference the implemented button; verify Polar's checkout captures the Art 16(a) waiver. |
| 4.3 | MED | The clear-and-conspicuous **pre-checkout** auto-renewal disclosure + unticked consent box exists only in the `.md` — the real point-of-sale is **Polar's checkout** (ROSCA/CA-ARL/CRD require it there). | Audit/configure Polar's checkout; treat the `.md` block as the spec. |
| 4.4 | MED | Price-change clause vague ("where required"); no concrete advance-notice window; "continued use = acceptance" risky (BGB §308 No.4). | State ≥7-day notice + cancel-before-change right (CA ARL 7–30d; NY §527-a 5–30d). |
| 4.5 | LOW | EUR-only price shown to US consumers (FX varies). | Show USD or state EUR is the billing currency. |

**Key sources:** [FTC v. Paddle ($5M, MoR)](https://www.ftc.gov/news-events/news/press-releases/2025/06/paddle-will-pay-5-million-settle-ftc-allegations-unfair-payment-processing-practices-facilitation) · [8th Cir vacates Click-to-Cancel — Sidley](https://www.sidley.com/en/insights/newsupdates/2025/07/us-ftc-click-to-cancel-rule-struck-down) · [CA ARL AB 2863](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2863) · [NY GBL §527-a](https://codes.findlaw.com/ny/general-business-law/gbs-sect-527-a/) · [EU withdrawal button — Greenberg Traurig](https://www.gtlaw.com/en/insights/2026/5/eu-consumer-law-new-withdrawal-button-requirements-for-online-contracts)

---

## 5. Legal Notice / Impressum — `legal/legal-notice-impressum.md` + `app/legal/notice/page.js`

**Strengths:** the **live page cites the current § 5 DDG (not the repealed TMG §5)** — the single most-warned post-2024 defect, avoided; sole-proprietor framing correct (no Handelsregister entry, VAT conditional).

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 5.1 | **BLOCKER** | Live Impressum renders a **placeholder postal address** (`lib/legal.js`). § 5(1) Nr.1 DDG requires a real ladungsfähige Anschrift (home address if no business one); a placeholder = incomplete Impressum = **UWG Abmahnung risk**. | Populate a real Cologne address before launch. |
| 5.2 | HIGH | The named `.md` is a **wrong-entity generic draft** (says "GmbH/Ltd/B.V.", "managing director", "[national statute]") — actively misleading vs the sole-proprietor reality. | Retire or rewrite the `.md` to mirror the page; page is source of truth. |
| 5.3 | MED | Only **one** contact channel (email). CJEU C-298/07 requires a *second* means of fast electronic contact (a contact form suffices; phone not mandatory). | Add a contact form or phone. |
| 5.4 | LOW | VAT-ID placeholder bracket; § 18 MStV "responsible person" optional (no editorial content) but its address loops back to 5.1. | At launch drop the bracket or add Kleinunternehmer §19 UStG note. |

**Key sources:** [DDG replaced TMG 14 May 2024 — IT-Recht Kanzlei](https://www.it-recht-kanzlei.de/tmg-ttdsg-ausser-kraft-impressum-datenschutz.html) · [Ladungsfähige Anschrift Pflicht](https://adressgeber.de/impressum-ohne-adresse-ist-das-erlaubt/) · [CJEU C-298/07 second channel — WBS](https://www.wbs.legal/allgemein/eugh-entschied-angabe-der-telefonnummer-im-impressum-nicht-zwingend-notwendig-8146/)

---

## 6. Data Retention & Incident Response — `legal/data-retention-and-incident-response.md` + `app/legal/data-retention/page.js`

**No BLOCKER.** Page gets the hard things right: **72-hour Art 33 rule**, Art 34 high-risk trigger, correct **LDI NRW** authority, and the **tax-retention/MoR reconciliation** (Polar keeps the tax records).

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 6.1 | HIGH | Published page states **no concrete retention periods/criteria** (Art 5(1)(e)/13(2)(a)) — the `.md` has them (90d logs, 14mo analytics, 24mo inactive, etc.) but they weren't ported. | Port the concrete figures to the page. |
| 6.2 | HIGH | Page says IP/security logs are "short-lived," but the code's prune is **unscheduled** (IP logs grow unbounded) + erasure misses `user_id = NULL` rows → claim untrue. | Schedule the prune + fix IP-scrub, **or** soften the claim. |
| 6.3 | MED | `.md` tax figure stale ("[6–10 yr]") — 2025 BEG IV cut booking-record retention to **8 years** (10 for some). | Update to 8/10 years. |
| 6.4 | MED | Art 30 RoPA not referenced; the <250-staff carve-out **doesn't apply** (non-occasional processing). | Confirm a RoPA exists (internal). |

**Key sources:** [Art 33 GDPR](https://gdpr-info.eu/art-33-gdpr/) · [Art 5 storage limitation](https://gdpr-info.eu/art-5-gdpr/) · [Art 30 RoPA — ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/documentation/who-needs-to-document-their-processing-activities/) · [Retention cut to 8y (2025) — KMLZ](https://www.kmlz.de/en/shortening-retention-periods-invoices-2025-what-you-need-bear-mind)

---

## 7. Accessibility Statement — `legal/accessibility-statement.md` + `app/accessibility/page.js`

**Notable — the obligation is OVER-stated.** As a **micro-enterprise providing a service**, the operator is **exempt** from the EAA/BFSG accessibility *and statement* obligations (EAA Art 4(5); micro = <10 staff & ≤€2m, Art 3(23)). Publishing is **voluntary**, not a P0 duty. Residual real exposure: US ADA Title III (de-facto WCAG; ~3,117 web suits in 2025) + UK Equality Act — no micro carve-out there. Correct standard targeted (WCAG 2.1 AA via EN 301 549 v3.2.1).

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 7.1 | HIGH | Page presents the EAA as a **binding obligation**, omitting the micro-enterprise exemption; `.md` checklist mislabels publishing as "P0". | Add one line: micro-enterprise exempt (Art 4(5)); WCAG pursued **voluntarily**. |
| 7.2 | HIGH | Placeholders (`lib/legal.js` address; the `.md`'s `[DATE]`/feedback alias). Feedback channel must actually be monitored (5-day SLA). | Fill placeholders; confirm/route an accessibility contact. |
| 7.3 | MED | EU enforcement body not named (it's the MLBF, Magdeburg) — but frame as informational given exemption. | Name MLBF; note exemption. |
| 7.4 | MED | US ADA line "consistent with the ADA" over-promises a specific legal commitment. | Soften to WCAG 2.1 AA as the working benchmark. |

**Key sources:** [EAA Art 4(5) micro-enterprise service exemption — Accessible.org](https://accessible.org/eaa-ecommerce-services-requirements/) · [EAA exemptions — Taylor Wessing](https://www.taylorwessing.com/en/interface/2025/accessibility/key-eu-accessibility-act-exemptions-and-the-challenges-they-pose) · [MLBF (Germany service authority)](https://ms.sachsen-anhalt.de/themen/menschen-mit-behinderungen/aktuelles/marktueberwachungsstelle-der-laender-fuer-die-barrierefreiheit-von-produkten-und-dienstleistungen) · [ADA web accessibility 2025 — ABA](https://www.americanbar.org/groups/business_law/resources/business-law-today/2025-august/digital-accessibility-under-title-iii-ada/)

---

## 8. Refund & Cancellation Policy — `legal/refund-and-cancellation-policy.md` + `app/refunds/page.js`

**Strong & current.** The hardest call (digital **service** → Art 16(a) → pro-rata, **not** content) is confirmed by the pending **Sky Austria C-234/25** AG Opinion (Feb 2026). Art 11a button is **really implemented**, correctly labelled ("Withdraw from contract here" → "Confirm withdrawal"), two-step, window-gated; fail-safe favours the consumer; Art 14(4) "no cost" stated.

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 8.1 | HIGH | **Art 11a requires the trader to *send* a durable-medium acknowledgement of receipt** (declaration content + timestamp) after withdrawal — the route only returns an on-screen "print it yourself" panel + internal audit row. (No first-party mailer.) | Email a withdrawal acknowledgement (first-party or a verified Polar hook). |
| 8.2 | MED | Pro-rata basis should cite "**total price agreed in the contract**" (Art 14(3)); correct here (no minimum term → the month) but should say so. | State the basis explicitly. |
| 8.3 | MED | Consent checkbox leads with "you lose the right" — for a monthly service it's never "fully performed" in 14 days, so the right is always retained; risks misleading. | Add: right retained throughout 14 days, pro-rata only; bump consent version. |
| 8.4 | MED | Art 8(2) order-button label + Art 8(7) confirmation are left as "verify" on Polar — an open gap, not a closed control. | Actually verify Polar's checkout; else send first-party Art 8(7) confirmation. |

**Key sources:** [Sky Austria C-234/25 (digital service / 14-day) — William Fry](https://www.williamfry.com/knowledge/world-consumer-rights-day-part-2-reshaping-online-subscription-rights-the-sky-austria-case/) · [Art 11a acknowledgement — Hogan Lovells](https://www.hoganlovells.com/en/publications/eu-consumer-protection-law-update-new-mandatory-withdrawal-button-what-online-traders-need-to-know) · [CRD 2011/83 — EUR-Lex](https://eur-lex.europa.eu/eli/dir/2011/83/oj/eng) · [Polar buyer terms](https://polar.sh/legal/checkout-buyer-terms)

---

## 9. Sub-processors — `legal/sub-processors.md` + `app/legal/sub-processors/page.js`

**No BLOCKER; list matches the real stack** (code cross-checked: Supabase, Groq, Vercel, Polar, Ahrefs, Google; **no missing email processor** — none exists; Stripe disclosed as Polar's onward). Transfer mechanisms correct for June 2026: **DPF** for Vercel/Google, **SCCs+TIA** for Supabase/Groq/Ahrefs; Polar correctly an independent controller; DPF appeal (C-703/25 P) monitored.

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 9.1 | HIGH | **Ahrefs location mislabelled "Singapore"** — data is actually transferred to/stored in the **US** (AWS EC2); Singapore is just the entity HQ. | Re-state location = US; put Ahrefs in the US-SCCs bucket. |
| 9.2 | MED | Page omits **GitHub/Discord** OAuth (in code, flag-gated) — becomes an undisclosed recipient the moment a flag flips. | Note them as available-but-disabled; update on enable. |
| 9.3 | MED | Groq "**zero data retention**" stated as live, but ZDR is **opt-in** — confirm it's enabled in the prod console. | Verify ZDR enabled; else soften wording. |
| 9.4 | MED/LOW | Vercel Speed Insights not named separately; page drops the `.md`'s **DPA-link column + 30-day change-notice**. | Add Speed Insights, DPA links, notice period. |

**Key sources:** [Vercel DPF certified](https://vercel.com/changelog/vercel-is-now-certified-under-the-eu-us-data-privacy-framework-dpf) · [Ahrefs data stored in US](https://help.ahrefs.com/en/articles/10247870-about-ahrefs-web-analytics) · [Groq ZDR opt-in](https://console.groq.com/docs/your-data) · [Art 28 GDPR](https://gdpr-info.eu/art-28-gdpr/)

---

## 10. AI Transparency Notice — `legal/ai-transparency-notice.md` + `app/legal/ai-transparency/page.js`

**Above baseline.** Lead "you are interacting with an AI system" (Art 50 spirit); provider named; concrete accuracy limits; voluntary human-review/contest (pre-supplies Art 22(3) safeguards). **Two adversarial conclusions:** (a) **likely NOT Annex III high-risk education AI** — but because it sits **outside an "educational/training institution"** (the textual trigger), *not* the weaker Art 6(3)(b) derogation the draft leans on; (b) grading **likely NOT** an Art 22 "solely automated significant" decision (user-initiated, advisory, server-computed). Art 50 duties apply from **2 Aug 2026**.

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 10.1 | HIGH | High-risk analysis omits the decisive "institutions" limiter and rests on a narrowly-construed derogation. | Lead with the **out-of-scope (no institution)** argument; finalise the assessment. |
| 10.2 | HIGH | The **relative rank/leaderboard is plausibly "profiling"** (GDPR Art 4(4)) → Art 6(3) "always high-risk where profiling" proviso could defeat the derogation. | Resolve before launch (defeat via scope, not derogation); document; reconsider leaderboard if counsel can't get comfortable. |
| 10.3 | HIGH | Published while still DRAFT-flavoured ("such as Groq", "[placeholders]", "contested call"). | Lock provider + fill placeholders; move "open questions" to an internal file. |
| 10.4 | MED | Provider under-committed; **US transfer + no-training + ZDR** not disclosed. | Name Groq; add the US-transfer/no-training sentence (sync with Privacy). |

**Key sources:** [AI Act Annex III(3) education](https://artificialintelligenceact.eu/annex/3/) · [Art 6(3) derogation + profiling proviso](https://artificialintelligenceact.eu/article/6/) · [Art 50 transparency](https://artificialintelligenceact.eu/article/50/) · [AI Act timeline (2 Aug 2026) — Lewis Silkin](https://www.lewissilkin.com/insights/2026/04/16/eu-artificial-intelligence-act-timeline) · [GDPR Art 22](https://gdpr-info.eu/art-22-gdpr/)

---

## 11. US State Privacy Notice — `legal/us-state-privacy-notice.md` + `app/legal/us-privacy/page.js`

**Key finding — the notice OVER-claims applicability.** A pre-revenue, one-person operator meets **no** US state comprehensive-privacy threshold: CCPA needs >$26.625M rev / 100k CA consumers / 50% data-sale revenue; VA/CO/CT/OR/etc. need 100k (or 25k+sale) volumes; Utah also needs $25M. **Texas (TDPSA) has no threshold but exempts SBA "small businesses"** (<500 staff) — so still out. Publishing **voluntarily** is fine and prudent; the fixes are about *accuracy*, not statutory breach.

**Strengths:** covers CCPA elements (categories/purposes/rights/appeal); **GPC honored and the new 1 Jan 2026 §7025 "opt-out honored" indicator is correctly reflected and implemented**; sale/share framed conservatively (opt-in analytics, no money sale); online-only contact carve-out used correctly.

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 11.1 | HIGH | Page says the laws "**apply because we offer the Service to U.S. consumers**" — false (every law needs a threshold; offering alone isn't enough). Risks conceding covered-"business" status + its SLAs. | Reframe as **voluntary** good-faith disclosures. |
| 11.2 | HIGH | Omits the **one live US-state hook**: TDPSA §541.107 requires even an exempt small business to get **consent before selling *sensitive* data** — and EXIF geolocation in photos goes to Groq. | Add "we do not sell/share sensitive PI without consent"; confirm EXIF stripped before Groq (it is, server-side). |
| 11.3 | MED | "Could be considered sharing" hedge + a "Do Not Sell/Share" link implied — but Vercel (cookieless, service-provider, 24h) + Ahrefs aren't cross-context ad "sharing"; link not required. | State plainly "we do not sell or share for CCBA"; GPC as courtesy. |
| 11.4 | MED | GPC logic internally inconsistent ("we don't share" yet "GPC opts you out of sharing"). | Reconcile to one position. |
| 11.5 | MED | `lib/legal.js` address placeholder renders a bracket to users on a rights-request page. | Populate address. |
| 11.6 | LOW | Lists "limit Sensitive PI" right with no mechanism (likely exempt — use is permitted-purpose only). | Clarify no separate limit needed. |

**Key sources:** [CCPA thresholds — IAPP](https://iapp.org/news/a/does-the-ccpa-as-modified-by-the-cpra-apply-to-your-business) · [§7025 "opt-out honored" 2026 — Nelson Mullins](https://www.nelsonmullins.com/insights/alerts/fcc-download/all/show-me-that-you-ve-opted-me-out-new-ccpa-rules-require-businesses-to-prove-compliance) · [TDPSA (small-biz exemption + sensitive-data consent) — Usercentrics](https://usercentrics.com/knowledge-hub/texas-data-privacy-and-security-act-tdpsa/) · [US state laws overview — IAPP](https://iapp.org/resources/article/us-state-privacy-laws-overview)

---

## 12. Acceptable Use Policy — `legal/acceptable-use-policy.md` + `app/aup/page.js`

**Low-risk — no BLOCKER.** Short, plain-language, proportionate, and **properly incorporated** into the Terms (BGB §305(2)); no "surprising" clauses (§305c); graduated enforcement ladder matches DSA Art 14(4); consistent with the content-safety blocklist + anonymous leaderboard. Correctly **not** an "online platform" (no public dissemination) → no Art 20-24 platform duties.

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 12.1 | HIGH | DSA **Art 17 statement-of-reasons** is scoped only to "removing content" — it must also cover **account suspension/termination**. The Art 19 micro-exemption excludes only Section 3 (platform) duties, **not** Art 17 (Section 2 hosting). | Attach the Art 17 statement-of-reasons + redress info to the whole enforcement sentence; include reasons in suspension/termination notices. |
| 12.2 | MED | Draft↔live divergence: `.md` links `/legal` + `abuse@/security@` addresses; live uses `/legal/notice` + single `russellrozario@noobto.pro`; `.md` has `[DATE]`/`[DOMAIN]`. | Reconcile `.md` to the live page; confirm the inbox is monitored. |
| 12.3 | LOW | "or otherwise harmful" catch-all is open-textured (§307 transparency) when used to terminate a paying consumer. | Narrow, or rely on the proportionality ladder + statement of reasons. |
| 12.4 | LOW | "Submit others' work" prohibition self-contradicts a practice grader; tie to misrepresentation. | Anchor to academic-integrity fraud only. |

**Key sources:** [DSA Art 17 (covers suspension/termination)](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_17.html) · [Art 19 micro-exemption is Section 3 only — CMS](https://www.cms-digitallaws.com/en/dsa/article-19/) · [Art 3 "online platform"/dissemination — DSA Library](https://dsa-library.com/article/3/) · [BGB §305c/§307](https://www.gesetze-im-internet.de/englisch_bgb/englisch_bgb.html)

---

## 13. Cross-cutting — consistency · Merchant-of-Record · 18+ age-gate

**Strengths:** single source of entity facts (`lib/legal.js`) keeps name/email/price/window mechanically consistent; **Art 8(2) order-button label complies** ("Subscribe & pay €9.99/month"); **age gate is server-authoritative** for account holders (`app_metadata.age_verified`, recomputed server-side, birth-year only — far stronger than a localStorage checkbox); sitemap lists all 13 legal routes, no orphan pages.

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 13.1 | **BLOCKER** | `lib/legal.js` placeholder **address** (+VAT) renders verbatim on `/legal/notice` → §5 DDG non-compliant, Abmahnung risk. | Populate a real Cologne address before EU launch. |
| 13.2 | HIGH | **MoR mislabeled**: `/privacy`, `/terms`, `/legal/data-retention` call Polar a "payment provider"/processor, contradicting `/legal/sub-processors` + `/refunds`/`/billing-terms` ("seller of record / independent controller"). | Standardize: Polar = MoR / seller of record / independent controller for payment+tax. |
| 13.3 | HIGH | "**Polar handles it" doesn't discharge trader duties** (FTC v. Paddle). Art 8(2) label, Art 8(7) confirmation, VAT/OSS, statutory refunds, ARL consent-record retention must be **verified in the Polar contract**, not assumed. | Confirm each against live Polar checkout + MSA; first-party fallback where Polar's email is short. |
| 13.4 | HIGH | **Broken cross-reference**: `/legal/ai-transparency` points to "the automated-processing section of our Privacy Policy" — which **doesn't exist** on the rendered `/privacy`. | Port the Art 22 section into `/privacy` (ties to 2.1/2.5). |
| 13.5 | HIGH | **"Last updated" drift**: `lib/legal.js` 18 Jun · `sitemap.js` 16 Jun · refund `.md` 19 Jun. | Reconcile to one date (19 Jun 2026). |
| 13.6 | MED | 18+ self-attestation is **defensible** (EDPB/ICO: ok for low-risk; account holders are server-verified) — but `/privacy` §7 says "date of birth" while only birth-year is stored, and the guest path stores nothing server-side. Don't call it "verification." | Reword to "age self-declaration with a server-recorded verdict for account holders"; note the risk-based choice in the DPIA. |
| 13.7 | MED | Footer omits direct `/aup`, `/accessibility`, **`/legal/notice` (Impressum)** links (reachable via hub, but German "two-click" Impressum expectation). | Add a footer Legal-Notice (+ Accessibility) link. |

**Key sources:** [FTC v. Paddle $5M (MoR)](https://www.ftc.gov/news-events/news/press-releases/2025/06/paddle-will-pay-5-million-settle-ftc-allegations-unfair-payment-processing-practices-facilitation) · [Polar MoR docs](https://polar.sh/docs/merchant-of-record/introduction) · [EDPB age-assurance statement (Feb 2025)](https://www.edpb.europa.eu/news/news/2025/edpb-adopts-statement-age-assurance-creates-task-force-ai-enforcement-and-gives_en) · [Age assurance 2026 — Lewis Silkin](https://www.lewissilkin.com/en/insights/2026/04/17/age-assurance-in-2026-what-do-digital-businesses-operating-in-the-uk-and-eu-need-to-know) · [CRD Art 8 — EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02011L0083-20220528)
