// Static guard on db/schema.sql's load-bearing invariants. The unit suite mocks
// Supabase and never executes SQL, so a regression in the RPC bodies — e.g.
// re-coupling concept-guide visibility to p_safe (the pre-hardening behavior), or
// dropping the control/zero-width strip in _concept_key — would otherwise ship
// fully green. These textual assertions fail CI if those invariants are weakened.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

// Slice a function's body: from its CREATE line up to the terminating `$$;`.
function fnBody(name) {
  const start = schema.indexOf(`create or replace function public.${name}(`);
  expect(start, `function ${name} should exist in db/schema.sql`).toBeGreaterThanOrEqual(0);
  const end = schema.indexOf("\n$$;", start);
  expect(end, `function ${name} should terminate with $$;`).toBeGreaterThan(start);
  return schema.slice(start, end);
}

describe("db/schema.sql — curation-only invariant (auto-grown guides are never public)", () => {
  it("promote_or_insert_guide ALWAYS stores visibility='hidden' and never 'public'", () => {
    // Both write paths (the pending-stub promote UPDATE and the user-guide INSERT)
    // set visibility='hidden'; the function contains NO 'public' literal at all, so
    // an attacker-influenced auto-grown guide can never reach the public read policy.
    const promote = fnBody("promote_or_insert_guide");
    expect(promote).toMatch(/visibility\s*=\s*'hidden'/); // promote UPDATE
    expect(promote).toContain("'hidden'"); // INSERT values
    expect(promote).not.toContain("'public'"); // no public-visibility coupling
  });

  it("register_concepts stores grader stubs as status='pending' (excluded by the read policy)", () => {
    expect(fnBody("register_concepts")).toContain("'pending'");
  });

  it("the public read policy only exposes visibility='public' AND status='ready'", () => {
    expect(schema).toContain("using (visibility = 'public' and status = 'ready')");
  });

  it("seed_curated_guide is the ONLY function that publishes (visibility='public'), and is service-role only", () => {
    // PR 4: the sanctioned BATCH public-publish path. It DOES set visibility='public'
    // (unlike promote_or_insert_guide), but is service-role only — so a signed-in user
    // can never self-publish to the hub (the curation-only model holds: seed + admin
    // approve are the only public paths; nothing automated/client-callable goes public).
    const body = fnBody("seed_curated_guide");
    expect(body).toContain("security definer");
    expect(body).toContain("'public'"); // it is the public path
    expect(body).toMatch(/'curated'/);
    expect(schema).toContain("revoke all on function public.seed_curated_guide(text, text, text, jsonb, text) from public, anon, authenticated");
    expect(schema).toContain("grant execute on function public.seed_curated_guide(text, text, text, jsonb, text) to service_role");
    expect(schema).not.toMatch(/grant execute on function public\.seed_curated_guide\([^)]*\) to authenticated/);
    // No OTHER concept-guide write function may emit 'public' (promote_or_insert_guide stays hidden).
    expect(fnBody("promote_or_insert_guide")).not.toContain("'public'");
  });

  it("dedupe_pending_stubs only deletes status='pending' rows (never public/ready/curated), service-role only", () => {
    const body = fnBody("dedupe_pending_stubs");
    expect(body).toContain("security definer");
    expect(body).toContain("g.status = 'pending'"); // only pending stubs are eligible for deletion
    expect(schema).toContain("grant execute on function public.dedupe_pending_stubs() to service_role");
    expect(schema).not.toMatch(/grant execute on function public\.dedupe_pending_stubs\(\) to authenticated/);
  });

  it("refresh_guide (PR 5 auto-heal) only overwrites NON-curated guides, and is service-role only", () => {
    // The stale-guide auto-heal must never overwrite a curated (author-vetted) row, and
    // must never promote a hidden guide to public — it only updates content/topic/level.
    const body = fnBody("refresh_guide");
    expect(body).toContain("security definer");
    expect(body).toContain("source <> 'curated'"); // curated guides are off-limits
    expect(body).not.toContain("visibility"); // never changes visibility (no hidden→public)
    expect(schema).toContain("revoke all on function public.refresh_guide(text, text, jsonb, text, text) from public, anon, authenticated");
    expect(schema).toContain("grant execute on function public.refresh_guide(text, text, jsonb, text, text) to service_role");
    expect(schema).not.toMatch(/grant execute on function public\.refresh_guide\([^)]*\) to authenticated/);
  });
});

describe("db/schema.sql — _concept_key parity with lib/supabaseAdmin.js conceptKey", () => {
  // Mirrors the JS regex /[\x00-\x1F\x7F-\x9F​-‍﻿]/ (test/conceptKey.test.js).
  // Search lowercased substrings so the assertions don't depend on backslash escaping.
  const key = fnBody("_concept_key").toLowerCase();
  it("strips the control range (C0 + DEL/C1) that JS conceptKey strips", () => {
    expect(key).toContain("x00-"); // C0 controls start
    expect(key).toContain("x1f"); // C0 controls end
    expect(key).toContain("x7f-"); // DEL + C1 start
    expect(key).toContain("x9f"); // C1 end
  });
  it("strips the zero-width range and the BOM", () => {
    expect(key).toContain("x200b-"); // zero-width space
    expect(key).toContain("x200d"); // zero-width joiner
    expect(key).toContain("xfeff"); // BOM
  });
  it("truncates by character with left(...,200) (matches JS Array.from slice)", () => {
    expect(key).toContain("left(");
    expect(key).toContain("200");
  });
});

describe("db/schema.sql — server-authoritative scoring (the trust boundary)", () => {
  it("scores & attempts are SELECT-only for authenticated (no direct client write path)", () => {
    expect(schema).toMatch(/create policy "read own scores"\s+on public\.scores for select/);
    expect(schema).toMatch(/create policy "read own attempts"\s+on public\.attempts for select/);
    // The prior read+write ("for all") policies must be gone, so a signed-in user can
    // no longer PATCH their own scores row to an arbitrary value via PostgREST.
    expect(schema).not.toMatch(/on public\.scores for all/);
    expect(schema).not.toMatch(/on public\.attempts for all/);
  });

  it("the client-callable save_progress(jsonb,jsonb) is dropped and never recreated", () => {
    expect(schema).toContain("drop function if exists public.save_progress(jsonb, jsonb)");
    expect(schema).not.toMatch(/create or replace function public\.save_progress\(p_scores/);
  });

  it("save_progress_for writes for an explicit p_user and is SERVICE-ROLE ONLY", () => {
    const body = fnBody("save_progress_for");
    expect(body).toContain("security definer");
    expect(body).toContain("p_user"); // user_id = p_user (the JWT-verified uid), not a client value
    expect(body).toContain("rubric"); // persists the per-subject rubric profile
    // PR 6: now a 4-arg signature (p_review default null). The old 3-arg is dropped so a
    // 3-arg call resolves unambiguously to this defaulted version. Grant hygiene: revoked
    // from every client role, granted ONLY to service_role.
    expect(schema).toContain("drop function if exists public.save_progress_for(uuid, jsonb, jsonb, jsonb)");
    expect(schema).toContain(
      "revoke all on function public.save_progress_for(uuid, jsonb, jsonb, jsonb, timestamptz, boolean) from public, anon, authenticated"
    );
    expect(schema).toContain(
      "grant execute on function public.save_progress_for(uuid, jsonb, jsonb, jsonb, timestamptz, boolean) to service_role"
    );
    expect(schema).not.toMatch(
      /grant execute on function public\.save_progress_for\(uuid, jsonb, jsonb, jsonb\) to authenticated/
    );
  });

  it("attempt_reviews (PR 6) is RLS SELECT-own with writes revoked (only save_progress_for writes it)", () => {
    expect(schema).toMatch(/create table if not exists public\.attempt_reviews/);
    expect(schema).toMatch(/alter table public\.attempt_reviews enable row level security/);
    // Read policy is SELECT, scoped to the owner via auth.uid().
    expect(schema).toMatch(/create policy "read own attempt reviews"\s+on public\.attempt_reviews for select/);
    expect(schema).toContain("(select auth.uid()) = user_id");
    // No client write path (all writes go through the service-role save_progress_for).
    expect(schema).toMatch(/revoke insert, update, delete, truncate on public\.attempt_reviews from anon, authenticated/);
    // save_progress_for writes the review row in the SAME transaction as the attempt.
    expect(fnBody("save_progress_for")).toContain("attempt_reviews");
  });

  it("migrate_guest_data & delete_user_data are SECURITY DEFINER, self-scoped to auth.uid()", () => {
    // They must be DEFINER to write under the now SELECT-only RLS, but stay self-scoped
    // (auth.uid()) so an authenticated caller can only touch their OWN rows.
    for (const name of ["migrate_guest_data", "delete_user_data"]) {
      const body = fnBody(name);
      expect(body, `${name} should be SECURITY DEFINER`).toContain("security definer");
      expect(body, `${name} should self-scope via auth.uid()`).toContain("auth.uid()");
    }
  });

  it("scores has a rubric jsonb column", () => {
    expect(schema).toMatch(/rubric jsonb/);
  });

  it("revokes direct client write grants on scores/attempts (grant-layer defense-in-depth)", () => {
    expect(schema).toMatch(/revoke insert, update, delete.*on public\.scores\s+from anon, authenticated/);
    expect(schema).toMatch(/revoke insert, update, delete.*on public\.attempts\s+from anon, authenticated/);
  });

  it("keeps RLS ENABLED on scores and attempts (not just policy-shaped)", () => {
    expect(schema).toMatch(/alter table public\.scores\s+enable row level security/);
    expect(schema).toMatch(/alter table public\.attempts enable row level security/);
  });
});

describe("db/schema.sql — audit-hardening invariants", () => {
  it("save_progress_for serializes same-user writes with a per-user advisory lock", () => {
    expect(fnBody("save_progress_for")).toContain("pg_advisory_xact_lock(hashtextextended(p_user::text, 0))");
  });

  it("revokes default client DML on the concept-hub / internal tables (keeps public SELECT + report INSERT)", () => {
    expect(schema).toMatch(/revoke insert, update, delete, truncate on public\.security_events from anon, authenticated/);
    // 0013: diagnostic_pool + try_add_diagnostic were DROPPED (superseded by the
    // curated lib/diagnosticBank.js) — the schema must not resurrect them.
    expect(schema).not.toMatch(/create table if not exists public\.diagnostic_pool/);
    expect(schema).not.toMatch(/create or replace function public\.try_add_diagnostic/);
    expect(schema).toMatch(/revoke insert, update, delete, truncate on public\.concept_guides, public\.concept_topics from anon, authenticated/);
    // 0011 (audit P2-8): the direct INSERT is revoked from EVERYONE — reports go
    // through the rate-bounded submit_concept_report RPC only.
    expect(schema).toMatch(/revoke update, delete, truncate on public\.concept_reports from anon, authenticated/);
    expect(schema).toMatch(/revoke insert on public\.concept_reports from anon, authenticated/);
    expect(schema).not.toMatch(/create policy "report own"/);
  });

  it("bounds report flooding with one-open-report-per-user partial unique index", () => {
    expect(schema).toMatch(/create unique index if not exists concept_reports_one_open_per_user/);
    expect(schema).toMatch(/where status = 'open'/);
  });

  it("durable rate limiter: rate_limit_hit is SECURITY DEFINER + service-role only; rate_limits is write-locked", () => {
    const body = fnBody("rate_limit_hit");
    expect(body).toContain("security definer");
    expect(body).toContain("on conflict (bucket) do update"); // atomic increment
    expect(schema).toContain("revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated");
    expect(schema).toContain("grant execute on function public.rate_limit_hit(text, int, int) to service_role");
    expect(schema).not.toMatch(/grant execute on function public\.rate_limit_hit\(text, int, int\) to authenticated/);
    expect(schema).toMatch(/alter table public\.rate_limits enable row level security/);
    expect(schema).toMatch(/revoke insert, update, delete, truncate on public\.rate_limits from anon, authenticated/);
  });
});

describe("db/schema.sql — Elo ranking + leaderboard invariants (PR 3)", () => {
  it("item_difficulty is RLS-on + write-locked (internal, service-role only)", () => {
    expect(schema).toMatch(/create table if not exists public\.item_difficulty/);
    expect(schema).toMatch(/alter table public\.item_difficulty enable row level security/);
    expect(schema).toMatch(/revoke insert, update, delete, truncate on public\.item_difficulty from anon, authenticated/);
    // FK to the taxonomy keeps the bucket key space bounded + valid.
    expect(schema).toMatch(/foreign key \(subject, topic\) references public\.concept_topics\(subject, slug\)/);
  });

  it("bump_item_difficulty is SECURITY DEFINER + service-role only (no client grant)", () => {
    const body = fnBody("bump_item_difficulty");
    expect(body).toContain("security definer");
    expect(schema).toContain("revoke all on function public.bump_item_difficulty(text, text, text, numeric, numeric) from public, anon, authenticated");
    expect(schema).toContain("grant execute on function public.bump_item_difficulty(text, text, text, numeric, numeric) to service_role");
    expect(schema).not.toMatch(/grant execute on function public\.bump_item_difficulty\([^)]*\) to authenticated/);
  });

  it("leaderboard_tiers is SECURITY DEFINER + service-role only, and exposes NO per-user identity", () => {
    const body = fnBody("leaderboard_tiers");
    expect(body).toContain("security definer");
    // Anonymous by construction: it aggregates counts; it must NOT select email / name
    // or return per-user identity rows.
    expect(body).not.toMatch(/email/i);
    expect(body).not.toMatch(/raw_user_meta_data/i);
    expect(schema).toContain("revoke all on function public.leaderboard_tiers(uuid) from public, anon, authenticated");
    expect(schema).toContain("grant execute on function public.leaderboard_tiers(uuid) to service_role");
    // A grant to authenticated would add the authenticated_security_definer advisor AND
    // let a client call the cross-user aggregate directly — neither is allowed.
    expect(schema).not.toMatch(/grant execute on function public\.leaderboard_tiers\(uuid\) to authenticated/);
  });

  it("attempts has a rationale column (the persisted 'why your rank moved' line)", () => {
    expect(schema).toMatch(/alter table public\.attempts add column if not exists rationale text/);
    expect(fnBody("save_progress_for")).toContain("rationale"); // persisted by the write RPC
  });
});

describe("db/schema.sql — concept_mastery (per-concept mastery, migration 0010)", () => {
  it("the table is RLS-enabled with a SELECT-own policy and all client writes revoked", () => {
    expect(schema).toContain("alter table public.concept_mastery enable row level security;");
    expect(schema).toMatch(/create policy concept_mastery_select_own on public\.concept_mastery\s*\n?\s*for select to authenticated using \(\(select auth\.uid\(\)\) = user_id\);/);
    expect(schema).toContain("revoke all on public.concept_mastery from public, anon, authenticated;");
    expect(schema).toContain("grant select on public.concept_mastery to authenticated;");
  });

  it("bump_concept_mastery is SECURITY DEFINER, search_path-pinned, and service-role ONLY", () => {
    const fn = fnBody("bump_concept_mastery");
    expect(fn).toContain("security definer");
    expect(fn).toContain("set search_path = public");
    expect(schema).toContain("revoke all on function public.bump_concept_mastery(uuid, jsonb) from public, anon, authenticated;");
    expect(schema).toContain("grant execute on function public.bump_concept_mastery(uuid, jsonb) to service_role;");
  });

  it("the SQL green threshold mirrors lib/mastery.js#MASTERY_GREEN_QUALITY", async () => {
    const { MASTERY_GREEN_QUALITY } = await import("@/lib/mastery");
    const fn = fnBody("bump_concept_mastery");
    // Two sites: the INSERT seed and the UPDATE increment. Pinned to the LIVE JS
    // constant (not a literal), so changing either side alone fails this test.
    expect(fn.match(new RegExp(`>= ${MASTERY_GREEN_QUALITY}`, "g"))?.length).toBe(2);
  });

  it("migrate_guest_data carries p_mastery (3-arg, defaulted) and the mastery insert is allow-listed", () => {
    expect(schema).toContain("create or replace function public.migrate_guest_data(p_scores jsonb, p_attempts jsonb, p_mastery jsonb default null)");
    const fn = fnBody("migrate_guest_data");
    expect(fn).toContain("insert into public.concept_mastery");
    expect(fn).toMatch(/s\.key in \('math', 'physics', 'chemistry'\)/);
    expect(schema).toContain("grant execute on function public.migrate_guest_data(jsonb, jsonb, jsonb) to authenticated;");
  });

  it("delete_user_data clears concept_mastery too (a reset clears the chip coloring)", () => {
    expect(fnBody("delete_user_data")).toContain("delete from public.concept_mastery where user_id = uid;");
  });
});

describe("db/schema.sql — audit fix round 2 (0011)", () => {
  it("attempts carries the token jti with a per-user unique partial index (replay dedupe)", () => {
    expect(schema).toContain("alter table public.attempts add column if not exists jti text;");
    expect(schema).toMatch(/create unique index if not exists attempts_user_jti_uidx\s*\n?\s*on public\.attempts \(user_id, jti\) where jti is not null;/);
  });

  it("save_progress_for dedupes on jti and supports the optimistic-concurrency check", () => {
    const fn = fnBody("save_progress_for");
    expect(fn).toContain("'duplicate'");
    expect(fn).toContain("'conflict'");
    expect(fn).toContain("p_expected_updated_at");
    expect(fn).toContain("is distinct from");
    expect(fn).toContain("p_check_conflict requires exactly one score row");
  });

  it("delete_user_data takes the same per-user advisory lock as save_progress_for", () => {
    expect(fnBody("delete_user_data")).toContain("pg_advisory_xact_lock(hashtextextended(uid::text, 0))");
  });

  it("migrate_guest_data admits a guest glicko blob only through _valid_glicko (bounded, numerically sane)", () => {
    expect(fnBody("migrate_guest_data")).toContain("public._valid_glicko(s->'glicko')");
    const vg = fnBody("_valid_glicko");
    expect(vg).toContain("between -2500 and 5500"); // rating bounds (the engine's legal band)
    expect(vg).toContain("is not true"); // three-valued-logic guard: a NULL axis check must flag, not slip
    expect(vg).toContain("between 1 and 500"); // rd bounds
    expect(vg).toContain("between 0 and 0.2"); // vol bounds
  });

  it("submit_concept_report is the only report path: authenticated EXECUTE, ≤20 open per reporter", () => {
    const fn = fnBody("submit_concept_report");
    expect(fn).toContain("security definer");
    expect(fn).toContain(">= 20");
    expect(schema).toContain("grant execute on function public.submit_concept_report(text, text, text) to authenticated;");
    expect(schema).toContain("revoke all on function public.submit_concept_report(text, text, text) from public, anon;");
  });
});
