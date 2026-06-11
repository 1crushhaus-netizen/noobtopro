// ---------------------------------------------------------------------------
// ADAPTIVE DIAGNOSTIC ITEMS — PHYSICS (RANKS_PLAN §8). Two curated, reasoning-
// rich items per band (beginner/foundational/intermediate/advanced/phd) = 10
// items. Shape + authoring rules: see lib/diagnosticBank.js (ids stable +
// unique; `band` is the lib/scoring.js difficulty band; `conceptKey` a real
// lib/curriculum.js PHYSICS concept — PhD-band items map to the hardest
// existing (university-rank) concept they evidence, since the doctorate cells
// are WIP). No solutions appear here; the grader solves each item itself.
// ---------------------------------------------------------------------------

export const PHYSICS_DIAGNOSTIC_ITEMS = [
  {
    id: "physics:beginner:1",
    subject: "physics", band: "beginner", conceptKey: "balanced_unbalanced_forces", topic: "Forces", topicSlug: "kinematics_dynamics",
    targetConcept: "balanced forces / Newton's first law",
    reasoningSurface: "trap",
    trap: "Reporting the weight (≈20 N) as 'the force' instead of recognizing the NET force is zero.",
    question:
      "A 2 kg book lies still on a flat table. What is the NET force on the book, and why? List the forces acting on it and explain how they combine to give that net force.",
  },
  {
    id: "physics:intermediate:1",
    subject: "physics", band: "intermediate", conceptKey: "conservation_energy", topic: "Energy conservation", topicSlug: "energy_momentum",
    targetConcept: "conservation of mechanical energy",
    reasoningSurface: "multi-step",
    question:
      "A 1.0 kg ball is dropped from rest at a height of 5.0 m (ignore air resistance; take g ≈ 10 m/s²). Find its speed just before it hits the ground using energy ideas, and explain why energy conservation lets you avoid working out the time of the fall.",
  },
  {
    id: "physics:advanced:1",
    subject: "physics", band: "advanced", conceptKey: "kinematics", topic: "Motion under gravity", topicSlug: "kinematics_dynamics",
    targetConcept: "distinguishing velocity from acceleration",
    reasoningSurface: "trap",
    trap: "Concluding acceleration is zero at the top because the velocity is momentarily zero.",
    question:
      "A ball is thrown straight up. At the exact highest point of its flight, is its acceleration zero? Carefully explain what IS zero and what is NOT zero at that instant, and why.",
  },
  {
    id: "physics:beginner:2",
    subject: "physics", band: "beginner", conceptKey: "gravity_intro", topic: "Falling objects", topicSlug: "gravitation_orbits",
    targetConcept: "falling rate does not depend on weight",
    reasoningSurface: "trap",
    trap: "Predicting the heavy rock lands first because heavier objects supposedly fall faster.",
    question:
      "You hold a big heavy rock in one hand and a small light pebble in the other, both at the same height above the ground, and you let go of both at exactly the same moment. Both are small and solid, so the air hardly slows either one. Which one reaches the ground first, or do they land together? Explain your reasoning about how gravity pulls on each object.",
  },
  {
    id: "physics:foundational:1",
    subject: "physics", band: "foundational", conceptKey: "speed_velocity_acceleration", topic: "Average speed", topicSlug: "kinematics_dynamics",
    targetConcept: "average speed as total distance over total time",
    reasoningSurface: "multi-step",
    question:
      "A delivery cyclist rides 30 km in 2 hours, stops for a 1 hour lunch break, and then rides another 30 km in 3 hours. What is the cyclist's average speed for the entire trip, including the break? Show every step of your reasoning, and explain why the break time must be counted even though no distance is covered during it.",
  },
  {
    id: "physics:foundational:2",
    subject: "physics", band: "foundational", conceptKey: "electricity_intro", topic: "Series circuits", topicSlug: "electromagnetism",
    targetConcept: "current is not used up around a series circuit",
    reasoningSurface: "trap",
    trap: "Believing the first bulb consumes part of the current so less current reaches the second bulb.",
    question:
      "Two identical bulbs are connected one after the other (in series) with a battery, so the current passes through bulb A first and then through bulb B. A friend claims bulb A must glow brighter because it 'uses up some of the current before it reaches bulb B.' Is your friend right? Explain what happens to the electric current as it goes around the circuit, and say what the bulbs actually take from the circuit to make light and heat.",
  },
  {
    id: "physics:intermediate:2",
    subject: "physics", band: "intermediate", conceptKey: "friction", topic: "Static & kinetic friction", topicSlug: "kinematics_dynamics",
    targetConcept: "static friction threshold versus kinetic friction",
    reasoningSurface: "branch",
    question:
      "A 10 kg box rests on a horizontal floor. The coefficient of static friction is 0.50 and the coefficient of kinetic friction is 0.40 (take g ≈ 10 m/s²). In trial 1 you push the box horizontally with 40 N; in trial 2 you push it horizontally with 60 N. For EACH trial, decide whether the box moves, state the actual friction force acting on it, and find its acceleration. Explain how you decide which kind of friction applies in each case.",
  },
  {
    id: "physics:advanced:2",
    subject: "physics", band: "advanced", conceptKey: "rotational_motion_torque", topic: "Rolling motion", topicSlug: "kinematics_dynamics",
    targetConcept: "energy partition in rolling without slipping",
    reasoningSurface: "multi-step",
    question:
      "A uniform solid cylinder of mass M and radius R (moment of inertia ½MR² about its central axis) starts from rest and rolls without slipping down a ramp, descending a vertical height of 1.8 m (take g ≈ 10 m/s²). Use energy methods to find its translational speed at the bottom. Then determine whether that speed is greater than, less than, or equal to the speed of an identical cylinder that slides down a frictionless ramp of the same height without rotating, and explain why, including what role friction plays in the rolling case and whether it removes mechanical energy.",
  },
  {
    id: "physics:phd:1",
    subject: "physics", band: "phd", conceptKey: "electrostatics_gauss", topic: "Gauss's law & symmetry", topicSlug: "electromagnetism",
    targetConcept: "symmetry requirements for extracting the field from Gauss's law",
    reasoningSurface: "branch",
    question:
      "Gauss's law holds for every closed surface around any charge distribution, yet it determines the electric field in one step for an infinite uniformly charged line while it cannot, by itself, give the field of a uniformly charged rod of finite length or of a uniformly charged solid cube. State precisely what conditions a charge distribution must satisfy for Gauss's law ALONE to determine the field, then analyze each of the three cases (infinite line, finite rod, cube) against those conditions, and describe what method you would have to use instead in the cases where Gauss's law alone is not enough.",
  },
  {
    id: "physics:phd:2",
    subject: "physics", band: "phd", conceptKey: "special_relativity", topic: "Rigidity & causality", topicSlug: "relativity",
    targetConcept: "no perfectly rigid bodies in special relativity",
    reasoningSurface: "trap",
    trap: "Assuming a rigid rod transmits a push to its far end instantaneously, enabling faster-than-light signaling.",
    question:
      "A colleague proposes sending messages faster than light by pushing one end of a 'perfectly rigid' rod that is one light-second long, arguing that the far end must move at the same instant the near end is pushed. Analyze this proposal in detail: describe what actually happens inside a real rod when one end is pushed, identify what physical property of the material sets the speed at which that disturbance travels and roughly how that speed compares to the speed of light, and explain what perfect rigidity would imply about signal propagation and why special relativity cannot accommodate it, including the causality problem that would arise between different inertial frames.",
  },
];
