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
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    auth: { getSession: async () => mocks.session },
    rpc: mocks.rpc,
    // A chainable query builder matching supabase-js: select/eq/order return the
    // same thenable (so `await from().select().eq().order().order()` resolves to a
    // configured {data,error}); upsert/insert resolve to their own results. Every
    // call's args are captured so tests can assert the RLS-scoping filter
    // (.eq("user_id", uid)) and the stable ordering, not just the returned data.
    from: (table) => {
      const sel = table === "scores" ? mocks.db.scoresSelect : mocks.db.attemptsSelect;
      const c = (mocks.calls[table] ||= { eq: [], order: [], upsert: [] });
      const chain = {
        select: (...a) => { c.select = a; return chain; },
        eq: (...a) => { c.eq.push(a); return chain; },
        order: (...a) => { c.order.push(a); return chain; },
        then: (resolve, reject) => Promise.resolve(sel ?? { data: [], error: null }).then(resolve, reject),
        upsert: async (...a) => { c.upsert.push(a); return mocks.db.scoresUpsert ?? { error: null }; },
      };
      return chain;
    },
  }),
}));

import { migrateGuestToAccount, deleteAllUserData, loadState, saveProgress } from "@/lib/store";

const KEY = "noobtopro:v1";
const signedIn = { data: { session: { user: { id: "u1" } } } };
const guest = { data: { session: null } };

beforeEach(() => {
  window.localStorage.clear();
  mocks.rpc.mockClear();
  mocks.session = signedIn;
  mocks.db = {};
  mocks.calls = {};
});

describe("migrateGuestToAccount", () => {
  it("sends a CLAMPED payload to migrate_guest_data and clears the guest copy", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        scores: {
          math: { score: 150, weakConcepts: ["vectors", 5, "limits"], comment: "x" },
          physics: { score: -3, weakConcepts: [], comment: "" },
        },
        history: [{ type: "baseline", t: "2024-01-01T00:00:00Z", totalAfter: 200, phdAfter: 67 }],
      })
    );

    const res = await migrateGuestToAccount();
    expect(res.migrated).toBe(true);

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = mocks.rpc.mock.calls[0];
    expect(fn).toBe("migrate_guest_data");
    const bySubject = Object.fromEntries(args.p_scores.map((s) => [s.subject, s]));
    expect(bySubject.math.score).toBe(100); // 150 -> clamped
    expect(bySubject.math.weak_concepts).toEqual(["vectors", "limits"]); // non-string dropped
    expect(bySubject.physics.score).toBe(0); // -3 -> clamped
    expect(args.p_attempts[0]).toMatchObject({ type: "baseline", created_at: "2024-01-01T00:00:00Z" });

    // Guest copy cleared after a successful migration.
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ scores: null, history: [] });
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
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ scores: null, history: [] });
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

  it("loadState maps score rows + attempt rows (rowToEvent) on the happy path", async () => {
    mocks.db = {
      scoresSelect: { data: [{ subject: "math", score: 60, weak_concepts: ["x"], comment: "c" }], error: null },
      attemptsSelect: {
        data: [{ type: "attempt", created_at: "t0", subject: "math", reasoning_score: 70, delta: 2, new_score: 62, total_after: 100, phd_after: 33 }],
        error: null,
      },
    };
    const st = await loadState();
    expect(st.scores.math).toEqual({ score: 60, weakConcepts: ["x"], comment: "c" });
    expect(st.history[0]).toMatchObject({ type: "attempt", t: "t0", subject: "math", reasoningScore: 70, newScore: 62, totalAfter: 100, phdAfter: 33 });
  });

  it("loadState scopes BOTH reads to the caller's user_id and orders attempts stably", async () => {
    // Regression guard: every read must filter .eq("user_id", uid) (defense-in-depth
    // alongside RLS) and the attempts read must order by created_at then id so a
    // shared-timestamp tie is deterministic.
    mocks.db = {
      scoresSelect: { data: [], error: null },
      attemptsSelect: { data: [], error: null },
    };
    await loadState();
    expect(mocks.calls.scores.eq).toContainEqual(["user_id", "u1"]);
    expect(mocks.calls.attempts.eq).toContainEqual(["user_id", "u1"]);
    expect(mocks.calls.attempts.order).toEqual([
      ["created_at", { ascending: true }],
      ["id", { ascending: true }],
    ]);
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
        scores: {
          math: { score: "wat", weakConcepts: "vectors", comment: "x" }, // string wc, garbage score
          physics: { score: 150, weakConcepts: ["a", 5, "b", null], comment: 42 }, // over-range, mixed wc, non-string comment
          chemistry: "bogus", // non-object subject -> dropped
        },
        history: "nope", // non-array -> []
      })
    );
    const st = await loadState();
    expect(st.scores.math).toEqual({ score: 0, weakConcepts: [], comment: "x" }); // "wat" -> 0, "vectors" -> []
    expect(st.scores.physics).toEqual({ score: 100, weakConcepts: ["a", "b"], comment: "" }); // 150 -> 100, non-strings dropped, bad comment -> ""
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
    expect(st).toEqual({ scores: null, history: [] });
  });
});

describe("saveProgress (atomic score + attempt write)", () => {
  const scores = { math: { score: 62, weakConcepts: ["x"], comment: "c" } };
  const evt = { type: "attempt", t: "t1", subject: "math", reasoningScore: 70, delta: 2, newScore: 62, totalAfter: 62, phdAfter: 21 };

  it("signed-in: calls the single save_progress RPC with snake_cased payload, then refreshes history", async () => {
    mocks.db = { attemptsSelect: { data: [{ type: "attempt", created_at: "t1", subject: "math", reasoning_score: 70, delta: 2, new_score: 62, total_after: 62, phd_after: 21 }], error: null } };
    const res = await saveProgress(scores, evt);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = mocks.rpc.mock.calls[0];
    expect(fn).toBe("save_progress");
    expect(args.p_scores).toEqual([{ subject: "math", score: 62, weak_concepts: ["x"], comment: "c" }]);
    expect(args.p_attempt).toMatchObject({ type: "attempt", subject: "math", reasoning_score: 70, new_score: 62, created_at: "t1" });
    expect(res.history[0]).toMatchObject({ type: "attempt", newScore: 62, reasoningScore: 70 });
  });

  it("signed-in: caps weak_concepts to <=64 elements in the save_progress payload (client-side defense)", async () => {
    const wc = Array.from({ length: 100 }, (_, i) => `c${i}`);
    mocks.db = { attemptsSelect: { data: [], error: null } };
    await saveProgress({ math: { score: 62, weakConcepts: wc, comment: "c" } }, evt);
    const [, args] = mocks.rpc.mock.calls[0];
    expect(args.p_scores[0].weak_concepts).toHaveLength(64);
    expect(args.p_scores[0].weak_concepts[0]).toBe("c0"); // kept the leading slice
  });

  it("signed-in: throws when the RPC fails and does NOT fall back to a separate score write (atomicity)", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(saveProgress(scores, evt)).rejects.toThrow(/boom/);
    // The only write attempted is the single atomic RPC — no independent scores upsert.
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe("save_progress");
  });

  it("signed-in: returns history:null when only the post-write refresh read fails", async () => {
    mocks.db = { attemptsSelect: { data: null, error: { message: "read failed" } } };
    const res = await saveProgress(scores, evt);
    expect(res.history).toBe(null); // the write still committed
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
