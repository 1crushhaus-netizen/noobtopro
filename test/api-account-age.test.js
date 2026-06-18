import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// /api/account/age — server-authoritative 18+ age verification. Verifies the JWT,
// recomputes the age from the submitted DOB SERVER-SIDE, rejects under-18, and only
// on success writes `age_verified` to app_metadata via the service-role Admin API.
// requireUser + the admin client are mocked at the boundary.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: (...a) => auth.requireUser(...a) }));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => storage.getAdmin() }));

import { POST } from "@/app/api/account/age/route";
import { _resetRateLimits } from "@/lib/rateLimit";

function fakeAdmin({ updateResult = { error: null } } = {}) {
  const updateUserById = vi.fn(async () => updateResult);
  return { auth: { admin: { updateUserById } }, _updateUserById: updateUserById };
}

const req = (body) =>
  new Request("http://test.local/api/account/age", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// A DOB that is unambiguously >= 18 / < 18 relative to "now" (uses Jan 1 so there's no
// birthday-this-year edge).
const thisYear = new Date().getUTCFullYear();
const adultDob = `${thisYear - 30}-01-01`;
const minorDob = `${thisYear - 15}-01-01`;

beforeEach(() => {
  _resetRateLimits();
  auth.requireUser.mockReset();
  storage.getAdmin.mockReset().mockReturnValue(null);
});

describe("POST /api/account/age (server-authoritative 18+ gate)", () => {
  it("401s a guest (identity comes only from the verified JWT)", async () => {
    auth.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    expect((await POST(req({ dob: adultDob }))).status).toBe(401);
  });

  it("rejects a cross-site request (403) before doing anything", async () => {
    const raw = new Request("http://test.local/api/account/age", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
      body: JSON.stringify({ dob: adultDob }),
    });
    expect((await POST(raw)).status).toBe(403);
  });

  it("400s an invalid date of birth", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1", app_metadata: {} } });
    storage.getAdmin.mockReturnValue(fakeAdmin());
    expect((await POST(req({ dob: "not-a-date" }))).status).toBe(400);
  });

  it("BLOCKS an under-18 DOB with 403 and never sets the flag", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1", app_metadata: {} } });
    const admin = fakeAdmin();
    storage.getAdmin.mockReturnValue(admin);
    const res = await POST(req({ dob: minorDob }));
    expect(res.status).toBe(403);
    expect((await res.json()).ageVerified).toBe(false);
    expect(admin._updateUserById).not.toHaveBeenCalled();
  });

  it("verifies an 18+ DOB and writes age_verified to app_metadata (server-side, not client)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1", app_metadata: { existing: "keep" } } });
    const admin = fakeAdmin();
    storage.getAdmin.mockReturnValue(admin);
    const res = await POST(req({ dob: adultDob }));
    expect(res.status).toBe(200);
    expect((await res.json()).ageVerified).toBe(true);
    expect(admin._updateUserById).toHaveBeenCalledTimes(1);
    const [uid, patch] = admin._updateUserById.mock.calls[0];
    expect(uid).toBe("u1");
    expect(patch.app_metadata.age_verified).toBe(true);
    expect(patch.app_metadata.existing).toBe("keep"); // merges, doesn't clobber
    expect(patch.app_metadata.birth_year).toBe(thisYear - 30);
    expect(typeof patch.app_metadata.age_verified_at).toBe("string");
  });

  it("503s when no service-role store is configured (can't record the verdict)", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1", app_metadata: {} } });
    storage.getAdmin.mockReturnValue(null);
    expect((await POST(req({ dob: adultDob }))).status).toBe(503);
  });

  it("500s when the admin write fails", async () => {
    auth.requireUser.mockResolvedValue({ user: { id: "u1", app_metadata: {} } });
    storage.getAdmin.mockReturnValue(fakeAdmin({ updateResult: { error: { message: "boom" } } }));
    expect((await POST(req({ dob: adultDob }))).status).toBe(500);
  });
});
