import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the two layers the admin routes lean on so we test ROUTE behavior in
// isolation:
//   - @/lib/adminAuth  : requireAdmin's verdict is whatever a test installs
//     (its real token/allowlist logic is covered in test/adminAuth.test.js).
//   - @/lib/supabaseAdmin : getSupabaseAdmin returns a fake service-role client
//     that records every PostgREST-style chain so we can assert what the route
//     asked the database to do.
// ---------------------------------------------------------------------------
const auth = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({
  requireAdmin: (...a) => auth.requireAdmin(...a),
}));

const storage = vi.hoisted(() => ({ getAdmin: vi.fn(() => null) }));
vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => storage.getAdmin(),
}));

import { POST as meRoute } from "@/app/api/admin/me/route";
import { POST as dataRoute } from "@/app/api/admin/data/route";
import { POST as actionRoute } from "@/app/api/admin/action/route";
import { _resetRateLimits } from "@/lib/rateLimit";

// ---------------------------------------------------------------------------
// A fake service-role client. Every builder method returns the SAME chainable
// object, and the object is awaitable (it has a `then`) so `await sb.from(...)
// .select(...).or(...)...` resolves to a `{ data, error }` result. The terminal
// result is chosen by `resultFor(table)`. All method calls land in `calls` so a
// test can assert the exact table/columns/filters the route issued.
//
// `select` is special-cased: on the action route's approve path the route
// awaits the *result of* `.select("concept_key")` (it ends a chain), so select
// must itself be both chainable AND awaitable — which it is, since it returns
// the same builder. On the data route, `.select(...).or(...)...` is a longer
// chain ending in `.limit(...)` that is then awaited — same object, also fine.
// ---------------------------------------------------------------------------
function fakeAdmin({ results = {}, defaultResult = { data: [], error: null } } = {}) {
  // results: per-(table[:tag]) terminal result. `tag` lets the action route's
  // multiple writes to "concept_guides" resolve differently (approve vs hide vs
  // delete) — we tag the builder when an identifying method is called.
  const calls = [];
  const make = (table) => {
    const builder = {
      _table: table,
      _tag: null,
      // Record a step, then return self for chaining.
      _step(method, args) {
        calls.push({ table, method, args });
        return this;
      },
      select(...args) {
        if (args[0] === "concept_key") this._tag = "approve";
        return this._step("select", args);
      },
      or(...args) {
        return this._step("or", args);
      },
      eq(...args) {
        if (args[0] === "status" && args[1] === "ready") this._tag = "approve";
        return this._step("eq", args);
      },
      order(...args) {
        return this._step("order", args);
      },
      limit(...args) {
        return this._step("limit", args);
      },
      update(...args) {
        this._tag = "update";
        return this._step("update", args);
      },
      delete(...args) {
        this._tag = "delete";
        return this._step("delete", args);
      },
      // Awaitable: resolve to the configured terminal result for this builder.
      then(resolve, reject) {
        const key = this._tag ? `${table}:${this._tag}` : table;
        const result =
          results[key] !== undefined
            ? results[key]
            : results[table] !== undefined
            ? results[table]
            : defaultResult;
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  };
  return {
    calls,
    from(table) {
      calls.push({ table, method: "from", args: [table] });
      return make(table);
    },
  };
}

// Find the first recorded call matching a predicate (for arg assertions).
const findCall = (sb, pred) => sb.calls.find(pred);

// ---------------------------------------------------------------------------
// Request builders. Default = same-origin-ish JSON (allowed). `raw(headers)`
// lets a test set Sec-Fetch-Site / Content-Type explicitly to exercise the
// shared request guard (mirrors test/api-generate.test.js's helper).
// ---------------------------------------------------------------------------
function req(url, bodyObjOrString, headers = { "Content-Type": "application/json" }) {
  const body =
    bodyObjOrString === undefined
      ? undefined
      : typeof bodyObjOrString === "string"
      ? bodyObjOrString
      : JSON.stringify(bodyObjOrString);
  return new Request(url, { method: "POST", headers, body });
}
const raw = (url, headers, body = {}) =>
  new Request(url, { method: "POST", headers, body: JSON.stringify(body) });

const ME = "http://test.local/api/admin/me";
const DATA = "http://test.local/api/admin/data";
const ACTION = "http://test.local/api/admin/action";

const ADMIN = { user: { id: "u1", email: "a@b.com" } };

beforeEach(() => {
  _resetRateLimits();
  auth.requireAdmin.mockReset();
  storage.getAdmin.mockReset();
  storage.getAdmin.mockReturnValue(fakeAdmin());
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// /api/admin/me
// ===========================================================================
describe("POST /api/admin/me", () => {
  it("returns { isAdmin:true, email } when requireAdmin verifies a user (200)", async () => {
    auth.requireAdmin.mockResolvedValue(ADMIN);
    const res = await meRoute(req(ME, {}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ isAdmin: true, email: "a@b.com" });
  });

  it("returns { isAdmin:false } (still 200) when requireAdmin denies (401)", async () => {
    auth.requireAdmin.mockResolvedValue({ error: "Authentication required.", status: 401 });
    const res = await meRoute(req(ME, {}));
    expect(res.status).toBe(200); // never leaks the deny reason as an error status
    const json = await res.json();
    expect(json.isAdmin).toBe(false);
    expect(json.email).toBe(null);
  });

  it("blocks a cross-site request with 403 (before any auth check)", async () => {
    auth.requireAdmin.mockResolvedValue(ADMIN);
    const res = await meRoute(raw(ME, { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content-type with 415", async () => {
    const res = await meRoute(raw(ME, { "Content-Type": "text/plain" }));
    expect(res.status).toBe(415);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// /api/admin/data
// ===========================================================================
describe("POST /api/admin/data", () => {
  it("returns 401 and does NOT read storage when requireAdmin denies (401)", async () => {
    auth.requireAdmin.mockResolvedValue({ error: "Authentication required.", status: 401 });
    const res = await dataRoute(req(DATA, {}));
    expect(res.status).toBe(401);
    expect(storage.getAdmin).not.toHaveBeenCalled();
  });

  it("returns 403 and does NOT read storage when requireAdmin denies (403)", async () => {
    auth.requireAdmin.mockResolvedValue({ error: "Not authorized.", status: 403 });
    const res = await dataRoute(req(DATA, {}));
    expect(res.status).toBe(403);
    expect(storage.getAdmin).not.toHaveBeenCalled();
  });

  it("returns 200 with { counts, pendingGuides, events, reports } shaped from the fake", async () => {
    auth.requireAdmin.mockResolvedValue(ADMIN);
    const sb = fakeAdmin({
      results: {
        concept_guides: {
          data: [
            {
              subject: "math",
              concept_key: "limits",
              concept: "Limits",
              topic: "calculus",
              status: "ready",
              visibility: "hidden",
              source: "auto",
              level_band: "intro",
              created_at: "2026-01-01",
              updated_at: "2026-01-02",
              content: { overview: "An overview of limits." },
            },
          ],
          error: null,
        },
        security_events: { data: [{ id: 1, status: "open" }], error: null },
        concept_reports: { data: [{ id: 7, status: "open" }, { id: 8, status: "open" }], error: null },
      },
    });
    storage.getAdmin.mockReturnValue(sb);

    const res = await dataRoute(req(DATA, {}));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.counts).toEqual({ pendingGuides: 1, events: 1, reports: 2 });
    expect(json.pendingGuides).toHaveLength(1);
    // Content is shipped as a trimmed PREVIEW string, not the full object.
    expect(json.pendingGuides[0]).toMatchObject({
      subject: "math",
      concept_key: "limits",
      status: "ready",
      visibility: "hidden",
      overview: "An overview of limits.",
    });
    expect(json.pendingGuides[0].content).toBeUndefined();
    expect(json.events).toEqual([{ id: 1, status: "open" }]);
    expect(json.reports).toHaveLength(2);

    // Asserts the curation-queue read path: NOT-public-or-NOT-ready, newest-first.
    const guideOr = findCall(sb, (c) => c.table === "concept_guides" && c.method === "or");
    expect(guideOr.args[0]).toBe("visibility.neq.public,status.neq.ready");
    const eventsEq = findCall(sb, (c) => c.table === "security_events" && c.method === "eq");
    expect(eventsEq.args).toEqual(["status", "open"]);
    const reportsEq = findCall(sb, (c) => c.table === "concept_reports" && c.method === "eq");
    expect(reportsEq.args).toEqual(["status", "open"]);
  });

  it("blocks a cross-site request with 403 (before auth/storage)", async () => {
    const res = await dataRoute(raw(DATA, { "Content-Type": "application/json", "Sec-Fetch-Site": "same-site" }));
    expect(res.status).toBe(403);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
    expect(storage.getAdmin).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content-type with 415", async () => {
    const res = await dataRoute(raw(DATA, { "Content-Type": "text/plain" }));
    expect(res.status).toBe(415);
    expect(storage.getAdmin).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// /api/admin/action
// ===========================================================================
describe("POST /api/admin/action", () => {
  beforeEach(() => {
    auth.requireAdmin.mockResolvedValue(ADMIN); // default: authorized admin
  });

  // ---- guide: approve ----
  it("approve publishes a READY guide (public/ready/curated, filtered status=ready) and returns ok", async () => {
    const sb = fakeAdmin({ results: { "concept_guides:approve": { data: [{ concept_key: "limits" }], error: null } } });
    storage.getAdmin.mockReturnValue(sb);

    const res = await actionRoute(req(ACTION, { target: "guide", action: "approve", subject: "math", concept_key: "limits" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, action: "approve" });

    const update = findCall(sb, (c) => c.table === "concept_guides" && c.method === "update");
    expect(update.args[0]).toMatchObject({ visibility: "public", status: "ready", source: "curated" });
    expect(update.args[0].updated_at).toEqual(expect.any(String));
    // Publish is gated to an already-ready row.
    const readyFilter = sb.calls.find((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "ready");
    expect(readyFilter).toBeTruthy();
    // And targets the exact subject + concept_key.
    expect(sb.calls.find((c) => c.method === "eq" && c.args[0] === "subject" && c.args[1] === "math")).toBeTruthy();
    expect(sb.calls.find((c) => c.method === "eq" && c.args[0] === "concept_key" && c.args[1] === "limits")).toBeTruthy();
  });

  it("approve returns 409 when no ready row matched (empty stub)", async () => {
    const sb = fakeAdmin({ results: { "concept_guides:approve": { data: [], error: null } } });
    storage.getAdmin.mockReturnValue(sb);
    const res = await actionRoute(req(ACTION, { target: "guide", action: "approve", subject: "math", concept_key: "limits" }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/ready/i);
  });

  // ---- guide: hide ----
  it("hide updates visibility:hidden on the targeted guide", async () => {
    const sb = fakeAdmin({ results: { "concept_guides:update": { error: null } } });
    storage.getAdmin.mockReturnValue(sb);
    const res = await actionRoute(req(ACTION, { target: "guide", action: "hide", subject: "physics", concept_key: "energy" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, action: "hide" });

    const update = findCall(sb, (c) => c.table === "concept_guides" && c.method === "update");
    expect(update.args[0]).toMatchObject({ visibility: "hidden" });
    expect(sb.calls.find((c) => c.method === "eq" && c.args[0] === "subject" && c.args[1] === "physics")).toBeTruthy();
    expect(sb.calls.find((c) => c.method === "eq" && c.args[0] === "concept_key" && c.args[1] === "energy")).toBeTruthy();
  });

  // ---- guide: delete ----
  it("delete removes the targeted guide", async () => {
    const sb = fakeAdmin({ results: { "concept_guides:delete": { error: null } } });
    storage.getAdmin.mockReturnValue(sb);
    const res = await actionRoute(req(ACTION, { target: "guide", action: "delete", subject: "chemistry", concept_key: "equilibrium" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, action: "delete" });

    expect(findCall(sb, (c) => c.table === "concept_guides" && c.method === "delete")).toBeTruthy();
    expect(sb.calls.find((c) => c.method === "eq" && c.args[0] === "subject" && c.args[1] === "chemistry")).toBeTruthy();
    expect(sb.calls.find((c) => c.method === "eq" && c.args[0] === "concept_key" && c.args[1] === "equilibrium")).toBeTruthy();
  });

  it("rejects an invalid/prototype subject with 400 and never touches storage", async () => {
    for (const subject of ["constructor", "bad", "__proto__", "toString"]) {
      const sb = fakeAdmin();
      storage.getAdmin.mockReturnValue(sb);
      const res = await actionRoute(req(ACTION, { target: "guide", action: "approve", subject, concept_key: "limits" }));
      expect(res.status).toBe(400);
      // No write/select against concept_guides was issued for a rejected subject.
      expect(sb.calls.find((c) => c.method === "update" || c.method === "delete")).toBeFalsy();
    }
  });

  it("rejects a guide reference with a missing concept_key with 400", async () => {
    const res = await actionRoute(req(ACTION, { target: "guide", action: "approve", subject: "math", concept_key: "" }));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown guide action with 400", async () => {
    const res = await actionRoute(req(ACTION, { target: "guide", action: "frobnicate", subject: "math", concept_key: "limits" }));
    expect(res.status).toBe(400);
  });

  // ---- event / report ----
  it("event + dismissed updates security_events.status by id", async () => {
    const sb = fakeAdmin({ results: { "security_events:update": { error: null } } });
    storage.getAdmin.mockReturnValue(sb);
    const res = await actionRoute(req(ACTION, { target: "event", action: "dismissed", id: 5 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, action: "dismissed" });

    const update = findCall(sb, (c) => c.table === "security_events" && c.method === "update");
    expect(update.args[0]).toEqual({ status: "dismissed" });
    expect(sb.calls.find((c) => c.method === "eq" && c.args[0] === "id" && c.args[1] === 5)).toBeTruthy();
  });

  it("report + reviewed updates concept_reports.status by id", async () => {
    const sb = fakeAdmin({ results: { "concept_reports:update": { error: null } } });
    storage.getAdmin.mockReturnValue(sb);
    const res = await actionRoute(req(ACTION, { target: "report", action: "reviewed", id: 9 }));
    expect(res.status).toBe(200);
    const update = findCall(sb, (c) => c.table === "concept_reports" && c.method === "update");
    expect(update.args[0]).toEqual({ status: "reviewed" });
    expect(sb.calls.find((c) => c.method === "eq" && c.args[0] === "id" && c.args[1] === 9)).toBeTruthy();
  });

  it("rejects a bad id with 400", async () => {
    for (const id of [0, -1, 1.5, "abc", undefined]) {
      const res = await actionRoute(req(ACTION, { target: "event", action: "dismissed", id }));
      expect(res.status).toBe(400);
    }
  });

  it("rejects an unknown review action with 400", async () => {
    const res = await actionRoute(req(ACTION, { target: "event", action: "approve", id: 5 }));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown target with 400", async () => {
    const res = await actionRoute(req(ACTION, { target: "spaceship", action: "approve", id: 5 }));
    expect(res.status).toBe(400);
  });

  // ---- auth + guard ----
  it("returns 401 when requireAdmin denies (and never touches storage)", async () => {
    auth.requireAdmin.mockResolvedValue({ error: "Authentication required.", status: 401 });
    const res = await actionRoute(req(ACTION, { target: "guide", action: "approve", subject: "math", concept_key: "limits" }));
    expect(res.status).toBe(401);
    expect(storage.getAdmin).not.toHaveBeenCalled();
  });

  it("returns 403 when requireAdmin denies a non-admin", async () => {
    auth.requireAdmin.mockResolvedValue({ error: "Not authorized.", status: 403 });
    const res = await actionRoute(req(ACTION, { target: "guide", action: "delete", subject: "math", concept_key: "limits" }));
    expect(res.status).toBe(403);
    expect(storage.getAdmin).not.toHaveBeenCalled();
  });

  it("blocks a cross-site request with 403 (before auth/storage)", async () => {
    const res = await actionRoute(raw(ACTION, { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }, { target: "guide", action: "delete", subject: "math", concept_key: "limits" }));
    expect(res.status).toBe(403);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
    expect(storage.getAdmin).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content-type with 415", async () => {
    const res = await actionRoute(raw(ACTION, { "Content-Type": "text/plain" }, { target: "guide", action: "delete", subject: "math", concept_key: "limits" }));
    expect(res.status).toBe(415);
    expect(storage.getAdmin).not.toHaveBeenCalled();
  });
});
