import { describe, it, expect } from "vitest";
import { preGradeDock, DOCK_SCORE } from "@/lib/preGrade";
import { RUBRIC_KEYS } from "@/lib/scoring";

describe("preGradeDock — deterministic docking gate", () => {
  it("docks empty / whitespace-only answers", () => {
    for (const r of ["", "   ", "\n\t  ", null, undefined]) {
      const v = preGradeDock(r);
      expect(v).toBeTruthy();
      expect(v.docked).toBe(true);
      expect(v.reason).toBe("empty");
    }
  });

  it("docks 'no answer' phrases regardless of case/punctuation", () => {
    for (const r of ["idk", "IDK", "I don't know", "dunno", "no idea", "pass", "skip", "n/a", "no clue", "not sure", "I give up"]) {
      const v = preGradeDock(r);
      expect(v, `expected "${r}" to dock`).toBeTruthy();
      expect(v.reason).toBe("no-answer phrase");
    }
  });

  it("docks a too-short, off-topic single word", () => {
    for (const r of ["blue", "yes", "ok", "maybe", "lol"]) {
      const v = preGradeDock(r);
      expect(v, `expected "${r}" to dock`).toBeTruthy();
      expect(v.reason).toBe("too short / off-topic");
    }
  });

  it("docks obvious keyboard-mash gibberish", () => {
    for (const r of ["asdfghjklasdfghjkl", "zzzzzzzzzzzzzzzz", "asdfghjklzxcvbnmqw"]) {
      const v = preGradeDock(r);
      expect(v, `expected "${r}" to dock`).toBeTruthy();
      expect(v.reason).toBe("gibberish");
    }
  });

  it("docks a single short repeated-char token (as too-short or gibberish)", () => {
    // "aaaaaaaa" is short + single-word so it's caught by the too-short rule; either
    // way it must dock — the category label is an internal detail.
    expect(preGradeDock("aaaaaaaa")).toBeTruthy();
  });

  it("does NOT dock substantive reasoning (passes to the grader)", () => {
    for (const r of [
      "I applied the chain rule and got 2x.",
      "Using conservation of momentum, m1v1 = m2v2 so the second velocity is 3 m/s.",
      "The limiting reagent is oxygen because there are fewer moles relative to the ratio.",
      "x = 5 because 2x + 3 = 13",
      "Let f(x) = x^2; then f'(x) = 2x by the power rule.",
    ]) {
      expect(preGradeDock(r), `expected "${r}" NOT to dock`).toBeNull();
    }
  });

  it("does NOT dock a short answer that carries a digit or math operator", () => {
    // Short, but substantive enough to grade — the gate must not over-fire.
    expect(preGradeDock("x=5")).toBeNull();
    expect(preGradeDock("2+2=4")).toBeNull();
  });

  it("a dock verdict is a complete, grader-shaped low verdict", () => {
    const v = preGradeDock("idk");
    expect(v.reasoningScore).toBe(DOCK_SCORE);
    expect(v.reasoningScore).toBeLessThan(10);
    // Rubric is a complete all-zero object over the 5 dimensions.
    expect(Object.keys(v.rubric).sort()).toEqual([...RUBRIC_KEYS].sort());
    expect(Object.values(v.rubric).every((x) => x === 0)).toBe(true);
    expect(v.weakConcepts).toEqual([]);
    expect(typeof v.socraticHint).toBe("string");
    expect(typeof v.comment).toBe("string");
  });

  it("is deterministic (same input → same verdict)", () => {
    expect(preGradeDock("idk")).toEqual(preGradeDock("idk"));
    expect(preGradeDock("a real attempt with reasoning, 2x+1")).toBeNull();
    expect(preGradeDock("a real attempt with reasoning, 2x+1")).toBeNull();
  });
});
