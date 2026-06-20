// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Supabase client so we can assert the RPC payloads without a real DB.
// `mocks.db` configures what the chainable from() builder resolves to per table,
// so the signed-in loadState/saveScores/saveProgress paths are testable too.
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({ error: null })),
  session: { data: { session: { user: { id: "u1" } } } },
  db: {},
  calls: {}, // per-table captured args: { [table]: { select, eq:[], order:[], upsert:[] } }
}));
vi.mock("@/lib/supabase", () => {
  const build = () => ({
    auth: { getSession: async () => mocks.session },
    rpc: mocks.rpc,
    // A chainable query builder matching supabase-js: select/eq/order return the
    // same thenable (so `await from().select().eq().order().order()` resolves to a
    // configured {data,error}); upsert/insert resolve to their own results. Every
    // call's args are captured so tests can assert the RLS-scoping filter
    // (.eq("user_id", uid)) and the stable ordering, not just the returned data.
    from: (table) => {
      const sel =
        table === "scores" ? mocks.db.scoresSelect
        : table === "attempt_reviews" ? mocks.db.reviewsSelect
        : mocks.db.attemptsSelect;
      const c = (mocks.calls[table] ||= { eq: [], order: [], upsert: [] });
      const chain = {
        select: (...a) => { c.select = a; return chain; },
        eq: (...a) => { c.eq.push(a); return chain; },
        order: (...a) => { c.order.push(a); return chain; },
        limit: (...a) => { c.limit = a; return chain; },
        then: (resolve, reject) => Promise.resolve(sel ?? { data: [], error: null }).then(resolve, reject),
        upsert: async (...a) => { c.upsert.push(a); return mocks.db.scoresUpsert ?? { error: null }; },
      };
      return chain;
    },
  });
  return {
    isSupabaseConfigured: true,
    getSupabase: build,
    ensureSupabase: async () => build(),
  };
});

import { migrateGuestToAccount, deleteAllUserData, loadState, saveProgress, loadReviews, loadMastery } from "@/lib/store";

const KEY = "noobtopro:v1";
// The signed-in fixture carries an access_token: loadState/loadTrends fetch the
// (now server-gated) attempt history from /api/history & /api/trends with the
// session bearer token — direct client SELECT on `attempts` is revoked because
// "Progress trends" is a paid Pro feature (db/migrations/0024).
const signedIn = { data: { session: { user: { id: "u1" }, access_token: "tok-1" } } };
const guest = { data: { session: null } };

beforeEach(() => {
  window.localStorage.clear();
  mocks.rpc.mockClear();
  mocks.session = signedIn;
  mocks.db = {};
  mocks.calls = {};
  // Default global fetch mock for the server read-routes. Tests set
  // mocks.db.historyResponse / mocks.db.trendsResponse to drive the payloads;
  // tests that need an error/402 stub their own fetch (and unstub in a finally).
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      const u = typeof url === "string" ? url : "";
      if (u.startsWith("/api/history")) {
        return { ok: true, status: 200, json: async () => ({ history: mocks.db.historyResponse ?? [] }) };
      }
      if (u.startsWith("/api/trends")) {
        return { ok: true, status: 200, json: async () => ({ trends: mocks.db.trendsResponse ?? [] }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    })
  );
});

describe("migrateGuestToAccount", () => {
  it("sends a CLAMPED payload to migrate_guest_data and clears the guest copy", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        scale: 350,
        scores: {
          math: { score: 999, weakConcepts: ["vectors", 5, "limits"], comment: "x" },
          physics: { score: -3, weakConcepts: [], comment: "" },
        },
        history: [{ type: "baseline", t: "2024-01-01T00:00:00Z", totalAfter: 700, phdAfter: 235 }],
      })
    );

    const res = await migrateGuestToAccount();
    expect(res.migrated).toBe(true);

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = mocks.rpc.mock.calls[0];
    expect(fn).toBe("migrate_guest_data");
    const bySubject = Object.fromEntries(args.p_scores.map((s) => [s.subject, s]));
    expect(bySubject.math.score).toBe(350); // 999 -> clamped
    expect(bySubject.math.weak_concepts).toEqual(["vectors", "limits"]); // non-string dropped
    expect(bySubject.physics.score).toBe(0); // -3 -> clamped
    expect(args.p_attempts[0]).toMatchObject({ type: "baseline", created_at: "2024-01-01T00:00:00Z" });

    // Guest copy cleared after a successful migration.
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ scores: null, history: [], scale: 350 });
  });

  it("carries the per-subject rubric profile into the migration payload (radar survives sign-in)", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        scores: {
          math: { score: 60, weakConcepts: [], comment: "", rubric: { conceptual_understanding: 3, logical_structure: 2 } },
          physics: { score: 40, weakConcepts: [], comment: "" }, // no rubric -> null
        },
        history: [],
      })
    );
    await migrateGuestToAccount();
    const [, args] = mocks.rpc.mock.calls[0];
    const bySubject = Object.fromEntries(args.p_scores.map((s) => [s.subject, s]));
    expect(bySubject.math.rubric).toEqual({ conceptual_understanding: 3, logical_structure: 2 });
    expect(bySubject.physics.rubric).toBe(null); // missing -> null (not undefined)
  });

  it("is a no-op when not signed in", async () => {
    mocks.session = guest;
    window.localStorage.setItem(KEY, JSON.stringify({ scores: { math: { score: 50 } }, history: [] }));
    const res = await migrateGuestToAccount();
    expect(res.migrated).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(KEY)).not.toBe(null); // local retained
  });

  it("is a no-op when there is no guest progress", async () => {
    const res = await migrateGuestToAccount();
    expect(res.migrated).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps the guest copy when the RPC fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "boom" } });
    window.localStorage.setItem(KEY, JSON.stringify({ scores: { math: { score: 50, weakConcepts: [] } }, history: [] }));
    const res = await migrateGuestToAccount();
    expect(res.migrated).toBe(false);
    expect(res.error).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(KEY)).scores).not.toBe(null); // retained for retry
  });

  it("is single-flight: two overlapping calls share ONE RPC invocation", async () => {
    // mount + onAuthStateChange(SIGNED_IN) both call migrateGuestToAccount on load;
    // the in-flight dedup must collapse them so the migration RPC runs exactly once.
    // The two calls are issued synchronously (no await between), so the second sees
    // the in-flight promise the first stored.
    window.localStorage.setItem(KEY, JSON.stringify({ scores: { math: { score: 50, weakConcepts: [] } }, history: [] }));
    const p1 = migrateGuestToAccount();
    const p2 = migrateGuestToAccount(); // overlaps p1 before it resolves
    expect(p1).toBe(p2); // same in-flight promise returned to both callers
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(mocks.rpc).toHaveBeenCalledTimes(1); // deduped, not two migrations
    expect(r1.migrated).toBe(true);
    expect(r2.migrated).toBe(true);
  });

  it("caps the migrated history to the most recent 5000 attempts (RPC payload limit)", async () => {
    // A guest with >5000 attempts would otherwise hit the RPC's 'payload too large'
    // guard forever and never migrate; the client trims to the newest 5000.
    const history = Array.from({ length: 5003 }, (_, i) => ({ type: "attempt", subject: "math", t: `t${i}`, newScore: i % 101 }));
    window.localStorage.setItem(KEY, JSON.stringify({ scores: { math: { score: 50, weakConcepts: [] } }, history }));
    const res = await migrateGuestToAccount();
    expect(res.migrated).toBe(true);
    const [, args] = mocks.rpc.mock.calls[0];
    expect(args.p_attempts).toHaveLength(5000);
    // kept the NEWEST tail (dropped t0..t2; first kept is t3, last is t5002)
    expect(args.p_attempts[0].created_at).toBe("t3");
    expect(args.p_attempts[args.p_attempts.length - 1].created_at).toBe("t5002");
  });
});

describe("deleteAllUserData", () => {
  it("calls the atomic delete_user_data RPC and clears local", async () => {
    const res = await deleteAllUserData();
    expect(res.ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("delete_user_data");
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ scores: null, history: [], scale: 350 });
  });

  it("throws when the delete RPC errors", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "denied" } });
    await expect(deleteAllUserData()).rejects.toThrow(/denied/);
  });
});

describe("signed-in data layer (Supabase paths)", () => {
  it("loadState surfaces a query error instead of treating it as a brand-new user", async () => {
    // Regression: an errored read must NOT look like "no data" — otherwise the UI
    // would bounce a signed-in user to the intro and risk overwriting real scores.
    mocks.db = {
      scoresSelect: { data: null, error: { message: "db down" } },
      attemptsSelect: { data: [], error: null },
    };
    const st = await loadState();
    expect(st.error).toBeTruthy();
    expect(st.scores).toBeUndefined();
  });

  it("loadState maps score rows directly and passes through the FREE /api/history events (no Pro trend field)", async () => {
    mocks.db = {
      scoresSelect: { data: [{ subject: "math", score: 60, weak_concepts: ["x"], comment: "c", rubric: { conceptual_understanding: 3 } }], error: null },
      // /api/history serves the FREE attempt fields only — crucially NOT the cumulative
      // total_after (that's the Pro trend-chart series, served by /api/trends).
      historyResponse: [{ type: "attempt", t: "t0", subject: "math", delta: 2, rationale: "good reasoning" }],
    };
    const st = await loadState();
    expect(st.scores.math).toEqual({ score: 60, weakConcepts: ["x"], comment: "c", rubric: { conceptual_understanding: 3 }, glicko: null });
    // History carries the free fields and NOT the paid trend field (totalAfter).
    expect(st.history[0]).toEqual({ type: "attempt", t: "t0", subject: "math", delta: 2, rationale: "good reasoning" });
    expect(st.history[0].totalAfter).toBeUndefined();
    // Signed-in history is fetched from the server route with the session bearer token.
    expect(fetch).toHaveBeenCalledWith(
      "/api/history",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer tok-1" }) })
    );
  });

  it("loadState defaults a missing rubric column to null", async () => {
    mocks.db = {
      scoresSelect: { data: [{ subject: "physics", score: 40, weak_concepts: [], comment: "" }], error: null },
      historyResponse: [],
    };
    const st = await loadState();
    expect(st.scores.physics.rubric).toBe(null);
  });

  it("loadState scopes the scores read to the caller's user_id and fetches history from the server route (no client attempts read)", async () => {
    // Regression guard: the scores read still filters .eq("user_id", uid) (defense-in-depth
    // alongside RLS). The attempt history is NO LONGER a direct client PostgREST read —
    // client SELECT on `attempts` is revoked (db/migrations/0024) because "Progress trends"
    // is a paid Pro feature — so it comes from /api/history with the session bearer token.
    mocks.db = {
      scoresSelect: { data: [], error: null },
      historyResponse: [],
    };
    await loadState();
    expect(mocks.calls.scores.eq).toContainEqual(["user_id", "u1"]);
    // No direct client read of `attempts` happens anymore (the route does it server-side).
    expect(mocks.calls.attempts).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      "/api/history",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer tok-1" }) })
    );
  });

  it("loadState surfaces a history error (route !ok) instead of treating it as a brand-new user", async () => {
    // A failed /api/history read must NOT look like "no history" — same trust rule as a
    // scores error: the caller must not bounce a signed-in user to the intro.
    mocks.db = { scoresSelect: { data: [], error: null } };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) })));
    try {
      const st = await loadState();
      expect(st.error).toBeTruthy();
      expect(st.history).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("loadState (guest blob sanitization)", () => {
  it("clamps a corrupt guest blob: weakConcepts-as-string -> [], garbage/out-of-range score -> clamped", async () => {
    // A structurally-valid-but-wrong-typed blob must NOT flow into React state
    // verbatim — a string weakConcepts would crash rendering (.slice/.filter/.map),
    // and a garbage/out-of-range score must degrade safely.
    mocks.session = guest;
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        scale: 350,
        scores: {
          math: { score: "wat", weakConcepts: "vectors", comment: "x" }, // string wc, garbage score
          physics: { score: 999, weakConcepts: ["a", 5, "b", null], comment: 42 }, // over-range, mixed wc, non-string comment
          chemistry: "bogus", // non-object subject -> dropped
        },
        history: "nope", // non-array -> []
      })
    );
    const st = await loadState();
    expect(st.scores.math).toEqual({ score: 0, weakConcepts: [], comment: "x", rubric: null, glicko: null }); // "wat" -> 0, "vectors" -> []
    expect(st.scores.physics).toEqual({ score: 350, weakConcepts: ["a", "b"], comment: "", rubric: null, glicko: null }); // 999 -> 350, non-strings dropped, bad comment -> ""
    expect(st.scores.chemistry).toBeUndefined(); // non-object subject dropped
    expect(st.history).toEqual([]); // non-array history -> []
  });

  it("caps a corrupt guest blob's weakConcepts to <=64 on read", async () => {
    mocks.session = guest;
    const wc = Array.from({ length: 100 }, (_, i) => `c${i}`);
    window.localStorage.setItem(KEY, JSON.stringify({ scores: { math: { score: 50, weakConcepts: wc, comment: "" } }, history: [] }));
    const st = await loadState();
    expect(st.scores.math.weakConcepts).toHaveLength(64);
  });

  it("returns a safe empty shape when the guest blob is null", async () => {
    mocks.session = guest;
    const st = await loadState();
    expect(st).toEqual({ scores: null, history: [], mastery: {} });
  });

  it("collapses an all-garbage scores blob to null (so hydrate routes the guest to the intro, not a 0/0/0 dashboard)", async () => {
    mocks.session = guest;
    // Every subject is a non-object → all dropped → scores must be null, matching the
    // signed-in path (not a truthy empty {} that looks like a placed-but-empty user).
    window.localStorage.setItem(KEY, JSON.stringify({ scores: { math: "x", physics: 5, chemistry: null }, history: [] }));
    const st = await loadState();
    expect(st.scores).toBe(null);
  });
});

describe("saveProgress (atomic score + attempt write)", () => {
  const scores = { math: { score: 62, weakConcepts: ["x"], comment: "c" } };
  const evt = { type: "attempt", t: "t1", subject: "math", reasoningScore: 70, delta: 2, newScore: 62, totalAfter: 62, phdAfter: 21 };

  it("signed-in: REFUSES to write locally — signed-in scoring is server-authoritative (/api/score), never the browser", async () => {
    // The trust boundary: a signed-in client must NOT persist scores from the browser
    // (scores/attempts are SELECT-only under RLS now). saveProgress is guest-only and
    // fails loudly rather than silently writing to the wrong (local) store; it never
    // calls a save RPC.
    mocks.session = signedIn;
    await expect(saveProgress(scores, evt)).rejects.toThrow(/server/i);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("guest: persists the rubric profile on the scores object", async () => {
    mocks.session = guest;
    const withRubric = { math: { score: 62, weakConcepts: ["x"], comment: "c", rubric: { conceptual_understanding: 2.5, logical_structure: 3 } } };
    await saveProgress(withRubric, evt);
    const local = JSON.parse(window.localStorage.getItem(KEY));
    expect(local.scores.math.rubric).toEqual({ conceptual_understanding: 2.5, logical_structure: 3 });
  });

  it("guest: writes scores + appended history locally in one shot, no RPC", async () => {
    mocks.session = guest;
    window.localStorage.setItem(KEY, JSON.stringify({ scores: null, history: [{ type: "baseline", t: "t0" }] }));
    const res = await saveProgress(scores, evt);
    expect(mocks.rpc).not.toHaveBeenCalled();
    const local = JSON.parse(window.localStorage.getItem(KEY));
    expect(local.scores).toEqual(scores);
    expect(local.history).toHaveLength(2);
    expect(local.history[1]).toMatchObject({ type: "attempt", subject: "math" });
    expect(res.history).toHaveLength(2);
  });

  it("guest: a single-subject save MERGES, preserving the other subjects (no data loss)", async () => {
    // Regression: submitPractice sends only the changed subject; the guest branch
    // must merge it over the stored map, not replace — else the other two subjects
    // are silently wiped from localStorage (and lost on reload / sign-in migration).
    mocks.session = guest;
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        scale: 350,
        scores: {
          math: { score: 40, weakConcepts: ["a"], comment: "" },
          physics: { score: 55, weakConcepts: ["b"], comment: "" },
          chemistry: { score: 30, weakConcepts: [], comment: "" },
        },
        history: [],
      })
    );
    await saveProgress({ physics: { score: 60, weakConcepts: ["b2"], comment: "" } }, { type: "attempt", subject: "physics" });
    const local = JSON.parse(window.localStorage.getItem(KEY));
    expect(local.scores.physics.score).toBe(60); // updated subject
    expect(local.scores.math.score).toBe(40); // preserved — not wiped
    expect(local.scores.chemistry.score).toBe(30); // preserved
    expect(Object.keys(local.scores).sort()).toEqual(["chemistry", "math", "physics"]);
  });

  it("guest: throws when the localStorage write fails (quota/blocked) instead of reporting false success", async () => {
    mocks.session = guest;
    // Spy the prototype so the jsdom localStorage instance's setItem actually throws.
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      await expect(saveProgress(scores, evt)).rejects.toThrow(/full or blocked/i);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("loadReviews (answer review)", () => {
  // P0-2: answer history is a PRO feature read through the server route /api/reviews
  // (direct client SELECT on attempt_reviews is revoked), so the signed-in path now
  // fetches with the session bearer token rather than querying the table directly.
  it("signed-in: loads answer history through the Pro-gated /api/reviews route", async () => {
    mocks.session = { data: { session: { user: { id: "u1" }, access_token: "tok-1" } } };
    // The route returns already-mapped (camelCase) items; loadReviews passes them through.
    const reviews = [
      { subject: "math", t: "t2", question: "Q2", answer: "A2", targetConcept: "addition", difficulty: "foundational", reasoningScore: 70, delta: 5, rubric: { conceptual_understanding: 3 }, feedback: { strengths: ["good"], improvements: ["more"], workedSolution: "S2" } },
    ];
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ reviews }) }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const res = await loadReviews();
      expect(res.reviews).toHaveLength(1);
      expect(res.reviews[0]).toMatchObject({ subject: "math", question: "Q2", answer: "A2", targetConcept: "addition", reasoningScore: 70 });
      expect(res.reviews[0].feedback.workedSolution).toBe("S2");
      // Calls the server route with the bearer token (no direct table read).
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reviews",
        expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer tok-1" }) })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("signed-in: surfaces an error from /api/reviews instead of an empty list", async () => {
    mocks.session = { data: { session: { user: { id: "u1" }, access_token: "tok-1" } } };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) })));
    try {
      const res = await loadReviews();
      expect(res.error).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("signed-in NON-Pro: surfaces a Pro-required error on a 402", async () => {
    mocks.session = { data: { session: { user: { id: "u1" }, access_token: "tok-1" } } };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 402, json: async () => ({ error: "Pro" }) })));
    try {
      const res = await loadReviews();
      expect(res.error).toBeTruthy();
      expect(String(res.error.message || res.error)).toMatch(/pro/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("guest: returns the review detail embedded in local history (newest-first)", async () => {
    mocks.session = guest;
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        scores: { math: { score: 50, weakConcepts: [] } },
        history: [
          { type: "attempt", t: "t1", subject: "math", reasoningScore: 40, delta: 2, review: { question: "Q1", answer: "A1", targetConcept: "addition", difficulty: "foundational", rubric: {}, feedback: { workedSolution: "S1" } } },
          { type: "attempt", t: "t0", subject: "math", reasoningScore: 30 }, // no review → excluded
        ],
      })
    );
    const res = await loadReviews();
    expect(res.reviews).toHaveLength(1);
    expect(res.reviews[0]).toMatchObject({ question: "Q1", answer: "A1", subject: "math", reasoningScore: 40 });
    expect(res.reviews[0].feedback.workedSolution).toBe("S1");
  });
});

describe("per-concept mastery (guest storage + signed-in reads + migration)", () => {
  const MATH_KEY = "ratios_unit_rates";

  it("saveProgress applies allow-listed mastery updates atomically with the score + attempt", async () => {
    mocks.session = guest;
    const scores = { math: { score: 50, weakConcepts: [], comment: "" } };
    await saveProgress(scores, { type: "attempt", subject: "math" }, [
      { subject: "math", conceptKey: MATH_KEY, quality: 80 },
      { subject: "math", conceptKey: "fake_concept", quality: 100 }, // dropped by the allowlist
    ]);
    const blob = JSON.parse(window.localStorage.getItem(KEY));
    expect(blob.mastery).toEqual({ math: { [MATH_KEY]: { attempts: 1, greenHits: 1, lastQuality: 80, bestQuality: 80 } } });
  });

  it("loadMastery (guest) reads the SANITIZED map — junk keys/counters in the blob are dropped", async () => {
    mocks.session = guest;
    window.localStorage.setItem(KEY, JSON.stringify({
      scores: null,
      history: [],
      mastery: {
        math: {
          [MATH_KEY]: { attempts: 2, greenHits: 99, lastQuality: 80, bestQuality: "garbage" },
          not_a_concept: { attempts: 5, greenHits: 5, lastQuality: 100, bestQuality: 100 },
        },
        biology: { whatever: { attempts: 3 } },
      },
    }));
    const { mastery } = await loadMastery();
    expect(mastery).toEqual({ math: { [MATH_KEY]: { attempts: 2, greenHits: 2, lastQuality: 80, bestQuality: null } } });
  });

  it("loadMastery (signed-in) maps the user's own concept_mastery rows; an error surfaces as { error }", async () => {
    mocks.session = signedIn;
    mocks.db.attemptsSelect = { data: [
      { subject: "math", concept_key: MATH_KEY, attempts: 2, green_hits: 2, last_quality: 90, best_quality: 95 },
      { subject: "math", concept_key: "fake_concept", attempts: 1, green_hits: 0, last_quality: 10, best_quality: 10 },
    ], error: null };
    const { mastery, error } = await loadMastery();
    expect(error).toBeUndefined();
    expect(mastery).toEqual({ math: { [MATH_KEY]: { attempts: 2, greenHits: 2, lastQuality: 90, bestQuality: 95 } } });
    // RLS-scoping filter present (defense-in-depth alongside RLS itself).
    expect(mocks.calls.concept_mastery.eq).toContainEqual(["user_id", "u1"]);

    mocks.calls = {};
    mocks.db.attemptsSelect = { data: null, error: { message: "relation does not exist" } };
    const res = await loadMastery();
    expect(res.error).toBeTruthy();
  });

  it("migration carries the guest mastery map (p_mastery) and falls back to 2-arg on a pre-0010 DB", async () => {
    mocks.session = signedIn;
    const guestBlob = {
      scores: { math: { score: 40, weakConcepts: [], comment: "" } },
      history: [],
      mastery: { math: { [MATH_KEY]: { attempts: 1, greenHits: 1, lastQuality: 80, bestQuality: 80 } } },
    };
    window.localStorage.setItem(KEY, JSON.stringify(guestBlob));
    await migrateGuestToAccount();
    let [fn, args] = mocks.rpc.mock.calls[0];
    expect(fn).toBe("migrate_guest_data");
    expect(args.p_mastery).toEqual(guestBlob.mastery);

    // Pre-0010 DB: the 3-arg signature is missing (PGRST202) → retry without p_mastery.
    window.localStorage.setItem(KEY, JSON.stringify(guestBlob));
    mocks.rpc.mockClear();
    mocks.rpc
      .mockResolvedValueOnce({ error: { code: "PGRST202", message: "no matching function" } })
      .mockResolvedValueOnce({ error: null });
    const res = await migrateGuestToAccount();
    expect(res.migrated).toBe(true);
    expect(mocks.rpc.mock.calls).toHaveLength(2);
    expect(mocks.rpc.mock.calls[1][1].p_mastery).toBeUndefined();
    // The un-migrated mastery map is PRESERVED in the cleared blob (not destroyed) —
    // scores/history are gone (they migrated), mastery stays recoverable.
    const blob = JSON.parse(window.localStorage.getItem(KEY));
    expect(blob.scores).toBeNull();
    expect(blob.mastery).toEqual(guestBlob.mastery);
  });

  it("migration omits p_mastery entirely when the guest has none (no needless 3-arg call)", async () => {
    mocks.session = signedIn;
    window.localStorage.setItem(KEY, JSON.stringify({
      scores: { math: { score: 40, weakConcepts: [], comment: "" } },
      history: [],
    }));
    await migrateGuestToAccount();
    const [, args] = mocks.rpc.mock.calls[0];
    expect("p_mastery" in args).toBe(false);
  });
});

describe("audit-fix round (P1-4 + P2-11)", () => {
  const signedIn = { data: { session: { user: { id: "u1" }, access_token: "tok-1" } } };

  it("migrate_guest_data returning FALSE (account not empty) KEEPS the guest blob (no silent data loss)", async () => {
    mocks.session = signedIn;
    const guestBlob = { scale: 350, scores: { math: { score: 40, weakConcepts: [], comment: "" } }, history: [] };
    window.localStorage.setItem(KEY, JSON.stringify(guestBlob));
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    const res = await migrateGuestToAccount();
    expect(res.migrated).toBe(false);
    expect(res.reason).toBe("account-not-empty");
    // The blob survives — before this fix it was wiped on ANY non-error response.
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual(guestBlob);
  });

  it("migrate_guest_data returning TRUE clears the guest blob (the happy path is unchanged)", async () => {
    mocks.session = signedIn;
    window.localStorage.setItem(KEY, JSON.stringify({ scale: 350, scores: { math: { score: 40, weakConcepts: [], comment: "" } }, history: [] }));
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    const res = await migrateGuestToAccount();
    expect(res.migrated).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ scores: null, history: [], scale: 350 });
  });

  it("loadState passes the server-ordered (chronological) history through unchanged", async () => {
    // The desc-fetch + re-reverse now lives in /api/history (it returns oldest→newest);
    // loadState just passes the route's order through, so the dashboard list stays chronological.
    mocks.session = signedIn;
    mocks.db = {
      scoresSelect: { data: [], error: null },
      historyResponse: [
        { type: "attempt", t: "t1", subject: "math", delta: 1, rationale: null },
        { type: "attempt", t: "t2", subject: "math", delta: 2, rationale: null },
      ],
    };
    const st = await loadState();
    expect(st.history.map((h) => h.t)).toEqual(["t1", "t2"]); // chronological for the charts
  });
});
