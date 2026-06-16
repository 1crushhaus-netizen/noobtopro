import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/reviews — the Pro-gated server read path for "answer history"
// (attempt_reviews). P0-2: a non-Pro user must NOT be able to read review rows;
// the only client read path now goes through this route, which enforces Pro.
// requireUser + the service-role client are mocked at the boundary.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

import { POST as reviewsPOST } from "@/app/api/reviews/route";
import { _resetRateLimits } from "@/lib/rateLimit";

// Fake service-role client: subscriptions.maybeSingle() -> `sub`; attempt_reviews read
// (.order().limit()) -> `reviews`. rpc errors so the durable rate limiter fails open to
// the in-memory limiter (which allows within the cap).
function fakeAdmin({ sub = null, reviews = [] } = {}) {
  return {
    from(table) {
      if (table === "subscriptions") {
        const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: sub, error: null }) };
        return chain;
      }
      const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => ({ data: reviews, error: null }) };
      return chain;
    },
    rpc: async () => ({ data: null, error: { message: "no durable limiter in test" } }),
  };
}

const req = () =>
  new Request("http://test.local/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

beforeEach(() => {
  _resetRateLimits();
  auth.requireUser.mockReset();
  storage.getAdmin.mockReset().mockReturnValue(null);
});

describe("POST /api/reviews — Pro-gated answer history (P0-2)", () => {
  it("401s a guest (no/invalid token)", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    expect((await reviewsPOST(req())).status).toBe(401);
  });

  it("402s a signed-in NON-Pro user (no entitlement store -> not Pro)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(null); // deny-by-default: nobody is Pro
    expect((await reviewsPOST(req())).status).toBe(402);
  });

  it("402s a signed-in user whose subscription is canceled", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ sub: { status: "canceled" } }));
    expect((await reviewsPOST(req())).status).toBe(402);
  });

  it("returns the caller's mapped reviews for a Pro user", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "pro1" } });
    storage.getAdmin.mockReturnValue(
      fakeAdmin({
        sub: { status: "active" },
        reviews: [
          { subject: "math", created_at: "2026-06-10T00:00:00Z", question: "Q1", answer: "A1", target_concept: "limits", difficulty: "intermediate", reasoning_score: 80, delta: 5, rubric: { principle: 3 }, feedback: { workedSolution: "...", improvements: ["x"] } },
        ],
      })
    );
    const res = await reviewsPOST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.reviews)).toBe(true);
    expect(body.reviews).toHaveLength(1);
    expect(body.reviews[0]).toMatchObject({ subject: "math", question: "Q1", targetConcept: "limits", reasoningScore: 80 });
    expect(body.reviews[0].feedback.workedSolution).toBe("...");
  });
});
