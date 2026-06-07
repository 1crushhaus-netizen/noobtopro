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
    // Grant hygiene (after the body): revoked from every client role, granted ONLY to
    // service_role — a grant to authenticated would let a caller write ANY user_id.
    expect(schema).toContain(
      "revoke all on function public.save_progress_for(uuid, jsonb, jsonb) from public, anon, authenticated"
    );
    expect(schema).toContain(
      "grant execute on function public.save_progress_for(uuid, jsonb, jsonb) to service_role"
    );
    expect(schema).not.toMatch(
      /grant execute on function public\.save_progress_for\(uuid, jsonb, jsonb\) to authenticated/
    );
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
    expect(schema).toMatch(/revoke insert, update, delete, truncate on public\.diagnostic_pool, public\.security_events from anon, authenticated/);
    expect(schema).toMatch(/revoke insert, update, delete, truncate on public\.concept_guides, public\.concept_topics from anon, authenticated/);
    // concept_reports keeps authenticated INSERT (the report feature) — only anon's
    // insert + everyone's update/delete/truncate are revoked.
    expect(schema).toMatch(/revoke update, delete, truncate on public\.concept_reports from anon, authenticated/);
    expect(schema).toMatch(/revoke insert on public\.concept_reports from anon/);
    expect(schema).not.toMatch(/revoke insert[^;]*on public\.concept_reports from anon, authenticated/);
  });

  it("bounds report flooding with one-open-report-per-user partial unique index", () => {
    expect(schema).toMatch(/create unique index if not exists concept_reports_one_open_per_user/);
    expect(schema).toMatch(/where status = 'open'/);
  });
});
