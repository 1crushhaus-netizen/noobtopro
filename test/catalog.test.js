// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Supabase client so we can assert the PostgREST query shape (which
// filters/orders the browse path issues) and drive auth state, without a real DB.
// `mocks.client` is what getSupabase() returns — set it to `null` to exercise the
// "Supabase not configured" branches. `mocks.result` is the {data,error} the
// chainable from()-builder resolves to (it's thenable, mirroring supabase-js, so
// `await from().select().eq().order().order()` resolves to it). `mocks.calls`
// captures every builder call's args so tests can assert .eq("subject", ...),
// the escaped .ilike(...) term, and the stable .order() sequence. `mocks.insert`
// records concept_reports inserts and `mocks.insertResult` configures their result.
const mocks = vi.hoisted(() => ({
  client: null,
  result: { data: [], error: null },
  session: { data: { session: null } },
  insert: [],
  insertResult: { error: null },
  calls: {}, // per-table: { [table]: { select, eq:[], ilike:[], order:[], limit:[] } }
  makeClient: null,
}));

// Build the fake chainable client fresh per test (clearing captured calls).
mocks.makeClient = () => ({
  auth: { getSession: async () => mocks.session },
  from: (table) => {
    const c = (mocks.calls[table] ||= { eq: [], ilike: [], order: [], limit: [] });
    const chain = {
      select: (...a) => { c.select = a; return chain; },
      eq: (...a) => { c.eq.push(a); return chain; },
      ilike: (...a) => { c.ilike.push(a); return chain; },
      order: (...a) => { c.order.push(a); return chain; },
      limit: (...a) => { c.limit.push(a); return chain; },
      // thenable: `await chain` resolves to the configured read result.
      then: (resolve, reject) => Promise.resolve(mocks.result).then(resolve, reject),
      insert: async (...a) => { mocks.insert.push(a); return mocks.insertResult; },
    };
    return chain;
  },
});

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabase: () => mocks.client,
}));

import { loadTopics, browsePublicConcepts, reportConcept } from "@/lib/catalog";
import { conceptKey } from "@/lib/conceptKey";

beforeEach(() => {
  mocks.result = { data: [], error: null };
  mocks.session = { data: { session: null } };
  mocks.insert = [];
  mocks.insertResult = { error: null };
  mocks.calls = {};
  mocks.client = mocks.makeClient();
});

describe("loadTopics", () => {
  it("reads concept_topics ordered by subject then sort and returns the rows", async () => {
    const rows = [
      { subject: "math", slug: "algebra", label: "Algebra", sort: 1 },
      { subject: "physics", slug: "kinematics", label: "Kinematics", sort: 2 },
    ];
    mocks.result = { data: rows, error: null };
    const out = await loadTopics();
    expect(out).toEqual(rows);
    expect(mocks.calls.concept_topics.select[0]).toBe("subject, slug, label, sort");
    expect(mocks.calls.concept_topics.order).toEqual([["subject"], ["sort"]]);
  });

  it("returns [] on a DB error", async () => {
    mocks.result = { data: null, error: { message: "boom" } };
    const out = await loadTopics();
    expect(out).toEqual([]);
  });

  it("returns [] when Supabase isn't configured (client null)", async () => {
    mocks.client = null;
    const out = await loadTopics();
    expect(out).toEqual([]);
    // No query was attempted.
    expect(mocks.calls.concept_topics).toBeUndefined();
  });
});

describe("browsePublicConcepts", () => {
  it("with no subject and no query: selects the lightweight cols with limit(500), no eq/ilike", async () => {
    mocks.result = { data: [{ subject: "math", concept: "Limits", concept_key: "limits" }], error: null };
    const out = await browsePublicConcepts({});
    expect(out).toEqual({ concepts: [{ subject: "math", concept: "Limits", concept_key: "limits" }] });
    const c = mocks.calls.concept_guides;
    expect(c.select[0]).toBe("subject, concept, concept_key, topic, level_band");
    expect(c.limit).toEqual([[500]]);
    expect(c.eq).toEqual([]); // no subject filter
    expect(c.ilike).toEqual([]); // no search filter
    expect(c.order).toEqual([["subject"], ["concept"]]); // stable ordering
  });

  it("with a valid subject: adds .eq(\"subject\", \"math\")", async () => {
    await browsePublicConcepts({ subject: "math" });
    expect(mocks.calls.concept_guides.eq).toEqual([["subject", "math"]]);
  });

  it("with an invalid subject (\"bad\"): does NOT add an eq filter", async () => {
    await browsePublicConcepts({ subject: "bad" });
    expect(mocks.calls.concept_guides.eq).toEqual([]);
  });

  it("ignores a prototype-pollution-style subject (\"__proto__\"): no eq filter", async () => {
    await browsePublicConcepts({ subject: "__proto__" });
    expect(mocks.calls.concept_guides.eq).toEqual([]);
  });

  it("with a plain query \"le ch\": calls .ilike(\"concept\", \"%le ch%\")", async () => {
    await browsePublicConcepts({ query: "le ch" });
    expect(mocks.calls.concept_guides.ilike).toEqual([["concept", "%le ch%"]]);
  });

  it("escapes ILIKE wildcards (% _ \\) in the query so they match literally", async () => {
    await browsePublicConcepts({ query: "50% off_a\\b" });
    // Each of %, _, \ is backslash-escaped inside the surrounding %...% pattern.
    expect(mocks.calls.concept_guides.ilike).toEqual([["concept", "%50\\% off\\_a\\\\b%"]]);
  });

  it("trims a whitespace-only query to empty (no ilike filter)", async () => {
    await browsePublicConcepts({ query: "   " });
    expect(mocks.calls.concept_guides.ilike).toEqual([]);
  });

  it("surfaces a DB error as { error } rather than concepts", async () => {
    mocks.result = { data: null, error: { message: "db down" } };
    const out = await browsePublicConcepts({ subject: "physics" });
    expect(out).toEqual({ error: { message: "db down" } });
    expect(out.concepts).toBeUndefined();
  });

  it("returns { concepts: [] } when data is null but there's no error", async () => {
    mocks.result = { data: null, error: null };
    const out = await browsePublicConcepts({});
    expect(out).toEqual({ concepts: [] });
  });

  it("returns { concepts: [] } when Supabase isn't configured (client null)", async () => {
    mocks.client = null;
    const out = await browsePublicConcepts({ subject: "math", query: "x" });
    expect(out).toEqual({ concepts: [] });
    expect(mocks.calls.concept_guides).toBeUndefined(); // no query attempted
  });
});

describe("reportConcept", () => {
  const signedIn = { data: { session: { user: { id: "u1" } } } };
  const guest = { data: { session: null } };

  it("rejects an unknown subject with { error } and never inserts", async () => {
    const out = await reportConcept({ subject: "bogus", conceptKey: "limits", reason: "bad" });
    expect(out.error).toBeTruthy();
    expect(mocks.insert).toHaveLength(0);
  });

  it("rejects a guest (no session) with a sign-in error and never inserts", async () => {
    mocks.session = guest;
    const out = await reportConcept({ subject: "math", conceptKey: "limits", reason: "bad" });
    expect(out.error).toMatch(/sign in/i);
    expect(mocks.insert).toHaveLength(0);
  });

  it("signed-in: inserts with reporter_id=uid and a NORMALIZED concept_key, returns { ok:true }", async () => {
    mocks.session = signedIn;
    const raw = "  Le Chatelier's Principle  ";
    const out = await reportConcept({ subject: "chemistry", conceptKey: raw, reason: "  duplicate guide  " });
    expect(out).toEqual({ ok: true });
    expect(mocks.insert).toHaveLength(1);
    const payload = mocks.insert[0][0];
    expect(payload).toEqual({
      subject: "chemistry",
      concept_key: "le chatelier's principle", // normalized via conceptKey()
      reporter_id: "u1",
      reason: "duplicate guide", // trimmed
    });
    // The stored key matches conceptKey() applied to the raw input.
    expect(payload.concept_key).toBe(conceptKey(raw));
  });

  it("signed-in: caps the reason to 1000 chars", async () => {
    mocks.session = signedIn;
    const longReason = "x".repeat(5000);
    const out = await reportConcept({ subject: "math", conceptKey: "limits", reason: longReason });
    expect(out).toEqual({ ok: true });
    expect(mocks.insert[0][0].reason).toHaveLength(1000);
  });

  it("signed-in: a blank/whitespace reason becomes null", async () => {
    mocks.session = signedIn;
    await reportConcept({ subject: "math", conceptKey: "limits", reason: "   " });
    expect(mocks.insert[0][0].reason).toBeNull();
    // A missing reason is also null.
    mocks.insert = [];
    await reportConcept({ subject: "math", conceptKey: "limits" });
    expect(mocks.insert[0][0].reason).toBeNull();
  });

  it("rejects when the normalized key is empty with { error } and never inserts", async () => {
    mocks.session = signedIn;
    const out = await reportConcept({ subject: "math", conceptKey: "   ", reason: "x" });
    expect(out.error).toBeTruthy();
    expect(mocks.insert).toHaveLength(0);
  });

  it("returns { error } when Supabase isn't configured (client null)", async () => {
    mocks.client = null;
    const out = await reportConcept({ subject: "math", conceptKey: "limits", reason: "x" });
    expect(out.error).toBeTruthy();
    expect(mocks.insert).toHaveLength(0);
  });

  it("surfaces a DB insert error as { error }", async () => {
    mocks.session = signedIn;
    mocks.insertResult = { error: { message: "insert denied" } };
    const out = await reportConcept({ subject: "physics", conceptKey: "momentum", reason: "x" });
    expect(out).toEqual({ error: "insert denied" });
  });
});
