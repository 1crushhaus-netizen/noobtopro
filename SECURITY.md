# Security Policy

We take the security of noobtopro and the safety of our users' data seriously.
This product handles personal data and payments, so we welcome reports from
security researchers and operators who find a vulnerability.

## Reporting a vulnerability

Please report security issues privately by email to **[security@your-domain]**.

Include as much detail as you can so we can reproduce and triage quickly:

- A description of the issue and its potential impact.
- Step-by-step reproduction instructions (and a proof-of-concept if you have one).
- The affected URL, endpoint, or component, and any relevant request/response data.
- Your name or handle if you would like to be credited.

Please do **not** open a public GitHub issue, pull request, or social-media post
for a security vulnerability.

## Scope

In scope:

- The web application at `https://noobto.pro`.
- The application's API routes (`/api/*`), including question/score signing,
  scoring, and rate limiting.
- Authentication and session handling (Supabase OAuth sign-in, account access).
- The payment / subscription flow (Polar checkout and webhook handling) and the
  Pro entitlement gating.

Out of scope (please do not test these):

- Denial-of-service / volumetric load testing, or any testing that degrades
  service for other users.
- Social engineering of our staff, users, or vendors; physical attacks.
- Findings that only affect third-party services (Supabase, Groq, Vercel,
  Polar/Stripe) — please report those to the relevant vendor.
- Reports of missing best-practice headers with no demonstrated impact.

Please test only against accounts you own, and avoid accessing, modifying, or
deleting other users' data. If you encounter personal data during testing, stop
and tell us immediately.

## Our commitment

- We aim to acknowledge your report within **3 business days**.
- We aim to provide an initial assessment and a remediation plan within
  **10 business days**, and will keep you updated as we work on a fix.
- We ask that you give us a reasonable opportunity to remediate the issue before
  any public disclosure, and that you coordinate the timing of any disclosure
  with us.

## Bug bounty

We do not operate a formal bug-bounty program at this time and cannot guarantee
monetary rewards. We are grateful for responsible disclosure and are happy to
credit researchers who report valid issues, with their permission.
