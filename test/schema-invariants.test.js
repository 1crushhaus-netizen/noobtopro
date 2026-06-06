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
