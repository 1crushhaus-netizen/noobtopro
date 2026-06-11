// ---------------------------------------------------------------------------
// NUMERIC VERIFIER (README §NEXT TASK — the last piece of the grading redesign).
//
// The grader solves every problem itself first (the `solve` block) and uses its
// own numbers to tell a clean execution-slip from a real reasoning error — but
// its arithmetic is fallible, and a grader that mis-computes its own reference
// answer then mis-types the learner's errors, mis-sets `finalAnswerMatches`,
// and prints the wrong number into the workedSolution the learner reads.
//
// The fix: the grader now also emits `solve.check` — ONE self-contained
// calculator expression (literal numbers + units, no variables) that recomputes
// its finalAnswer — and `learnerAnswer`, the learner's final answer verbatim.
// This module re-evaluates the check in a SANDBOXED mathjs instance and:
//   - confirms the grader's arithmetic (status "confirmed"), or
//   - proves it wrong, in which case the route re-grades ONCE with the verified
//     value injected as server context (status "regraded"), falling back to
//     field-level correction when the re-grade is unavailable/denied/fails
//     (status "corrected").
// In every verified state the learner-facing `finalAnswerMatches` is recomputed
// against the machine-verified value, and — RAISE-ONLY, evidence-bounded — a
// learner whose final answer provably matches it gets computation restored to 4
// and final-number execution-slips dropped. Verification NEVER lowers a rubric
// axis: a mismatched final answer doesn't prove bad arithmetic (a wrong setup
// with clean arithmetic is already costed on the heavier reasoning axes).
//
// FAIL-OPEN BY DESIGN: no check / unparseable / non-numeric / incomparable units
// → status "skipped" and the grade passes through byte-identical. The verifier
// only ever acts on what it can PROVE with arithmetic.
//
// SANDBOX: the check expression is model output influenced by learner text
// (prompt injection), so it is treated as hostile. An isolated mathjs instance
// + an explicit AST allowlist (constants, + - * / ^ !, allow-listed functions,
// unit symbols — NO assignment, NO property access, NO arrays/objects/ranges,
// NO function definition) + a length cap, with the classic escape hatches
// (import/createUnit/evaluate/parse) hard-disabled on the instance.
// ---------------------------------------------------------------------------

import { create, all } from "mathjs";
import { normalizeSolve } from "@/lib/gradeInput";

const math = create(all, { number: "number" });
// Capture the functions we use BEFORE disabling them on the instance (the
// expression evaluator resolves names against the instance, so a hostile
// expression can no longer reach them; these local refs still can).
const parseExpr = math.parse;
const formatValue = math.format;
const isUnit = (v) => math.isUnit(v);
const isComplex = (v) => math.isComplex(v);
const isValuelessUnit = (name) => {
  try {
    return math.Unit.isValuelessUnit(name);
  } catch {
    return false;
  }
};
const DISABLED = () => {
  throw new Error("disabled in the numeric-verifier sandbox");
};
math.import(
  { createUnit: DISABLED, evaluate: DISABLED, parse: DISABLED, simplify: DISABLED, derivative: DISABLED, import: DISABLED },
  { override: true }
);

// The check expression is model-emitted and bounded in normalizeSolve; re-enforce
// here so a caller passing un-normalized input is still capped.
export const MAX_CHECK_CHARS = 240;

// What a check expression may contain. Plain arithmetic + the functions a STEM
// final-answer recompute can plausibly need. Everything else — assignment,
// property access (the classic mathjs escape route), matrices, ranges, blocks,
// conditionals, function definition — is rejected before evaluation.
const OP_ALLOW = new Set(["+", "-", "*", "/", "^", "!"]);
const FN_ALLOW = new Set([
  "sqrt", "cbrt", "abs", "exp", "log", "log10", "log2", "pow", "nthRoot",
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh",
  "round", "floor", "ceil", "mod", "gcd", "lcm", "min", "max", "factorial",
  "unaryMinus", "unaryPlus",
]);
const CONST_ALLOW = new Set(["pi", "e", "tau", "phi", "PI", "E"]);

function validateNode(node) {
  if (!node || typeof node.type !== "string") return false;
  switch (node.type) {
    case "ConstantNode":
      return typeof node.value === "number" && Number.isFinite(node.value);
    case "ParenthesisNode":
      return validateNode(node.content);
    case "OperatorNode":
      return OP_ALLOW.has(node.op) && Array.isArray(node.args) && node.args.every(validateNode);
    case "FunctionNode":
      return (
        node.fn && node.fn.type === "SymbolNode" && FN_ALLOW.has(node.fn.name) &&
        Array.isArray(node.args) && node.args.every(validateNode)
      );
    case "SymbolNode":
      // A bare symbol is only ever a math constant or a unit ("N", "kg", "mol").
      return CONST_ALLOW.has(node.name) || isValuelessUnit(node.name);
    default:
      return false;
  }
}

// Normalize the unicode math notation that models and learners actually write
// into parser-friendly ASCII: −×÷·°, "3.0 × 10^8", thousands commas. Linear-time
// replacements on an already length-capped string.
function normalizeMathText(s) {
  return s
    .replace(/[−–]/g, "-")
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[·⋅]/g, "*")
    .replace(/°/g, " deg")
    .replace(/(\d)\s*,\s*(?=\d{3}(\D|$))/g, "$1"); // 40,000 → 40000 (thousands only)
}

// The result must be a real magnitude: a finite number, a VALUED unit, or a
// complex with a negligible imaginary part (sqrt of a float that dipped negative).
function coerceResult(v) {
  if (typeof v === "number") return Number.isFinite(v) ? { ok: true, value: v } : { ok: false };
  if (isUnit(v)) {
    try {
      // A VALUELESS unit ("N" alone) is a dimension, not a magnitude — toNumber()
      // would happily report 1, so check the stored value explicitly.
      if (v.value == null) return { ok: false };
      return Number.isFinite(v.toNumber()) ? { ok: true, value: v } : { ok: false };
    } catch {
      return { ok: false };
    }
  }
  if (isComplex(v)) {
    if (Math.abs(v.im) <= 1e-12 * Math.max(1, Math.abs(v.re)) && Number.isFinite(v.re)) {
      return { ok: true, value: v.re };
    }
  }
  return { ok: false };
}

// Sandboxed evaluation of one calculator expression. { ok:false } on ANYTHING
// suspicious or unparseable — the verifier's contract is to only act on proof.
export function safeEvaluate(expr) {
  if (typeof expr !== "string") return { ok: false };
  const s = normalizeMathText(expr.trim()).trim();
  if (!s || s.length > MAX_CHECK_CHARS || !/^[\x20-\x7E]*$/.test(s)) return { ok: false };
  try {
    const node = parseExpr(s);
    if (!validateNode(node)) return { ok: false };
    return coerceResult(node.compile().evaluate({}));
  } catch {
    return { ok: false };
  }
}

// Comparison tolerance: rounding a reported answer to ~3 significant figures is
// honest convention, so values within 1% (relative) are "the same number"; both-
// integer values must match exactly (12 ≠ 12.1 on a counting answer).
const REL_TOL = 0.01;
const ABS_TOL = 1e-9;
function closeNums(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (Number.isInteger(x) && Number.isInteger(y)) return x === y;
  return Math.abs(x - y) <= Math.max(ABS_TOL, REL_TOL * Math.max(Math.abs(x), Math.abs(y)));
}

// Unit-aware numeric equality: true / false when comparable, null when not
// (incompatible dimensions, unparsed sides). A bare number against a unit value
// is read in the unit side's own display units (learners routinely omit units —
// "40000" for "40000 N·s" is the same magnitude claim).
export function numericallyEqual(a, b) {
  if (a == null || b == null) return null;
  try {
    const aU = isUnit(a);
    const bU = isUnit(b);
    if (aU && bU) {
      if (!a.equalBase(b)) return null;
      return closeNums(a.toSI().toNumber(), b.toSI().toNumber());
    }
    if (aU !== bU) {
      const unit = aU ? a : b;
      const num = aU ? b : a;
      return typeof num === "number" ? closeNums(unit.toNumber(), num) : null;
    }
    return typeof a === "number" && typeof b === "number" ? closeNums(a, b) : null;
  } catch {
    return null;
  }
}

// Parse a stated answer ("≈ 34.6 N", "x = 7", "40,000 N·s", "3/4", "3.0 × 10^8 m/s")
// into a number/Unit, or null when it isn't ONE unambiguous numeric value. The text
// is learner/model-controlled, so it runs through the same sandbox as the check.
export function parseAnswer(text, unitsHint = "") {
  if (typeof text !== "string") return null;
  let s = text.slice(0, 300).trim();
  if (!s || s.includes("%")) return null; // "25%" is ambiguous (25? 0.25?) — skip
  s = s.replace(/^[A-Za-z][A-Za-z0-9_]{0,20}\s*[=≈~:]\s*/, ""); // "x = 7" → "7"
  s = s.replace(/^[≈~]\s*/, "").replace(/^(approximately|approx\.?|about|roughly)\s+/i, "");
  s = s.replace(/[.,;]\s*$/, "").trim();
  if (!s || /\b(or|and)\b/i.test(s)) return null; // "x = 3 or x = -2" — not one value
  const direct = safeEvaluate(s);
  if (direct.ok) return direct.value;
  // Fallback: exactly one numeric literal, with the trailing text (then the
  // grader's units field) tried as that number's units.
  const norm = normalizeMathText(s);
  const m = norm.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
  if (!m) return null;
  if (/\d/.test(norm.slice(0, m.index) + norm.slice(m.index + m[0].length))) return null; // 2+ numbers — ambiguous
  const num = Number(m[0]);
  if (!Number.isFinite(num)) return null;
  const tail = norm.slice(m.index + m[0].length).trim();
  for (const u of [tail, typeof unitsHint === "string" ? unitsHint.trim() : ""]) {
    if (u) {
      const withUnit = safeEvaluate(`${m[0]} ${u}`);
      if (withUnit.ok) return withUnit.value;
    }
  }
  return num;
}

// Render a verified value for the response/persisted feedback and the re-grade
// correction note. Bounded; null when unformattable.
export function formatVerified(v) {
  if (v == null) return null;
  try {
    return String(formatValue(v, { precision: 10 })).slice(0, 80);
  } catch {
    return null;
  }
}

// Verify ONE normalized solve block against its own check expression.
//   { status: "skipped" }                      — nothing provable (fail open)
//   { status: "confirmed",    value }          — check ≈ stated finalAnswer
//   { status: "inconsistent", value }          — check provably ≠ stated finalAnswer
export function checkSolve(solve) {
  if (!solve || typeof solve !== "object" || typeof solve.check !== "string" || !solve.check.trim()) {
    return { status: "skipped" };
  }
  const ev = safeEvaluate(solve.check);
  if (!ev.ok) return { status: "skipped" };
  const stated = parseAnswer(solve.finalAnswer, solve.units);
  if (stated == null) return { status: "skipped" };
  const eq = numericallyEqual(ev.value, stated);
  if (eq === null) return { status: "skipped" };
  return { status: eq ? "confirmed" : "inconsistent", value: ev.value };
}

// RAISE-ONLY learner correction against the machine-verified value, applied to the
// RAW grade fields (the routes re-normalize after). finalAnswerMatches is recomputed
// whenever the learner's stated answer is comparable; a learner whose final answer
// provably matches gets computation restored to 4 and execution-slip errors dropped
// (a verifiably-right final number refutes "your arithmetic was wrong"). A provable
// MISMATCH only corrects the flag — it is not evidence of bad arithmetic.
export function applyLearnerCorrection({ value, learnerAnswer, finalAnswerMatches, rubric, errors }) {
  const out = { finalAnswerMatches: finalAnswerMatches === true, rubric, errors, changed: false };
  const learner = parseAnswer(learnerAnswer);
  if (learner == null) return out;
  const matches = numericallyEqual(learner, value);
  if (matches === null) return out;
  if (matches !== out.finalAnswerMatches) {
    out.finalAnswerMatches = matches;
    out.changed = true;
  }
  if (matches === true) {
    const rb = rubric && typeof rubric === "object" ? rubric : {};
    if (!(Number(rb.computation) >= 4)) {
      out.rubric = { ...rb, computation: 4 };
      out.changed = true;
    }
    if (Array.isArray(errors) && errors.some((e) => e && e.type === "execution-slip")) {
      out.errors = errors.filter((e) => !(e && e.type === "execution-slip"));
      out.changed = true;
    }
  }
  return out;
}

// The server-context note injected into the SYSTEM prompt of the corrective
// re-grade. `expr` has passed the AST allowlist (literal arithmetic only) and
// `valueStr` is our own formatter's output — both safe to embed.
function correctionNote(expr, valueStr) {
  return (
    `SERVER ARITHMETIC CHECK (trusted — computed by a calculator, not by the learner): ` +
    `your previous grade's \`solve.check\` expression ${expr} evaluates to ${valueStr}, which CONTRADICTS the finalAnswer you stated alongside it. ` +
    `Your arithmetic was wrong somewhere. Re-solve and re-grade from scratch: recompute \`solve\` (fix the setup if the expression itself was wrong, otherwise use ${valueStr} as the correct result), ` +
    `and make the rubric, the typed errors, finalAnswerMatches, and the worked solution consistent with the corrected arithmetic.`
  );
}

/**
 * Verify a raw (non-docked) model grade and return the grade to use.
 *
 * @param {object} data    The raw grader JSON (already past the route's rubric gate).
 * @param {(note:string)=>Promise<object>} [opts.regrade]
 *        Re-issues the SAME grade call with `note` appended to the system prompt
 *        (the caller charges its own budgets and may withhold the callback — e.g.
 *        image grades — by passing null). Only invoked when the grader's own
 *        arithmetic is PROVEN wrong; any throw/garbage falls back to field-level
 *        correction of the original grade.
 * @returns {{ data: object, verification: { status: "skipped"|"confirmed"|"regraded"|"corrected", value: string|null, changed: boolean } }}
 *        `data` is the chosen raw grade with the corrections applied onto its raw
 *        fields (finalAnswerMatches / rubric.computation / errors), so callers
 *        normalize and proceed exactly as without verification.
 */
export async function withNumericVerification(data, { regrade } = {}) {
  const solve = normalizeSolve(data && data.solve);
  const first = checkSolve(solve);
  if (first.status === "skipped") {
    return { data, verification: { status: "skipped", value: null, changed: false } };
  }

  let out = data;
  let regraded = false;
  let reference = first.value; // the machine-verified value the corrections compare against
  let verified = first.status === "confirmed"; // does the FINAL grade's own check verify?
  const valueStr = formatVerified(first.value);
  if (!verified && typeof regrade === "function" && valueStr) {
    try {
      const re = await regrade(correctionNote(solve.check, valueStr));
      // The re-grade must clear the same usable-rubric bar as a primary grade;
      // otherwise keep the original grade and fall through to field correction.
      if (re && typeof re === "object" && re.rubric && typeof re.rubric === "object") {
        out = re;
        regraded = true;
        const second = checkSolve(normalizeSolve(re.solve));
        // A re-grade that dropped its check keeps the original verified value as
        // the best available reference (and stays "corrected", not verified).
        if (second.status !== "skipped") {
          reference = second.value;
          verified = second.status === "confirmed";
        }
      }
    } catch {
      /* unavailable/denied/failed re-grade → field-level correction below */
    }
  }

  const status = verified ? (regraded ? "regraded" : "confirmed") : "corrected";
  const fix = applyLearnerCorrection({
    value: reference,
    learnerAnswer: out.learnerAnswer,
    finalAnswerMatches: out.finalAnswerMatches,
    rubric: out.rubric,
    errors: out.errors,
  });
  return {
    data: { ...out, finalAnswerMatches: fix.finalAnswerMatches, rubric: fix.rubric, errors: fix.errors },
    verification: { status, value: formatVerified(reference), changed: fix.changed || regraded },
  };
}

// The budget-charged corrective re-grade all four route wirings share: null for
// image grades (the expensive vision path is never re-fired — those fall back to
// field-level correction), otherwise charge ONE token from the injected global
// Groq budget and re-issue the same grade call with the correction note appended
// to the system prompt. A denied budget throws — withNumericVerification catches
// it and falls back, so a learner's successful grade is never 429'd after the
// fact. `charge`/`call` are injected to keep this module free of route deps.
export function makeRegrade({ image, system, charge, call }) {
  if (image) return null;
  return async (note) => {
    const charged = await charge(1);
    if (!charged || !charged.ok) throw new Error("re-grade budget denied");
    return call(`${system}\n\n${note}`);
  };
}
