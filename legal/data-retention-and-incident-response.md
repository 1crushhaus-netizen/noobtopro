# Data Retention Schedule + Breach & DSAR Runbooks (internal) — noobtopro

> **DRAFT for counsel/operator — not legal advice.** Fill `[placeholders]`. Internal-facing.
> Code-verified facts: photos are **transient** (sent to Groq, not stored); **answer text IS
> stored** in `attempt_reviews.answer` (≤12k chars); `security_events` stores real client **IP**
> and its prune is **UNSCHEDULED** (admin-load only → IP logs grow unbounded); account deletion
> cascades all per-user tables + cancels Polar but the IP scrub matches only `user_id` (misses
> `user_id = NULL` rows holding the IP); **Ahrefs analytics is undisclosed with no consent**.

## Retention schedule
| # | Category | Where | Personal data | Basis | Retention | Deletion mechanism |
|---|---|---|---|---|---|---|
| 1 | Account/auth | Supabase `auth.users` | name, email, OAuth pic, age-verify (birth year) | Contract | life of account; purge inactive after **[24 mo]** (notice first) | account-delete → `auth.admin.deleteUser` (cascades) |
| 2 | Scores/ranks/history | `scores`, `attempts`, `concept_mastery` | scores, glicko, rank moves | Contract/LI | life of account / until "reset progress" | cascade on delete; `delete_user_data()` on reset |
| 3 | Answer text + feedback | `attempt_reviews` | question, free-text answer (≤12k), rubric, feedback | Contract | life of account; consider auto-trim > **[12 mo]** | cascade off `attempts` |
| 4 | Photos | **not stored** (→ Groq, discarded) | handwriting images (transient) | Contract | **zero/transient** (confirm Groq retention; **enable ZDR**) | n/a |
| 5 | Subscription/billing | `subscriptions` (local) + **Polar** | status, polar IDs, period end (no card data) | Contract/**Legal (tax)** | local: deleted on account deletion; **tax records at Polar: [6–10 yr]** | local cascade + Polar revoke |
| 6 | Security/event logs (incl. IP) | `security_events`, `rate_limits` | client **IP**, route, flagged sample | LI (security) | **[90 days]** then delete | `prune_security_data(90)` — **MUST be scheduled** |
| 7 | Analytics | Vercel/Ahrefs | pageviews, performance | **Consent**/LI | processor default; **[14 mo]** max | processor-side config |
| 8 | DSAR/erasure logs | [request log] | requester email, type, action | Legal | **[3 yr]** after closure | scheduled purge |
| 9 | Breach records (Art. 33(5)) | [breach register] | facts, effects, remediation | Legal | **[5 yr]** | scheduled purge |

**Privacy Policy retention paragraph** — see `privacy-policy.md` §8.

## Breach-response runbook (target: SA decision within 72h of awareness)
1. **Detect & contain** (rotate keys, revoke tokens, isolate); **record the awareness time** (starts the 72h clock).
2. **Triage & assess risk** (categories — note no card data, no stored photos; numbers; EU/UK/US residents) using EDPB factors.
3. **SA notification (by 72h)** to your lead SA **[name]** unless unlikely to risk rights; include Art. 33(3) content; **phased notice** permitted (file on time, supplement).
4. **Data-subject notification (Art. 34)** if **high risk** — clear language, without undue delay (skip only if encrypted/neutralised/disproportionate → public notice).
5. **US residents** — notify per applicable **state** breach laws (often 30–60 days; check AG/credit-bureau thresholds).
6. **Document everything** (Art. 33(5)) even if not reported; retain **[5 yr]**.
7. **Post-incident** root-cause/fix; notify processors/insurer per contract.
*Pre-fill:* lead SA + portal · DPO/contact · processor breach-contacts (Supabase/Groq/Polar/Vercel) · counsel.

## DSAR runbook (target: substantive response within 1 month)
1. **Intake & log** (any channel counts; the one-month clock starts on receipt; acknowledge).
2. **Verify identity** (account auth is sufficient; only request more if reasonable doubt; you may suspend the deadline pending necessary verification — document it; don't over-collect).
3. **Classify & locate:** Access (export account + scores/attempts/`attempt_reviews` incl. answer text + subscription metadata; photos not stored); **Erasure** (run account-delete cascade + Polar cancel, **then manually purge `security_events`/`rate_limits` rows holding the IP** — automated scrub matches only `user_id`); Portability (JSON/CSV); Rectification/restriction/objection.
4. **Refusal/fee** only if **manifestly unfounded/excessive** (justify); else free.
5. **Respond by day 30** (extend by 2 months for complex/numerous, with notice in month 1); inform of the right to complain to a SA.
6. **Log the outcome**; retain DSAR records **[3 yr]**.

## DPIA / DPO / representative triggers
- **DPIA — likely required**: meets EDPB "evaluation/scoring" + "automated evaluation" criteria
  (the grading/ranking pipeline). NOT triggered by children (18+) nor by photos (not Art. 9
  biometric on current facts, Recital 51). Scope a DPIA around rank/grading + answer-text retention.
- **DPO — likely NOT mandatory** (grading isn't large-scale behaviour-monitoring; no large-scale
  Art. 9 data) — but recommended; **document the decision** (status currently unknown).
- **EU Art. 27 representative — N/A** (EU-established). **UK Art. 27 representative — likely
  REQUIRED** for ongoing UK users with no UK establishment — appoint and name in the policy.

## Engineering fixes the analysis demands (hand to dev)
1. **Schedule** the `security_events`/`concept_reports` prune (Vercel Cron / Supabase pg_cron) — currently admin-load only.
2. **Make erasure complete** — purge/anonymise `security_events`/`rate_limits` by **IP**, not just `user_id` (or anonymise IPs at write).
3. **Disclose Ahrefs** + add the EU consent mechanism (see `cookie-policy.md`); fill the privacy placeholders.
4. **Enable Groq ZDR**; **strip EXIF** (incl. precise geolocation) on photo upload.

### Open questions for counsel
Retention periods (esp. statutory tax years for **[member state]**) · lead SA / establishment ·
UK representative · DPO decision · DPIA sign-off (+ confirm Art. 22 not engaged) · Groq biometric/
retention confirmation in the DPA · Art. 30 records (the <250-employee carve-out likely doesn't
apply) · sub-processor DPAs in place.
