#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Concept Hub PUBLIC SEED (PR 4) — batch-generate + publish a curated baseline
// guide for the core concept of each of the 36 taxonomy topics, so the hub is the
// SAME vetted catalog for everyone from day one (the curation-only model otherwise
// leaves a fresh user's hub empty).
//
// Idempotent + re-runnable: each concept is published via the service-role-only
// `seed_curated_guide` RPC (source='curated', visibility='public', status='ready').
// Re-running refreshes content. By default it SKIPS concepts that already have a
// public+ready guide; pass --force to regenerate them.
//
// Run it once, with secrets, from the repo root (NOT in CI):
//   GROQ_API_KEY=… NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     node scripts/seed-concept-hub.mjs            # or: --force to refresh existing
//
// It reuses the app's EXACT grading client + prompt (lib/groq.js groqJSON/LEARN_SYS)
// so seeded guides are identical in shape to /api/learn output. The seed concept list
// below mirrors lib/taxonomy.js SEED_CONCEPTS (validated by test/seed-concepts.test.js).
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";
import { groqJSON, LEARN_SYS } from "../lib/groq.js";

// One canonical core concept per taxonomy topic (mirrors lib/taxonomy.js SEED_CONCEPTS).
const SEED = {
  math: [
    ["arithmetic_number", "Prime factorization"],
    ["algebra", "Solving linear equations"],
    ["functions_precalc", "Function composition"],
    ["geometry", "The Pythagorean theorem"],
    ["trigonometry", "The unit circle"],
    ["calculus_analysis", "The derivative as a rate of change"],
    ["linear_algebra", "Matrix multiplication"],
    ["differential_equations", "Separable differential equations"],
    ["probability_statistics", "Conditional probability"],
    ["discrete_logic", "Proof by induction"],
    ["proof_reasoning", "Direct versus indirect proof"],
    ["general_math", "Problem-solving strategies in mathematics"],
  ],
  physics: [
    ["kinematics_dynamics", "Newton's second law"],
    ["energy_momentum", "Conservation of energy"],
    ["gravitation_orbits", "Newton's law of universal gravitation"],
    ["oscillations_waves", "Simple harmonic motion"],
    ["fluids_continuum", "Bernoulli's principle"],
    ["thermodynamics_statmech", "The first law of thermodynamics"],
    ["electromagnetism", "Coulomb's law"],
    ["optics", "Refraction and Snell's law"],
    ["modern_quantum", "Wave-particle duality"],
    ["relativity", "Time dilation"],
    ["nuclear_particle", "Radioactive decay"],
    ["general_physics", "Dimensional analysis"],
  ],
  chemistry: [
    ["atomic_structure", "Electron configuration"],
    ["bonding_molecular", "Covalent versus ionic bonding"],
    ["stoichiometry", "Limiting reagents"],
    ["states_intermolecular", "Intermolecular forces"],
    ["thermochemistry", "Enthalpy of reaction"],
    ["equilibrium", "Le Chatelier's principle"],
    ["acids_bases", "The pH scale"],
    ["kinetics", "Reaction rate and rate laws"],
    ["electrochemistry", "Redox reactions"],
    ["organic", "Functional groups"],
    ["analytical_spectroscopy", "The Beer-Lambert law"],
    ["general_chemistry", "The mole concept"],
  ],
};

const SUBJECTS = ["math", "physics", "chemistry"];
const BANDS = new Set(["beginner", "foundational", "intermediate", "advanced", "phd"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function env(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var ${name}. See the header of this file.`);
    process.exit(1);
  }
  return v;
}

// Shape the LLM guide exactly like /api/learn does (arrays of strings; bounded tryThisQuestion).
function normalizeGuide(subject, concept, data) {
  const arr = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === "string" && s.trim()).slice(0, 12) : []);
  const str = (x) => (typeof x === "string" ? x.trim() : "");
  let tryThisQuestion = null;
  const q = data && data.tryThisQuestion;
  if (q && typeof q.question === "string" && q.question.trim()) {
    const d = typeof q.difficulty === "string" ? q.difficulty.trim().toLowerCase() : "";
    tryThisQuestion = { question: q.question.trim(), targetConcept: concept, difficulty: BANDS.has(d) ? d : "intermediate" };
  }
  return {
    subject,
    concept,
    topic: str(data && data.topic),
    overview: str(data && data.overview),
    keyIdeas: arr(data && data.keyIdeas),
    socraticQuestions: arr(data && data.socraticQuestions),
    pitfalls: arr(data && data.pitfalls),
    tryThis: str(data && data.tryThis),
    tryThisQuestion,
  };
}

async function main() {
  const force = process.argv.includes("--force");
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  env("GROQ_API_KEY"); // used by groqJSON
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Which (subject, concept_key) are already public+ready (skip unless --force).
  const existing = new Set();
  if (!force) {
    const { data } = await sb
      .from("concept_guides")
      .select("subject, concept_key")
      .eq("visibility", "public")
      .eq("status", "ready");
    for (const r of data || []) existing.add(`${r.subject}:${r.concept_key}`);
  }
  const normKey = (s) => s.toLowerCase().trim().replace(/\s+/g, " ").slice(0, 200);

  let seeded = 0, skipped = 0, failed = 0;
  for (const subject of SUBJECTS) {
    const allowed = SEED[subject].map(([slug]) => slug).join(", ");
    for (const [slug, concept] of SEED[subject]) {
      if (!force && existing.has(`${subject}:${normKey(concept)}`)) {
        skipped++;
        console.log(`· skip   ${subject}/${slug} — "${concept}" (already public)`);
        continue;
      }
      try {
        const data = await groqJSON({
          system: LEARN_SYS,
          user: `Subject: ${subject}\nConcept: ${concept}\nAllowed topics: ${allowed}\nTeach this concept now.`,
          maxTokens: 1600,
        });
        const guide = normalizeGuide(subject, concept, data);
        if (!guide.overview && guide.keyIdeas.length === 0) throw new Error("empty guide");
        const topic = SEED[subject].some(([s]) => s === guide.topic) ? guide.topic : slug;
        const level = guide.tryThisQuestion ? guide.tryThisQuestion.difficulty : null;
        const { error } = await sb.rpc("seed_curated_guide", {
          p_subject: subject, p_topic: topic, p_concept: concept, p_content: guide, p_level: level,
        });
        if (error) throw error;
        seeded++;
        console.log(`✓ seed   ${subject}/${topic} — "${concept}"`);
        await sleep(400); // be gentle on the Groq rate limit
      } catch (e) {
        failed++;
        console.error(`✗ FAILED ${subject}/${slug} — "${concept}": ${e.message || e}`);
      }
    }
  }
  // Conservative housekeeping: collapse pending stubs the seed now subsumes.
  try {
    const { data: removed } = await sb.rpc("dedupe_pending_stubs");
    console.log(`\nDone. seeded=${seeded} skipped=${skipped} failed=${failed}; pending stubs pruned=${removed ?? 0}.`);
  } catch {
    console.log(`\nDone. seeded=${seeded} skipped=${skipped} failed=${failed}.`);
  }
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
