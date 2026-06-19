import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/checkout and /api/portal — the authenticated Polar.sh billing entry points.
// requireUser (verified identity) and the Polar client (lib/polar) are mocked at the
// boundary so we test ROUTE behavior: identity binding, config gating, and error mapping.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const polar = vi.hoisted(() => ({
  getPolar: vi.fn(),
  proProductId: vi.fn(() => "prod_pro"),
  successUrl: vi.fn(() => "https://app.test/?checkout=success"),
}));
vi.mock("@/lib/polar", () => ({
  getPolar: (...a) => polar.getPolar(...a),
  proProductId: (...a) => polar.proProductId(...a),
  successUrl: (...a) => polar.successUrl(...a),
}));

// /api/checkout records the Art. 16(a) consent via the service-role client before creating
// the Polar session. Mock it so we can assert the audit write (and default to null = the
// dev/test "no service-role store" case, where recording is skipped but checkout proceeds).
const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { POST as portalPOST } from "@/app/api/portal/route";
import { _resetRateLimits } from "@/lib/rateLimit";
import { IMMEDIATE_ACCESS_CONSENT_VERSION } from "@/lib/consent";

// A service-role client whose billing_audit.insert(row) is captured for assertions.
function fakeAdmin(captured) {
  return {
    from(table) {
      return { insert: async (row) => { captured.push({ table, row }); return { error: null }; } };
    },
  };
}

function jsonReq(url, body, { authHeader = false, secFetchSite } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authHeader) headers.Authorization = "Bearer test-token";
  if (secFetchSite) headers["sec-fetch-site"] = secFetchSite;
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body || {}) });
}

beforeEach(() => {
  _resetRateLimits();
  auth.requireUser.mockReset();
  polar.getPolar.mockReset();
  polar.proProductId.mockReset().mockReturnValue("prod_pro");
  polar.successUrl.mockReset().mockReturnValue("https://app.test/?checkout=success");
  storage.getAdmin.mockReset().mockReturnValue(null);
});

// The Art. 16(a) immediate-access consent the checkout dialog captures — required in the body.
const CONSENT = { consent: true, consentVersion: IMMEDIATE_ACCESS_CONSENT_VERSION };

describe("POST /api/checkout", () => {
  it("rejects a cross-site request with 403 before any auth/Polar work", async () => {
    const res = await checkoutPOST(jsonReq("http://test.local/api/checkout", {}, { secFetchSite: "cross-site" }));
    expect(res.status).toBe(403);
    expect(auth.requireUser).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    const res = await checkoutPOST(jsonReq("http://test.local/api/checkout", {}));
    expect(res.status).toBe(401);
  });

  it("400s when the immediate-access consent (CRD Art. 16(a)) is missing", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    polar.getPolar.mockReturnValue({ checkouts: { create: vi.fn() } });
    const res = await checkoutPOST(jsonReq("http://test.local/api/checkout", {}, { authHeader: true }));
    expect(res.status).toBe(400);
    // No Polar session is created without consent.
    expect(polar.getPolar.mock.results.some((r) => r.value && r.value.checkouts.create.mock.calls.length)).toBe(false);
  });

  it("503s when Polar is not configured (no token / product)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    polar.getPolar.mockReturnValue(null);
    const res = await checkoutPOST(jsonReq("http://test.local/api/checkout", CONSENT, { authHeader: true }));
    expect(res.status).toBe(503);
  });

  it("creates a checkout bound to the VERIFIED uid (never the body) and returns its url", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    const create = vi.fn(async () => ({ url: "https://polar.test/checkout/abc" }));
    polar.getPolar.mockReturnValue({ checkouts: { create } });
    const res = await checkoutPOST(jsonReq("http://test.local/api/checkout", { ...CONSENT, externalCustomerId: "attacker" }, { authHeader: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://polar.test/checkout/abc");
    const arg = create.mock.calls[0][0];
    expect(arg.externalCustomerId).toBe("u1");
    expect(arg.products).toEqual(["prod_pro"]);
    expect(arg.metadata).toEqual({ user_id: "u1" });
    expect(arg.customerEmail).toBe("a@b.com");
  });

  it("records the Art. 16(a) consent (billing_audit) before creating the session", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    polar.getPolar.mockReturnValue({ checkouts: { create: vi.fn(async () => ({ url: "https://polar.test/checkout/abc" })) } });
    const captured = [];
    storage.getAdmin.mockReturnValue(fakeAdmin(captured));
    const res = await checkoutPOST(jsonReq("http://test.local/api/checkout", CONSENT, { authHeader: true }));
    expect(res.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0].table).toBe("billing_audit");
    expect(captured[0].row).toMatchObject({ user_id: "u1", kind: "immediate_access_consent" });
    expect(captured[0].row.detail.version).toBe(IMMEDIATE_ACCESS_CONSENT_VERSION);
    expect(typeof captured[0].row.detail.text).toBe("string");
  });

  it("502s when the Polar API throws (upstream detail never leaks)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    polar.getPolar.mockReturnValue({ checkouts: { create: vi.fn(async () => { throw new Error("polar 500 detail"); }) } });
    const res = await checkoutPOST(jsonReq("http://test.local/api/checkout", CONSENT, { authHeader: true }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toMatch(/polar 500 detail/);
  });
});

describe("POST /api/portal", () => {
  it("401s an unauthenticated caller", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    const res = await portalPOST(jsonReq("http://test.local/api/portal", {}));
    expect(res.status).toBe(401);
  });

  it("returns the customer portal url for the verified uid", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const create = vi.fn(async () => ({ customerPortalUrl: "https://polar.test/portal/u1" }));
    polar.getPolar.mockReturnValue({ customerSessions: { create } });
    const res = await portalPOST(jsonReq("http://test.local/api/portal", {}, { authHeader: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://polar.test/portal/u1");
    expect(create.mock.calls[0][0]).toEqual({ externalCustomerId: "u1" });
  });

  it("404s when the user has no Polar customer yet (never subscribed)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    polar.getPolar.mockReturnValue({
      customerSessions: { create: vi.fn(async () => { const e = new Error("not found"); e.statusCode = 404; throw e; }) },
    });
    const res = await portalPOST(jsonReq("http://test.local/api/portal", {}, { authHeader: true }));
    expect(res.status).toBe(404);
  });

  it("503s when Polar is not configured", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    polar.getPolar.mockReturnValue(null);
    const res = await portalPOST(jsonReq("http://test.local/api/portal", {}, { authHeader: true }));
    expect(res.status).toBe(503);
  });
});
