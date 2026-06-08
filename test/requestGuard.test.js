import { describe, it, expect } from "vitest";
import {
  isCrossSiteRequest,
  isWrongContentType,
  isBodyTooLarge,
  readJsonLimited,
  MAX_BODY_BYTES_TEXT,
} from "@/lib/requestGuard";

const mk = (h) => ({ headers: { get: (k) => h[k.toLowerCase()] ?? null } });

// A real Request so readJsonLimited exercises the streaming body reader path.
const jsonReq = (bodyStr) =>
  new Request("http://test.local/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: bodyStr,
  });

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

  it("isBodyTooLarge rejects an over-cap Content-Length (advisory pre-check)", () => {
    expect(isBodyTooLarge(mk({ "content-length": String(MAX_BODY_BYTES_TEXT + 1) }), MAX_BODY_BYTES_TEXT)).toBe(true);
    expect(isBodyTooLarge(mk({ "content-length": "100" }), MAX_BODY_BYTES_TEXT)).toBe(false);
    expect(isBodyTooLarge(mk({}), MAX_BODY_BYTES_TEXT)).toBe(false); // absent header => can't pre-judge
  });

  describe("readJsonLimited", () => {
    it("parses a small JSON body", async () => {
      await expect(readJsonLimited(jsonReq('{"a":1}'), MAX_BODY_BYTES_TEXT)).resolves.toEqual({ a: 1 });
    });

    it("throws a 400-shaped SyntaxError on invalid JSON", async () => {
      await expect(readJsonLimited(jsonReq("{ not json"), MAX_BODY_BYTES_TEXT)).rejects.toThrow();
    });

    it("throws BODY_TOO_LARGE when the body exceeds the byte ceiling", async () => {
      // A JSON string value larger than the cap — the streaming reader must abort.
      const big = JSON.stringify({ s: "x".repeat(MAX_BODY_BYTES_TEXT + 1000) });
      await expect(readJsonLimited(jsonReq(big), MAX_BODY_BYTES_TEXT)).rejects.toMatchObject({ code: "BODY_TOO_LARGE" });
    });

    it("accepts a body right at the ceiling", async () => {
      const payload = { s: "y".repeat(1000) };
      const str = JSON.stringify(payload);
      await expect(readJsonLimited(jsonReq(str), str.length)).resolves.toEqual(payload);
    });
  });
});
