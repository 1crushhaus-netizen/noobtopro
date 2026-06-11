// ---------------------------------------------------------------------------
// Shared SHAPE RULES for the curated written guides (Phase D, RANKS_PLAN §12.3).
// A guide is:
//   { explanation: [paragraph, …],                    // 2–4 plain-prose paragraphs
//     example: { problem, steps: [step, …], answer }, // one fully worked problem
//     selfQuestions: [question, …] }                  // 3–5 open questions
// Every string is ONE plain paragraph: no markdown, no LaTeX, no HTML — math/science
// notation is plain text + Unicode (x², 10⁻³, √, H₂O, Na⁺, →, ⇌ …).
// Used by BOTH test/guides.test.js and scripts/validate-guides.mjs so the CI suite
// and the authoring/validation tool enforce identical rules.
// Returns a list of human-readable problems ([] = valid).
// ---------------------------------------------------------------------------

// Problems with one prose string (shared by every field).
function textProblems(s, where, minLen) {
  if (typeof s !== "string" || !s.trim()) return [`${where}: missing/empty`];
  const out = [];
  if (s.trim().length < minLen) out.push(`${where}: too short (<${minLen} chars) — looks like stub content`);
  if (/[\n\t]/.test(s)) out.push(`${where}: contains a newline/tab (each string is one plain paragraph)`);
  if (/\\/.test(s)) out.push(`${where}: contains a backslash (no LaTeX — use plain text + Unicode notation)`);
  if (/\*\*|`|^#|\$[A-Za-z{\\]/.test(s)) out.push(`${where}: contains markdown/TeX syntax`);
  if (/<[A-Za-z]/.test(s)) out.push(`${where}: contains HTML-like markup`);
  return out;
}

export function guideProblems(guide) {
  if (!guide || typeof guide !== "object" || Array.isArray(guide)) return ["guide is not an object"];
  const out = [];

  // No fields beyond the contract (catches typos like selfquestions/examples).
  for (const k of Object.keys(guide)) {
    if (!["explanation", "example", "selfQuestions"].includes(k)) out.push(`unknown field "${k}"`);
  }

  // explanation — 2–4 substantial paragraphs.
  if (!Array.isArray(guide.explanation) || guide.explanation.length < 2 || guide.explanation.length > 4) {
    out.push("explanation: must be an array of 2–4 paragraphs");
  } else {
    guide.explanation.forEach((p, i) => out.push(...textProblems(p, `explanation[${i}]`, 80)));
  }

  // example — one fully worked problem: problem + 3–8 reasoning steps + answer.
  const ex = guide.example;
  if (!ex || typeof ex !== "object" || Array.isArray(ex)) {
    out.push("example: must be { problem, steps, answer }");
  } else {
    for (const k of Object.keys(ex)) {
      if (!["problem", "steps", "answer"].includes(k)) out.push(`example: unknown field "${k}"`);
    }
    out.push(...textProblems(ex.problem, "example.problem", 30));
    if (!Array.isArray(ex.steps) || ex.steps.length < 3 || ex.steps.length > 8) {
      out.push("example.steps: must be an array of 3–8 steps");
    } else {
      ex.steps.forEach((s, i) => out.push(...textProblems(s, `example.steps[${i}]`, 20)));
    }
    out.push(...textProblems(ex.answer, "example.answer", 10));
  }

  // selfQuestions — 3–5 open questions, each actually phrased as a question.
  if (!Array.isArray(guide.selfQuestions) || guide.selfQuestions.length < 3 || guide.selfQuestions.length > 5) {
    out.push("selfQuestions: must be an array of 3–5 questions");
  } else {
    guide.selfQuestions.forEach((q, i) => {
      out.push(...textProblems(q, `selfQuestions[${i}]`, 20));
      if (typeof q === "string" && q.trim() && !q.trim().endsWith("?")) {
        out.push(`selfQuestions[${i}]: must end with a question mark`);
      }
    });
  }

  return out;
}
