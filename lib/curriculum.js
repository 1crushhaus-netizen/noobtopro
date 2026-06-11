// ---------------------------------------------------------------------------
// CURRICULUM — the fixed concept database for the five ranks.
//
// PROVENANCE / COPYRIGHT: the concept *categories* below are standard,
// discipline-defined topics independently arranged into noobtopro's five-rank
// ladder. Their scope-and-sequence is grounded in PUBLIC education standards —
// Common Core State Standards (mathematics) and the Next Generation Science
// Standards / NGSS (chemistry & physics) — plus the standard undergraduate
// sequence at the University tier. Concept names are short factual terms (not
// copyrightable expression), the arrangement is our own, and NO third-party
// lesson text, exercises, or questions are reproduced — so this database carries
// no attribution or license obligation. (Guide text and practice questions are
// generated/authored separately as original content.)
//
// STRUCTURE: CURRICULUM[subject][rank] = ordered array of { key, label, strand }.
//   - `key`    stable slug (used as the concept identity in storage/routing)
//   - `label`  display name
//   - `strand` the standards strand it belongs to (becomes a topic grouping)
// EMPTY RANKS are kept as explicit empty arrays (not omitted) so the gaps are
// visible when this is translated into the rank system:
//   - DOCTORATE is empty for every subject — a WIP tier with no public-curriculum
//     source; the rank exists on paper, but practice stays GREYED OUT until seeded.
// ---------------------------------------------------------------------------

export const RANKS = ["elementary", "middle", "high", "university", "doctorate"];

export const RANK_LABELS = {
  elementary: "Elementary",
  middle: "Middle",
  high: "High",
  university: "University",
  doctorate: "Doctorate",
};

// Ranks with no concepts yet — UI greys out practice and explains why.
export const WIP_RANKS_NOTE =
  "Doctorate-level content is in development. You've reached the top of the current curriculum — practice for this rank is coming soon.";

export const CURRICULUM = {
  // =========================================================================
  // MATHEMATICS — Common Core (K–5 / 6–8 / High School) + standard undergraduate math
  // =========================================================================
  math: {
    elementary: [
      { key: "counting_cardinality", label: "Counting & cardinality", strand: "Number & operations" },
      { key: "place_value_base_ten", label: "Place value & the base-ten system", strand: "Number & operations" },
      { key: "addition_subtraction", label: "Addition & subtraction", strand: "Number & operations" },
      { key: "multiplication_division", label: "Multiplication & division", strand: "Number & operations" },
      { key: "properties_of_operations", label: "Properties of operations", strand: "Number & operations" },
      { key: "factors_multiples", label: "Factors & multiples", strand: "Number & operations" },
      { key: "fractions_meaning_equivalence", label: "Fractions: meaning & equivalence", strand: "Fractions" },
      { key: "comparing_fractions", label: "Comparing & ordering fractions", strand: "Fractions" },
      { key: "fraction_add_subtract", label: "Adding & subtracting fractions", strand: "Fractions" },
      { key: "fraction_multiply", label: "Multiplying fractions", strand: "Fractions" },
      { key: "decimals_place_value", label: "Decimals & decimal place value", strand: "Fractions" },
      { key: "rounding_estimation", label: "Rounding & estimation", strand: "Number & operations" },
      { key: "measurement_units", label: "Measurement (length, mass, volume, time)", strand: "Measurement & data" },
      { key: "money", label: "Money", strand: "Measurement & data" },
      { key: "data_line_plots", label: "Representing & interpreting data", strand: "Measurement & data" },
      { key: "area_perimeter", label: "Area & perimeter", strand: "Measurement & data" },
      { key: "volume_intro", label: "Volume", strand: "Measurement & data" },
      { key: "shapes_2d_3d", label: "2D & 3D shapes", strand: "Geometry" },
      { key: "lines_angles_symmetry", label: "Lines, angles & symmetry", strand: "Geometry" },
      { key: "coordinate_plane_intro", label: "The coordinate plane (intro)", strand: "Geometry" },
      { key: "patterns_relationships", label: "Patterns & relationships", strand: "Algebraic thinking" },
    ],
    middle: [
      { key: "ratios_unit_rates", label: "Ratios & unit rates", strand: "Ratios & proportional relationships" },
      { key: "proportional_relationships", label: "Proportional relationships", strand: "Ratios & proportional relationships" },
      { key: "percentages", label: "Percentages", strand: "Ratios & proportional relationships" },
      { key: "rational_number_operations", label: "Operations with rational numbers", strand: "The number system" },
      { key: "negative_numbers", label: "Negative numbers & the number line", strand: "The number system" },
      { key: "absolute_value", label: "Absolute value", strand: "The number system" },
      { key: "exponents", label: "Exponents", strand: "Expressions & equations" },
      { key: "scientific_notation", label: "Scientific notation", strand: "Expressions & equations" },
      { key: "irrational_numbers_intro", label: "Irrational numbers (intro)", strand: "The number system" },
      { key: "algebraic_expressions", label: "Algebraic expressions", strand: "Expressions & equations" },
      { key: "one_variable_equations", label: "One-variable equations & inequalities", strand: "Expressions & equations" },
      { key: "linear_equations_two_var", label: "Linear equations in two variables", strand: "Expressions & equations" },
      { key: "systems_linear_intro", label: "Systems of linear equations", strand: "Expressions & equations" },
      { key: "functions_intro", label: "Functions (intro)", strand: "Functions" },
      { key: "slope_rate_of_change", label: "Slope & rate of change", strand: "Functions" },
      { key: "angle_relationships", label: "Angle relationships", strand: "Geometry" },
      { key: "area_surface_volume", label: "Area, surface area & volume", strand: "Geometry" },
      { key: "scale_similarity", label: "Scale drawings & similarity", strand: "Geometry" },
      { key: "pythagorean_theorem", label: "The Pythagorean theorem", strand: "Geometry" },
      { key: "transformations_congruence", label: "Transformations & congruence", strand: "Geometry" },
      { key: "statistical_distributions", label: "Statistical distributions", strand: "Statistics & probability" },
      { key: "center_variability", label: "Measures of center & variability", strand: "Statistics & probability" },
      { key: "probability_intro", label: "Probability (intro)", strand: "Statistics & probability" },
    ],
    high: [
      { key: "quantities_units", label: "Quantities & units", strand: "Number & quantity" },
      { key: "real_complex_numbers", label: "The real & complex number systems", strand: "Number & quantity" },
      { key: "polynomial_arithmetic", label: "Polynomial arithmetic", strand: "Algebra" },
      { key: "factoring_identities", label: "Factoring & polynomial identities", strand: "Algebra" },
      { key: "quadratics", label: "Quadratic functions & equations", strand: "Algebra" },
      { key: "rational_expressions", label: "Rational expressions & equations", strand: "Algebra" },
      { key: "radical_expressions", label: "Radical expressions & equations", strand: "Algebra" },
      { key: "exponential_functions", label: "Exponential functions", strand: "Functions" },
      { key: "logarithms", label: "Logarithms & logarithmic functions", strand: "Functions" },
      { key: "sequences_series_hs", label: "Sequences & series", strand: "Functions" },
      { key: "function_transformations", label: "Function notation & transformations", strand: "Functions" },
      { key: "inverse_functions", label: "Inverse functions", strand: "Functions" },
      { key: "systems_equations_inequalities", label: "Systems of equations & inequalities", strand: "Algebra" },
      { key: "right_triangle_trig", label: "Right-triangle trigonometry", strand: "Trigonometry" },
      { key: "unit_circle_trig", label: "The unit circle & trigonometric functions", strand: "Trigonometry" },
      { key: "trig_identities", label: "Trigonometric identities & equations", strand: "Trigonometry" },
      { key: "trig_graphs", label: "Graphs of trigonometric functions", strand: "Trigonometry" },
      { key: "congruence_proof", label: "Congruence & geometric proof", strand: "Geometry" },
      { key: "similarity_transformations", label: "Similarity & transformations", strand: "Geometry" },
      { key: "circles", label: "Circles & their properties", strand: "Geometry" },
      { key: "conic_sections", label: "Conic sections", strand: "Geometry" },
      { key: "analytic_geometry", label: "Coordinate (analytic) geometry", strand: "Geometry" },
      { key: "solid_geometry", label: "Three-dimensional geometry & measurement", strand: "Geometry" },
      { key: "vectors_intro", label: "Vectors (intro)", strand: "Number & quantity" },
      { key: "matrices_intro", label: "Matrices (intro)", strand: "Number & quantity" },
      { key: "probability_combinatorics", label: "Probability rules & combinatorics", strand: "Statistics & probability" },
      { key: "conditional_probability", label: "Conditional probability", strand: "Statistics & probability" },
      { key: "sampling_design", label: "Sampling & experimental design", strand: "Statistics & probability" },
      { key: "descriptive_statistics", label: "Descriptive statistics & distributions", strand: "Statistics & probability" },
      { key: "inference_regression_intro", label: "Inference & regression (intro)", strand: "Statistics & probability" },
      { key: "limits_intro", label: "Limits (intro to calculus)", strand: "Calculus readiness" },
    ],
    university: [
      { key: "limits_continuity", label: "Limits & continuity", strand: "Single-variable calculus" },
      { key: "derivatives", label: "Derivatives & differentiation rules", strand: "Single-variable calculus" },
      { key: "applications_derivatives", label: "Applications of derivatives", strand: "Single-variable calculus" },
      { key: "integrals_ftc", label: "Integrals & the fundamental theorem of calculus", strand: "Single-variable calculus" },
      { key: "integration_techniques", label: "Techniques of integration", strand: "Single-variable calculus" },
      { key: "applications_integration", label: "Applications of integration", strand: "Single-variable calculus" },
      { key: "sequences_series", label: "Infinite sequences & series", strand: "Single-variable calculus" },
      { key: "power_taylor_series", label: "Power & Taylor series", strand: "Single-variable calculus" },
      { key: "parametric_polar_calc", label: "Parametric & polar calculus", strand: "Single-variable calculus" },
      { key: "partial_derivatives", label: "Multivariable functions & partial derivatives", strand: "Multivariable calculus" },
      { key: "gradients", label: "Gradients & directional derivatives", strand: "Multivariable calculus" },
      { key: "multiple_integrals", label: "Multiple integrals", strand: "Multivariable calculus" },
      { key: "vector_calculus", label: "Vector calculus (Green's, Stokes', divergence)", strand: "Multivariable calculus" },
      { key: "vector_spaces", label: "Vectors & vector spaces", strand: "Linear algebra" },
      { key: "linear_transformations", label: "Linear transformations & matrices", strand: "Linear algebra" },
      { key: "determinants", label: "Determinants", strand: "Linear algebra" },
      { key: "eigenvalues", label: "Eigenvalues & eigenvectors", strand: "Linear algebra" },
      { key: "orthogonality", label: "Inner product spaces & orthogonality", strand: "Linear algebra" },
      { key: "first_order_odes", label: "First-order differential equations", strand: "Differential equations" },
      { key: "linear_odes", label: "Higher-order & linear differential equations", strand: "Differential equations" },
      { key: "systems_odes", label: "Systems of differential equations", strand: "Differential equations" },
      { key: "laplace_transforms", label: "Laplace transforms", strand: "Differential equations" },
      { key: "probability_theory", label: "Probability theory", strand: "Probability & statistics" },
      { key: "random_variables", label: "Random variables & distributions", strand: "Probability & statistics" },
      { key: "statistical_inference", label: "Statistical inference & estimation", strand: "Probability & statistics" },
    ],
    // DOCTORATE — WIP (no public-curriculum source). Practice greyed out (see WIP_RANKS_NOTE).
    doctorate: [],
  },

  // =========================================================================
  // PHYSICS — NGSS Physical Science (K–5 / MS / HS) + standard college physics
  // =========================================================================
  physics: {
    elementary: [
      { key: "properties_of_materials", label: "Properties of materials", strand: "Matter" },
      { key: "states_of_matter_intro", label: "States of matter (solid, liquid, gas)", strand: "Matter" },
      { key: "pushes_pulls", label: "Forces: pushes & pulls", strand: "Forces & motion" },
      { key: "motion_position", label: "Motion & position", strand: "Forces & motion" },
      { key: "gravity_intro", label: "Gravity (objects fall down)", strand: "Forces & motion" },
      { key: "energy_intro", label: "Energy (motion, heat, light, sound)", strand: "Energy" },
      { key: "light_shadows", label: "Light & shadows", strand: "Waves" },
      { key: "sound_vibration", label: "Sound & vibration", strand: "Waves" },
      { key: "magnets_intro", label: "Magnets & magnetic force", strand: "Forces & motion" },
      { key: "heat_temperature_intro", label: "Heat & temperature (intro)", strand: "Energy" },
    ],
    middle: [
      { key: "speed_velocity_acceleration", label: "Speed, velocity & acceleration", strand: "Motion & forces" },
      { key: "newtons_laws_intro", label: "Forces & Newton's laws (intro)", strand: "Motion & forces" },
      { key: "gravity_weight", label: "Gravity & weight", strand: "Motion & forces" },
      { key: "balanced_unbalanced_forces", label: "Balanced & unbalanced forces", strand: "Motion & forces" },
      { key: "kinetic_potential_energy", label: "Kinetic & potential energy", strand: "Energy" },
      { key: "energy_transfer", label: "Energy transfer & conservation", strand: "Energy" },
      { key: "thermal_energy_transfer", label: "Thermal energy & heat transfer", strand: "Energy" },
      { key: "wave_properties", label: "Wave properties (amplitude, wavelength, frequency)", strand: "Waves" },
      { key: "sound_waves", label: "Sound waves", strand: "Waves" },
      { key: "em_spectrum_intro", label: "Light & the electromagnetic spectrum (intro)", strand: "Waves" },
      { key: "electricity_intro", label: "Electricity & simple circuits (intro)", strand: "Electricity & magnetism" },
      { key: "magnetism_intro", label: "Magnetism & electromagnetism (intro)", strand: "Electricity & magnetism" },
      { key: "simple_machines", label: "Simple machines", strand: "Motion & forces" },
    ],
    high: [
      { key: "kinematics", label: "Kinematics (1D & 2D motion, projectiles)", strand: "Mechanics" },
      { key: "newtons_laws", label: "Newton's laws of motion", strand: "Mechanics" },
      { key: "forces_fbd", label: "Forces & free-body diagrams", strand: "Mechanics" },
      { key: "friction", label: "Friction", strand: "Mechanics" },
      { key: "work_energy_power", label: "Work, energy & power", strand: "Mechanics" },
      { key: "conservation_energy", label: "Conservation of energy", strand: "Mechanics" },
      { key: "momentum_impulse", label: "Momentum & impulse", strand: "Mechanics" },
      { key: "collisions", label: "Collisions", strand: "Mechanics" },
      { key: "circular_motion", label: "Uniform circular motion", strand: "Mechanics" },
      { key: "universal_gravitation", label: "Universal gravitation", strand: "Mechanics" },
      { key: "simple_harmonic_motion", label: "Simple harmonic motion", strand: "Waves & oscillations" },
      { key: "mechanical_waves_sound", label: "Mechanical waves & sound", strand: "Waves & oscillations" },
      { key: "em_waves", label: "Electromagnetic waves", strand: "Waves & oscillations" },
      { key: "geometric_optics", label: "Geometric optics (reflection & refraction)", strand: "Waves & oscillations" },
      { key: "electric_charge_fields", label: "Electric charge & electric fields", strand: "Electricity & magnetism" },
      { key: "electric_potential_current", label: "Electric potential & current", strand: "Electricity & magnetism" },
      { key: "dc_circuits", label: "DC circuits (Ohm's law, series & parallel)", strand: "Electricity & magnetism" },
      { key: "magnetism_induction", label: "Magnetism & electromagnetic induction", strand: "Electricity & magnetism" },
      { key: "thermodynamics_intro", label: "Thermodynamics (intro)", strand: "Thermodynamics" },
    ],
    university: [
      { key: "vectors_kinematics_calc", label: "Vectors & kinematics (calculus-based)", strand: "Classical mechanics" },
      { key: "newtonian_dynamics", label: "Newtonian dynamics", strand: "Classical mechanics" },
      { key: "rotational_motion_torque", label: "Rotational motion & torque", strand: "Classical mechanics" },
      { key: "angular_momentum", label: "Angular momentum", strand: "Classical mechanics" },
      { key: "statics_equilibrium", label: "Statics & equilibrium", strand: "Classical mechanics" },
      { key: "fluid_mechanics", label: "Fluid mechanics", strand: "Classical mechanics" },
      { key: "oscillations_waves_adv", label: "Oscillations & waves (advanced)", strand: "Waves & thermodynamics" },
      { key: "thermodynamics_kinetic", label: "Thermodynamics & kinetic theory", strand: "Waves & thermodynamics" },
      { key: "statistical_mechanics_intro", label: "Statistical mechanics (intro)", strand: "Waves & thermodynamics" },
      { key: "electrostatics_gauss", label: "Electrostatics & Gauss's law", strand: "Electromagnetism" },
      { key: "potential_capacitance", label: "Electric potential & capacitance", strand: "Electromagnetism" },
      { key: "current_resistance_circuits", label: "Current, resistance & DC circuits", strand: "Electromagnetism" },
      { key: "magnetic_fields_forces", label: "Magnetic fields & forces", strand: "Electromagnetism" },
      { key: "induction_maxwell", label: "Electromagnetic induction & Maxwell's equations", strand: "Electromagnetism" },
      { key: "ac_circuits", label: "AC circuits", strand: "Electromagnetism" },
      { key: "physical_optics", label: "Physical optics (interference & diffraction)", strand: "Modern physics" },
      { key: "special_relativity", label: "Special relativity", strand: "Modern physics" },
      { key: "quantum_mechanics_intro", label: "Quantum mechanics (intro)", strand: "Modern physics" },
      { key: "atomic_nuclear_physics", label: "Atomic & nuclear physics", strand: "Modern physics" },
      { key: "particle_physics_intro", label: "Particle physics (intro)", strand: "Modern physics" },
    ],
    // DOCTORATE — WIP (no public-curriculum source). Practice greyed out.
    doctorate: [],
  },

  // =========================================================================
  // CHEMISTRY — NGSS Matter & its interactions (K–5 / MS / HS) + standard college chemistry
  // =========================================================================
  chemistry: {
    elementary: [
      { key: "material_properties", label: "Properties of materials", strand: "Matter" },
      { key: "classifying_materials", label: "Classifying materials by their properties", strand: "Matter" },
      { key: "states_of_matter_elem", label: "States of matter (solid, liquid, gas)", strand: "Matter" },
      { key: "changes_of_state", label: "Changes of state (melting, freezing, evaporation)", strand: "Changes in matter" },
      { key: "heating_cooling_matter", label: "Effects of heating & cooling on matter", strand: "Changes in matter" },
      { key: "mixing_materials", label: "Mixtures & combining materials", strand: "Matter" },
      { key: "reversible_irreversible", label: "Reversible & irreversible changes", strand: "Changes in matter" },
      { key: "particles_intro", label: "Matter is made of tiny particles (intro)", strand: "Matter" },
      { key: "conservation_matter_intro", label: "Conservation of matter (intro)", strand: "Changes in matter" },
    ],
    middle: [
      { key: "atoms_molecules", label: "Atoms & molecules", strand: "Structure of matter" },
      { key: "elements_compounds", label: "Elements & compounds", strand: "Structure of matter" },
      { key: "particle_model", label: "The particle model of matter", strand: "Structure of matter" },
      { key: "phase_changes_particle", label: "States of matter & phase changes (particle view)", strand: "Structure of matter" },
      { key: "physical_chemical_changes", label: "Physical vs. chemical changes", strand: "Chemical reactions" },
      { key: "chemical_reactions_intro", label: "Chemical reactions (intro)", strand: "Chemical reactions" },
      { key: "conservation_mass", label: "Conservation of mass", strand: "Chemical reactions" },
      { key: "properties_density", label: "Properties of matter (density, etc.)", strand: "Structure of matter" },
      { key: "mixtures_solutions_separation", label: "Mixtures, solutions & separation", strand: "Structure of matter" },
      { key: "periodic_table_intro", label: "The periodic table (intro)", strand: "Structure of matter" },
      { key: "synthetic_materials", label: "Synthetic materials (intro)", strand: "Chemical reactions" },
    ],
    high: [
      { key: "atomic_structure", label: "Atomic structure", strand: "Atomic structure & periodicity" },
      { key: "isotopes_atomic_mass", label: "Isotopes & atomic mass", strand: "Atomic structure & periodicity" },
      { key: "electron_config_intro", label: "Electron configuration (intro)", strand: "Atomic structure & periodicity" },
      { key: "periodic_trends", label: "The periodic table & periodic trends", strand: "Atomic structure & periodicity" },
      { key: "ionic_bonding", label: "Ionic bonding", strand: "Bonding" },
      { key: "covalent_bonding", label: "Covalent bonding", strand: "Bonding" },
      { key: "metallic_bonding", label: "Metallic bonding", strand: "Bonding" },
      { key: "naming_formulas", label: "Naming compounds & writing formulas", strand: "Bonding" },
      { key: "balancing_equations", label: "Chemical equations & balancing", strand: "Reactions & stoichiometry" },
      { key: "mole_molar_mass", label: "The mole & molar mass", strand: "Reactions & stoichiometry" },
      { key: "stoichiometry", label: "Stoichiometry", strand: "Reactions & stoichiometry" },
      { key: "reaction_types", label: "Types of chemical reactions", strand: "Reactions & stoichiometry" },
      { key: "gas_laws", label: "States of matter & gas laws", strand: "States & solutions" },
      { key: "solutions_concentration", label: "Solutions & concentration", strand: "States & solutions" },
      { key: "acids_bases_intro", label: "Acids & bases (intro)", strand: "States & solutions" },
      { key: "thermochemistry_intro", label: "Thermochemistry (intro)", strand: "Energy & rates" },
      { key: "reaction_rates_intro", label: "Reaction rates (intro)", strand: "Energy & rates" },
      { key: "nuclear_chemistry_intro", label: "Nuclear chemistry (intro)", strand: "Energy & rates" },
    ],
    university: [
      { key: "quantum_atomic_models", label: "Quantum theory & atomic models", strand: "Atomic & molecular structure" },
      { key: "electron_config_quantum", label: "Electron configuration & quantum numbers", strand: "Atomic & molecular structure" },
      { key: "periodic_trends_adv", label: "Periodic trends (advanced)", strand: "Atomic & molecular structure" },
      { key: "lewis_vsepr", label: "Lewis structures & molecular geometry (VSEPR)", strand: "Atomic & molecular structure" },
      { key: "hybridization_mo", label: "Hybridization & molecular orbital theory", strand: "Atomic & molecular structure" },
      { key: "intermolecular_forces", label: "Intermolecular forces", strand: "Atomic & molecular structure" },
      { key: "stoichiometry_adv", label: "Advanced stoichiometry & limiting reagents", strand: "Reactions & thermodynamics" },
      { key: "gas_laws_kmt", label: "Gas laws & kinetic molecular theory", strand: "Reactions & thermodynamics" },
      { key: "thermodynamics_chem", label: "Thermodynamics (enthalpy, entropy, Gibbs free energy)", strand: "Reactions & thermodynamics" },
      { key: "chemical_kinetics", label: "Chemical kinetics", strand: "Reactions & thermodynamics" },
      { key: "chemical_equilibrium", label: "Chemical equilibrium", strand: "Equilibrium" },
      { key: "acid_base_equilibria", label: "Acid–base equilibria & buffers", strand: "Equilibrium" },
      { key: "solubility_equilibria", label: "Solubility & precipitation equilibria", strand: "Equilibrium" },
      { key: "electrochemistry", label: "Electrochemistry & redox", strand: "Equilibrium" },
      { key: "coordination_chemistry", label: "Coordination chemistry", strand: "Inorganic & nuclear" },
      { key: "nuclear_chemistry_adv", label: "Nuclear chemistry (advanced)", strand: "Inorganic & nuclear" },
      { key: "organic_structure_nomenclature", label: "Organic structure, bonding & nomenclature", strand: "Organic chemistry" },
      { key: "stereochemistry", label: "Stereochemistry", strand: "Organic chemistry" },
      { key: "substitution_elimination", label: "Substitution & elimination reactions", strand: "Organic chemistry" },
      { key: "addition_reactions", label: "Addition reactions (alkenes & alkynes)", strand: "Organic chemistry" },
      { key: "aromatic_chemistry", label: "Aromatic chemistry", strand: "Organic chemistry" },
      { key: "carbonyl_chemistry", label: "Carbonyl chemistry", strand: "Organic chemistry" },
      { key: "spectroscopy", label: "Spectroscopy (IR, NMR, MS)", strand: "Organic chemistry" },
      { key: "biochemistry_intro", label: "Biochemistry (intro)", strand: "Organic chemistry" },
    ],
    // DOCTORATE — WIP (no public-curriculum source). Practice greyed out.
    doctorate: [],
  },
};

// --- helpers ---------------------------------------------------------------

// Concepts for a (subject, rank); [] for an empty/WIP rank.
export function conceptsFor(subject, rank) {
  const s = CURRICULUM[subject];
  return (s && s[rank]) || [];
}

// True when a rank has no concepts yet (UI greys out practice + shows WIP_RANKS_NOTE).
export function isRankWip(subject, rank) {
  return conceptsFor(subject, rank).length === 0;
}

// Flat list of every concept tagged with its subject + rank (for seeding / queries).
export function allConcepts() {
  const out = [];
  for (const subject of Object.keys(CURRICULUM)) {
    for (const rank of RANKS) {
      for (const c of conceptsFor(subject, rank)) out.push({ subject, rank, ...c });
    }
  }
  return out;
}

// Count grid — quick visibility into which (subject, rank) cells are populated vs blank.
export function coverageGrid() {
  const grid = {};
  for (const subject of Object.keys(CURRICULUM)) {
    grid[subject] = {};
    for (const rank of RANKS) grid[subject][rank] = conceptsFor(subject, rank).length;
  }
  return grid;
}

// ---------------------------------------------------------------------------
// PREREQUISITE GRAPH — each concept's "root concepts": its direct, most-relevant
// foundational prerequisites that live in a STRICTLY LOWER rank of the SAME subject.
// Edges point only downward in rank, so the graph is acyclic by construction. This
// powers the concept page's root-concept navigation and the "study the foundations
// first" nudge on red (struggling) concepts. Elementary concepts have no roots.
// (Cross-subject prerequisites — e.g. calculus-based physics -> math — are a future
// enhancement; v1 keeps roots within a single subject.)
// ---------------------------------------------------------------------------
export const PREREQUISITES = {
  math: {
    "counting_cardinality": [],
    "place_value_base_ten": [],
    "addition_subtraction": [],
    "multiplication_division": [],
    "properties_of_operations": [],
    "factors_multiples": [],
    "fractions_meaning_equivalence": [],
    "comparing_fractions": [],
    "fraction_add_subtract": [],
    "fraction_multiply": [],
    "decimals_place_value": [],
    "rounding_estimation": [],
    "measurement_units": [],
    "money": [],
    "data_line_plots": [],
    "area_perimeter": [],
    "volume_intro": [],
    "shapes_2d_3d": [],
    "lines_angles_symmetry": [],
    "coordinate_plane_intro": [],
    "patterns_relationships": [],
    "ratios_unit_rates": ["multiplication_division", "fractions_meaning_equivalence", "decimals_place_value"],
    "proportional_relationships": ["multiplication_division", "fractions_meaning_equivalence"],
    "percentages": ["fractions_meaning_equivalence", "decimals_place_value"],
    "rational_number_operations": ["fraction_add_subtract", "fraction_multiply", "decimals_place_value", "properties_of_operations"],
    "negative_numbers": ["addition_subtraction", "coordinate_plane_intro", "comparing_fractions"],
    "absolute_value": ["coordinate_plane_intro"],
    "exponents": ["multiplication_division", "properties_of_operations", "factors_multiples"],
    "scientific_notation": ["decimals_place_value", "place_value_base_ten"],
    "irrational_numbers_intro": ["decimals_place_value", "comparing_fractions"],
    "algebraic_expressions": ["properties_of_operations", "patterns_relationships"],
    "one_variable_equations": ["properties_of_operations"],
    "linear_equations_two_var": ["coordinate_plane_intro", "patterns_relationships"],
    "systems_linear_intro": [],
    "functions_intro": ["patterns_relationships", "coordinate_plane_intro"],
    "slope_rate_of_change": ["coordinate_plane_intro"],
    "angle_relationships": ["lines_angles_symmetry", "shapes_2d_3d"],
    "area_surface_volume": ["area_perimeter", "volume_intro", "shapes_2d_3d"],
    "scale_similarity": ["shapes_2d_3d"],
    "pythagorean_theorem": ["area_perimeter", "shapes_2d_3d"],
    "transformations_congruence": ["shapes_2d_3d", "coordinate_plane_intro", "lines_angles_symmetry"],
    "statistical_distributions": ["data_line_plots"],
    "center_variability": ["data_line_plots", "addition_subtraction"],
    "probability_intro": ["fractions_meaning_equivalence", "data_line_plots"],
    "quantities_units": ["measurement_units", "ratios_unit_rates", "rounding_estimation"],
    "real_complex_numbers": ["irrational_numbers_intro", "rational_number_operations", "negative_numbers"],
    "polynomial_arithmetic": ["algebraic_expressions", "exponents", "properties_of_operations"],
    "factoring_identities": ["algebraic_expressions", "factors_multiples", "exponents"],
    "quadratics": ["algebraic_expressions", "functions_intro", "exponents"],
    "rational_expressions": ["algebraic_expressions", "rational_number_operations", "exponents"],
    "radical_expressions": ["exponents", "irrational_numbers_intro", "pythagorean_theorem"],
    "exponential_functions": ["exponents", "functions_intro", "proportional_relationships"],
    "logarithms": ["exponents", "functions_intro", "scientific_notation"],
    "sequences_series_hs": ["patterns_relationships", "functions_intro", "exponents"],
    "function_transformations": ["functions_intro", "coordinate_plane_intro", "transformations_congruence"],
    "inverse_functions": ["functions_intro", "algebraic_expressions"],
    "systems_equations_inequalities": ["systems_linear_intro", "one_variable_equations", "linear_equations_two_var"],
    "right_triangle_trig": ["pythagorean_theorem", "scale_similarity", "ratios_unit_rates"],
    "unit_circle_trig": ["coordinate_plane_intro", "angle_relationships", "pythagorean_theorem"],
    "trig_identities": ["pythagorean_theorem", "angle_relationships", "ratios_unit_rates"],
    "trig_graphs": ["functions_intro", "angle_relationships", "coordinate_plane_intro"],
    "congruence_proof": ["transformations_congruence", "angle_relationships", "lines_angles_symmetry"],
    "similarity_transformations": ["scale_similarity", "transformations_congruence", "proportional_relationships"],
    "circles": ["angle_relationships", "area_surface_volume", "coordinate_plane_intro"],
    "conic_sections": ["coordinate_plane_intro", "pythagorean_theorem", "algebraic_expressions"],
    "analytic_geometry": ["coordinate_plane_intro", "slope_rate_of_change", "pythagorean_theorem"],
    "solid_geometry": ["area_surface_volume", "shapes_2d_3d", "pythagorean_theorem"],
    "vectors_intro": ["coordinate_plane_intro", "pythagorean_theorem", "slope_rate_of_change"],
    "matrices_intro": ["systems_linear_intro", "algebraic_expressions"],
    "probability_combinatorics": ["probability_intro", "multiplication_division", "factors_multiples"],
    "conditional_probability": ["probability_intro", "fractions_meaning_equivalence"],
    "sampling_design": ["statistical_distributions", "center_variability", "probability_intro"],
    "descriptive_statistics": ["center_variability", "statistical_distributions", "data_line_plots"],
    "inference_regression_intro": ["slope_rate_of_change", "probability_intro"],
    "limits_intro": ["functions_intro", "slope_rate_of_change", "rational_number_operations"],
    "limits_continuity": ["limits_intro", "function_transformations", "rational_expressions"],
    "derivatives": ["slope_rate_of_change", "function_transformations"],
    "applications_derivatives": ["analytic_geometry", "quadratics"],
    "integrals_ftc": ["area_surface_volume"],
    "integration_techniques": ["trig_identities", "rational_expressions"],
    "applications_integration": ["solid_geometry", "analytic_geometry"],
    "sequences_series": ["sequences_series_hs", "functions_intro"],
    "power_taylor_series": ["function_transformations"],
    "parametric_polar_calc": ["trig_graphs", "analytic_geometry"],
    "partial_derivatives": ["function_transformations", "analytic_geometry"],
    "gradients": ["vectors_intro"],
    "multiple_integrals": ["solid_geometry"],
    "vector_calculus": ["vectors_intro"],
    "vector_spaces": ["vectors_intro", "systems_equations_inequalities", "real_complex_numbers"],
    "linear_transformations": ["matrices_intro", "vectors_intro", "function_transformations"],
    "determinants": ["matrices_intro", "systems_equations_inequalities"],
    "eigenvalues": ["matrices_intro", "factoring_identities", "systems_equations_inequalities"],
    "orthogonality": ["vectors_intro", "right_triangle_trig", "pythagorean_theorem"],
    "first_order_odes": ["functions_intro"],
    "linear_odes": ["quadratics"],
    "systems_odes": ["systems_equations_inequalities", "matrices_intro"],
    "laplace_transforms": ["exponential_functions"],
    "probability_theory": ["probability_combinatorics", "conditional_probability"],
    "random_variables": ["probability_combinatorics", "descriptive_statistics"],
    "statistical_inference": ["inference_regression_intro", "descriptive_statistics", "sampling_design"],
  },
  physics: {
    "properties_of_materials": [],
    "states_of_matter_intro": [],
    "pushes_pulls": [],
    "motion_position": [],
    "gravity_intro": [],
    "energy_intro": [],
    "light_shadows": [],
    "sound_vibration": [],
    "magnets_intro": [],
    "heat_temperature_intro": [],
    "speed_velocity_acceleration": ["motion_position"],
    "newtons_laws_intro": ["pushes_pulls", "motion_position"],
    "gravity_weight": ["gravity_intro", "pushes_pulls"],
    "balanced_unbalanced_forces": ["pushes_pulls", "motion_position"],
    "kinetic_potential_energy": ["energy_intro", "motion_position"],
    "energy_transfer": ["energy_intro"],
    "thermal_energy_transfer": ["heat_temperature_intro", "energy_intro"],
    "wave_properties": ["sound_vibration", "energy_intro"],
    "sound_waves": ["sound_vibration"],
    "em_spectrum_intro": ["light_shadows", "energy_intro"],
    "electricity_intro": ["energy_intro", "magnets_intro"],
    "magnetism_intro": ["magnets_intro"],
    "simple_machines": ["pushes_pulls", "energy_intro"],
    "kinematics": ["speed_velocity_acceleration", "motion_position"],
    "newtons_laws": ["newtons_laws_intro", "balanced_unbalanced_forces", "speed_velocity_acceleration"],
    "forces_fbd": ["newtons_laws_intro", "balanced_unbalanced_forces"],
    "friction": ["newtons_laws_intro", "balanced_unbalanced_forces"],
    "work_energy_power": ["kinetic_potential_energy", "energy_transfer", "simple_machines"],
    "conservation_energy": ["energy_transfer", "kinetic_potential_energy"],
    "momentum_impulse": ["newtons_laws_intro", "speed_velocity_acceleration"],
    "collisions": ["kinetic_potential_energy"],
    "circular_motion": ["speed_velocity_acceleration", "newtons_laws_intro"],
    "universal_gravitation": ["gravity_weight", "newtons_laws_intro"],
    "simple_harmonic_motion": ["wave_properties", "kinetic_potential_energy"],
    "mechanical_waves_sound": ["wave_properties", "sound_waves"],
    "em_waves": ["em_spectrum_intro", "wave_properties"],
    "geometric_optics": ["em_spectrum_intro", "wave_properties"],
    "electric_charge_fields": ["electricity_intro", "magnetism_intro"],
    "electric_potential_current": ["electricity_intro", "energy_transfer"],
    "dc_circuits": ["electricity_intro"],
    "magnetism_induction": ["magnetism_intro", "electricity_intro"],
    "thermodynamics_intro": ["thermal_energy_transfer", "energy_transfer"],
    "vectors_kinematics_calc": ["kinematics"],
    "newtonian_dynamics": ["newtons_laws", "forces_fbd", "friction", "kinematics"],
    "rotational_motion_torque": ["newtons_laws", "circular_motion", "forces_fbd"],
    "angular_momentum": ["momentum_impulse", "circular_motion"],
    "statics_equilibrium": ["forces_fbd", "newtons_laws"],
    "fluid_mechanics": ["forces_fbd", "conservation_energy"],
    "oscillations_waves_adv": ["simple_harmonic_motion", "mechanical_waves_sound"],
    "thermodynamics_kinetic": ["thermodynamics_intro", "conservation_energy"],
    "statistical_mechanics_intro": ["thermodynamics_intro", "conservation_energy"],
    "electrostatics_gauss": ["electric_charge_fields"],
    "potential_capacitance": ["electric_potential_current", "electric_charge_fields"],
    "current_resistance_circuits": ["dc_circuits", "electric_potential_current"],
    "magnetic_fields_forces": ["magnetism_induction", "electric_charge_fields"],
    "induction_maxwell": ["magnetism_induction", "em_waves", "electric_charge_fields"],
    "ac_circuits": ["dc_circuits", "magnetism_induction"],
    "physical_optics": ["em_waves", "geometric_optics"],
    "special_relativity": ["kinematics", "em_waves"],
    "quantum_mechanics_intro": ["em_waves", "conservation_energy"],
    "atomic_nuclear_physics": ["electric_charge_fields", "conservation_energy"],
    "particle_physics_intro": ["electric_charge_fields", "conservation_energy"],
  },
  chemistry: {
    "material_properties": [],
    "classifying_materials": [],
    "states_of_matter_elem": [],
    "changes_of_state": [],
    "heating_cooling_matter": [],
    "mixing_materials": [],
    "reversible_irreversible": [],
    "particles_intro": [],
    "conservation_matter_intro": [],
    "atoms_molecules": ["particles_intro", "material_properties"],
    "elements_compounds": ["particles_intro", "classifying_materials", "mixing_materials"],
    "particle_model": ["particles_intro", "states_of_matter_elem", "changes_of_state"],
    "phase_changes_particle": ["states_of_matter_elem", "changes_of_state", "heating_cooling_matter", "particles_intro"],
    "physical_chemical_changes": ["reversible_irreversible", "changes_of_state", "mixing_materials"],
    "chemical_reactions_intro": ["reversible_irreversible", "particles_intro", "conservation_matter_intro"],
    "conservation_mass": ["conservation_matter_intro", "particles_intro"],
    "properties_density": ["material_properties", "classifying_materials", "states_of_matter_elem"],
    "mixtures_solutions_separation": ["mixing_materials", "material_properties", "reversible_irreversible"],
    "periodic_table_intro": ["classifying_materials", "particles_intro"],
    "synthetic_materials": ["material_properties", "mixing_materials", "classifying_materials"],
    "atomic_structure": ["atoms_molecules", "particle_model", "periodic_table_intro"],
    "isotopes_atomic_mass": ["atoms_molecules", "conservation_mass"],
    "electron_config_intro": ["atoms_molecules", "periodic_table_intro"],
    "periodic_trends": ["periodic_table_intro", "elements_compounds", "atoms_molecules"],
    "ionic_bonding": ["atoms_molecules", "elements_compounds", "periodic_table_intro"],
    "covalent_bonding": ["atoms_molecules", "elements_compounds", "periodic_table_intro"],
    "metallic_bonding": ["atoms_molecules", "elements_compounds", "properties_density"],
    "naming_formulas": ["elements_compounds", "atoms_molecules", "periodic_table_intro"],
    "balancing_equations": ["chemical_reactions_intro", "conservation_mass", "elements_compounds"],
    "mole_molar_mass": ["atoms_molecules", "conservation_mass", "elements_compounds"],
    "stoichiometry": ["chemical_reactions_intro", "conservation_mass", "atoms_molecules"],
    "reaction_types": ["chemical_reactions_intro", "physical_chemical_changes", "elements_compounds"],
    "gas_laws": ["phase_changes_particle", "particle_model", "properties_density"],
    "solutions_concentration": ["mixtures_solutions_separation", "properties_density", "elements_compounds"],
    "acids_bases_intro": ["mixtures_solutions_separation", "chemical_reactions_intro", "elements_compounds"],
    "thermochemistry_intro": ["chemical_reactions_intro", "heating_cooling_matter", "physical_chemical_changes"],
    "reaction_rates_intro": ["chemical_reactions_intro", "particle_model"],
    "nuclear_chemistry_intro": ["atoms_molecules", "elements_compounds", "periodic_table_intro"],
    "quantum_atomic_models": ["atomic_structure", "electron_config_intro", "isotopes_atomic_mass"],
    "electron_config_quantum": ["electron_config_intro", "atomic_structure", "periodic_trends"],
    "periodic_trends_adv": ["periodic_trends", "electron_config_intro", "atomic_structure"],
    "lewis_vsepr": ["covalent_bonding", "naming_formulas", "electron_config_intro"],
    "hybridization_mo": ["covalent_bonding", "electron_config_intro", "atomic_structure"],
    "intermolecular_forces": ["covalent_bonding", "gas_laws", "periodic_trends"],
    "stoichiometry_adv": ["stoichiometry", "mole_molar_mass", "balancing_equations"],
    "gas_laws_kmt": ["gas_laws", "mole_molar_mass"],
    "thermodynamics_chem": ["thermochemistry_intro", "stoichiometry", "reaction_types"],
    "chemical_kinetics": ["reaction_rates_intro", "stoichiometry", "reaction_types"],
    "chemical_equilibrium": ["reaction_rates_intro", "reaction_types", "stoichiometry"],
    "acid_base_equilibria": ["acids_bases_intro", "solutions_concentration", "mole_molar_mass"],
    "solubility_equilibria": ["solutions_concentration", "reaction_types", "mole_molar_mass"],
    "electrochemistry": ["reaction_types", "balancing_equations", "ionic_bonding"],
    "coordination_chemistry": ["ionic_bonding", "covalent_bonding", "periodic_trends"],
    "nuclear_chemistry_adv": ["nuclear_chemistry_intro", "isotopes_atomic_mass", "atomic_structure"],
    "organic_structure_nomenclature": ["covalent_bonding", "naming_formulas", "atomic_structure"],
    "stereochemistry": ["covalent_bonding", "naming_formulas", "atomic_structure"],
    "substitution_elimination": ["covalent_bonding", "reaction_types", "naming_formulas"],
    "addition_reactions": ["covalent_bonding", "reaction_types", "naming_formulas"],
    "aromatic_chemistry": ["covalent_bonding", "reaction_types", "naming_formulas"],
    "carbonyl_chemistry": ["covalent_bonding", "reaction_types", "naming_formulas"],
    "spectroscopy": ["covalent_bonding", "electron_config_intro", "atomic_structure"],
    "biochemistry_intro": ["covalent_bonding", "reaction_types", "solutions_concentration"],
  },
};

// Root concept KEYS for a (subject, concept). [] for elementary / no recorded roots.
export function prereqKeysFor(subject, conceptKey) {
  const m = PREREQUISITES[subject];
  return (m && m[conceptKey]) || [];
}

// Resolve a concept's roots to full concept objects ({ key, label, strand, rank }),
// for rendering the clickable root-concept buttons on a concept page.
export function rootsFor(subject, conceptKey) {
  const keys = prereqKeysFor(subject, conceptKey);
  if (!keys.length) return [];
  const index = {};
  for (const rank of RANKS) for (const c of conceptsFor(subject, rank)) index[c.key] = { ...c, rank };
  return keys.map((k) => index[k]).filter(Boolean);
}
