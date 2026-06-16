-- ---------------------------------------------------------------------------
-- 0022 — Retention prune for security_events + concept_reports (audit 04 P2-8 / 06 P2-1).
--
-- security_events stores a bounded snippet (`sample`, ≤500 chars) of flagged learner/
-- attacker text, and concept_reports stores user-submitted report text. Neither had any
-- retention bound, so this PII-bearing data grew forever. This adds a service-role-only
-- prune the admin-data route calls opportunistically (admins load it infrequently), so old
-- rows age out instead of accumulating indefinitely. Open reports are retained for review.
-- ---------------------------------------------------------------------------

create or replace function public.prune_security_data(p_days int default 90)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(1, coalesce(p_days, 90)));
begin
  -- Transient security logs: drop everything past the retention window (≥90 days is
  -- ample for review; the open queue surfaces recent items).
  delete from public.security_events where created_at < cutoff;
  -- User reports: keep OPEN ones (the admin still needs to action them); drop only the
  -- already-handled (reviewed/dismissed) ones past the window.
  delete from public.concept_reports where status <> 'open' and created_at < cutoff;
end;
$$;

revoke all on function public.prune_security_data(int) from public, anon, authenticated;
grant execute on function public.prune_security_data(int) to service_role;
