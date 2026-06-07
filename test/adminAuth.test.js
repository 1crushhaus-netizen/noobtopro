import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Control the Supabase client that adminAuth's verifyClient() builds. createClient
// returns a fake whose auth.getUser we drive per-test. We capture the args
// createClient was called with so we can assert it used the configured URL/anon.
const sbMock = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args) => sbMock.createClient(...args),
}));

import {
  isAdminUser,
  requireAdmin,
  adminEmails,
  adminUserIds,
  _resetVerifyClient,
} from "@/lib/adminAuth";

// Snapshot + restore only the env vars these tests touch, so the suite is
// hermetic regardless of the ambient environment.
const ENV_KEYS = [
  "ADMIN_EMAILS",
  "ADMIN_USER_IDS",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
let savedEnv;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];

  sbMock.getUser.mockReset();
  sbMock.createClient.mockReset();
  sbMock.createClient.mockImplementation(() => ({ auth: { getUser: sbMock.getUser } }));

  _resetVerifyClient(); // drop any cached client so each test rebuilds it
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  _resetVerifyClient();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// isAdminUser — pure allowlist check (deny-by-default).
// ---------------------------------------------------------------------------
describe("isAdminUser — deny-by-default allowlist", () => {
  it("returns false for a valid user when BOTH allowlists are empty/unset", () => {
    // no ADMIN_EMAILS, no ADMIN_USER_IDS in env
    expect(isAdminUser({ id: "u-1", email: "person@example.com" })).toBe(false);
  });

  it("returns true for an email in ADMIN_EMAILS (case-insensitive, env-list spaces tolerated)", () => {
    process.env.ADMIN_EMAILS = "  Admin@Example.com , other@x.io ";
    // user email differs in case + has its own surrounding case differences
    expect(isAdminUser({ id: "u-1", email: "ADMIN@example.COM" })).toBe(true);
  });

  it("returns false for an email NOT in ADMIN_EMAILS", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminUser({ id: "u-1", email: "intruder@example.com" })).toBe(false);
  });

  it("returns true for an id in ADMIN_USER_IDS (exact match)", () => {
    process.env.ADMIN_USER_IDS = "uuid-aaa, uuid-bbb";
    expect(isAdminUser({ id: "uuid-bbb", email: "nobody@example.com" })).toBe(true);
  });

  it("returns true for a user with no email but a listed id", () => {
    process.env.ADMIN_USER_IDS = "uuid-aaa";
    expect(isAdminUser({ id: "uuid-aaa" })).toBe(true); // email absent
    expect(isAdminUser({ id: "uuid-aaa", email: "" })).toBe(true); // email empty string
  });

  it("returns false when neither the email nor the id is listed", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    process.env.ADMIN_USER_IDS = "uuid-aaa";
    expect(isAdminUser({ id: "uuid-zzz", email: "intruder@example.com" })).toBe(false);
  });

  it("requires a non-empty email to match by email (empty email never matches the email list)", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    // id is not listed and email is empty → no match path available
    expect(isAdminUser({ id: "uuid-zzz", email: "" })).toBe(false);
    expect(isAdminUser({ id: "uuid-zzz" })).toBe(false);
  });

  it("returns false for null / non-object / garbage users", () => {
    process.env.ADMIN_EMAILS = "admin@example.com"; // allowlist populated, yet still deny
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
    expect(isAdminUser("admin@example.com")).toBe(false);
    expect(isAdminUser(42)).toBe(false);
    expect(isAdminUser({})).toBe(false); // object with no id/email
    expect(isAdminUser({ id: 123, email: 456 })).toBe(false); // non-string fields
  });
});

describe("adminEmails / adminUserIds — list parsing", () => {
  it("parses, trims, lowercases emails and drops blanks", () => {
    process.env.ADMIN_EMAILS = " A@b.com ,, C@D.io , ";
    expect(adminEmails()).toEqual(new Set(["a@b.com", "c@d.io"]));
  });

  it("parses and trims ids without lowercasing, dropping blanks", () => {
    process.env.ADMIN_USER_IDS = " UUID-1 ,, uuid-2 ";
    expect(adminUserIds()).toEqual(new Set(["UUID-1", "uuid-2"]));
  });

  it("returns empty sets when unset", () => {
    expect(adminEmails().size).toBe(0);
    expect(adminUserIds().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// requireAdmin — token verification + admin membership.
// ---------------------------------------------------------------------------
// Fake Next.js Request-like object: only headers.get(name) is used by the module.
function fakeReq(headersObj = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headersObj)) lower[k.toLowerCase()] = v;
  return { headers: { get: (k) => lower[String(k).toLowerCase()] ?? null } };
}

describe("requireAdmin — bearer verification + authorization", () => {
  beforeEach(() => {
    // Supabase configured for these tests (verifyClient() needs both).
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    _resetVerifyClient();
  });

  it("returns 401 when there is no Authorization header", async () => {
    const res = await requireAdmin(fakeReq({}));
    expect(res.status).toBe(401);
    expect(res.error).toBeTruthy();
    expect(res.user).toBeUndefined();
    expect(sbMock.getUser).not.toHaveBeenCalled(); // never verifies an absent token
  });

  it("returns 503 when Supabase is not configured server-side", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    _resetVerifyClient();
    const res = await requireAdmin(fakeReq({ Authorization: "Bearer tok" }));
    expect(res.status).toBe(503);
  });

  it("returns 401 when getUser reports an error / no user", async () => {
    sbMock.getUser.mockResolvedValue({ data: null, error: { message: "bad jwt" } });
    const res = await requireAdmin(fakeReq({ Authorization: "Bearer bad-token" }));
    expect(res.status).toBe(401);
    expect(res.user).toBeUndefined();
    expect(sbMock.getUser).toHaveBeenCalledWith("bad-token"); // verified the supplied token
  });

  it("returns {user} (no error) for a verified user whose email is in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    const verifiedUser = { id: "u-1", email: "Admin@Example.com" };
    sbMock.getUser.mockResolvedValue({ data: { user: verifiedUser }, error: null });

    const res = await requireAdmin(fakeReq({ Authorization: "Bearer good-token" }));
    expect(res.user).toBe(verifiedUser);
    expect(res.error).toBeUndefined();
    expect(res.status).toBeUndefined();
    expect(sbMock.getUser).toHaveBeenCalledWith("good-token");
    // Client built from the configured URL/anon, never client-supplied values.
    expect(sbMock.createClient).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "anon-key",
      expect.anything()
    );
  });

  it("returns 403 for a verified user who is in NO allowlist", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    process.env.ADMIN_USER_IDS = "uuid-aaa";
    sbMock.getUser.mockResolvedValue({
      data: { user: { id: "uuid-zzz", email: "intruder@example.com" } },
      error: null,
    });
    const res = await requireAdmin(fakeReq({ Authorization: "Bearer good-token" }));
    expect(res.status).toBe(403);
    expect(res.user).toBeUndefined();
  });

  it("returns 403 for a verified user when the allowlist is empty (deny-by-default)", async () => {
    // no ADMIN_EMAILS / ADMIN_USER_IDS set → nobody is an admin even with a valid token
    sbMock.getUser.mockResolvedValue({
      data: { user: { id: "u-1", email: "real@example.com" } },
      error: null,
    });
    const res = await requireAdmin(fakeReq({ Authorization: "Bearer good-token" }));
    expect(res.status).toBe(403);
  });

  it("returns 401 when getUser throws", async () => {
    sbMock.getUser.mockRejectedValue(new Error("network down"));
    const res = await requireAdmin(fakeReq({ Authorization: "Bearer good-token" }));
    expect(res.status).toBe(401);
    expect(res.user).toBeUndefined();
  });

  it("parses the bearer token case-insensitively and trims it", async () => {
    process.env.ADMIN_USER_IDS = "uuid-aaa";
    sbMock.getUser.mockResolvedValue({
      data: { user: { id: "uuid-aaa" } },
      error: null,
    });
    const res = await requireAdmin(fakeReq({ Authorization: "bearer   the-token  " }));
    expect(res.user).toBeTruthy();
    expect(sbMock.getUser).toHaveBeenCalledWith("the-token");
  });
});
