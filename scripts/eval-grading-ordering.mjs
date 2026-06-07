#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LIVE-GROQ grading eval (manual — NOT run in CI). Grades the canonical reasoning
// PROBES against the real grading model and prints the headline score + typed errors,
// so a human can confirm the ordering contract holds end-to-end:
//
//   clean-correct ≈ 100  >  sound-method + decimal slip (WRONG answer)
//                        >  right-looking answer reached by broken reasoning
//                        >  fluent jargon-salad (≈ single digits)
//
// The shallow single-substitution probe is included to DEMONSTRATE that no grader can
// fix an atomic question (it will score ~100) — the fix for that lives in the question
// generator (reasoning surface), not the rubric. The harness flags it as such.
//
// Run from the repo root with a key (uses the cheaper grading model by default):
//   GROQ_API_KEY=… node scripts/eval-grading-ordering.mjs
// ---------------------------------------------------------------------------

import { groqJSON, PRACTICE_GRADE_SYS } from "../lib/groq.js";
import { scoreFromRubric, normalizeRubric } from "../lib/scoring.js";

if (!process.env.GROQ_API_KEY) {
  console.error("Missing GROQ_API_KEY. Run: GROQ_API_KEY=… node scripts/eval-grading-ordering.mjs");
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBES = [
  {
    id: "power = force×time (wrong principle)", subject: "physics", concept: "work and power", difficulty: "intermediate",
    question: "A 4000 N force pushes a crate 12 m in 10 s. Find the average power delivered. (More quantities are given than you need — choose carefully.)",
    reasoning: "Power = force × time = 4000 × 10 = 40000 W.",
    expect: "LOW — wrong relation; a unit check (N·s = impulse, not watts) should catch it.",
  },
  {
    id: "inverted 2:1 ratio (lucky-ish, reasoning error)", subject: "chemistry", concept: "stoichiometry", difficulty: "intermediate",
    question: "For 2 H2 + O2 -> 2 H2O, how many moles of O2 react with 50 mol of H2?",
    reasoning: "The ratio of H2 to O2 is 2:1, so O2 = 50 × 2 = 100 mol.",
    expect: "LOW — inverted the ratio (reasoning error); a Socratic prompt should ask to re-check 2:1.",
  },
  {
    id: "decimal slip in a sound method (WRONG answer)", subject: "math", concept: "division", difficulty: "foundational",
    question: "A factory makes 468,750 widgets across 10 equal shifts, then splits each shift's output equally among 25 machines. How many widgets per machine per shift?",
    reasoning: "Per shift: 468,750 / 10 = 46,875. Per machine: 46,875 / 25 = 1,875. Wait — I'll write the per-shift number as 4,687.5, so per machine = 4,687.5 / 25 = 187.5.",
    expect: "HIGH — the method is correct; the only flaw is a decimal slip (execution-slip), which should cost almost nothing.",
  },
  {
    id: "jargon salad (fluent nonsense)", subject: "physics", concept: "energy conservation", difficulty: "advanced",
    question: "A block slides down a rough incline. Is mechanical energy conserved, and how much is lost? Explain and compute.",
    reasoning: "By the Hamiltonian invariance under Noether symmetry, the entropic flux of the system thermodynamically equilibrates the kinetic tensor, so energy is fundamentally conserved through gauge-theoretic resonance.",
    expect: "VERY LOW — names principles without using them; no real inference.",
  },
  {
    id: "shallow single-substitution (atomic question)", subject: "physics", concept: "Newton's second law", difficulty: "beginner",
    question: "A 2 kg object accelerates at 3 m/s^2. What is the net force?",
    reasoning: "F = m·a = 2 × 3 = 6 N.",
    expect: "HIGH — and that's the POINT: on an atomic question complete == shallow. Fix the QUESTION (reasoning surface), not the rubric.",
  },
];

async function main() {
  const rows = [];
  for (const p of PROBES) {
    try {
      const data = await groqJSON({
        system: PRACTICE_GRADE_SYS,
        grade: true,
        maxTokens: 3000,
        user:
          `Subject: ${p.subject}\nQuestion: ${p.question}\nConcept being probed: ${p.concept}\n` +
          `Question difficulty band: ${p.difficulty}\nLearner's current level: 50/100\n\n` +
          `Learner's reasoning:\n"""${p.reasoning}"""`,
      });
      const score = scoreFromRubric(normalizeRubric(data?.rubric));
      rows.push({ id: p.id, score });
      console.log(`\n=== ${p.id} ===  score=${score}`);
      console.log(`  expected: ${p.expect}`);
      if (data?.solve) console.log(`  grader solved: ${data.solve.finalAnswer} ${data.solve.units || ""}`.trim());
      console.log(`  rubric: ${JSON.stringify(data?.rubric)}`);
      for (const e of data?.errors || []) {
        console.log(`  [${e.type}] ${e.what}${e.socraticPrompt ? `\n     Q> ${e.socraticPrompt}` : ""}`);
      }
    } catch (e) {
      console.error(`\n=== ${p.id} ===  FAILED: ${e.message || e}`);
      rows.push({ id: p.id, score: null });
    }
    await sleep(500); // be gentle on the Groq rate limit
  }

  const by = Object.fromEntries(rows.map((r) => [r.id, r.score]));
  const slip = by["decimal slip in a sound method (WRONG answer)"];
  const inverted = by["inverted 2:1 ratio (lucky-ish, reasoning error)"];
  const salad = by["jargon salad (fluent nonsense)"];
  console.log("\n--- ordering check ---");
  console.log(`  sound-slip (${slip}) > inverted-ratio (${inverted}) > jargon-salad (${salad}) ?`,
    slip != null && inverted != null && salad != null && slip > inverted && inverted > salad ? "PASS" : "REVIEW");
  console.log("  (the shallow atomic probe scoring high is EXPECTED — that's a question-design gap, not a grader bug.)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
