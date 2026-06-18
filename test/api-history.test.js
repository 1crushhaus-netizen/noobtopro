import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/history — the FREE signed-in server read path for attempt-derived data
// (the "problems graded" count + the "why your reasoning moved" rationale list).
// F-01: direct client SELECT on `attempts` is revoked (db/migrations/0024) because
// "Progress trends" is a paid Pro feature, so this route serves the always-visible
// free fields — crucially NOT the cumulative total_after (that's Pro, via /api/trends).
// requireUser + the service-role client are mocked at the boundary.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

import { POST as historyPOST } from "@/app/api/history/route";
import { _resetRateLimits } from "@/lib/rateLimit";

// Fake service-role client: the attempts read (.eq().order().order().limit()) -> `attempts`.
// rpc errors so the durable rate limiter fails open to the in-memory limiter (allows within cap).
function fakeAdmin({ attempts = [] } = {}) {
  return {
    from() {
      const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => ({ data: attempts, error: null }) };
      return chain;
    },
    rpc: async () => ({ data: null, error: { message: "no durable limiter in test" } }),
  };
}

const req = (headers = {}) =>
  new Request("http://test.local/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: "{}",
  });

beforeEach(() => {
  _resetRateLimits();
  auth.requireUser.mockReset();
  storage.getAdmin.mockReset().mockReturnValue(null);
});

describe("POST /api/history — FREE signed-in attempt history (F-01)", () => {
  it("403s a cross-site request before any auth work", async () => {
    expect((await historyPOST(req({ "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(auth.requireUser).not.toHaveBeenCalled();
  });

  it("415s a non-JSON content type", async () => {
    expect((await historyPOST(req({ "Content-Type": "text/plain" }))).status).toBe(415);
  });

  it("401s a guest (no/invalid token)", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    expect((await historyPOST(req())).status).toBe(401);
  });

  it("returns an empty (not errored) history when no service-role store is configured", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(null);
    const res = await historyPOST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ history: [] });
  });

  it("returns the caller's FREE events (no cumulative total) chronologically for any signed-in user", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(
      fakeAdmin({
        // The DB returns NEWEST-first; the route re-reverses to chronological. Rows carry
        // total_after, but the route must NOT leak it (that's the Pro trend field).
        attempts: [
          { type: "attempt", subject: "physics", delta: -2, rationale: "Missed a force.", total_after: 90, created_at: "t2" },
          { type: "attempt", subject: "math", delta: 5, rationale: "Sound derivation.", total_after: 70, created_at: "t1" },
        ],
      })
    );
    const res = await historyPOST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.history.map((h) => h.t)).toEqual(["t1", "t2"]); // chronological
    // Free shape only — crucially NO totalAfter / total_after.
    expect(body.history[0]).toEqual({ type: "attempt", t: "t1", subject: "math", delta: 5, rationale: "Sound derivation." });
    expect(body.history.some((h) => "totalAfter" in h || "total_after" in h)).toBe(false);
  });
});
