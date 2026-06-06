// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Supabase client so we can assert the RPC payloads without a real DB.
// `mocks.db` configures what the chainable from() builder resolves to per table,
// so the signed-in loadState/saveScores/recordAttempt paths are testable too.
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({ error: null })),
  session: { data: { session: { user: { id: "u1" } } } },
  db: {},
}));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    auth: { getSession: async () => mocks.session },
    rpc: mocks.rpc,
    // A chainable query builder matching supabase-js: select/eq/order return the
    // same thenable (so `await from().select().eq().order().order()` resolves to a
    // configured {data,error}); upsert/insert resolve to their own results.
    from: (table) => {
      const sel = table === "scores" ? mocks.db.scoresSelect : mocks.db.attemptsSelect;
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        then: (resolve, reject) => Promise.resolve(sel ?? { data: [], error: null }).then(resolve, reject),
        upsert: async () => mocks.db.scoresUpsert ?? { error: null },
        insert: async () => mocks.db.attemptsInsert ?? { error: null },
      };
      return chain;
    },
  }),
}));

import { migrateGuestToAccount, deleteAllUserData, loadState, saveScores, recordAttempt } from "@/lib/store";

const KEY = "noobtopro:v1";
const signedIn = { data: { session: { user: { id: "u1" } } } };
const guest = { data: { session: null } };

beforeEach(() => {
  window.localStorage.clear();
  mocks.rpc.mockClear();
  mocks.session = signedIn;
  mocks.db = {};
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

  it("saveScores throws when the upsert fails so the caller can surface a banner", async () => {
    mocks.db = { scoresUpsert: { error: { message: "rls denied" } } };
    await expect(saveScores({ math: { score: 50, weakConcepts: [], comment: "" } })).rejects.toThrow(/rls denied/);
  });

  it("recordAttempt throws when the insert fails", async () => {
    mocks.db = { attemptsInsert: { error: { message: "insert denied" } } };
    await expect(recordAttempt({ type: "attempt", subject: "math", reasoningScore: 50 })).rejects.toThrow(/insert denied/);
  });

  it("recordAttempt returns history:null when the post-insert refresh read fails (keeps current chart)", async () => {
    mocks.db = {
      attemptsInsert: { error: null },
      attemptsSelect: { data: null, error: { message: "read failed" } },
    };
    const res = await recordAttempt({ type: "attempt", subject: "math", reasoningScore: 50 });
    expect(res.history).toBe(null);
  });
});
