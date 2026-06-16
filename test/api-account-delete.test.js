import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/account/delete — permanent account erasure (P0-11). Verifies JWT, cancels
// any Polar subscription (best-effort), then hard-deletes the auth user (cascades
// all data). requireUser / the service-role admin client / the Polar client are
// mocked at the boundary.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

const polar = vi.hoisted(() => ({ getPolar: vi.fn(() => null) }));
vi.mock("@/lib/polar", () => ({ getPolar: () => polar.getPolar() }));

import { POST as deletePOST } from "@/app/api/account/delete/route";

// Fake service-role admin: subscriptions read -> `subRow`; auth.admin.deleteUser -> deleteResult.
function fakeAdmin({ subRow = null, deleteResult = { error: null } } = {}) {
  const deleteUser = vi.fn(async () => deleteResult);
  return {
    from() {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: subRow, error: null }) };
      return chain;
    },
    auth: { admin: { deleteUser } },
    _deleteUser: deleteUser,
  };
}

const req = () =>
  new Request("http://test.local/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

beforeEach(() => {
  auth.requireUser.mockReset();
  storage.getAdmin.mockReset().mockReturnValue(null);
  polar.getPolar.mockReset().mockReturnValue(null);
});

describe("POST /api/account/delete (P0-11 right to erasure)", () => {
  it("401s a guest", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    expect((await deletePOST(req())).status).toBe(401);
  });

  it("503s when no service-role store is configured (can't truly delete)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(null);
    expect((await deletePOST(req())).status).toBe(503);
  });

  it("deletes the auth user (no Polar configured)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const admin = fakeAdmin();
    storage.getAdmin.mockReturnValue(admin);
    const res = await deletePOST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
    expect(admin._deleteUser).toHaveBeenCalledWith("u1");
  });

  it("revokes the Polar subscription before deleting when one exists", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const admin = fakeAdmin({ subRow: { polar_subscription_id: "sub_123" } });
    storage.getAdmin.mockReturnValue(admin);
    const revoke = vi.fn(async () => ({}));
    polar.getPolar.mockReturnValue({ subscriptions: { revoke } });
    const res = await deletePOST(req());
    expect(res.status).toBe(200);
    expect(revoke).toHaveBeenCalledWith({ id: "sub_123" });
    expect(admin._deleteUser).toHaveBeenCalledWith("u1");
  });

  it("still deletes the account even if the Polar revoke throws (best-effort)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    const admin = fakeAdmin({ subRow: { polar_subscription_id: "sub_123" } });
    storage.getAdmin.mockReturnValue(admin);
    polar.getPolar.mockReturnValue({ subscriptions: { revoke: vi.fn(async () => { throw new Error("polar down"); }) } });
    const res = await deletePOST(req());
    expect(res.status).toBe(200);
    expect(admin._deleteUser).toHaveBeenCalledWith("u1");
  });

  it("500s when the auth-user deletion fails", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1" } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ deleteResult: { error: { message: "boom" } } }));
    expect((await deletePOST(req())).status).toBe(500);
  });
});
