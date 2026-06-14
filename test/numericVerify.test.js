import { describe, it, expect, vi } from "vitest";
import {
  safeEvaluate,
  parseAnswer,
  parseValues,
  numericallyEqual,
  formatVerified,
  checkSolve,
  applyLearnerCorrection,
  withNumericVerification,
  makeRegrade,
  MAX_CHECK_CHARS,
} from "@/lib/numericVerify";

// Convenience: evaluate a known-good expression to a mathjs value for comparisons.
const val = (expr) => {
  const r = safeEvaluate(expr);
  expect(r.ok, `expected "${expr}" to evaluate`).toBe(true);
  return r.value;
};

describe("safeEvaluate — the sandboxed calculator", () => {
  it("evaluates plain arithmetic, functions, constants, and factorials", () => {
    expect(val("(120 - 40) / 16")).toBe(5);
    expect(val("sqrt(144) + 3")).toBe(15);
    expect(val("5! / (3! * 2!)")).toBe(10);
    expect(val("2 * pi")).toBeCloseTo(6.2832, 3);
    expect(val("round(10 / 3, 2)")).toBeCloseTo(3.33, 5);
  });

  it("evaluates unit arithmetic (the physics/chemistry check shape)", () => {
    expect(numericallyEqual(val("(4000 N * 10 s)"), val("40000 N s"))).toBe(true);
    expect(numericallyEqual(val("9.8 m/s^2 * 2 kg"), val("19.6 N"))).toBe(true);
    expect(numericallyEqual(val("3.0e8 m / s"), val("3e8 m/s"))).toBe(true);
  });

  it("normalizes the unicode math notation models actually emit (× ÷ − · ° and thousands commas)", () => {
    expect(val("3 × 10^8")).toBe(3e8);
    expect(val("10 ÷ 4")).toBe(2.5);
    expect(numericallyEqual(val("4000 N · 10 s"), val("40000 N s"))).toBe(true);
    expect(val("40,000 / 2")).toBe(20000);
    expect(numericallyEqual(val("90°"), val("90 deg"))).toBe(true);
  });

  it("rejects non-strings, blanks, and over-long expressions", () => {
    expect(safeEvaluate(null).ok).toBe(false);
    expect(safeEvaluate(42).ok).toBe(false);
    expect(safeEvaluate("").ok).toBe(false);
    expect(safeEvaluate("   ").ok).toBe(false);
    expect(safeEvaluate("1 + 1 + ".repeat(MAX_CHECK_CHARS) + "1").ok).toBe(false);
  });

  it("rejects every non-arithmetic AST shape (assignment, access, arrays, ranges, conditionals, strings, definitions)", () => {
    for (const evil of [
      "a = 5",
      "f(x) = x",
      "[1, 2, 3]",
      "{ a: 1 }",
      "1:10",
      "2 > 1",
      "2 > 1 ? 1 : 0",
      '"abc"',
      "x + 1", // unknown symbol (not a constant, not a unit)
      "process",
      "constructor",
      "pi.constructor",
      "(1).constructor",
    ]) {
      expect(safeEvaluate(evil).ok, evil).toBe(false);
    }
  });

  it("rejects the mathjs escape hatches and unlisted functions by name", () => {
    for (const evil of [
      'evaluate("1+1")',
      'parse("1")',
      "import({}, {})",
      'createUnit("zz")',
      'simplify("x")',
      "det([1])",
      "combinations(5, 2)",
      "range(1, 10)",
    ]) {
      expect(safeEvaluate(evil).ok, evil).toBe(false);
    }
  });

  it("rejects non-magnitude results: Infinity, complex, valueless units", () => {
    expect(safeEvaluate("1 / 0").ok).toBe(false);
    expect(safeEvaluate("sqrt(-1)").ok).toBe(false);
    expect(safeEvaluate("N").ok).toBe(false); // a unit with no magnitude is not an answer
  });
});

describe("parseAnswer — one stated answer to one machine value", () => {
  it("parses the shapes graders and learners actually write", () => {
    expect(numericallyEqual(parseAnswer("≈ 34.6 N"), val("34.6 N"))).toBe(true);
    expect(parseAnswer("x = 7")).toBe(7);
    expect(parseAnswer("answer: 42")).toBe(42);
    expect(numericallyEqual(parseAnswer("40,000 N·s"), val("4000 N * 10 s"))).toBe(true);
    expect(parseAnswer("3/4")).toBe(0.75);
    expect(numericallyEqual(parseAnswer("1.2e3 J"), val("1200 J"))).toBe(true);
    expect(numericallyEqual(parseAnswer("3.0 × 10^8 m/s"), val("3e8 m/s"))).toBe(true);
    expect(numericallyEqual(parseAnswer("approximately 5 kg"), val("5 kg"))).toBe(true);
    expect(parseAnswer("12.")).toBe(12);
  });

  it("falls back to number + units-hint when the trailing text is not a parseable unit", () => {
    expect(numericallyEqual(parseAnswer("34.6 units of force", "N"), val("34.6 N"))).toBe(true);
  });

  it("returns null on anything that is not ONE unambiguous numeric value", () => {
    for (const text of ["", "x = 3 or x = -2", "25%", "12 m and 14 m", "no numeric answer", "3, -2", null]) {
      expect(parseAnswer(text), String(text)).toBe(null);
    }
  });
});

describe("parseValues — multi-root + percent candidate sets (FIX 5)", () => {
  it("returns a one-element set for a single clean value", () => {
    expect(parseValues("x = 7")).toEqual([7]);
    expect(parseValues("3/4")).toEqual([0.75]);
  });

  it("splits multi-root answers and parses each root", () => {
    expect(parseValues("x = 3 or x = -2").sort()).toEqual([-2, 3]);
    expect(parseValues("3, -2").sort()).toEqual([-2, 3]);
    expect(parseValues("x = 5 and x = 9").sort()).toEqual([5, 9]);
  });

  it("emits BOTH legitimate readings of a bare percentage", () => {
    expect(parseValues("25%").sort((a, b) => a - b)).toEqual([0.25, 25]);
    expect(parseValues("p = 75%").sort((a, b) => a - b)).toEqual([0.75, 75]);
  });

  it("returns [] when nothing parses (fail open)", () => {
    expect(parseValues("")).toEqual([]);
    expect(parseValues("no numeric answer")).toEqual([]);
    expect(parseValues(null)).toEqual([]);
  });
});

describe("numericallyEqual — unit-aware tolerant comparison", () => {
  it("compares across compatible unit prefixes via SI, null on incompatible dimensions", () => {
    expect(numericallyEqual(val("40 kN * 1 s"), val("40000 N s"))).toBe(true);
    expect(numericallyEqual(val("5 N"), val("5 s"))).toBe(null);
  });

  it("reads a bare number in the unit side's own display units (learners omit units)", () => {
    expect(numericallyEqual(val("40000 N s"), 40000)).toBe(true);
    expect(numericallyEqual(val("40000 N s"), 40)).toBe(false);
  });

  it("uses ~1% relative tolerance for rounded values, exact match for integer-vs-integer", () => {
    expect(numericallyEqual(100, 100.9)).toBe(true);
    expect(numericallyEqual(100, 102)).toBe(false);
    expect(numericallyEqual(12, 12)).toBe(true);
    expect(numericallyEqual(12, 13)).toBe(false);
    expect(numericallyEqual(1000000, 1005000)).toBe(false); // both integers → exact
    expect(numericallyEqual(0, 1e-10)).toBe(true); // absolute floor near zero
    expect(numericallyEqual(0, 0.001)).toBe(false);
    expect(numericallyEqual(null, 5)).toBe(null);
  });
});

describe("checkSolve — the grader's own arithmetic, verified", () => {
  it("confirms a solve whose check expression reproduces its finalAnswer", () => {
    const r = checkSolve({ finalAnswer: "40000 N·s", units: "N·s", check: "4000 N * 10 s" });
    expect(r.status).toBe("confirmed");
    expect(formatVerified(r.value)).toBe("40000 N s");
  });

  it("proves a solve inconsistent when the check evaluates to a different value", () => {
    const r = checkSolve({ finalAnswer: "31.25 m", units: "m", check: "(100 / 32) m" });
    expect(r.status).toBe("inconsistent");
    expect(formatVerified(r.value)).toBe("3.125 m");
  });

  it("fails OPEN (skipped) on anything unprovable: no/garbage check, unparseable or incomparable finalAnswer", () => {
    expect(checkSolve(null).status).toBe("skipped");
    expect(checkSolve({ finalAnswer: "5 m", units: "m", check: "" }).status).toBe("skipped");
    expect(checkSolve({ finalAnswer: "5 m", units: "m", check: "x + 1" }).status).toBe("skipped");
    expect(checkSolve({ finalAnswer: "x = 3 or x = -2", units: "", check: "(120 - 40) / 16" }).status).toBe("skipped");
    expect(checkSolve({ finalAnswer: "5 s", units: "s", check: "5 N" }).status).toBe("skipped");
  });
});

describe("applyLearnerCorrection — raise-only, evidence-bounded", () => {
  const rubric = { computation: 1, logic: 3 };
  const errors = [
    { type: "execution-slip", what: "decimal slip" },
    { type: "conceptual", what: "wrong principle" },
  ];

  it("a learner answer that provably MATCHES flips the flag, restores computation to 4, and drops execution-slips only", () => {
    const r = applyLearnerCorrection({ value: val("3.125 m"), learnerAnswer: "3.125 m", finalAnswerMatches: false, rubric, errors });
    expect(r.finalAnswerMatches).toBe(true);
    expect(r.rubric.computation).toBe(4);
    expect(r.rubric.logic).toBe(3); // only the computation axis is touched
    expect(r.errors).toEqual([{ type: "conceptual", what: "wrong principle" }]);
    expect(r.changed).toBe(true);
  });

  it("a provable MISMATCH only corrects the flag — never lowers the rubric or touches errors", () => {
    const r = applyLearnerCorrection({ value: val("3.125 m"), learnerAnswer: "31.25 m", finalAnswerMatches: true, rubric, errors });
    expect(r.finalAnswerMatches).toBe(false);
    expect(r.rubric).toBe(rubric);
    expect(r.errors).toBe(errors);
    expect(r.changed).toBe(true);
  });

  it("an unparseable learner answer changes nothing (fail open)", () => {
    const r = applyLearnerCorrection({ value: val("3.125 m"), learnerAnswer: "", finalAnswerMatches: true, rubric, errors });
    expect(r).toMatchObject({ finalAnswerMatches: true, changed: false });
    expect(r.rubric).toBe(rubric);
  });

  it("is a no-op when the grade already agrees with the machine", () => {
    const ok = { computation: 4 };
    const r = applyLearnerCorrection({ value: 5, learnerAnswer: "5", finalAnswerMatches: true, rubric: ok, errors: [] });
    expect(r.changed).toBe(false);
    expect(r.rubric).toBe(ok);
  });

  it("FIX 5: a MULTI-ROOT answer matches when the verified value is ONE of the roots (raise-only)", () => {
    // verified root = 3; the learner listed both correct roots — credit the match.
    const r = applyLearnerCorrection({ value: 3, learnerAnswer: "x = 3 or x = -2", finalAnswerMatches: false, rubric, errors });
    expect(r.finalAnswerMatches).toBe(true);
    expect(r.rubric.computation).toBe(4);
    expect(r.errors).toEqual([{ type: "conceptual", what: "wrong principle" }]); // slip dropped
  });

  it("FIX 5: a multi-root answer with NO matching root is a real mismatch (flag only, never lowers)", () => {
    const r = applyLearnerCorrection({ value: 3, learnerAnswer: "x = 5 or x = 9", finalAnswerMatches: true, rubric, errors });
    expect(r.finalAnswerMatches).toBe(false);
    expect(r.rubric).toBe(rubric); // raise-only: never lowers
    expect(r.errors).toBe(errors);
  });

  it("FIX 5: a PERCENTAGE answer matches the verified value under either reading", () => {
    // verified fraction 0.25; learner wrote "25%" — the same magnitude under a percent reading.
    const r1 = applyLearnerCorrection({ value: 0.25, learnerAnswer: "25%", finalAnswerMatches: false, rubric, errors });
    expect(r1.finalAnswerMatches).toBe(true);
    expect(r1.rubric.computation).toBe(4);
    // verified percent number 25; learner wrote "25%" — also matches.
    const r2 = applyLearnerCorrection({ value: 25, learnerAnswer: "25%", finalAnswerMatches: false, rubric, errors });
    expect(r2.finalAnswerMatches).toBe(true);
  });
});

describe("withNumericVerification — the route-facing orchestrator", () => {
  // An inconsistent grade: the grader's own check proves its finalAnswer wrong,
  // and the learner's stated answer matches the machine-verified value.
  const BAD = {
    rubric: { computation: 1, logic: 3 },
    solve: { principle: "p", steps: ["s"], finalAnswer: "31.25 m", units: "m", check: "(100 / 32) m" },
    errors: [{ type: "execution-slip", what: "w" }],
    learnerAnswer: "3.125 m",
    finalAnswerMatches: false,
  };
  const FIXED = {
    rubric: { computation: 4, logic: 4 },
    solve: { principle: "p", steps: ["s"], finalAnswer: "3.125 m", units: "m", check: "(100 / 32) m" },
    errors: [],
    learnerAnswer: "3.125 m",
    finalAnswerMatches: true,
  };

  it("passes a grade with no check through untouched (status skipped)", async () => {
    const data = { rubric: { computation: 0 }, solve: { finalAnswer: "5", units: "", check: "" } };
    const regrade = vi.fn();
    const r = await withNumericVerification(data, { regrade });
    expect(r.data).toBe(data);
    expect(r.verification).toEqual({ status: "skipped", value: null, changed: false });
    expect(regrade).not.toHaveBeenCalled();
  });

  it("confirms a self-consistent grade and still corrects a wrong learner flag — without re-grading", async () => {
    const data = {
      rubric: { computation: 2 },
      solve: { principle: "p", steps: [], finalAnswer: "5 m", units: "m", check: "((120 - 40) / 16) m" },
      errors: [{ type: "execution-slip", what: "w" }],
      learnerAnswer: "5 m",
      finalAnswerMatches: false,
    };
    const regrade = vi.fn();
    const r = await withNumericVerification(data, { regrade });
    expect(regrade).not.toHaveBeenCalled();
    expect(r.verification).toEqual({ status: "confirmed", value: "5 m", changed: true });
    expect(r.data.finalAnswerMatches).toBe(true);
    expect(r.data.rubric.computation).toBe(4);
    expect(r.data.errors).toEqual([]);
  });

  it("re-grades ONCE on a proven-wrong solve, with the verified value in the correction note", async () => {
    const regrade = vi.fn(async () => FIXED);
    const r = await withNumericVerification(BAD, { regrade });
    expect(regrade).toHaveBeenCalledTimes(1);
    const note = regrade.mock.calls[0][0];
    expect(note).toContain("SERVER ARITHMETIC CHECK");
    expect(note).toContain("3.125 m");
    expect(note).toContain("(100 / 32) m");
    expect(r.verification.status).toBe("regraded");
    expect(r.verification.value).toBe("3.125 m");
    expect(r.data.rubric).toEqual(FIXED.rubric);
    expect(r.data.finalAnswerMatches).toBe(true);
  });

  it("falls back to field-level correction when the re-grade throws (budget denied, upstream down)", async () => {
    const regrade = vi.fn(async () => {
      throw new Error("re-grade budget denied");
    });
    const r = await withNumericVerification(BAD, { regrade });
    expect(r.verification.status).toBe("corrected");
    expect(r.verification.value).toBe("3.125 m");
    // The learner's answer matches the machine value → flag flipped, computation
    // restored, slip dropped — on the ORIGINAL grade.
    expect(r.data.finalAnswerMatches).toBe(true);
    expect(r.data.rubric.computation).toBe(4);
    expect(r.data.errors).toEqual([]);
    expect(r.data.solve).toBe(BAD.solve);
  });

  it("falls back to field-level correction when the re-grade returns no usable rubric", async () => {
    const regrade = vi.fn(async () => ({ comment: "no rubric here" }));
    const r = await withNumericVerification(BAD, { regrade });
    expect(r.verification.status).toBe("corrected");
    expect(r.data.finalAnswerMatches).toBe(true);
    expect(r.data.rubric.computation).toBe(4);
  });

  it("falls back to field-level correction when no regrade callback is provided (image grades)", async () => {
    const r = await withNumericVerification(BAD, {});
    expect(r.verification.status).toBe("corrected");
    expect(r.data.finalAnswerMatches).toBe(true);
  });

  it("a re-grade that drops its check keeps the ORIGINAL verified value as the reference (status corrected, not verified)", async () => {
    const noCheck = { ...FIXED, solve: { ...FIXED.solve, check: "" }, finalAnswerMatches: false };
    const regrade = vi.fn(async () => noCheck);
    const r = await withNumericVerification(BAD, { regrade });
    expect(r.verification.status).toBe("corrected");
    expect(r.verification.value).toBe("3.125 m");
    // The regraded grade is still the one used — with the learner flag corrected
    // against the original machine value.
    expect(r.data.rubric).toEqual(FIXED.rubric);
    expect(r.data.finalAnswerMatches).toBe(true);
  });
});

describe("makeRegrade — the shared budget-charged re-grade callback", () => {
  it("is null for image grades (the vision path is never re-fired)", () => {
    expect(makeRegrade({ image: { mime: "image/png", data: "x" }, system: "S", charge: vi.fn(), call: vi.fn() })).toBe(null);
  });

  it("charges ONE budget token and re-issues the call with the note appended to the system prompt", async () => {
    const charge = vi.fn(async () => ({ ok: true }));
    const call = vi.fn(async () => ({ rubric: {} }));
    const regrade = makeRegrade({ image: undefined, system: "SYS", charge, call });
    const re = await regrade("NOTE");
    expect(charge).toHaveBeenCalledWith(1);
    expect(call).toHaveBeenCalledWith("SYS\n\nNOTE");
    expect(re).toEqual({ rubric: {} });
  });

  it("throws on a denied budget WITHOUT making the call (the orchestrator falls back)", async () => {
    const call = vi.fn();
    const regrade = makeRegrade({ image: undefined, system: "SYS", charge: vi.fn(async () => ({ ok: false })), call });
    await expect(regrade("NOTE")).rejects.toThrow(/budget/);
    expect(call).not.toHaveBeenCalled();
  });
});
