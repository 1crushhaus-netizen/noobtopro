# U.S. State Privacy Notice (CCPA/CPRA + multistate) — noobtopro

> **DRAFT for counsel — not legal advice.** Slots into the Privacy Policy (Section 12). noobtopro is
> a single-person, **pre-revenue** German sole proprietorship. It meets **no** US state-privacy
> applicability threshold: CCPA needs ~$26.6M revenue **or** 100,000 CA consumers **or** 50% of
> revenue from selling/sharing; other states use 100,000-resident **or** 25,000+data-sale
> thresholds (Utah also $25M); **Texas (TDPSA) has no threshold but exempts SBA "small
> businesses,"** which we are. The one live hook even for an exempt small business is TDPSA
> §541.107 (sensitive-data consent), satisfied by our no-sell/no-share-without-consent commitment.
> These disclosures are therefore published and honored **voluntarily / in good faith**, not as a
> strict legal requirement of an operator of this size. New for **1 Jan 2026**: §7025 "Opt-Out
> Request Honored" indicator (we honor GPC as a courtesy).

This Notice is for residents of US states with comprehensive privacy laws (California CCPA/CPRA,
Virginia, Colorado, Connecticut, Utah, Oregon, Montana, Texas, and others). It supplements the rest
of our Privacy Policy and controls for those residents where it conflicts. noobtopro is operated by
**noobtopro, a sole proprietorship (Einzelunternehmen) under German law** (Cologne, Germany).

We are a small, single-person, pre-revenue business. We do not meet the size or revenue thresholds
that make most of these laws apply to us, and where a law has no threshold (Texas) we fall within
its small-business exemption. We nonetheless make the good-faith disclosures below and honor these
rights **voluntarily**, even where the law does not strictly require it of an operator of our size.

## 1. Categories of PI we collect, disclose, and "sell"/"share"
We do **not** sell or share your personal information, including **sensitive** personal information,
and we will not do so without your consent. We do not sell PI for money and we do **not** "share" PI
for cross-context behavioral advertising. (This also satisfies TDPSA §541.107 sensitive-data
consent, even though that Act's broader obligations exempt a small business of our size.)

| Category (§1798.140) | Examples | Sources | Purpose | Disclosed to | Sold? | Shared? |
|---|---|---|---|---|---|---|
| Identifiers | name, email, account ID, IP, device/cookie IDs | you; device; analytics | provide/secure; account mgmt | hosting/db, analytics, payments | No | No |
| Commercial info | subscription tier, payment status, history | you; payment processor | billing; Pro features | Polar | No | No |
| Internet/network activity | pages viewed, usage, referrers | device; analytics | analytics; improve | analytics | No | No |
| Geolocation (approx.) | coarse IP location | device | security; analytics | hosting, analytics | No | No |
| **Precise geolocation (sensitive)** | EXIF/location in photos — **stripped server-side before grading** | you (uploads) | (removed before processing) | n/a (stripped) | No | No |
| User content | typed answers; photos of work | you | AI grading | AI provider (Groq, US); hosting | No | No |
| **Sensitive PI (other)** | answers/photos may incidentally reveal health/religion/etc. or message contents | you | grading | AI provider (Groq, US); hosting | No | No |
| Inferences | performance/usage inferences | derived | improve | hosting, analytics | No | No |

The service providers we use (hosting, analytics, and the AI model provider Groq, in the US, which
grades uploaded work) process data only on our instructions to operate the Service — a
service-provider disclosure, not a sale or a share. Before any photo is sent to Groq we strip EXIF
metadata **server-side**, removing any precise geolocation embedded in the image.

**Retention:** see the Privacy Policy retention section / `data-retention-and-incident-response.md`.

## 2. Your rights
Know/access, delete, correct; **opt out of "sale"/"sharing"** and targeted advertising/certain
profiling (we do none of these, so there is nothing to opt out of — we still honor opt-out signals
as a courtesy); **limit use of Sensitive PI** (we already use it only for permitted purposes, so
this is not separately actionable — Section 4); non-discrimination; and (VA/CO/CT/OR/MT/TX and
others) the right to **appeal** a denial — appeal by email to **russellrozario@noobto.pro** with
"Appeal" in the subject; if denied, contact your state Attorney General.

## 3. Do Not Sell or Share; Opt-Out Preference Signals (GPC)
We do **not** sell or share your PI for cross-context behavioral advertising, so there is no "Do Not
Sell or Share My Personal Information" activity to switch off and no such link is required. Our setup
is consistent with this: our hosting provider operates cookieless and as a service provider, and our
site analytics (Ahrefs) are not used for ad targeting. **We nonetheless honor the Global Privacy
Control (GPC) as a courtesy:** if your browser sends a GPC signal we treat it as a valid opt-out for
that browser/device (and your account when logged in), and — consistent with the California rules in
effect from **1 Jan 2026 (§7025)** — **we display that your opt-out request was honored**. You need
not be a Pro subscriber to exercise this. We won't ask you to opt back in for 12 months.

## 4. Right to Limit the Use of Sensitive Personal Information
Some submissions could reveal Sensitive PI (health, beliefs, racial/ethnic origin, message contents,
or **precise geolocation** in a photo). We use Sensitive PI **only** to provide and secure the
grading service and other legally permitted purposes — **not** to infer characteristics or for
advertising. Because we already confine use to permitted purposes (and **strip** EXIF location
metadata from uploaded photos before grading), the "limit" right gives you nothing separate to
exercise: there is no additional secondary use to restrict, so no separate "Limit the Use of My
Sensitive Personal Information" mechanism is required.

## 5. How to exercise
**Email russellrozario@noobto.pro.** We operate online and interact with you primarily through your
account, so we provide this online method rather than a toll-free number, as permitted by California
law. We verify identity (typically via your account email). **Authorized agents** may submit
requests with your written permission (or via GPC for opt-outs). We confirm receipt and respond
within the timeframes required by applicable law (generally up to 45 days, extendable as the law
allows); most requests are free.

## 6. Non-discrimination and pricing
We will not discriminate or retaliate for exercising your rights. Our free and Pro tiers differ by
the **value of the services**, not by your exercise of privacy rights, and **both tiers get the same
privacy rights and opt-outs**.

## 7. Contact
**russellrozario@noobto.pro** — noobtopro, Cologne, Germany. California residents may also contact
the CPPA or the California Attorney General.

### Open questions for counsel
Confirm/document pre-revenue status and TX small-business exemption · confirm no analytics config
constitutes a "sale"/"share" (Ahrefs / hosting DPAs) · confirm GPC + the "honored" indicator are
implemented as described · ADMT/risk-assessment (2026 regs) for AI grading if scope changes ·
per-category retention.
