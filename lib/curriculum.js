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
