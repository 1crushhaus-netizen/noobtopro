import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// /api/leaderboard verifies the caller's JWT (requireUser), then calls the
// service-role-only leaderboard_tiers RPC with the VERIFIED uid. We mock those
// boundary layers and assert the route never trusts a client identity and never
// leaks per-user data (the RPC's anonymity is covered by the migration/DB tests).
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

vi.mock("@/lib/abuseDetection", () => ({ reportRateLimit: vi.fn() }));

import { POST } from "@/app/api/leaderboard/route";
import { _resetRateLimits } from "@/lib/rateLimit";

function req({ authHeader = false, site } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authHeader) headers.Authorization = "Bearer test-token";
  if (site) headers["Sec-Fetch-Site"] = site;
  return new Request("http://test.local/api/leaderboard", { method: "POST", headers, body: "{}" });
}

const TIERS = {
  overall: { counts: [1, 1, 0, 0, 0], total: 2, you: { band: 0, score: 12, above: 1 } },
  math: { counts: [1, 0, 1, 0, 0], total: 2, you: { band: 2, score: 55, above: 0 } },
};

beforeEach(() => {
  _resetRateLimits();
  auth.requireUser.mockReset();
  storage.getAdmin.mockReset();
  storage.getAdmin.mockReturnValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/leaderboard", () => {
  it("blocks a forced cross-site request with 403 (before auth)", async () => {
    const res = await POST(req({ authHeader: true, site: "cross-site" }));
    expect(res.status).toBe(403);
    expect(auth.requireUser).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content-type with 415", async () => {
    const r = new Request("http://test.local/api/leaderboard", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" });
    expect((await POST(r)).status).toBe(415);
  });

  it("requires a verified user (401 short-circuits before any DB call)", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    const rpc = vi.fn();
    storage.getAdmin.mockReturnValue({ rpc });
    const res = await POST(req({ authHeader: true }));
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 503 when the service-role client is unavailable", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(null);
    expect((await POST(req({ authHeader: true }))).status).toBe(503);
  });

  it("returns the tiers from leaderboard_tiers called with the VERIFIED uid", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "verified-uid" } });
    const rpc = vi.fn(async (fn, args) => {
      expect(fn).toBe("leaderboard_tiers");
      expect(args.p_uid).toBe("verified-uid"); // never a client-supplied id
      return { data: TIERS, error: null };
    });
    storage.getAdmin.mockReturnValue({ rpc });
    const res = await POST(req({ authHeader: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.tiers).toEqual(TIERS);
    // Anonymity smoke-check: the payload carries no user identifiers.
    expect(JSON.stringify(j)).not.toMatch(/user_id|email|reporter/i);
  });

  it("returns a generic 500 (no leak) when the RPC fails", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue({ rpc: vi.fn(async () => ({ data: null, error: { message: "db boom" } })) });
    const res = await POST(req({ authHeader: true }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).not.toMatch(/db boom/);
  });
});
