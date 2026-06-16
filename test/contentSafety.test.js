import { describe, it, expect } from "vitest";
import { isConceptSafe, isContentSafe, redactUnsafe } from "@/lib/contentSafety";

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
  it("catches leetspeak + separator evasions (audit-round2 hardening)", () => {
    expect(isContentSafe("this is sh1t")).toBe(false); // 1 -> i
    expect(isContentSafe("f4ggot")).toBe(false); // 4 -> a
    expect(isContentSafe("n1gg3r")).toBe(false); // leet
    expect(isContentSafe("f u c k this")).toBe(false); // spaced
    expect(isContentSafe("f.u.c.k")).toBe(false); // punctuation-separated
  });
  it("does NOT false-positive on legitimate STEM/English prose after folding", () => {
    expect(isContentSafe("Complete the assignment using the class method and pass the test")).toBe(true);
    expect(isContentSafe("Count the moles, then compute the rate and verify the units")).toBe(true);
  });
});

describe("redactUnsafe — screen model-authored output (audit-round2)", () => {
  it("passes safe text through unchanged", () => {
    const s = "Strong setup; next, apply the chain rule to the inner function.";
    expect(redactUnsafe(s)).toBe(s);
    expect(redactUnsafe("")).toBe("");
  });
  it("replaces unsafe text (incl. leet evasion) with the placeholder", () => {
    expect(redactUnsafe("you are sh1t at this")).toBe("(removed for safety)");
    expect(redactUnsafe("nice work", "X")).toBe("nice work");
    expect(redactUnsafe("porn", "X")).toBe("X");
  });
  it("passes non-strings through unchanged", () => {
    expect(redactUnsafe(null)).toBe(null);
    expect(redactUnsafe(undefined)).toBe(undefined);
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
