// ---------------------------------------------------------------------------
// CURATED DIAGNOSTIC BANK — the fixed, standardized "Prove it" placement.
//
// 9 hand-curated, REASONING-RICH questions: each subject (math, physics, chemistry)
// asked once at each of 3 levels (beginner / intermediate / hard). Served directly by
// /api/generate with **zero Groq calls** (no generation, no pool) — so the placement is
// fully standardized (everyone gets the same calibrated questions, the app's stated
// standardization goal) and never depends on the model generating from scratch.
//
// Every question demands EXPLAINED reasoning, not plug-and-chug, and the harder tiers
// carry a deliberate TRAP where the naive path is wrong (so "complete" and "shallow"
// answers look different — the only way a rubric can measure thinking). No solutions or
// final answers appear here (the grader solves them itself; the learner proves it first).
//
// `difficulty` MUST be one of DIAGNOSTIC_DIFFICULTIES (lib/scoring.js): beginner,
// intermediate, advanced. `topicSlug` is a valid lib/taxonomy.js slug. To edit the
// placement, edit this list (and keep one question per subject × level).
// ---------------------------------------------------------------------------

export const DIAGNOSTIC_BANK = [
  // ----- MATHEMATICS -----
  {
    subject: "math", difficulty: "beginner", topic: "Ratios & proportions", topicSlug: "arithmetic_number",
    targetConcept: "proportional reasoning",
    reasoningSurface: "multi-step",
    question:
      "A recipe uses 3 cups of flour to make 12 cookies. Keeping the recipe the same, how much flour is needed to make 30 cookies? Explain the relationship you are using and show your steps — don't just give a number.",
  },
  {
    subject: "math", difficulty: "intermediate", topic: "Rational equations", topicSlug: "algebra",
    targetConcept: "solving rational equations and checking validity",
    reasoningSurface: "trap",
    trap: "Solving algebraically without checking whether the solution is allowed (the denominator can't be zero).",
    question:
      "Solve (x + 2) / (x − 3) = 5 for x. Then check whether your answer is actually a valid solution, and explain why checking matters for an equation like this one.",
  },
  {
    subject: "math", difficulty: "advanced", topic: "Proof & reasoning", topicSlug: "proof_reasoning",
    targetConcept: "constructing a general proof",
    reasoningSurface: "branch",
    question:
      "Explain why the sum of the first n odd numbers, 1 + 3 + 5 + … + (2n − 1), always equals n². Give a general argument that works for EVERY whole number n — a clear justification matters far more than quoting the formula.",
  },

  // ----- PHYSICS -----
  {
    subject: "physics", difficulty: "beginner", topic: "Forces", topicSlug: "kinematics_dynamics",
    targetConcept: "balanced forces / Newton's first law",
    reasoningSurface: "trap",
    trap: "Reporting the weight (≈20 N) as 'the force' instead of recognizing the NET force is zero.",
    question:
      "A 2 kg book lies still on a flat table. What is the NET force on the book, and why? List the forces acting on it and explain how they combine to give that net force.",
  },
  {
    subject: "physics", difficulty: "intermediate", topic: "Energy conservation", topicSlug: "energy_momentum",
    targetConcept: "conservation of mechanical energy",
    reasoningSurface: "multi-step",
    question:
      "A 1.0 kg ball is dropped from rest at a height of 5.0 m (ignore air resistance; take g ≈ 10 m/s²). Find its speed just before it hits the ground using energy ideas, and explain why energy conservation lets you avoid working out the time of the fall.",
  },
  {
    subject: "physics", difficulty: "advanced", topic: "Motion under gravity", topicSlug: "kinematics_dynamics",
    targetConcept: "distinguishing velocity from acceleration",
    reasoningSurface: "trap",
    trap: "Concluding acceleration is zero at the top because the velocity is momentarily zero.",
    question:
      "A ball is thrown straight up. At the exact highest point of its flight, is its acceleration zero? Carefully explain what IS zero and what is NOT zero at that instant, and why.",
  },

  // ----- CHEMISTRY -----
  {
    subject: "chemistry", difficulty: "beginner", topic: "Composition by mass", topicSlug: "stoichiometry",
    targetConcept: "molar mass and composition from a formula",
    reasoningSurface: "multi-step",
    question:
      "Water is H₂O, with a molar mass of about 18 g/mol (H ≈ 1 g/mol, O ≈ 16 g/mol). In exactly 18 g of water, what mass is hydrogen and what mass is oxygen? Explain how the chemical formula tells you the ratio.",
  },
  {
    subject: "chemistry", difficulty: "intermediate", topic: "Limiting reagents", topicSlug: "stoichiometry",
    targetConcept: "limiting reagent from mole ratios",
    reasoningSurface: "trap",
    trap: "Assuming equal moles react completely, ignoring the 2:1 H₂:O₂ ratio (H₂ is limiting).",
    question:
      "For the reaction 2 H₂ + O₂ → 2 H₂O, you combine 4 mol of H₂ with 4 mol of O₂. Which reactant runs out first (the limiting reagent), and how many moles of water form? Be careful with the 2:1 ratio and explain your reasoning.",
  },
  {
    subject: "chemistry", difficulty: "advanced", topic: "Limiting reagents from mass", topicSlug: "stoichiometry",
    targetConcept: "converting equal masses to moles before comparing",
    reasoningSurface: "trap",
    trap: "Treating equal MASSES as equal MOLES — H₂ (2 g/mol) gives far more moles than O₂ (32 g/mol).",
    question:
      "Equal masses — 10 g of H₂ and 10 g of O₂ — are sealed in a container and react to form water (2 H₂ + O₂ → 2 H₂O). Which is the limiting reagent? Explain carefully why equal MASSES do not mean equal MOLES, and reason all the way to your answer.",
  },
];

// The diagnostic payload /api/generate returns, in the same shape the client + grader
// expect (`{ questions: [...] }`). A fresh shallow copy each call so a caller can't mutate
// the bank. `curated:true` marks it as served from the bank (no Groq).
export function buildDiagnostic() {
  return { questions: DIAGNOSTIC_BANK.map((q) => ({ ...q })), curated: true };
}

// The bank is one question per (subject, difficulty) slot.
const BANK_BY_SLOT = new Map(DIAGNOSTIC_BANK.map((q) => [`${q.subject}:${q.difficulty}`, q]));

// SERVER-SIDE source of truth for a diagnostic question's reasoning-surface metadata,
// keyed by its slot. The diagnostic grader derives surface/trap from HERE — never from the
// client request body — so a crafted answer can't spoof the grader's calibration (the
// metadata only ever helps LOCATE errors and is grader-internal; deriving it server-side
// removes any client influence over it entirely). Unknown slot → empty (no surface line).
export function diagnosticSurfaceFor(subject, difficulty) {
  const q = BANK_BY_SLOT.get(`${subject}:${difficulty}`);
  return { reasoningSurface: (q && q.reasoningSurface) || null, trap: (q && q.trap) || "" };
}
