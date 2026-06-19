import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/trends — the Pro-gated server read path for "Progress trends" (the trend
// charts). F-01: the chart series lives in `attempts`, whose direct client SELECT
// is revoked (db/migrations/0024), so a non-Pro user must NOT be able to read the
// cumulative trend series. This route is the SERVER enforcement (requireProUser).
// requireUser + the service-role client are mocked at the boundary.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

import { POST as trendsPOST } from "@/app/api/trends/route";
import { _resetRateLimits } from "@/lib/rateLimit";

// Fake service-role client: subscriptions.maybeSingle() -> `sub` (the Pro check);
// the attempts read (.eq().order().order().limit()) -> `attempts`. rpc errors so the
// durable rate limiter fails open to the in-memory limiter (which allows within the cap).
function fakeAdmin({ sub = null, attempts = [] } = {}) {
  return {
    from(table) {
      if (table === "subscriptions") {
        const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: sub, error: null }) };
        return chain;
      }
      const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => ({ data: attempts, error: null }) };
      return chain;
    },
    rpc: async () => ({ data: null, error: { message: "no durable limiter in test" } }),
  };
}

const req = (headers = {}) =>
  new Request("http://test.local/api/trends", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: "{}",
  });

beforeEach(() => {
  _resetRateLimits();
  auth.requireUser.mockReset();
  storage.getAdmin.mockReset().mockReturnValue(null);
});

describe("POST /api/trends — Pro-gated progress trends (F-01)", () => {
  it("403s a cross-site request before any auth work", async () => {
    expect((await trendsPOST(req({ "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(auth.requireUser).not.toHaveBeenCalled();
  });

  it("415s a non-JSON content type", async () => {
    expect((await trendsPOST(req({ "Content-Type": "text/plain" }))).status).toBe(415);
  });

  it("401s a guest (no/invalid token)", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    expect((await trendsPOST(req())).status).toBe(401);
  });

  it("402s a signed-in NON-Pro user (no entitlement store -> not Pro)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(null); // deny-by-default: nobody is Pro
    expect((await trendsPOST(req())).status).toBe(402);
  });

  it("402s a signed-in user whose subscription is canceled", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ sub: { status: "canceled" } }));
    expect((await trendsPOST(req())).status).toBe(402);
  });

  it("returns the caller's mapped trend series — chronological, carrying totalAfter — for a Pro user", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "pro1" } });
    storage.getAdmin.mockReturnValue(
      fakeAdmin({
        sub: { status: "active" },
        // The DB returns NEWEST-first; the route re-reverses to chronological for the time series.
        attempts: [
          { type: "attempt", subject: "physics", delta: -2, total_after: 90, created_at: "t2", id: 2 },
          { type: "attempt", subject: "math", delta: 5, total_after: 70, created_at: "t1", id: 1 },
        ],
      })
    );
    const res = await trendsPOST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trends.map((t) => t.totalAfter)).toEqual([70, 90]); // chronological
    expect(body.trends[0]).toEqual({ type: "attempt", subject: "math", delta: 5, totalAfter: 70 });
  });
});
