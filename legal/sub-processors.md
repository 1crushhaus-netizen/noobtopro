# Sub-processors & Third-Party Recipients — noobtopro

> **DRAFT for counsel — not legal advice.** Verify each vendor's role, region, transfer
> mechanism, and live DPF-list status before publishing. **Last updated:** [DATE].
> We will give **[30 days']** notice of new sub-processors via **[email / this page]**.

| # | Name (entity) | Role | Purpose | Personal data | Location | Transfer mechanism (EU/UK→) | DPA / legal link |
|---|---|---|---|---|---|---|---|
| 1 | **Supabase, Inc.** | Processor | Database (Postgres), authentication, storage | Account/auth IDs (email, Google OAuth subject), profile & grading data | USA (AWS us-east-1) | **SCCs (Module 2) + UK Addendum + TIA**; ISO 27001, SOC 2 (**not** DPF-certified) | supabase.com/legal/dpa |
| 2 | **Groq, Inc.** | Processor | LLM inference / AI grading | Typed answers; **photos of handwritten work**; derived outputs | USA (GCP) | **SCCs (Module 2) + TIA**; **enable ZDR**; no-training commitment (**not** DPF-certified) | console.groq.com/docs/legal/customer-data-processing-addendum · trust.groq.com/subprocessors |
| 3 | **Polar Software, Inc.** | **Independent Controller** (Merchant of Record) | Payments, billing, fraud, tax/VAT, invoicing | Name, email, billing/transaction data (no full card numbers) | USA | **Controller-to-controller**; Polar's own policy & SCCs/DPF chain (Stripe sub-processor) | polar.sh/legal/privacy · polar.sh/legal/payment-processor-partners |
| 4 | **Vercel, Inc.** | Processor | Hosting/CDN + Web Analytics | Request/log/IP-derived metadata, deployment data | USA (AWS; default US) | **EU-US DPF (Active, certified 4 Jun 2024) + UK/Swiss extensions**; SCCs fallback | vercel.com/legal/dpa |
| 5 | **Ahrefs Pte. Ltd.** | Processor | Privacy-friendly web analytics (cookieless) | Aggregated traffic metrics; **verify IP handling** (daily salted hash) | Singapore (AWS) | If personal data: **SCCs (Modules 2/3) + TIA (Singapore)**; else Chapter V not engaged | ahrefs.com/legal/data-processing-addendum |
| 6 | **Google LLC** (Sign in with Google) | **Independent Controller** | Federated authentication | Google account ID/email, auth tokens | USA | **EU-US DPF (Google LLC)** + Google's own safeguards | (link Google's policy / DPF entry) |

**Onward sub-processors (informational):** Supabase → **AWS**; Groq → **Google Cloud (GCP)**;
Polar → **Stripe, LLC** (US; SCCs, DPF-aligned); Vercel → **AWS**; Ahrefs → **AWS EC2**.

## Privacy Policy — "International data transfers" section (drop-in)
noobtopro is established in **[EU/EEA country]** and is the controller of your personal data.
Some providers are outside the EEA/UK/Switzerland — principally the **United States** and, for
analytics, **Singapore**. Whenever we transfer your data there we rely on a Chapter V safeguard:
**EU-US DPF adequacy** (for certified recipients — **Vercel**, **Google**); **Standard
Contractual Clauses (2021) + UK IDTA + a Transfer Impact Assessment + supplementary measures**
(encryption, data-minimisation, zero-retention) for **Supabase**, **Groq**, and **Ahrefs**;
and, for **payments**, **Polar acts as Merchant of Record and independent controller** under its
own policy (with Stripe). Request a copy of the safeguards at **[privacy@…]**.
*Note: the EU-US DPF is under appeal (C-703/25 P); we monitor it and keep SCCs as a fallback.*

## Art. 28 DPA-in-place checklist
For each processor, confirm a **signed/accepted DPA** with the Art. 28(3) terms + a valid
Chapter V mechanism: **Supabase** (execute the DPA), **Groq** (accept DPA + **enable ZDR**;
build the TIA — handwriting images make this the priority), **Vercel** (confirm), **Ahrefs**
(confirm; verify whether any personal data → Singapore TIA). **Polar** is a controller for
payment data (DPA only for any processor-role data — confirm scope). Confirm each vendor's
sub-processor notice mechanism and breach-notification timeframe.

### Open questions for counsel
Polar's exact controller/processor split per data category · live DPF-list status of each US
recipient · whether Ahrefs processes any personal data in your deployment · the exporter
supervisory authority in the SCCs (match your establishment) · DPA execution status for each.
