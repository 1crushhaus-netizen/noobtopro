import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/account/export — "Download my data" (GDPR access/portability). Verifies the JWT
// and returns the caller's account + scores + attempts + reviews + mastery + subscription
// as JSON, scoped to auth.uid() via the service-role client. requireUser + the admin client
// are mocked at the boundary.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

import { POST as exportPOST } from "@/app/api/account/export/route";
import { _resetRateLimits } from "@/lib/rateLimit";

// Service-role client: table reads (select/eq/order) resolve to per-table data; the
// subscription read uses maybeSingle. rpc errors so the durable rate limiter fails open.
function fakeAdmin(data = {}) {
  return {
    from(table) {
      const result = data[table] ?? { data: [], error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        maybeSingle: async () => data.subscriptions ?? { data: null, error: null },
        then: (res, rej) => Promise.resolve(result).then(res, rej),
      };
      return chain;
    },
    rpc: async () => ({ data: null, error: { message: "no durable limiter in test" } }),
  };
}

const USER = {
  id: "u1",
  email: "a@b.com",
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: { age_verified: true, age_verified_at: "2026-01-02T00:00:00Z" },
  user_metadata: { full_name: "Ada Lovelace" },
};

const req = (headers = {}) =>
  new Request("http://test.local/api/account/export", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: "{}",
  });

beforeEach(() => {
  _resetRateLimits();
  auth.requireUser.mockReset();
  storage.getAdmin.mockReset().mockReturnValue(null);
});

describe("POST /api/account/export — data download", () => {
  it("403s a cross-site request before any auth work", async () => {
    expect((await exportPOST(req({ "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(auth.requireUser).not.toHaveBeenCalled();
  });

  it("415s a non-JSON content type", async () => {
    expect((await exportPOST(req({ "Content-Type": "text/plain" }))).status).toBe(415);
  });

  it("401s a guest (no/invalid token)", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    expect((await exportPOST(req())).status).toBe(401);
  });

  it("503s when no service-role store is configured", async () => {
    auth.requireUser.mockResolvedValue({ user: USER });
    storage.getAdmin.mockReturnValue(null);
    expect((await exportPOST(req())).status).toBe(503);
  });

  it("returns the full data bundle for the verified user, as a JSON download", async () => {
    auth.requireUser.mockResolvedValue({ user: USER });
    storage.getAdmin.mockReturnValue(
      fakeAdmin({
        scores: { data: [{ user_id: "u1", subject: "math", score: 210 }], error: null },
        attempts: { data: [{ user_id: "u1", subject: "math", delta: 5, created_at: "t1" }], error: null },
        attempt_reviews: { data: [{ user_id: "u1", question: "Q", answer: "A" }], error: null },
        concept_mastery: { data: [{ user_id: "u1", concept_key: "ratios", attempts: 2 }], error: null },
        subscriptions: { data: { status: "active", product_id: "prod_pro" }, error: null },
      })
    );
    const res = await exportPOST(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="noobtopro-data-export\.json"/);
    const body = await res.json();
    expect(body.account).toMatchObject({ id: "u1", email: "a@b.com", displayName: "Ada Lovelace", ageVerified: true });
    expect(body.account.ageVerifiedAt).toBe("2026-01-02T00:00:00Z");
    expect(body.scores).toHaveLength(1);
    expect(body.attempts[0]).toMatchObject({ subject: "math", delta: 5 });
    expect(body.answerReviews[0]).toMatchObject({ question: "Q", answer: "A" });
    expect(body.conceptMastery[0]).toMatchObject({ concept_key: "ratios" });
    expect(body.subscription).toMatchObject({ status: "active" });
    expect(typeof body.exportedAt).toBe("string");
  });

  it("500s when a table read errors (no silent partial export)", async () => {
    auth.requireUser.mockResolvedValue({ user: USER });
    storage.getAdmin.mockReturnValue(fakeAdmin({ attempts: { data: null, error: { message: "relation missing" } } }));
    expect((await exportPOST(req())).status).toBe(500);
  });
});
