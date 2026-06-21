// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the real Vercel tracker so we can assert whether the consent gate let an event through.
const va = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics", () => ({ track: (...a) => va.track(...a) }));

import { track, hasAnalyticsConsent, CONSENT_STORAGE_KEY, writeConsent, readConsentChoice, CONSENT_VERSION } from "@/lib/analytics";

beforeEach(() => {
  va.track.mockReset();
  window.localStorage.clear();
});

describe("lib/analytics — ePrivacy consent gate on track()", () => {
  it("does NOT track when consent is undecided (deny by default)", () => {
    track("checkout_started");
    expect(va.track).not.toHaveBeenCalled();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("does NOT track when consent is explicitly denied", () => {
    writeConsent("denied"); // current-version, auditable record
    track("diagnostic_started", { signedIn: true });
    expect(va.track).not.toHaveBeenCalled();
  });

  it("tracks (forwarding name + props) once consent is granted", () => {
    writeConsent("granted"); // current-version, auditable record
    track("checkout_success");
    track("sign_in_started", { provider: "google" });
    expect(va.track).toHaveBeenCalledTimes(2);
    expect(va.track).toHaveBeenCalledWith("checkout_success");
    expect(va.track).toHaveBeenCalledWith("sign_in_started", { provider: "google" });
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("never throws if the underlying tracker throws", () => {
    writeConsent("granted");
    va.track.mockImplementation(() => { throw new Error("boom"); });
    expect(() => track("x")).not.toThrow();
  });
});

describe("lib/analytics — consent record format", () => {
  it("writeConsent stores an auditable {choice, ts, version} record; readConsentChoice reads it back", () => {
    window.localStorage.clear();
    writeConsent("granted");
    const rec = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    expect(rec.choice).toBe("granted");
    expect(rec.version).toBe(CONSENT_VERSION);
    expect(typeof rec.ts).toBe("string");
    expect(readConsentChoice()).toBe("granted");
  });
  it("treats a STALE or legacy/unversioned record as undecided (re-ask, deny-by-default)", () => {
    // A legacy bare string predates consent-record versioning, so we can't know which
    // disclosure it agreed to → treat as undecided so the banner re-asks for a fresh opt-in.
    window.localStorage.clear();
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "granted");
    expect(readConsentChoice()).toBe(null);
    expect(hasAnalyticsConsent()).toBe(false);
    // A versioned record written against an OLDER disclosure version is likewise stale.
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ choice: "granted", ts: "2020-01-01T00:00:00.000Z", version: "2000-01-01" }));
    expect(readConsentChoice()).toBe(null);
    expect(hasAnalyticsConsent()).toBe(false);
  });
  it("ignores a malformed record (undecided)", () => {
    window.localStorage.clear();
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "{not json");
    expect(readConsentChoice()).toBe(null);
  });
});
