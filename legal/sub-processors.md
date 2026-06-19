# Sub-processors & Third-Party Recipients — noobtopro

> **DRAFT for counsel — not legal advice.** Verify each vendor's role, region, transfer
> mechanism, and live DPF-list status before publishing. **Last updated:** 19 June 2026
> (`LEGAL.lastUpdated`). We will give **30 days'** advance notice of new sub-processors via
> **this page (and email where appropriate)**, allowing time to object before the change takes
> effect.

| # | Name (entity) | Role | Purpose | Personal data | Location | Transfer mechanism (EU/UK→) | DPA / legal link |
|---|---|---|---|---|---|---|---|
| 1 | **Supabase, Inc.** | Processor | Database (Postgres), authentication, storage | Account/auth IDs (email, Google OAuth subject), profile & grading data | USA (AWS us-east-1) | **SCCs (Module 2) + UK Addendum + TIA**; ISO 27001, SOC 2 (**not** DPF-certified) | supabase.com/legal/dpa |
| 2 | **Groq, Inc.** | Processor | LLM inference / AI grading | Typed answers; **photos of handwritten work**; derived outputs | USA (GCP) | **SCCs (Module 2) + TIA**; we **rely on Groq's zero-data-retention (ZDR) setting** + no-training commitment (**not** DPF-certified) | console.groq.com/docs/legal/customer-data-processing-addendum · trust.groq.com/subprocessors |
| 3 | **Polar Software, Inc.** | **Independent Controller** (Merchant of Record) | Payments, billing, fraud, tax/VAT, invoicing | Name, email, billing/transaction data (no full card numbers) | USA | **Controller-to-controller**; Polar's own policy & SCCs/DPF chain (Stripe sub-processor) | polar.sh/legal/privacy · polar.sh/legal/payment-processor-partners |
| 4 | **Vercel, Inc.** | Processor | Hosting/CDN + Web Analytics + **Speed Insights** | Request/log/IP-derived metadata, deployment data | USA (AWS; default US) | **EU-US DPF (Active, certified 4 Jun 2024) + UK/Swiss extensions**; SCCs fallback | vercel.com/legal/dpa |
| 5 | **Ahrefs** (Ahrefs Pte. Ltd., Singapore) | Processor | Privacy-friendly web analytics (cookieless) | Aggregated traffic metrics; **verify IP handling** (daily salted hash) | **USA (AWS EC2)** — data transferred to/stored in the US | **SCCs (Modules 2/3) + TIA**; data lands in the US (not Singapore) | ahrefs.com/legal/data-processing-addendum |
| 6 | **Google LLC** (Sign in with Google) | **Independent Controller** | Federated authentication | Google account ID/email, auth tokens | USA | **EU-US DPF (Google LLC)** + Google's own safeguards | policies.google.com/privacy |

**Onward sub-processors (informational):** Supabase → **AWS**; Groq → **Google Cloud (GCP)**;
Polar → **Stripe, LLC** (US; SCCs, DPF-aligned); Vercel → **AWS**; Ahrefs → **AWS EC2 (US)**.

**Additional sign-in providers (disabled):** the codebase also supports **GitHub** and **Discord**
OAuth (each an independent controller, like Google). These are **feature-flagged OFF** and not in
use; add to the list and re-date if enabled.

## Privacy Policy — "International data transfers" section (drop-in)
noobtopro is established in **Germany** (Cologne / Köln, NRW) and is the controller of your
personal data. Several providers are outside the EEA/UK/Switzerland — principally the
**United States** (note: Ahrefs is a **Singapore** entity, but the analytics data is transferred
to and stored in the **US** on AWS EC2). Whenever we transfer your data there we rely on a
Chapter V safeguard: **EU-US DPF adequacy** (for certified recipients — **Vercel**, **Google**);
**Standard Contractual Clauses (2021) + UK IDTA + a Transfer Impact Assessment + supplementary
measures** (encryption, data-minimisation, reliance on zero-retention settings) for **Supabase**,
**Groq**, and **Ahrefs**; and, for **payments**, **Polar acts as Merchant of Record and
independent controller** under its own policy (with Stripe). Request a copy of the safeguards at
**russellrozario@noobto.pro** (`LEGAL.contactEmail`).
*Note: the EU-US DPF is under appeal (C-703/25 P); we monitor it and keep SCCs as a fallback.*

## Art. 28 DPA-in-place checklist
For each processor, confirm a **signed/accepted DPA** with the Art. 28(3) terms + a valid
Chapter V mechanism: **Supabase** (execute the DPA), **Groq** (accept DPA + **rely on the ZDR
setting**; build the TIA — handwriting images make this the priority), **Vercel** (confirm; covers
Web Analytics + Speed Insights), **Ahrefs** (confirm; data lands in the **US** on AWS EC2 → US
TIA, not Singapore). **Polar** is a controller for payment data (DPA only for any processor-role
data — confirm scope). Confirm each vendor's sub-processor notice mechanism and
breach-notification timeframe.

### Open questions for counsel
Polar's exact controller/processor split per data category · live DPF-list status of each US
recipient · whether Ahrefs processes any personal data in your deployment (data lands in the US) ·
exporter supervisory authority in the SCCs = **LDI NRW** (matches the Cologne/NRW establishment) ·
DPA execution status for each.
