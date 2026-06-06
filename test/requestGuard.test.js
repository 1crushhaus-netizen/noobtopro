import { describe, it, expect } from "vitest";
import { isCrossSiteRequest, isWrongContentType } from "@/lib/requestGuard";

const mk = (h) => ({ headers: { get: (k) => h[k.toLowerCase()] ?? null } });

describe("requestGuard", () => {
  it("isCrossSiteRequest blocks cross-site/same-site; allows same-origin/none/absent", () => {
    expect(isCrossSiteRequest(mk({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteRequest(mk({ "sec-fetch-site": "same-site" }))).toBe(true);
    expect(isCrossSiteRequest(mk({ "sec-fetch-site": "SAME-ORIGIN" }))).toBe(false); // case-insensitive
    expect(isCrossSiteRequest(mk({ "sec-fetch-site": "none" }))).toBe(false); // direct nav
    expect(isCrossSiteRequest(mk({}))).toBe(false); // absent (non-browser) allowed
  });

  it("isWrongContentType requires application/json", () => {
    expect(isWrongContentType(mk({ "content-type": "application/json" }))).toBe(false);
    expect(isWrongContentType(mk({ "content-type": "application/json; charset=utf-8" }))).toBe(false);
    expect(isWrongContentType(mk({ "content-type": "text/plain" }))).toBe(true);
    expect(isWrongContentType(mk({}))).toBe(true);
  });
});
