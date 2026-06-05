// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Supabase client so we can assert the RPC payloads without a real DB.
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({ error: null })),
  session: { data: { session: { user: { id: "u1" } } } },
}));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    auth: { getSession: async () => mocks.session },
    rpc: mocks.rpc,
  }),
}));

import { migrateGuestToAccount, deleteAllUserData } from "@/lib/store";

const KEY = "noobtopro:v1";
const signedIn = { data: { session: { user: { id: "u1" } } } };
const guest = { data: { session: null } };

beforeEach(() => {
  window.localStorage.clear();
  mocks.rpc.mockClear();
  mocks.session = signedIn;
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
