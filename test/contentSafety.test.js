import { describe, it, expect } from "vitest";
import { isConceptSafe } from "@/lib/contentSafety";

describe("isConceptSafe", () => {
  it("accepts ordinary STEM concept labels", () => {
    for (const c of [
      "removable discontinuities",
      "Le Chatelier's principle",
      "the chain rule",
      "SN1 and SN2 reactions",
      "Bayes' theorem",
      "eigenvalues and eigenvectors",
    ]) {
      expect(isConceptSafe(c)).toBe(true);
    }
  });

  it("rejects links, emails, markup, and contact/spam payloads", () => {
    expect(isConceptSafe("buy cheap stuff at evil.com")).toBe(false);
    expect(isConceptSafe("visit https://spam.example")).toBe(false);
    expect(isConceptSafe("email me at a@b.com")).toBe(false);
    expect(isConceptSafe("<script>alert(1)</script>")).toBe(false);
    expect(isConceptSafe("limits {{injection}}")).toBe(false);
  });

  it("rejects empty, over-long, symbol-dominated, and blocklisted strings", () => {
    expect(isConceptSafe("")).toBe(false);
    expect(isConceptSafe("   ")).toBe(false);
    expect(isConceptSafe(null)).toBe(false);
    expect(isConceptSafe("x".repeat(200))).toBe(false); // too long for a public label
    expect(isConceptSafe("$$$ !!! @@@ ###")).toBe(false); // mostly symbols
    expect(isConceptSafe("this concept is shit")).toBe(false); // blocklist
  });
});
