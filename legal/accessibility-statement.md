# Accessibility Statement — noobtopro

> **DRAFT for counsel/operator — not legal advice.** Fill `[placeholders]`. The **European
> Accessibility Act** (Dir. (EU) 2019/882, live since 28 Jun 2025) applies to this e-commerce
> service; target **WCAG 2.1 AA via EN 301 549 v3.2.1**. A **micro-enterprise exemption** (<10
> staff AND ≤€2M turnover/balance sheet) *may* lift the EAA duty — **fact-dependent and
> fragile** — but **US ADA Title III and UK Equality Act 2010 exposure persist regardless**, so
> AA conformance is the recommended posture either way. [If relying on the exemption, frame this
> statement as "voluntary alignment" — COUNSEL.]

**Last updated:** [DATE] · **Operated by:** [Company Legal Name], [Registered Address, EU Member State]

## Our commitment
noobtopro is committed to making our web application accessible to the widest possible audience,
including people with disabilities. We aim for an experience that is **perceivable, operable,
understandable, and robust**.

## Conformance status
We target **WCAG 2.1 Level AA**, as referenced by the European harmonised standard **EN 301 549
(v3.2.1)** under the European Accessibility Act. [Optional: we are also working toward WCAG 2.2
AA.] noobtopro is **partially conformant** — some content does not yet fully conform. Known
exceptions are below.

## Known limitations (from an internal audit on 2026-06-18)
| Area | Issue | WCAG criterion | Status / target |
|---|---|---|---|
| Public "Learn" pages (light theme) | Math subject-accent "eyebrow" text contrast 3.81:1 (AA ≥ 4.5:1) | 1.4.3 | In progress — [DATE] |
| Public "Learn" pages (light theme) | Physics subject-accent "eyebrow" text contrast 3.98:1 | 1.4.3 | In progress — [DATE] |
| Certain views | A few views miss a top-level `<h1>` | 1.3.1 / 2.4.6 | In progress — [DATE] |
| Some interactive controls | A few touch targets are ~28px (below the recommended minimum) | 2.5.8 | In progress — [DATE] |
| Dynamic status messages | One live region announces more verbosely than necessary | 4.1.3 | In progress — [DATE] |

We assess the app through [automated testing, manual review, and assistive-technology testing —
adjust to actual process].

## Feedback — tell us about a barrier
Email **[accessibility@your-domain]** [+ optional form/postal address]. Please describe the
problem, the page/screen, and your assistive technology/browser. We aim to respond within **[5]
business days**.

## Enforcement and escalation
- **EU/EEA:** contact the market-surveillance / service-compliance authority for the EAA in
  **[Member State of establishment — name the authority]**. *[COUNSEL: insert the correct body.]*
- **United Kingdom:** the **Equality Advisory and Support Service (EASS)** regarding the Equality
  Act 2010.
- **United States:** contact us directly; we are committed to effective communication consistent
  with the ADA.

## Compatibility & preparation
Accessibility relies on [HTML, CSS, ARIA, JavaScript], designed for recent [browsers] and common
assistive technologies [e.g. NVDA, VoiceOver]. This statement was prepared on **[DATE]** based on
a self-assessment/audit on **2026-06-18** by [noobtopro/auditor]; reviewed at least [annually].

### Obligations checklist
**P0:** fix the two contrast failures; add the missing `<h1>`s; publish this statement (EAA Art.
13/Annex V — place in or alongside the general T&Cs in an accessible format — confirm placement).
**P1:** enlarge sub-minimum touch targets (≥ 24×24 CSS, ideally 44×44); trim the verbose live
region; **confirm micro-enterprise status** and document it. **P2:** feedback channel + SLA;
document the conformance assessment (Annex V); adopt WCAG 2.2 AA as the working target; schedule
periodic re-audits; confirm the designated EAA authority and ADA "physical-nexus" exposure.
