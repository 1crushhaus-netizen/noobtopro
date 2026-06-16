// ---------------------------------------------------------------------------
// ADAPTIVE DIAGNOSTIC ITEMS — CHEMISTRY (RANKS_PLAN §8). Two curated,
// reasoning-rich items per band (beginner/foundational/intermediate/advanced/
// phd) = 10 items. Shape + authoring rules: see lib/diagnosticBank.js (ids
// stable + unique; `band` is the lib/scoring.js difficulty band; `conceptKey`
// a real lib/curriculum.js CHEMISTRY concept — PhD-band items map to the
// hardest existing (university-rank) concept they evidence, since the
// doctorate cells are WIP). No solutions appear here; the grader solves each
// item itself.
// ---------------------------------------------------------------------------

export const CHEMISTRY_DIAGNOSTIC_ITEMS = [
  {
    id: "chemistry:beginner:1",
    subject: "chemistry", band: "beginner", conceptKey: "particles_intro", topic: "Composition by mass", topicSlug: "stoichiometry",
    targetConcept: "molar mass and composition from a formula",
    reasoningSurface: "multi-step",
    question:
      "Water is H₂O, with a molar mass of about 18 g/mol (H ≈ 1 g/mol, O ≈ 16 g/mol). In exactly 18 g of water, what mass is hydrogen and what mass is oxygen? Explain how the chemical formula tells you the ratio.",
  },
  {
    id: "chemistry:intermediate:1",
    subject: "chemistry", band: "intermediate", conceptKey: "stoichiometry", topic: "Limiting reagents", topicSlug: "stoichiometry",
    targetConcept: "limiting reagent from mole ratios",
    reasoningSurface: "trap",
    trap: "Assuming equal moles react completely, ignoring the 2:1 H₂:O₂ ratio (H₂ is limiting).",
    question:
      "For the reaction 2 H₂ + O₂ → 2 H₂O, you combine 4 mol of H₂ with 4 mol of O₂. Which reactant runs out first (the limiting reagent), and how many moles of water form? Be careful with the 2:1 ratio and explain your reasoning.",
  },
  {
    id: "chemistry:advanced:1",
    subject: "chemistry", band: "advanced", conceptKey: "stoichiometry_adv", topic: "Limiting reagents from mass", topicSlug: "stoichiometry",
    targetConcept: "converting equal masses to moles before comparing",
    reasoningSurface: "trap",
    trap: "Treating equal MASSES as equal MOLES — H₂ (2 g/mol) gives far more moles than O₂ (32 g/mol).",
    question:
      "Equal masses — 10 g of H₂ and 10 g of O₂ — are sealed in a container and react to form water (2 H₂ + O₂ → 2 H₂O). Which is the limiting reagent? Explain carefully why equal MASSES do not mean equal MOLES, and reason all the way to your answer.",
  },
  {
    id: "chemistry:beginner:2",
    subject: "chemistry", band: "beginner", conceptKey: "conservation_matter_intro", topic: "Dissolving & conservation of matter", topicSlug: "general_chemistry",
    targetConcept: "dissolved matter is not destroyed and can be recovered",
    reasoningSurface: "trap",
    trap: "Believing the salt was destroyed because it can no longer be seen — it is still there, dissolved in the water, and recoverable.",
    question:
      "You stir a spoonful of salt into a glass of warm water and keep stirring until you cannot see the salt anymore. A friend says the salt is gone forever because it disappeared. Do you agree? Explain what really happened to the salt, and describe one way you could get the salt back out of the water.",
  },
  {
    id: "chemistry:foundational:1",
    subject: "chemistry", band: "foundational", conceptKey: "conservation_mass", topic: "Conservation of mass", topicSlug: "stoichiometry",
    targetConcept: "conservation of mass in closed vs open systems",
    reasoningSurface: "branch",
    question:
      "A student mixes baking soda and vinegar inside a tightly sealed flask. Before the reaction the sealed flask weighs 250 g, and after the fizzing stops it still weighs 250 g. She then repeats the experiment in an open cup, and the balance reading drops from 250 g to 248 g. Explain BOTH results: why the sealed flask's mass did not change, and where the missing 2 g went in the open cup. Was any matter actually destroyed?",
  },
  {
    id: "chemistry:foundational:2",
    subject: "chemistry", band: "foundational", conceptKey: "properties_density", topic: "Density & flotation", topicSlug: "states_intermolecular",
    targetConcept: "density as mass per volume deciding float or sink",
    reasoningSurface: "multi-step",
    question:
      "Block A has a mass of 120 g and a volume of 40 cm³. Block B has a mass of 48 g and a volume of 60 cm³. Both blocks are dropped into water, whose density is 1.0 g/cm³. Calculate the density of each block, predict which block floats and which sinks, and explain your reasoning step by step.",
  },
  {
    id: "chemistry:intermediate:2",
    subject: "chemistry", band: "intermediate", conceptKey: "gas_laws", topic: "Gas laws & absolute temperature", topicSlug: "states_intermolecular",
    targetConcept: "pressure–temperature proportionality requires kelvin",
    reasoningSurface: "trap",
    trap: "Doubling the Celsius reading is not doubling the absolute temperature — the gas law needs kelvin (298 K → 323 K), so the pressure rises only modestly.",
    question:
      "A rigid, sealed container holds a gas at 25 °C and 100 kPa. A student predicts that heating it to 50 °C will double the pressure to 200 kPa, 'because the temperature doubled.' Calculate the actual final pressure (the volume is constant and no gas escapes), and explain exactly where the student's reasoning goes wrong.",
  },
  {
    id: "chemistry:advanced:2",
    subject: "chemistry", band: "advanced", conceptKey: "thermodynamics_chem", topic: "Gibbs free energy & spontaneity", topicSlug: "thermochemistry",
    targetConcept: "entropy-driven spontaneity via ΔG = ΔH − TΔS",
    reasoningSurface: "multi-step",
    question:
      "For the melting of ice, ΔH = +6.0 kJ/mol and ΔS = +22.0 J/(mol·K); assume both values are independent of temperature. Using ΔG = ΔH − T·ΔS, find the temperature in kelvin above which melting becomes spontaneous, and explain in words how a process that absorbs heat (ΔH > 0) can still happen on its own. Watch the units of ΔH and ΔS.",
  },
  {
    id: "chemistry:phd:1",
    subject: "chemistry", band: "phd", conceptKey: "addition_reactions", topic: "Kinetic vs thermodynamic control", topicSlug: "organic",
    targetConcept: "kinetic vs thermodynamic control of product distribution",
    reasoningSurface: "branch",
    question:
      "1,3-butadiene reacts with one equivalent of HBr. At −80 °C the major product is the 1,2-adduct, 3-bromo-1-butene; at 40 °C the major product is the 1,4-adduct, 1-bromo-2-butene; and simply warming the −80 °C product mixture to 40 °C converts it largely into the 1,4-adduct. Both products form from the same resonance-stabilized allylic carbocation. Construct an energy-profile argument that explains all three observations, addressing why the faster-forming product is not the more stable one and what role reversibility plays at the higher temperature.",
  },
  {
    id: "chemistry:phd:2",
    subject: "chemistry", band: "phd", conceptKey: "chemical_equilibrium", topic: "Le Chatelier & inert gases", topicSlug: "equilibrium",
    targetConcept: "inert-gas addition analyzed through the reaction quotient",
    reasoningSurface: "trap",
    trap: "Applying 'pressure favors fewer moles' to TOTAL pressure — at constant volume the partial pressures (and Q) are unchanged, and at constant total pressure dilution actually shifts the equilibrium toward MORE moles of gas.",
    question:
      "For the equilibrium N₂(g) + 3 H₂(g) ⇌ 2 NH₃(g), a colleague argues: 'Injecting argon raises the total pressure, and higher pressure shifts an equilibrium toward the side with fewer moles of gas, so adding argon must increase the ammonia yield.' Evaluate this claim rigorously for TWO separate cases — argon added at constant volume and temperature, and argon added at constant total pressure and temperature — by reasoning about the reaction quotient written in partial pressures. State in which case, if either, the colleague is correct, and explain why an intuitive reading of Le Chatelier's principle fails here.",
  },
];
