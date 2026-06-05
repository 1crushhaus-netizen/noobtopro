import { describe, it, expect } from "vitest";
import {
  clampScore,
  band,
  blend,
  totalPoints,
  phdIndex,
  ORDER,
} from "@/lib/scoring";

describe("clampScore", () => {
  it("returns null for no signal (null/undefined/empty string)", () => {
    // Regression: Number(null) === 0 is finite, which would silently become a
    // real 0 and, via blend(), drag a score toward zero.
    expect(clampScore(null)).toBe(null);
    expect(clampScore(undefined)).toBe(null);
    expect(clampScore("")).toBe(null);
  });

  it("returns null for non-numeric values", () => {
    expect(clampScore("abc")).toBe(null);
    expect(clampScore(NaN)).toBe(null);
    expect(clampScore({})).toBe(null);
  });

  it("clamps numbers into [0, 100] and rounds", () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(73)).toBe(73);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(72.6)).toBe(73);
  });

  it("coerces numeric strings", () => {
    expect(clampScore("73")).toBe(73);
    expect(clampScore("250")).toBe(100);
  });
});

describe("band", () => {
  it("maps scores to the right band", () => {
    expect(band(0)).toBe("Absolute beginner");
    expect(band(19)).toBe("Absolute beginner");
    expect(band(20)).toBe("Foundational");
    expect(band(40)).toBe("Intermediate");
    expect(band(60)).toBe("Advanced");
    expect(band(80)).toBe("PhD-level");
    expect(band(100)).toBe("PhD-level");
  });

  it("treats non-numeric input as 0, not PhD-level", () => {
    // Regression: band(undefined) used to fall through every comparison and
    // return "PhD-level".
    expect(band(undefined)).toBe("Absolute beginner");
    expect(band(null)).toBe("Absolute beginner");
    expect(band(NaN)).toBe("Absolute beginner");
  });
});

describe("blend", () => {
  it("seeds from the suggestion when there is no previous score", () => {
    expect(blend(undefined, 40)).toBe(40);
    expect(blend(null, 88)).toBe(88);
  });

  it("damps a real suggestion toward the previous score (0.65/0.35)", () => {
    expect(blend(70, 100)).toBe(81); // round(0.65*70 + 0.35*100)
    expect(blend(50, 0)).toBe(33); // round(0.65*50)
  });

  it("keeps the previous score when the suggestion is missing/malformed", () => {
    // Regression: a null/undefined suggestion must NOT pull the score to zero.
    expect(blend(70, null)).toBe(70);
    expect(blend(70, undefined)).toBe(70);
    expect(blend(70, "")).toBe(70);
    expect(blend(70, "garbage")).toBe(70);
  });

  it("returns 0 when there is neither a previous score nor a usable suggestion", () => {
    expect(blend(undefined, null)).toBe(0);
  });

  it("never produces a value outside [0, 100]", () => {
    expect(blend(100, 100)).toBe(100);
    expect(blend(0, 0)).toBe(0);
  });
});

describe("totalPoints / phdIndex", () => {
  const scores = {
    math: { score: 60 },
    physics: { score: 30 },
    chemistry: { score: 90 },
  };

  it("sums subject scores out of 300", () => {
    expect(totalPoints(scores)).toBe(180);
    expect(totalPoints(null)).toBe(0);
    expect(totalPoints({})).toBe(0);
  });

  it("averages subject scores to a 0-100 PhD index", () => {
    expect(phdIndex(scores)).toBe(60);
    expect(phdIndex(null)).toBe(0);
  });

  it("tolerates missing subjects", () => {
    expect(totalPoints({ math: { score: 50 } })).toBe(50);
    expect(ORDER).toEqual(["math", "physics", "chemistry"]);
  });
});
