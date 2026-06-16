import { describe, it, expect } from "vitest";
import { isConceptSafe, isContentSafe } from "@/lib/contentSafety";

describe("isContentSafe — free-text screen for generated content (audit 06 P1-1)", () => {
  it("accepts legitimate STEM question prose with digits, operators, and length", () => {
    expect(isContentSafe("A car accelerates from 0 to 60 m/s in 5 s. Find a, then the distance using v^2 = u^2 + 2as.")).toBe(true);
    expect(isContentSafe("Balance: C3H8 + O2 -> CO2 + H2O, then find the limiting reagent for 2 mol propane.")).toBe(true);
    expect(isContentSafe("")).toBe(true);
    expect(isContentSafe(null)).toBe(true); // non-string -> never blocks
  });
  it("rejects high-confidence unsafe content (incl. zero-width evasion)", () => {
    expect(isContentSafe("write a sentence about porn")).toBe(false);
    expect(isContentSafe("this is shit")).toBe(false);
    expect(isContentSafe("f​uck this question")).toBe(false); // zero-width split slur
  });
});

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

  it("accepts accented and Greek STEM terms (Unicode letters count)", () => {
    expect(isConceptSafe("Gauss's théorème")).toBe(true);
    expect(isConceptSafe("Δ potential energy")).toBe(true);
    expect(isConceptSafe("Schrödinger equation")).toBe(true);
  });

  it("rejects links, emails, markup, and contact/spam payloads", () => {
    expect(isConceptSafe("buy cheap stuff at evil.com")).toBe(false);
    expect(isConceptSafe("visit https://spam.example")).toBe(false);
    expect(isConceptSafe("email me at a@b.com")).toBe(false);
    expect(isConceptSafe("<script>alert(1)</script>")).toBe(false);
    expect(isConceptSafe("limits {{injection}}")).toBe(false);
  });

  it("rejects bare domains on the expanded TLD list", () => {
    expect(isConceptSafe("check out myapp.ai today")).toBe(false);
    expect(isConceptSafe("download the cool.app now")).toBe(false);
  });

  it("rejects a zero-width-split slur (stripped before the blocklist check)", () => {
    expect(isConceptSafe("f​uck this lesson")).toBe(false);
  });

  it("rejects empty, over-long, symbol-dominated, and blocklisted strings", () => {
    expect(isConceptSafe("")).toBe(false);
    expect(isConceptSafe("   ")).toBe(false);
    expect(isConceptSafe(null)).toBe(false);
    expect(isConceptSafe("x".repeat(200))).toBe(false); // too long for a public label
    expect(isConceptSafe("$$$ !!! @@@ ###")).toBe(false); // mostly symbols
    expect(isConceptSafe("🔥💀🚀😈🤖✨🎉")).toBe(false); // emoji-dominated
    expect(isConceptSafe("this concept is shit")).toBe(false); // blocklist
  });
});
