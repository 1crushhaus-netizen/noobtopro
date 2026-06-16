import { describe, it, expect, beforeEach, vi } from "vitest";

// Entitlements reads through two server deps: the service-role admin client
// (getSupabaseAdmin) and the JWT verifier (requireUser). Mock both at the module
// boundary so these are pure unit tests of the entitlement logic.
const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("@/lib/adminAuth", () => ({ requireUser: mocks.requireUser }));

import {
  PRO_STATUSES,
  isActiveSubscription,
  getSubscriptionRow,
  isProUserId,
  proStatusFromRequest,
  requireProUser,
} from "@/lib/entitlements";

// Build a fake service-role client whose subscriptions query resolves to `result`
// ({ data, error }). Mirrors the supabase-js chain entitlements uses:
//   from(...).select(...).eq(...).maybeSingle()
function fakeAdmin(result) {
  const maybeSingle = vi.fn(async () => result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, _chain: { from, select, eq, maybeSingle } };
}

const NOW = Date.parse("2026-06-15T00:00:00Z");
const FUTURE = "2026-12-31T00:00:00Z";
const PAST = "2026-01-01T00:00:00Z";

beforeEach(() => {
  mocks.getSupabaseAdmin.mockReset();
  mocks.requireUser.mockReset();
});

// ---------------------------------------------------------------------------
// isActiveSubscription — pure predicate.
// ---------------------------------------------------------------------------
describe("isActiveSubscription — pure Pro predicate", () => {
  it("active with a FUTURE period end is Pro", () => {
    expect(isActiveSubscription({ status: "active", current_period_end: FUTURE }, NOW)).toBe(true);
  });

  it("active with NO period end is Pro (open-ended)", () => {
    expect(isActiveSubscription({ status: "active", current_period_end: null }, NOW)).toBe(true);
    expect(isActiveSubscription({ status: "active" }, NOW)).toBe(true);
  });

  it("trialing counts as Pro", () => {
    expect(isActiveSubscription({ status: "trialing", current_period_end: FUTURE }, NOW)).toBe(true);
  });

  it("active but PAST the period end is NOT Pro (missed-revoke belt-and-suspenders)", () => {
    expect(isActiveSubscription({ status: "active", current_period_end: PAST }, NOW)).toBe(false);
  });

  it("canceled / revoked / past_due / unknown statuses are NOT Pro", () => {
    for (const status of ["canceled", "revoked", "past_due", "incomplete", "unpaid", "inactive", "something_new"]) {
      expect(isActiveSubscription({ status, current_period_end: FUTURE }, NOW)).toBe(false);
    }
  });

  it("an unparseable period end falls back to the status decision (status already active)", () => {
    expect(isActiveSubscription({ status: "active", current_period_end: "not-a-date" }, NOW)).toBe(true);
  });

  it("null / garbage rows are NOT Pro", () => {
    expect(isActiveSubscription(null, NOW)).toBe(false);
    expect(isActiveSubscription(undefined, NOW)).toBe(false);
    expect(isActiveSubscription("active", NOW)).toBe(false);
    expect(isActiveSubscription(42, NOW)).toBe(false);
    expect(isActiveSubscription({}, NOW)).toBe(false); // no status
  });

  it("PRO_STATUSES is the active allow-list (active + trialing)", () => {
    expect(PRO_STATUSES.has("active")).toBe(true);
    expect(PRO_STATUSES.has("trialing")).toBe(true);
    expect(PRO_STATUSES.has("canceled")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSubscriptionRow / isProUserId — service-role read (deny-by-default).
// ---------------------------------------------------------------------------
describe("getSubscriptionRow / isProUserId — deny-by-default read", () => {
  it("returns null and never queries when there is no userId", async () => {
    expect(await getSubscriptionRow("")).toBeNull();
    expect(await getSubscriptionRow(null)).toBeNull();
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns null when no service-role store is configured (nobody is Pro)", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(null);
    expect(await getSubscriptionRow("u-1")).toBeNull();
    expect(await isProUserId("u-1")).toBe(false);
  });

  it("returns the row and scopes the query to the user", async () => {
    const row = { user_id: "u-1", status: "active", current_period_end: FUTURE };
    const admin = fakeAdmin({ data: row, error: null });
    mocks.getSupabaseAdmin.mockReturnValue(admin);

    expect(await getSubscriptionRow("u-1")).toEqual(row);
    expect(admin._chain.from).toHaveBeenCalledWith("subscriptions");
    expect(admin._chain.eq).toHaveBeenCalledWith("user_id", "u-1");
  });

  it("returns null on a query error", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(fakeAdmin({ data: null, error: { message: "boom" } }));
    expect(await getSubscriptionRow("u-1")).toBeNull();
  });

  it("isProUserId is true for an active row and false for a canceled one", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(fakeAdmin({ data: { status: "active" }, error: null }));
    expect(await isProUserId("u-1")).toBe(true);

    mocks.getSupabaseAdmin.mockReturnValue(fakeAdmin({ data: { status: "canceled" }, error: null }));
    expect(await isProUserId("u-1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// proStatusFromRequest — non-erroring branch helper.
// ---------------------------------------------------------------------------
describe("proStatusFromRequest — guests resolve to not-Pro without a DB hit", () => {
  it("returns {user:null, isPro:false} for an unauthenticated caller and never touches the DB", async () => {
    mocks.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    expect(await proStatusFromRequest({})).toEqual({ user: null, isPro: false });
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns {user, isPro:true} for a signed-in Pro caller", async () => {
    const user = { id: "u-1" };
    mocks.requireUser.mockResolvedValue({ user });
    mocks.getSupabaseAdmin.mockReturnValue(fakeAdmin({ data: { status: "active" }, error: null }));
    expect(await proStatusFromRequest({})).toEqual({ user, isPro: true });
  });

  it("returns {user, isPro:false} for a signed-in NON-Pro caller", async () => {
    const user = { id: "u-2" };
    mocks.requireUser.mockResolvedValue({ user });
    mocks.getSupabaseAdmin.mockReturnValue(null); // no entitlement store -> not Pro
    expect(await proStatusFromRequest({})).toEqual({ user, isPro: false });
  });
});

// ---------------------------------------------------------------------------
// requireProUser — hard gate for Pro-only routes.
// ---------------------------------------------------------------------------
describe("requireProUser — hard Pro gate", () => {
  it("passes through requireUser's auth error (401)", async () => {
    mocks.requireUser.mockResolvedValue({ error: "Authentication required.", status: 401 });
    const res = await requireProUser({});
    expect(res.status).toBe(401);
    expect(res.user).toBeUndefined();
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled(); // never checks entitlement without a user
  });

  it("returns 402 (Payment Required) for a signed-in caller who is not Pro", async () => {
    mocks.requireUser.mockResolvedValue({ user: { id: "u-1" } });
    mocks.getSupabaseAdmin.mockReturnValue(fakeAdmin({ data: { status: "canceled" }, error: null }));
    const res = await requireProUser({});
    expect(res.status).toBe(402);
    expect(res.user).toBeUndefined();
  });

  it("returns {user} for a signed-in Pro caller", async () => {
    const user = { id: "u-1" };
    mocks.requireUser.mockResolvedValue({ user });
    mocks.getSupabaseAdmin.mockReturnValue(fakeAdmin({ data: { status: "active", current_period_end: FUTURE }, error: null }));
    const res = await requireProUser({});
    expect(res.user).toBe(user);
    expect(res.error).toBeUndefined();
    expect(res.status).toBeUndefined();
  });
});
