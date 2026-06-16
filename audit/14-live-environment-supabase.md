# 14 — Live Environment Scan (Supabase advisors)

Source: Supabase MCP `get_advisors` (read-only) run against the live project
`noobtopro` (ref `vwvhgnlgubctrgksyohr`, Postgres 17.6, us-east-1) on 2026-06-16.
This complements the static `db/` audit (report 04) with what the running
database actually reports.

## Summary

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 1 |
| P2 | 4 |

Most advisor notices are **benign-by-design** and were verified against the
committed DDL — see "Verified safe" below. The one item worth acting on before
launch is leaked-password protection, because it interacts with an admin-auth
assumption flagged in report 01.

---

## P1

### [P1] Supabase leaked-password protection is DISABLED (interacts with admin allowlist)
- **File(s):** Supabase Auth setting (dashboard); cross-ref `lib/adminAuth.js`
- **Category:** Security / Auth hardening
- **Description:** The security advisor reports `auth_leaked_password_protection`
  is off (HaveIBeenPwned checks disabled). On its own this is a WARN. It becomes
  more important here because report 01 found the admin email-allowlist branch is
  only safe **while email/password sign-in stays disabled** in Supabase — if a
  password provider is enabled, an attacker who controls a matching email could
  authenticate and the JWT email would satisfy the allowlist.
- **Impact:** If password auth is (or becomes) enabled, weak/compromised
  passwords are accepted, and the admin-allowlist assumption weakens.
- **Recommended fix:** (1) Confirm email/password auth is disabled in Supabase
  (OAuth-only) — if so, document it as a hard invariant; (2) enable leaked-password
  protection regardless as defense-in-depth; (3) prefer `ADMIN_USER_IDS` (UUIDs)
  over `ADMIN_EMAILS` so admin access never depends on the auth-method invariant.
  https://supabase.com/docs/guides/auth/password-security

---

## P2

### [P2] Unindexed foreign key `concept_guides_topic_fk`
- **File(s):** live DB `public.concept_guides`; cross-ref `db/` migrations
- **Category:** Performance
- **Description:** Performance advisor: FK `concept_guides_topic_fk` has no
  covering index. Joins/deletes that traverse it do sequential scans.
- **Impact:** Minor today; grows with the guide cache. Compounds the "no index
  for anonymous concept_guides browse" P2 from report 04.
- **Recommended fix:** Add an index covering the FK columns.
  https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

### [P2] RLS enabled but no policy on 4 tables (verify deny-all intent)
- **File(s):** live DB `concept_reports`, `item_difficulty`, `rate_limits`, `security_events`
- **Category:** Security (informational)
- **Description:** Advisor `rls_enabled_no_policy` (INFO) on four tables. RLS on
  with no policy = **deny-all** to anon/authenticated (only the service role,
  which bypasses RLS, can touch them). This is the intended pattern for
  server-only tables. Flagged so it's a conscious decision, not an accident, and
  so a future "add a SELECT policy" change is reviewed carefully (esp.
  `security_events`, which stores attacker-controlled snippets, and
  `item_difficulty`, which drives population ranking).
- **Impact:** None currently; risk is a future accidental policy that exposes
  these server-only tables.
- **Recommended fix:** Keep deny-all. Add a code/SQL comment on each table
  stating "RLS on, no policy = service-role-only by design."

### [P2] Three SECURITY DEFINER functions executable by `authenticated` (verified self-scoped)
- **File(s):** `db/schema.sql:244` (`migrate_guest_data`), `db/schema.sql:454`
  (`delete_user_data`), and `submit_concept_report`
- **Category:** Security (informational / by-design)
- **Description:** Advisor `authenticated_security_definer_function_executable`
  (WARN) on these user-facing RPCs. **Verified against the DDL:** each captures
  `uid := auth.uid()`, null-checks it, only touches the caller's own rows, pins
  `search_path = public`, and has EXECUTE revoked from `public`/`anon` and
  granted only to `authenticated`. These are intentional self-service RPCs
  (guest→account migration, account/data deletion, concept report) and are safe.
  (`delete_user_data` is also the GDPR/CCPA data-deletion path — relevant to the
  legal-readiness findings in report 11.)
- **Impact:** None — false-positive-by-design. Documented to prevent a future
  "fix the advisor" change from breaking a legitimate user flow.
- **Recommended fix:** No change. Optionally annotate each function with a
  comment noting the advisor is acknowledged and the function is self-scoped.

### [P2] Confirm Vercel region == Supabase region (us-east-1)
- **File(s):** `vercel.json`; live Supabase region `us-east-1`
- **Category:** Performance / DevOps
- **Description:** Supabase is in `us-east-1`. Report 10 flagged no region
  pinning in `vercel.json`. Vercel's default function region is `iad1`
  (us-east-1), so this is likely already co-located — but it is unpinned, so a
  future dashboard change could silently add cross-region DB latency to every
  request. NEEDS VERIFICATION of the Vercel project's function region setting.
- **Impact:** Latent latency risk if regions drift apart.
- **Recommended fix:** Pin the function region to `iad1` (or set explicitly) so
  it can't drift from Supabase.

---

## Verified safe (no finding) — checked against live + DDL
- User-callable SECURITY DEFINER RPCs are self-scoped to `auth.uid()` with
  EXECUTE revoked from anon/public (confirmed `db/schema.sql:244,454`).
- No critical/ERROR-level security or performance lints on the live database.
- The four RLS-no-policy tables are deny-all by design (service-role-only).
