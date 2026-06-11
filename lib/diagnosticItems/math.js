// ---------------------------------------------------------------------------
// ADAPTIVE DIAGNOSTIC ITEMS — MATH (RANKS_PLAN §8). Two curated, reasoning-rich
// items per band (beginner/foundational/intermediate/advanced/phd) = 10 items.
// Shape + authoring rules: see lib/diagnosticBank.js (ids stable + unique;
// `band` is the lib/scoring.js difficulty band; `conceptKey` a real
// lib/curriculum.js MATH concept — PhD-band items map to the hardest existing
// (university-rank) concept they evidence, since the doctorate cells are WIP).
// No solutions appear here; the grader solves each item itself.
// ---------------------------------------------------------------------------

export const MATH_DIAGNOSTIC_ITEMS = [
  {
    id: "math:beginner:1",
    subject: "math", band: "beginner", conceptKey: "ratios_unit_rates", topic: "Ratios & proportions", topicSlug: "arithmetic_number",
    targetConcept: "proportional reasoning",
    reasoningSurface: "multi-step",
    question:
      "A recipe uses 3 cups of flour to make 12 cookies. Keeping the recipe the same, how much flour is needed to make 30 cookies? Explain the relationship you are using and show your steps — don't just give a number.",
  },
  {
    id: "math:intermediate:1",
    subject: "math", band: "intermediate", conceptKey: "rational_expressions", topic: "Rational equations", topicSlug: "algebra",
    targetConcept: "solving rational equations and checking validity",
    reasoningSurface: "trap",
    trap: "Solving algebraically without checking whether the solution is allowed (the denominator can't be zero).",
    question:
      "Solve (x + 2) / (x − 3) = 5 for x. Then check whether your answer is actually a valid solution, and explain why checking matters for an equation like this one.",
  },
  {
    id: "math:advanced:1",
    subject: "math", band: "advanced", conceptKey: "sequences_series_hs", topic: "Proof & reasoning", topicSlug: "proof_reasoning",
    targetConcept: "constructing a general proof",
    reasoningSurface: "branch",
    question:
      "Explain why the sum of the first n odd numbers, 1 + 3 + 5 + … + (2n − 1), always equals n². Give a general argument that works for EVERY whole number n — a clear justification matters far more than quoting the formula.",
  },
  {
    id: "math:beginner:2",
    subject: "math", band: "beginner", conceptKey: "multiplication_division", topic: "Counting along a line", topicSlug: "arithmetic_number",
    targetConcept: "fencepost counting (intervals vs. endpoints)",
    reasoningSurface: "trap",
    trap: "Dividing 24 by 3 to get 8 posts, which counts the gaps between posts but forgets the post standing at the very start of the fence.",
    question:
      "A straight fence is 24 meters long. There is a post at the very start of the fence, then one post every 3 meters, finishing with a post at the very end. How many posts are there in total? Explain your reasoning step by step — describing or sketching the fence counts as showing your work.",
  },
  {
    id: "math:foundational:1",
    subject: "math", band: "foundational", conceptKey: "percentages", topic: "Percent change", topicSlug: "arithmetic_number",
    targetConcept: "successive percent changes apply to different bases",
    reasoningSurface: "trap",
    trap: "Assuming a 20% increase followed by a 20% decrease cancel out, so the price simply returns to $50.",
    question:
      "A jacket costs $50. The store raises the price by 20%, and a month later it lowers the NEW price by 20%. What is the final price in dollars? Show each step of your calculation, and explain why the final price does or does not come back to $50.",
  },
  {
    id: "math:foundational:2",
    subject: "math", band: "foundational", conceptKey: "one_variable_equations", topic: "Equations from geometry", topicSlug: "algebra",
    targetConcept: "translating verbal conditions into a linear equation",
    reasoningSurface: "multi-step",
    question:
      "In a triangle, the second angle is twice as large as the first angle, and the third angle is 20° larger than the first angle. The three angles of any triangle add up to 180°. Find the size of each of the three angles — write down the equation you set up, show your steps, and check that your three angles really satisfy every condition.",
  },
  {
    id: "math:intermediate:2",
    subject: "math", band: "intermediate", conceptKey: "probability_combinatorics", topic: "Counting with cases", topicSlug: "discrete_logic",
    targetConcept: "case analysis in counting problems",
    reasoningSurface: "branch",
    question:
      "How many three-digit numbers (from 100 to 999) are even and have all three digits different from one another? Explain your counting strategy fully — in particular, justify any separate cases you split the count into, and show the arithmetic for each case before combining them.",
  },
  {
    id: "math:advanced:2",
    subject: "math", band: "advanced", conceptKey: "integrals_ftc", topic: "Improper integrals", topicSlug: "calculus_analysis",
    targetConcept: "hypotheses of the fundamental theorem of calculus",
    reasoningSurface: "trap",
    trap: "Applying the fundamental theorem with the antiderivative −1/x straight across the interval and reporting −2, even though the integrand is unbounded inside it.",
    question:
      "Evaluate the definite integral of 1/x² from x = −1 to x = 1, explaining every step. Before you apply any antiderivative rule, justify whether that rule is actually valid on this whole interval, and state clearly what your final conclusion about this integral is and why.",
  },
  {
    id: "math:phd:1",
    subject: "math", band: "phd", conceptKey: "sequences_series", topic: "Modes of convergence", topicSlug: "calculus_analysis",
    targetConcept: "pointwise vs. uniform convergence of function sequences",
    reasoningSurface: "multi-step",
    question:
      "For n = 1, 2, 3, … define fₙ(x) = xⁿ on the interval [0, 1]. Determine the pointwise limit function f, then decide whether fₙ converges to f uniformly on [0, 1]. Prove your verdict rigorously — for instance via an ε-style argument about sup |fₙ(x) − f(x)| — and explain in a sentence what your conclusion shows about whether continuity must survive a limit process.",
  },
  {
    id: "math:phd:2",
    subject: "math", band: "phd", conceptKey: "eigenvalues", topic: "Spectral reasoning", topicSlug: "linear_algebra",
    targetConcept: "eigenvalues and diagonalizability of idempotent operators",
    reasoningSurface: "branch",
    question:
      "Let A be a real n×n matrix satisfying A² = A. Determine every number that can occur as an eigenvalue of such a matrix, and justify why nothing else is possible. Then explain — with a genuine argument rather than a quoted theorem — why A must be diagonalizable, and describe how ℝⁿ decomposes into subspaces naturally associated with A. Treat any special cases separately if needed.",
  },
];
