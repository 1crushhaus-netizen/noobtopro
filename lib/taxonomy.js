// ---------------------------------------------------------------------------
// Concept-hub taxonomy: the curated, FIXED Subject -> Topic tree.
//
// This is the single source of truth for topic SLUGS (the stored, immutable
// identifier) and their display LABELS. It is mirrored in the DB by the
// `concept_topics` reference table (see db/schema.sql) — keep the two in sync.
//
// Rules:
// - Slugs are STABLE/IMMUTABLE (they appear in browse URLs and the FK). Never
//   rename a slug; add a new one and re-classify if a topic must change.
// - Every subject has a terminal `general_<subject>` bucket so the LLM
//   classifier (and any fallback) always has a valid place to land.
// - The grader/learn LLM is told to pick ONE slug from the subject's list; the
//   server hard-validates against this set and collapses anything unknown to the
//   subject's `general_*` fallback (mirrors the ORDER.includes / DIFFICULTY_BANDS
//   defensive-normalization idiom used elsewhere).
// ---------------------------------------------------------------------------

import { ORDER } from "@/lib/scoring";

// Subject -> ordered list of { slug, label }. ~12 topics each incl. general_*.
export const TOPICS = {
  math: [
    { slug: "arithmetic_number", label: "Arithmetic & Number Theory" },
    { slug: "algebra", label: "Algebra" },
    { slug: "functions_precalc", label: "Functions & Precalculus" },
    { slug: "geometry", label: "Geometry" },
    { slug: "trigonometry", label: "Trigonometry" },
    { slug: "calculus_analysis", label: "Calculus & Analysis" },
    { slug: "linear_algebra", label: "Linear Algebra" },
    { slug: "differential_equations", label: "Differential Equations" },
    { slug: "probability_statistics", label: "Probability & Statistics" },
    { slug: "discrete_logic", label: "Discrete Math & Logic" },
    { slug: "proof_reasoning", label: "Proof & Mathematical Reasoning" },
    { slug: "general_math", label: "General / Other" },
  ],
  physics: [
    { slug: "kinematics_dynamics", label: "Kinematics & Dynamics" },
    { slug: "energy_momentum", label: "Energy & Momentum" },
    { slug: "gravitation_orbits", label: "Gravitation & Orbits" },
    { slug: "oscillations_waves", label: "Oscillations & Waves" },
    { slug: "fluids_continuum", label: "Fluids & Continuum Mechanics" },
    { slug: "thermodynamics_statmech", label: "Thermodynamics & Statistical Mechanics" },
    { slug: "electromagnetism", label: "Electricity & Magnetism" },
    { slug: "optics", label: "Optics" },
    { slug: "modern_quantum", label: "Modern & Quantum Physics" },
    { slug: "relativity", label: "Relativity" },
    { slug: "nuclear_particle", label: "Nuclear & Particle Physics" },
    { slug: "general_physics", label: "General / Other" },
  ],
  chemistry: [
    { slug: "atomic_structure", label: "Atomic Structure & Periodicity" },
    { slug: "bonding_molecular", label: "Bonding & Molecular Structure" },
    { slug: "stoichiometry", label: "Stoichiometry & Reactions" },
    { slug: "states_intermolecular", label: "States of Matter & Intermolecular Forces" },
    { slug: "thermochemistry", label: "Thermochemistry & Energetics" },
    { slug: "equilibrium", label: "Equilibrium" },
    { slug: "acids_bases", label: "Acids, Bases & Salts" },
    { slug: "kinetics", label: "Reaction Kinetics" },
    { slug: "electrochemistry", label: "Electrochemistry" },
    { slug: "organic", label: "Organic Chemistry" },
    { slug: "analytical_spectroscopy", label: "Analytical Chemistry & Spectroscopy" },
    { slug: "general_chemistry", label: "General / Other" },
  ],
};

// The terminal fallback slug for a subject (always the last entry above).
export function fallbackTopic(subject) {
  return `general_${subject}`;
}

// A flat Set of every valid slug for O(1), prototype-safe membership checks.
const ALL_SLUGS = new Set(ORDER.flatMap((s) => (TOPICS[s] || []).map((t) => t.slug)));

// True only if `slug` is a real topic of `subject` (prototype-safe; no inherited
// keys). Used by the server to validate LLM-assigned topics before storing.
export function isValidTopic(subject, slug) {
  if (!ORDER.includes(subject) || typeof slug !== "string") return false;
  return (TOPICS[subject] || []).some((t) => t.slug === slug);
}

// Coerce any LLM/clientsupplied topic to a valid slug for the subject, falling
// back to general_<subject>. Case/space-normalized to tolerate minor drift.
export function normalizeTopic(subject, slug) {
  if (!ORDER.includes(subject)) return null;
  const key = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  return isValidTopic(subject, key) ? key : fallbackTopic(subject);
}

// Display label for a slug (falls back to the slug itself if unknown).
export function topicLabel(subject, slug) {
  const t = (TOPICS[subject] || []).find((x) => x.slug === slug);
  return t ? t.label : slug;
}

// Every (subject, slug, label, sort) row — used to seed/verify concept_topics.
export function allTopicRows() {
  return ORDER.flatMap((subject) =>
    (TOPICS[subject] || []).map((t, i) => ({ subject, slug: t.slug, label: t.label, sort: i }))
  );
}

// The slug list for a subject, as a comma-joined string for LLM prompt injection.
export function topicSlugsFor(subject) {
  return (TOPICS[subject] || []).map((t) => t.slug).join(", ");
}

export { ALL_SLUGS };
