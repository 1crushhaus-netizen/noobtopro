import { describe, it, expect } from "vitest";
import {
  VARIETY_THEMES,
  VARIETY_ANGLES,
  pickVariety,
  varietyDirectiveText,
  sanitizeRecentQuestions,
  avoidListText,
} from "@/lib/questionVariety";

// A deterministic RNG that walks a fixed sequence (cycled) — so we can assert exact picks.
function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("pickVariety", () => {
  it("returns a valid theme, angle, and 4-char nonce from the lists", () => {
    const v = pickVariety(seq([0, 0, 0]));
    expect(VARIETY_THEMES).toContain(v.theme);
    expect(VARIETY_ANGLES).toContain(v.angle);
    expect(v.nonce).toMatch(/^[0-9a-z]{4}$/);
  });
  it("draws theme, angle, nonce from three INDEPENDENT rng calls (order matters)", () => {
    // r1 → theme index, r2 → angle index, r3 → nonce
    const v = pickVariety(seq([0, 0.999, 0.5]));
    expect(v.theme).toBe(VARIETY_THEMES[0]);
    expect(v.angle).toBe(VARIETY_ANGLES[VARIETY_ANGLES.length - 1]);
  });
  it("is deterministic for a fixed rng and varies across different draws", () => {
    const a = pickVariety(seq([0.1, 0.2, 0.3]));
    const b = pickVariety(seq([0.1, 0.2, 0.3]));
    const c = pickVariety(seq([0.9, 0.8, 0.7]));
    expect(a).toEqual(b);
    expect(c.theme).not.toBe(a.theme);
  });
  it("clamps an out-of-range rng (never indexes past the list)", () => {
    const hi = pickVariety(seq([1, 1, 1])); // r===1 would be list[length]
    expect(VARIETY_THEMES).toContain(hi.theme);
    expect(VARIETY_ANGLES).toContain(hi.angle);
    const lo = pickVariety(seq([-5, -5, -5]));
    expect(lo.theme).toBe(VARIETY_THEMES[0]);
  });
  it("defaults to Math.random when called with no args (smoke)", () => {
    const v = pickVariety();
    expect(VARIETY_THEMES).toContain(v.theme);
    expect(v.nonce).toMatch(/^[0-9a-z]{4}$/);
  });
});

describe("varietyDirectiveText", () => {
  it("renders the theme, angle, nonce, and the avoid-canonical instruction", () => {
    const text = varietyDirectiveText({ theme: "a money scenario", angle: "a direct form", nonce: "ab12" });
    expect(text).toContain("a money scenario");
    expect(text).toContain("a direct form");
    expect(text).toContain("ab12");
    expect(text).toMatch(/non-canonical/i);
  });
  it("returns '' for a missing spec (safe to concatenate)", () => {
    expect(varietyDirectiveText(null)).toBe("");
    expect(varietyDirectiveText(undefined)).toBe("");
  });
});

describe("sanitizeRecentQuestions", () => {
  it("keeps strings, trims, drops blanks and dupes, caps to the NEWEST count (chronological order)", () => {
    const out = sanitizeRecentQuestions(
      ["  solve 2x+5=11 ", "solve 2x+5=11", "", 42, null, "another", "third", "fourth", "fifth", "sixth"],
      { maxItems: 5, maxLen: 240 }
    );
    // After dropping non-strings/blanks/dupes the uniques are
    // [solve 2x+5=11, another, third, fourth, fifth, sixth] — capping at 5 keeps the
    // NEWEST five (drops the oldest "solve 2x+5=11"), in chronological order.
    expect(out).toEqual(["another", "third", "fourth", "fifth", "sixth"]);
  });
  it("when over the cap, keeps the most-recently-shown questions (anti-repeat protects the freshest)", () => {
    const out = sanitizeRecentQuestions(["q1", "q2", "q3", "q4", "q5", "q6", "q7"], { maxItems: 3 });
    expect(out).toEqual(["q5", "q6", "q7"]); // the 3 newest, oldest-first
    expect(out).toContain("q7"); // the just-shown one is NEVER dropped
  });
  it("truncates over-long items", () => {
    const [only] = sanitizeRecentQuestions(["x".repeat(1000)]);
    expect(only.length).toBe(240);
  });
  it("returns [] for a non-array", () => {
    expect(sanitizeRecentQuestions("nope")).toEqual([]);
    expect(sanitizeRecentQuestions(undefined)).toEqual([]);
  });
});

describe("avoidListText", () => {
  it("numbers each recent question under an explicit AVOID instruction", () => {
    const text = avoidListText(["q one", "q two"]);
    expect(text).toMatch(/AVOID/);
    expect(text).toContain("1. q one");
    expect(text).toContain("2. q two");
  });
  it("returns '' when there's nothing to avoid", () => {
    expect(avoidListText([])).toBe("");
    expect(avoidListText(null)).toBe("");
  });
});
