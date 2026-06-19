# Accessibility Statement — noobtopro

> **DRAFT for counsel/operator — not legal advice.** noobtopro is a single-person German sole
> proprietorship (Einzelunternehmen). As a **micro-enterprise providing a service** (<10 staff AND
> ≤€2M turnover/balance sheet, Dir. (EU) 2019/882 Art. 3(23)), it is **exempt** from the European
> Accessibility Act / German BFSG accessibility obligations **and** from the duty to publish an
> accessibility statement (EAA Art. 4(5)). This statement is therefore **voluntary**: we pursue
> **WCAG 2.1 AA via EN 301 549 v3.2.1** as good practice, not as a binding legal duty. There is no
> statutory ADA duty for a foreign online service either; AA is our working benchmark as risk
> management. Confirm and document micro-enterprise status.

**Last updated:** 19 June 2026 · **Operated by:** noobtopro, a sole proprietorship
(Einzelunternehmen) under German law, Cologne (Köln), Germany

## Our commitment
noobtopro is committed to making our web application accessible to the widest possible audience,
including people with disabilities. We aim for an experience that is **perceivable, operable,
understandable, and robust**.

## 1. Scope of this statement (voluntary)
noobtopro is a **micro-enterprise** — a single-person business with fewer than 10 staff and an
annual turnover and balance sheet that do not exceed €2 million (Dir. (EU) 2019/882, Art. 3(23)).
As a micro-enterprise providing a service, we are **exempt** from the accessibility obligations of
the European Accessibility Act and its German implementation, the Barrierefreiheitsstärkungsgesetz
(BFSG), **including the duty to publish an accessibility statement** (EAA Art. 4(5)). We provide
this statement and pursue WCAG conformance **voluntarily**, as a matter of good practice and not as
a binding legal obligation.

## 2. Conformance status
On a voluntary basis we target **WCAG 2.1 Level AA**, as referenced by the European harmonised
standard **EN 301 549 (v3.2.1)** (the standard used under the European Accessibility Act, Dir. (EU)
2019/882). noobtopro is currently **partially conformant** — some content does not yet fully
conform. Known exceptions are below.

## 3. Known limitations (from an internal audit on 2026-06-18)
| Area | Issue | WCAG criterion | Status / target |
|---|---|---|---|
| Public "Learn" pages (light theme) | Math subject-accent "eyebrow" text contrast 3.81:1 (AA ≥ 4.5:1) | 1.4.3 | In progress |
| Public "Learn" pages (light theme) | Physics subject-accent "eyebrow" text contrast 3.98:1 | 1.4.3 | In progress |
| Certain views | A few views miss a top-level `<h1>` | 1.3.1 / 2.4.6 | In progress |
| Some interactive controls | A few touch targets are ~28px (below the recommended minimum) | 2.5.8 | In progress |
| Dynamic status messages | One live region announces more verbosely than necessary | 4.1.3 | In progress |

We assess the app through automated testing, manual review, and assistive-technology testing.

**Remediation.** These known issues are being actively worked on. We are prioritising the two
colour-contrast failures and the missing top-level headings, followed by the touch-target and
live-region items, and we update this statement as fixes ship.

## 4. Feedback — tell us about a barrier
Email **russellrozario@noobto.pro**. Please describe the problem, the page/screen, and your
assistive technology/browser. We aim to respond within **5 business days**.

## 5. Escalation (informational)
Because we rely on the micro-enterprise exemption (Section 1), the formal European Accessibility Act
enforcement and complaints mechanisms do not apply to us. We list the following for information
only; in the first instance, please contact us directly so we can help.

- **EU/EEA:** In Germany, the service-side authority responsible for the BFSG is the
  **Marktüberwachungsstelle der Länder für die Barrierefreiheit von Produkten und Dienstleistungen
  (MLBF)**, based in Magdeburg.
- **United Kingdom:** the **Equality Advisory and Support Service (EASS)** regarding the Equality
  Act 2010.
- **United States:** as a foreign online service we are not subject to a statutory ADA duty here;
  as a matter of good practice we aim for **WCAG 2.1 AA** as our working benchmark and are committed
  to effective communication. Please contact us directly.

## 6. Compatibility & preparation
Accessibility relies on HTML, CSS, ARIA, and JavaScript, designed for recent browsers and common
assistive technologies (e.g. NVDA, VoiceOver). This statement is based on a self-assessment
conducted on **2026-06-18** and is reviewed at least annually.

## 7. Contact
**russellrozario@noobto.pro** — noobtopro, Cologne (Köln), Germany.
