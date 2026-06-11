// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — CHEMISTRY · UNIVERSITY.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  quantum_atomic_models: {
    explanation: [
      "Quantum theory replaces the planetary picture of the atom you met in high school with a model built on two experimental facts: energy exchange between light and matter is quantized (E = hν), and electrons show wave behavior. Bohr captured the first fact for hydrogen — electrons sit in discrete energy levels, and a photon is emitted or absorbed only when the electron jumps between them — which is why atomic spectra are sharp lines rather than continuous bands.",
      "The full quantum model goes further: solving the Schrödinger equation gives orbitals, three-dimensional standing waves whose square tells you the probability of finding the electron in each region of space. The working habit to build is energy bookkeeping: every spectral line corresponds to ΔE between two allowed levels, and ΔE = hc/λ converts between energy and wavelength. For hydrogen, Eₙ = −2.18 × 10⁻¹⁸ J/n², with the negative sign meaning the electron is bound.",
      "The classic misconception is to keep imagining the electron circling the nucleus on a track. An orbital is not an orbit — it has no defined path, only a probability cloud with a characteristic shape (spherical s, dumbbell p), and the electron does not spiral or travel between levels; it transitions with no intermediate energies allowed.",
    ],
    example: {
      problem: "A hydrogen atom relaxes from the n = 3 level to the n = 2 level. Using Eₙ = −2.18 × 10⁻¹⁸ J/n², find the energy and wavelength of the emitted photon (h = 6.626 × 10⁻³⁴ J·s, c = 3.00 × 10⁸ m/s), and state which region of the spectrum it falls in.",
      steps: [
        "Evaluate the two levels first: E₃ = −2.18 × 10⁻¹⁸/9 = −2.42 × 10⁻¹⁹ J and E₂ = −2.18 × 10⁻¹⁸/4 = −5.45 × 10⁻¹⁹ J. Both are negative because a bound electron has less energy than a free one.",
        "The atom loses energy in the drop, and that loss becomes the photon: ΔE = E₃ − E₂ = (−2.42 + 5.45) × 10⁻¹⁹ = 3.03 × 10⁻¹⁹ J carried away by the light.",
        "Convert energy to wavelength with E = hc/λ, rearranged to λ = hc/E = (6.626 × 10⁻³⁴ × 3.00 × 10⁸)/(3.03 × 10⁻¹⁹) = 1.99 × 10⁻²⁵/3.03 × 10⁻¹⁹ = 6.56 × 10⁻⁷ m.",
        "Interpret: 656 nm sits in the visible range (400–700 nm), at the red end. That is exactly the behavior expected for a Balmer-series transition (any drop ending at n = 2 lands in or near the visible).",
      ],
      answer: "The photon carries 3.03 × 10⁻¹⁹ J with wavelength about 656 nm — visible red light, the famous red line of hydrogen.",
    },
    selfQuestions: [
      "Why must the emitted photon energies of hydrogen form a discrete set rather than a continuum, and what would the spectrum look like if energy levels were not quantized?",
      "How would you explain to a friend the difference between an orbit and an orbital without using equations?",
      "What happens to the spacing between adjacent energy levels as n grows, and how does that explain where each spectral series converges?",
      "If a photon arrives with slightly less energy than the n = 1 to n = 2 gap, what does the atom do with it — and why?",
    ],
  },
  electron_config_quantum: {
    explanation: [
      "Four quantum numbers act as an address system for every electron in an atom: n sets the shell and overall energy, l the subshell shape (0 = s, 1 = p, 2 = d, 3 = f), ml the orbital orientation, and ms the spin. You already know the broad shell picture from introductory electron configuration; the university-level upgrade is using the Pauli exclusion principle (no two electrons share all four numbers), the aufbau filling order, and Hund's rule (spread out within a degenerate subshell before pairing) to write and defend configurations exactly.",
      "The practical skill is reading configurations off the periodic table itself: the table's block structure is the filling order. Watch the 4s/3d crossover carefully. Neutral atoms fill 4s before 3d, but once 3d is occupied it drops below 4s in energy — so transition metals ionize by losing their 4s electrons first. The common error is stripping d electrons first because d filled last; that produces wrong magnetic predictions for nearly every transition-metal ion.",
      "Configurations are testable, not bookkeeping trivia: the count of unpaired electrons predicts whether a species is paramagnetic (drawn into a magnetic field) or diamagnetic, and measured magnetism is how chemists confirm which electrons actually left.",
    ],
    example: {
      problem: "Write the ground-state electron configuration of Fe (Z = 26) and of Fe³⁺, and determine how many unpaired electrons each species has.",
      steps: [
        "Count electrons into subshells in aufbau order: 26 electrons give 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶, written compactly as [Ar] 4s² 3d⁶ since argon accounts for the first 18.",
        "Apply Hund's rule to the 3d⁶ set: six electrons in five d orbitals means one orbital holds a pair and four stay single — neutral Fe has 4 unpaired electrons.",
        "Form the cation by removing the three highest-energy electrons of the ion, not the last-filled subshell of the atom: both 4s electrons leave first, then one 3d, giving Fe³⁺ = [Ar] 3d⁵.",
        "A 3d⁵ subshell puts one electron in each of the five d orbitals, so Fe³⁺ has 5 unpaired electrons — strongly paramagnetic, which experiment confirms.",
        "Sanity-check: a half-filled d⁵ configuration has extra exchange stability, consistent with Fe³⁺ being one of the most common iron species in minerals and biology.",
      ],
      answer: "Fe is [Ar] 4s² 3d⁶ with 4 unpaired electrons; Fe³⁺ is [Ar] 3d⁵ with 5 unpaired electrons.",
    },
    selfQuestions: [
      "Why do transition metals lose 4s electrons before 3d when they ionize, even though 4s filled first in the neutral atom?",
      "How does Hund's rule follow from electron–electron repulsion and exchange energy rather than being an arbitrary convention?",
      "What experimental measurement would distinguish [Ar] 3d⁵ from [Ar] 4s² 3d³ for a 3+ ion, and what result would each predict?",
      "Where do the exceptions like Cr and Cu come from, and what does that tell you about how close in energy 4s and 3d really are?",
    ],
  },
  periodic_trends_adv: {
    explanation: [
      "Behind every periodic trend sits one master variable: effective nuclear charge, Zeff — the net pull an outer electron feels after inner electrons screen part of the nucleus. Across a period, protons are added while screening barely changes, so Zeff climbs, atoms shrink, and ionization energy and electronegativity rise. Down a group, new shells dominate, so radius grows and ionization energy falls. You already know the directions of these trends; the university skill is explaining magnitudes, exceptions, and ions with the Zeff lens.",
      "Two famous dips test whether you reason rather than memorize: ionization energy drops from Be to B (the new 2p electron sits higher than 2s) and from N to O (the fourth p electron must pair up, and the repulsion within one orbital makes it easier to remove). Isoelectronic series add another layer: when several species carry the same electron count, the electron cloud is identical in size only superficially — the species with more protons pulls the same cloud in tighter.",
      "The misconception to retire is that more electrons always means a bigger particle. Size is a tug-of-war: in an isoelectronic series the electron number is fixed, so radius is decided entirely by nuclear charge, and the cation with the most protons is the smallest of all.",
    ],
    example: {
      problem: "Rank Mg²⁺, Na⁺, F⁻, and O²⁻ from smallest to largest radius, and justify the order using effective nuclear charge.",
      steps: [
        "Check the electron counts: Mg²⁺ has 12 − 2 = 10, Na⁺ has 11 − 1 = 10, F⁻ has 9 + 1 = 10, and O²⁻ has 8 + 2 = 10. All four are isoelectronic with neon, so shell structure cannot distinguish them.",
        "With identical electron clouds, the deciding factor is how many protons pull on those 10 electrons: Mg has 12, Na has 11, F has 9, O has 8.",
        "More protons per electron means higher Zeff and a tighter, smaller sphere, so size increases as nuclear charge decreases: Mg²⁺ < Na⁺ < F⁻ < O²⁻.",
        "Sanity-check the extremes: O²⁻ asks only 8 protons to hold 10 mutually repelling electrons, so it swells dramatically, while Mg²⁺ binds the same 10 with 12 protons and contracts — the physical picture matches the ranking.",
      ],
      answer: "Mg²⁺ < Na⁺ < F⁻ < O²⁻; in an isoelectronic series the radius is set entirely by nuclear charge, so the most protons gives the smallest ion.",
    },
    selfQuestions: [
      "Why does ionization energy dip from N to O even though Zeff increases across the period?",
      "How would you predict whether the radius change from K⁺ to Ca²⁺ is larger or smaller than the change from Na⁺ to Mg²⁺, and what controls it?",
      "Electron affinity trends are much noisier than ionization energy trends — what physical effects compete to make them irregular?",
      "How does the Zeff argument explain why a cation is always smaller than its parent atom while an anion is always larger?",
    ],
  },
  lewis_vsepr: {
    explanation: [
      "A Lewis structure is an electron inventory: count all valence electrons, connect atoms with bonding pairs, and distribute the remainder as lone pairs until octets are satisfied, using formal charge to choose between candidate arrangements. VSEPR then converts that inventory into three-dimensional shape with a single principle — electron domains (bonds and lone pairs alike) repel and spread out as far as possible. You already handle simple covalent bonding; here you add expanded octets, resonance, and the geometry vocabulary that underlies polarity, reactivity, and spectroscopy.",
      "Keep two geometries separate in your head: the electron-domain geometry counts every domain, while the molecular shape names only the atom positions. Water has four domains (tetrahedral arrangement) but a bent shape, because shape ignores the two lone pairs while the bond angle still feels them. Lone pairs press harder than bonding pairs, compressing angles below the ideal values, and in a trigonal bipyramid they always claim equatorial spots where 90° clashes are fewest.",
      "The persistent misconception is naming the shape from all domains — calling water tetrahedral or ammonia pyramidal-with-four-corners. Train the two-step habit: count domains for the skeleton, then drop the lone pairs from the name but not from the angle reasoning.",
    ],
    example: {
      problem: "Determine the Lewis structure, electron-domain geometry, molecular shape, and polarity of SF₄.",
      steps: [
        "Tally valence electrons: sulfur contributes 6 and each fluorine 7, so 6 + 4 × 7 = 34 electrons to place.",
        "Build the skeleton with four S–F single bonds (8 electrons), then complete each fluorine octet with three lone pairs (24 electrons). That spends 32, leaving 34 − 32 = 2 electrons, which land on sulfur as a lone pair — an expanded octet of 10, allowed for a period-3 element.",
        "Count domains on the central atom: four bonds plus one lone pair = five domains, so the electron-domain geometry is trigonal bipyramidal.",
        "Place the lone pair equatorial: there it meets only two bonds at 90°, versus three if it sat axial, minimizing the strongest repulsions. The atoms then trace a seesaw shape.",
        "Judge polarity: the seesaw is not symmetric, so the four S–F bond dipoles cannot cancel; SF₄ has a net dipole moment and is polar — consistent with its measured dipole of about 0.6 D.",
      ],
      answer: "SF₄ has 34 valence electrons, a trigonal-bipyramidal domain geometry with an equatorial lone pair, a seesaw molecular shape, and a net dipole — it is polar.",
    },
    selfQuestions: [
      "Why do lone pairs occupy equatorial rather than axial positions in a trigonal bipyramid, and why does the same question not arise in an octahedron?",
      "How does formal charge guide you between two Lewis structures that both satisfy the octet rule, and when can it mislead you?",
      "What would have to change about SF₄ for the molecule to be nonpolar, and which shapes guarantee cancellation of identical bond dipoles?",
      "How would you explain to a friend why CO₂ is linear but SO₂ is bent, using only electron counting?",
    ],
  },
  hybridization_mo: {
    explanation: [
      "Hybridization and molecular orbital (MO) theory are two complementary answers to a question Lewis structures dodge: what are the actual orbitals doing in a bond? Hybridization is the local fix — mixing one atom's s and p orbitals into sp, sp² or sp³ sets that point along the observed VSEPR geometry, with leftover p orbitals forming π bonds. It explains methane's four identical bonds and the rigidity of a C=C double bond cleanly and quickly.",
      "MO theory is the global model: atomic orbitals across the whole molecule combine into delocalized bonding and antibonding orbitals, filled bottom-up like atomic levels. Its scorecard is bond order = (bonding electrons − antibonding electrons)/2, and its signature triumph is O₂ — Lewis predicts all electrons paired, yet liquid oxygen clings to a magnet. MO filling puts two unpaired electrons in degenerate π* orbitals, predicting both the double-bond strength and the paramagnetism in one stroke.",
      "Resist the misconception that hybridization is a physical event atoms undergo before bonding. Both schemes are models — mathematical re-descriptions of the same electrons — and you choose whichever lens fits the question: hybridization for geometry and σ/π counting, MO for magnetism, bond order, and delocalization.",
    ],
    example: {
      problem: "Use molecular orbital theory to determine the bond order of O₂ and predict whether the molecule is paramagnetic or diamagnetic.",
      steps: [
        "Count the valence electrons that enter the MO diagram: each oxygen brings 6, so 12 electrons fill the 2s- and 2p-derived molecular orbitals.",
        "Fill in energy order for O₂ (where σ2p lies below π2p): σ2s² σ*2s² σ2p² π2p⁴ π*2p². The first 10 electrons fill through π2p; the last 2 must enter the degenerate π* pair.",
        "Apply Hund's rule to the two π* orbitals: the electrons occupy separate orbitals with parallel spins rather than pairing, leaving 2 unpaired electrons.",
        "Compute bond order: bonding electrons number 8 (σ2s, σ2p, two π2p), antibonding number 4 (σ*2s, two π*2p singles), so bond order = (8 − 4)/2 = 2 — a double bond, matching the measured bond length and strength.",
        "Interpret against experiment: unpaired electrons make O₂ paramagnetic, exactly what the magnet test on liquid oxygen shows and what no correct Lewis structure can reproduce.",
      ],
      answer: "O₂ has bond order 2 and two unpaired π* electrons, so it is paramagnetic — a prediction unique to MO theory.",
    },
    selfQuestions: [
      "Why does filling antibonding orbitals weaken a bond, and what does a bond order of zero predict about a molecule like He₂?",
      "How would the bond order and magnetism change if you removed one electron from O₂ to form O₂⁺, and what does that imply about its bond length?",
      "When would you reach for hybridization instead of MO theory, and what kinds of questions force you the other way?",
      "How does the sp² + leftover-p picture of ethene explain why rotation about a C=C bond is restricted while rotation about C–C is free?",
    ],
  },
  intermolecular_forces: {
    explanation: [
      "Intermolecular forces (IMFs) are the attractions between molecules — far weaker than the covalent bonds within them, yet they decide boiling points, melting points, viscosity, surface tension, and solubility. The hierarchy you need: London dispersion forces act between all molecules and grow with electron count and contact area; dipole–dipole forces add on for polar molecules; hydrogen bonding — an especially strong dipole interaction requiring H bonded directly to N, O, or F — adds the most per interaction; ion–dipole forces dominate when ions dissolve in polar solvents.",
      "The comparison strategy is sequential: first match molar masses to hold dispersion roughly constant, then ask which molecule carries the stronger additional force. Shape matters too — a long unbranched chain offers more contact area than its compact branched isomer, so it boils higher despite identical formula. Polarity comes straight from your VSEPR analysis: a molecule needs both polar bonds and a shape that fails to cancel them.",
      "Two corrections to common errors: boiling water breaks hydrogen bonds between molecules, never the O–H covalent bonds inside them; and dispersion is not always the weakest player — in large molecules its cumulative effect can outweigh hydrogen bonding, which is why nonpolar candle wax is a solid while hydrogen-bonding ethanol is a liquid.",
    ],
    example: {
      problem: "Butane (CH₃CH₂CH₂CH₃, 58 g/mol), acetone (CH₃COCH₃, 58 g/mol), and 1-propanol (CH₃CH₂CH₂OH, 60 g/mol) have nearly identical molar masses. Rank their boiling points from lowest to highest and justify the order.",
      steps: [
        "Equal molar masses and similar sizes mean the dispersion contributions are comparable, so the ranking will be decided by the additional forces each molecule can form.",
        "Butane is a pure hydrocarbon with essentially nonpolar bonds — dispersion only, so it should boil lowest; indeed it is a gas at room temperature (bp about −1 °C).",
        "Acetone has a polar C=O group and a bent-at-carbonyl shape that leaves a net dipole, adding dipole–dipole attraction; but its hydrogens sit on carbon, not oxygen, so it cannot hydrogen-bond to itself. It boils in the middle (about 56 °C).",
        "1-Propanol carries an O–H group: hydrogen bonding between molecules is the strongest IMF available here, so it boils highest (about 97 °C).",
        "Sanity-check the spread: each added force type lifts the boiling point by tens of degrees at constant mass — exactly the staircase the data shows: −1 °C, 56 °C, 97 °C.",
      ],
      answer: "Butane < acetone < 1-propanol (about −1 °C, 56 °C, and 97 °C), because at matched molar mass the boiling point tracks dispersion-only < dipole–dipole < hydrogen bonding.",
    },
    selfQuestions: [
      "Why must you compare molecules of similar molar mass before crediting a boiling-point difference to dipoles or hydrogen bonds?",
      "How can a molecule with very polar bonds, like CO₂, still have zero dipole moment, and which force is left to hold its solid together?",
      "What changes about hydrogen bonding when a molecule can donate H-bonds versus only accept them, and how does that show up in boiling points?",
      "Why does pentane boil 27 °C higher than its isomer neopentane even though their formulas are identical?",
    ],
  },
  stoichiometry_adv: {
    explanation: [
      "Real reactions rarely come with reagents in the exact balanced-equation ratio, so one reactant runs out first — the limiting reagent — and it alone fixes how much product can form. You already convert grams to moles and use mole ratios; the advanced layer is the full pipeline: identify the limiting reagent by comparing supply to stoichiometric demand, compute the theoretical yield from it, then report percent yield = (actual/theoretical) × 100 to quantify how well the real reaction performed.",
      "The reliable test for the limiting reagent is a demand calculation: pick one reactant, compute how much partner it requires through the mole ratio, and compare with what is actually present. Equivalently, divide each reactant's moles by its coefficient and the smallest quotient loses. The trap is comparing raw grams or even raw moles — a reactant can be present in greater mass and greater mole count and still be limiting if the equation demands it in a higher ratio.",
      "Percent yield below 100 is normal (side reactions, incomplete conversion, transfer losses); a value above 100 signals an error or a wet, impure product, not a bonus. Always sanity-check that your theoretical yield respects conservation of mass.",
    ],
    example: {
      problem: "Aluminum burns in chlorine by 2 Al + 3 Cl₂ → 2 AlCl₃. A run combines 10.0 g of Al (27.0 g/mol) with 30.0 g of Cl₂ (70.9 g/mol) and isolates 31.2 g of AlCl₃ (133.3 g/mol). Identify the limiting reagent and find the theoretical and percent yields.",
      steps: [
        "Convert both reactants to moles: 10.0/27.0 = 0.370 mol Al and 30.0/70.9 = 0.423 mol Cl₂.",
        "Run the demand test: consuming all 0.370 mol Al would require 0.370 × (3 mol Cl₂/2 mol Al) = 0.556 mol Cl₂, but only 0.423 mol is on hand — chlorine is the limiting reagent, even though it outweighs and outnumbers the aluminum.",
        "Build the theoretical yield from the limiting reagent: 0.423 mol Cl₂ × (2 mol AlCl₃/3 mol Cl₂) = 0.282 mol AlCl₃, and 0.282 × 133.3 = 37.6 g possible at best.",
        "Compare with reality: percent yield = 31.2/37.6 × 100 = 83.0%.",
        "Sanity-check: the actual yield sits below the theoretical maximum, as it must, and the leftover Al (0.370 − 0.423 × 2/3 = 0.088 mol) confirms aluminum was in excess.",
      ],
      answer: "Cl₂ is the limiting reagent; the theoretical yield is 37.6 g of AlCl₃ and the percent yield is 83.0%.",
    },
    selfQuestions: [
      "Why can a reactant present in both greater mass and greater mole count still be the limiting reagent?",
      "How would you redesign the reactant amounts above so that neither reagent is left over, and when would a chemist deliberately avoid that?",
      "What physical causes push percent yield below 100, and what should you suspect when a student reports 104%?",
      "How does the divide-by-coefficient shortcut for finding the limiting reagent follow from the demand-comparison method?",
    ],
  },
  gas_laws_kmt: {
    explanation: [
      "The ideal gas law PV = nRT compresses Boyle's, Charles's, and Avogadro's separate observations into one equation of state, and kinetic molecular theory (KMT) explains why it works: gas particles are tiny relative to their container, in ceaseless random motion, colliding elastically, with negligible mutual attraction — and their average kinetic energy depends only on absolute temperature. You already used single-variable gas laws; the university move is wielding PV = nRT quantitatively, including the workhorse rearrangement M = mRT/(PV) that turns a vapor's mass, volume, pressure, and temperature into a molar mass.",
      "Because average kinetic energy is fixed by T alone, two different gases at the same temperature must differ in speed: lighter molecules move faster on average (the root of Graham's law of effusion). The widespread misconception is that all molecules at one temperature share one speed — in fact each gas has a broad Maxwell–Boltzmann distribution, and equal temperature means equal average kinetic energy, not equal velocity.",
      "Know where ideality fails: at high pressure, molecular volume stops being negligible, and at low temperature, attractions slow molecules near the walls — both corrected empirically by the van der Waals equation. Under ordinary lab conditions, though, PV = nRT is reliable to about a percent.",
    ],
    example: {
      problem: "A 0.612 g sample of a volatile liquid is vaporized, filling a 250.0 mL flask at 100.0 °C and 0.980 atm. Find the molar mass of the compound and decide whether it could be carbon disulfide, CS₂ (76.1 g/mol). Use R = 0.08206 L·atm/(mol·K).",
      steps: [
        "Convert every quantity to the units R expects: V = 0.2500 L and T = 100.0 + 273 = 373 K; pressure is already in atm.",
        "Count the moles of vapor with the ideal gas law: n = PV/RT = (0.980 × 0.2500)/(0.08206 × 373) = 0.245/30.61 = 8.00 × 10⁻³ mol.",
        "Molar mass is mass per mole: M = 0.612 g/0.00800 mol = 76.5 g/mol.",
        "Compare with the candidate: CS₂ has 12.01 + 2 × 32.06 = 76.1 g/mol, within about 0.5% of the measurement — the identification is consistent.",
        "Sanity-check the assumptions: at roughly 1 atm and well above the boiling point, the vapor is dilute and ideal behavior is a fair model, so the small deviation is ordinary experimental scatter rather than non-ideality.",
      ],
      answer: "The molar mass is about 76.5 g/mol, consistent with the vapor being CS₂.",
    },
    selfQuestions: [
      "Why does the ideal gas law need no information about the identity of the gas, and which experimental conditions break that indifference?",
      "How does KMT explain why lighter gases effuse faster even though all gases at one temperature share the same average kinetic energy?",
      "What systematic error would you expect in the measured molar mass if some of the liquid failed to vaporize, and in which direction?",
      "How would you decide, given P, V, T data for a real gas, whether attractions or molecular volume dominate its deviation from ideality?",
    ],
  },
  thermodynamics_chem: {
    explanation: [
      "Three state functions run chemical thermodynamics: enthalpy H tracks heat at constant pressure (ΔH < 0 exothermic), entropy S measures how widely energy and matter are dispersed (gases and more particles mean more entropy), and Gibbs free energy ties them together through ΔG = ΔH − TΔS. At constant temperature and pressure, ΔG < 0 marks a spontaneous process — one that can proceed without continuous outside work. You already know reaction heats from thermochemistry; the new power is predicting direction and the temperature at which direction flips.",
      "Read the equation as a competition: enthalpy and entropy each vote, and temperature weights the entropy vote. When ΔH and ΔS share a sign, the reaction has a crossover temperature T = ΔH/ΔS where ΔG passes through zero — endothermic, entropy-driven reactions switch on above it; exothermic, order-creating reactions switch off. Unit discipline matters: ΔH usually arrives in kJ and ΔS in J/K, so convert before subtracting.",
      "The essential correction: spontaneous does not mean fast. Thermodynamics ranks where a system wants to end up, never how quickly it gets there — diamond converting to graphite is spontaneous and takes geological eons. Rate questions belong to kinetics.",
    ],
    example: {
      problem: "For the decomposition CaCO₃(s) → CaO(s) + CO₂(g), ΔH° = +178.3 kJ/mol and ΔS° = +160.5 J/(mol·K). Is the reaction spontaneous at 298 K? Assuming ΔH° and ΔS° stay constant, above what temperature does it become spontaneous?",
      steps: [
        "Convert entropy to matching units first: ΔS° = 160.5 J/(mol·K) = 0.1605 kJ/(mol·K). Skipping this step is the single most common source of nonsense answers.",
        "Evaluate ΔG° at room temperature: ΔG° = 178.3 − 298 × 0.1605 = 178.3 − 47.8 = +130.5 kJ/mol. Positive, so limestone does not decompose spontaneously at 298 K — which matches everyday experience.",
        "Both ΔH° and ΔS° are positive (heat must flow in, but a gas is created), so raising T strengthens the entropy term until it overcomes the enthalpy cost.",
        "Set ΔG° = 0 to find the crossover: T = ΔH°/ΔS° = 178.3/0.1605 = 1111 K, about 838 °C.",
        "Interpret: above roughly 1111 K the −TΔS° term exceeds +178.3 kJ/mol and decomposition becomes spontaneous — consistent with industrial lime kilns running near 900 °C.",
      ],
      answer: "At 298 K, ΔG° = +130.5 kJ/mol, so the decomposition is nonspontaneous; it becomes spontaneous above about 1111 K (roughly 838 °C).",
    },
    selfQuestions: [
      "Why does creating a gas product give a reaction such a large positive ΔS, and how could you estimate the sign of ΔS by inspection of any equation?",
      "What does a positive ΔG actually forbid — and why can coupled reactions in living cells still drive such steps forward?",
      "How would the crossover-temperature argument change for a reaction with ΔH < 0 and ΔS < 0, and what does that predict about cooling?",
      "How would you explain to a friend the difference between a spontaneous reaction and a fast one, with a concrete example of each combination?",
    ],
  },
  chemical_kinetics: {
    explanation: [
      "Kinetics measures how fast reactions run and what molecular pathway they follow. The central object is the rate law, rate = k[A]ᵐ[B]ⁿ, where the orders m and n must come from experiment — typically the method of initial rates, where you change one concentration at a time and watch how the rate responds. The rate constant k bundles in temperature dependence through the Arrhenius equation, k = A·e^(−Ea/RT): a higher activation energy Ea means a steeper sensitivity to temperature.",
      "Integrated rate laws convert the same information into concentration-versus-time predictions; first-order processes have the special property of a constant half-life, t½ = 0.693/k. Mechanisms connect rate laws to molecular events: a multistep pathway moves only as fast as its slowest (rate-determining) step, and a proposed mechanism is acceptable only if it reproduces the observed rate law and sums to the overall equation.",
      "The cardinal error is reading orders from the balanced equation's coefficients. Coefficients describe overall bookkeeping; orders describe the rate-determining molecular encounter, and they match only for a true elementary step. A catalyst, likewise, speeds the trip by lowering Ea on a new pathway — it never shifts where equilibrium lies.",
    ],
    example: {
      problem: "For A + B → C, initial-rate experiments give: run 1, [A] = 0.10 M, [B] = 0.10 M, rate = 2.0 × 10⁻⁴ M/s; run 2, [A] = 0.20 M, [B] = 0.10 M, rate = 8.0 × 10⁻⁴ M/s; run 3, [A] = 0.10 M, [B] = 0.20 M, rate = 4.0 × 10⁻⁴ M/s. Determine the rate law and the value of k with units.",
      steps: [
        "Compare runs 1 and 2, where only [A] changes: doubling [A] multiplies the rate by 8.0/2.0 = 4 = 2², so the reaction is second order in A.",
        "Compare runs 1 and 3, where only [B] changes: doubling [B] doubles the rate (4.0/2.0 = 2 = 2¹), so it is first order in B.",
        "Assemble the rate law: rate = k[A]²[B], overall order 2 + 1 = 3 — note this could never be read off the 1:1 coefficients of the equation.",
        "Solve for k using run 1: k = rate/([A]²[B]) = 2.0 × 10⁻⁴/((0.10)² × 0.10) = 2.0 × 10⁻⁴/1.0 × 10⁻³ = 0.20 M⁻²·s⁻¹, with units chosen so the rate comes out in M/s.",
        "Verify against an unused data point: run 2 predicts 0.20 × (0.20)² × 0.10 = 8.0 × 10⁻⁴ M/s, exactly as observed — the rate law is consistent.",
      ],
      answer: "Rate = k[A]²[B] with k = 0.20 M⁻²·s⁻¹; the reaction is third order overall.",
    },
    selfQuestions: [
      "Why must reaction orders be measured rather than copied from stoichiometric coefficients, and when do the two coincide?",
      "What does a zero-order dependence on a reactant suggest about the mechanism, and where might you see one in a catalyzed reaction?",
      "How does the Arrhenius equation explain the rule of thumb that rates roughly double for a 10 °C rise, and when does that rule fail?",
      "If two proposed mechanisms both reproduce the observed rate law, what further experiments could distinguish them?",
    ],
  },
  chemical_equilibrium: {
    explanation: [
      "Chemical equilibrium is a dynamic standoff: forward and reverse reactions keep running, but at equal rates, so concentrations stop changing. The law of mass action assigns each reaction a constant, K = products over reactants (each raised to its coefficient, pure solids and liquids omitted), fixed at a given temperature. The reaction quotient Q uses the same expression with current concentrations: Q < K means the system shifts forward, Q > K backward, Q = K means it has arrived. You already know reactions can be reversible; here you make the balance point quantitative.",
      "The standard computational tool is the ICE table — Initial, Change, Equilibrium — which encodes stoichiometry into one unknown x and turns the K expression into algebra. Look for structure before grinding: perfect-square cases collapse under a square root, and small-K systems justify the approximation that x is negligible against initial amounts (check it afterward). Le Chatelier's principle then predicts qualitatively how the position responds to added species, pressure changes, or temperature.",
      "Strike the misconception that equilibrium means equal concentrations of reactants and products, or that the reaction has stopped. K can be enormous or tiny — the balance point can sit far to either side — and molecules continue converting in both directions forever; only the net change is zero.",
    ],
    example: {
      problem: "At 448 °C, Kc = 50.5 for H₂(g) + I₂(g) ⇌ 2 HI(g). If 1.00 mol of H₂ and 1.00 mol of I₂ are sealed in a 1.00 L flask, find all three equilibrium concentrations.",
      steps: [
        "Set up the ICE table with x mol/L of each reactant consumed: [H₂] = [I₂] = 1.00 − x and [HI] = 2x, since each reaction event makes two HI.",
        "Write the equilibrium condition: Kc = [HI]²/([H₂][I₂]) = (2x)²/(1.00 − x)² = 50.5.",
        "Notice the right side is a perfect square — take the square root of both sides instead of expanding a quadratic: 2x/(1.00 − x) = √50.5 = 7.11.",
        "Solve the linear equation: 2x = 7.11 − 7.11x, so 9.11x = 7.11 and x = 0.780.",
        "Back-substitute: [H₂] = [I₂] = 1.00 − 0.780 = 0.220 M and [HI] = 2 × 0.780 = 1.56 M.",
        "Verify: (1.56)²/(0.220 × 0.220) = (7.09)² ≈ 50.3, matching Kc within rounding — and with K well above 1 it is sensible that products dominate at equilibrium.",
      ],
      answer: "[HI] ≈ 1.56 M and [H₂] = [I₂] ≈ 0.220 M at equilibrium.",
    },
    selfQuestions: [
      "Why does a catalyst change how fast equilibrium is reached but not where it lies?",
      "How do you decide when the small-x approximation is safe, and what do you do when the check fails?",
      "What happens to Kc itself, versus the equilibrium position, when you compress the flask or when you raise the temperature of an exothermic reaction?",
      "How would you explain dynamic equilibrium to a friend using a two-way escalator or crowd analogy, and where does the analogy break down?",
    ],
  },
  acid_base_equilibria: {
    explanation: [
      "Weak acids and bases only partially ionize, so their solutions are governed by equilibrium constants: Ka for an acid HA ⇌ H⁺ + A⁻, Kb for its conjugate base, with Ka × Kb = Kw = 1.0 × 10⁻¹⁴ at 25 °C. The pKa scale compresses these constants logarithmically and pairs naturally with pH. You already know pH = −log[H₃O⁺] and the strong/weak distinction; the university skill is computing pH for weak systems, conjugate pairs, and — most importantly — buffers.",
      "A buffer is a deliberate mixture of a weak acid and its conjugate base in comparable amounts. Added strong acid is absorbed by the base member, added strong base by the acid member, so the pH moves only slightly. The Henderson–Hasselbalch equation, pH = pKa + log([base]/[acid]), makes the arithmetic nearly mental: when the two members are equal, pH = pKa, and each factor of ten in the ratio moves the pH one unit. Strong acid or base added to a buffer reacts essentially completely first — do that stoichiometry before any equilibrium math.",
      "Correct the notion that a buffer freezes pH. It only moderates change, and only within its capacity: once added acid or base consumes one member entirely, the buffering collapses. Buffers work best within about one pH unit of pKa, where both members remain plentiful.",
    ],
    example: {
      problem: "A buffer is 0.250 M in acetic acid (Ka = 1.8 × 10⁻⁵) and 0.400 M in sodium acetate. Find the pH, and then the pH after 0.050 mol of HCl is added to 1.00 L of this buffer (assume no volume change).",
      steps: [
        "Find pKa = −log(1.8 × 10⁻⁵) = 4.74. Both buffer members are present in comparable concentrations, so Henderson–Hasselbalch applies directly.",
        "Initial pH = 4.74 + log(0.400/0.250) = 4.74 + log(1.60) = 4.74 + 0.20 = 4.94. With more base than acid, the pH sensibly sits above pKa.",
        "Treat the added HCl as reacting completely with the base member: acetate falls to 0.400 − 0.050 = 0.350 M while acetic acid rises to 0.250 + 0.050 = 0.300 M. This neutralization step always precedes the equilibrium step.",
        "Recompute: pH = 4.74 + log(0.350/0.300) = 4.74 + log(1.17) = 4.74 + 0.07 = 4.81.",
        "Interpret the protection: the same 0.050 mol of HCl in 1.00 L of pure water would give pH = −log(0.050) = 1.30, a plunge of 5.7 units from neutral; the buffer held the change to 0.13 units.",
      ],
      answer: "The buffer pH is 4.94, falling only to 4.81 after the acid — a drop of 0.13 units versus the crash to pH 1.30 the same acid causes in plain water.",
    },
    selfQuestions: [
      "Why does a buffer resist pH change in both directions, and what determines how much it can absorb before failing?",
      "How would you choose the best conjugate pair to buffer at pH 9.2, and what ratio of base to acid would you mix?",
      "Why must added strong acid be handled with stoichiometry before any equilibrium calculation, and what error results from skipping that order?",
      "What does the relation Ka × Kb = Kw imply about the basicity of the conjugate of a very weak acid?",
    ],
  },
  solubility_equilibria: {
    explanation: [
      "Sparingly soluble salts set up their own heterogeneous equilibrium: a solid in contact with its dissolved ions, governed by the solubility product Ksp. For CaF₂(s) ⇌ Ca²⁺(aq) + 2 F⁻(aq), Ksp = [Ca²⁺][F⁻]² — the solid never appears in the expression because its activity is constant. You already think in terms of dissolving and concentration; here the payoffs are computing molar solubility from Ksp, predicting precipitation by comparing the ion product Q to Ksp, and quantifying the common-ion effect.",
      "Translate carefully between solubility s (moles of salt dissolving per liter) and ion concentrations: stoichiometry inserts coefficients and powers, so a 1:2 salt gives Ksp = s(2s)² = 4s³. The common-ion effect is Le Chatelier in action — pre-loading the solution with one product ion drives the equilibrium back toward solid and can suppress solubility by orders of magnitude, which is why selective precipitation works as a separation tool.",
      "The trap to avoid is ranking solubilities by comparing raw Ksp values across salts of different formulas. Because the exponents differ, a 1:1 salt and a 1:2 salt with similar Ksp values can have wildly different molar solubilities — always convert to s before comparing.",
    ],
    example: {
      problem: "The Ksp of CaF₂ is 3.9 × 10⁻¹¹ at 25 °C. Calculate its molar solubility in pure water and in a 0.10 M NaF solution, and compare the two.",
      steps: [
        "Write the dissolution and assign concentrations: CaF₂(s) ⇌ Ca²⁺ + 2 F⁻, so if s mol/L dissolves, [Ca²⁺] = s and [F⁻] = 2s.",
        "Substitute into the solubility product: Ksp = s(2s)² = 4s³ = 3.9 × 10⁻¹¹, so s³ = 9.75 × 10⁻¹² and s = 2.1 × 10⁻⁴ M in pure water.",
        "In 0.10 M NaF the fluoride is dominated by the added salt: [F⁻] ≈ 0.10 M, since the contribution 2s will be tiny. Then s = Ksp/[F⁻]² = 3.9 × 10⁻¹¹/(0.10)² = 3.9 × 10⁻⁹ M.",
        "Check the approximation: 2s = 7.8 × 10⁻⁹ M is utterly negligible next to 0.10 M, so the shortcut was justified.",
        "Interpret: the common ion crushes solubility by a factor of 2.1 × 10⁻⁴/3.9 × 10⁻⁹ ≈ 54,000 — exactly the Le Chatelier shift toward solid you would predict when a product ion is supplied externally.",
      ],
      answer: "Molar solubility is about 2.1 × 10⁻⁴ M in pure water but only 3.9 × 10⁻⁹ M in 0.10 M NaF — roughly 54,000 times lower because of the common-ion effect.",
    },
    selfQuestions: [
      "Why does the exponent structure of Ksp make direct comparisons between salts of different stoichiometry meaningless?",
      "How does comparing Q to Ksp tell you whether mixing two solutions will produce a precipitate, and what does Q = Ksp mean physically?",
      "Why does the common-ion calculation square the fluoride concentration but not the calcium concentration in this salt?",
      "How could pH changes alter the solubility of a salt whose anion is a weak base, even though Ksp itself stays fixed?",
    ],
  },
  electrochemistry: {
    explanation: [
      "Electrochemistry turns redox chemistry into measurable voltage. In a galvanic cell, oxidation at the anode and reduction at the cathode are separated so the transferred electrons must travel through an external wire. Each half-reaction carries a standard reduction potential E°; the half-cell with the higher E° runs as the reduction, and E°cell = E°cathode − E°anode. A positive cell potential signals a spontaneous reaction, and the bridge to thermodynamics is exact: ΔG° = −nFE°, with F = 96,485 C/mol, while log K = nE°/0.0592 at 25 °C links potential to the equilibrium constant.",
      "Your balancing skills feed straight in: split the overall reaction into half-reactions, balance atoms and charge with electrons, and scale until electron counts match. But here is the subtlety that catches almost everyone — multiplying a half-reaction by a coefficient does not multiply its E°. Potential is an intensive property, energy per unit charge, like a height difference; doubling the amount of substance doubles the energy and the charge together, leaving the voltage unchanged.",
      "Keep the sign conventions straight by anchoring to physical meaning: electrons always flow from anode to cathode through the wire, and a table of reduction potentials simply ranks how strongly each species pulls electrons toward itself.",
    ],
    example: {
      problem: "A galvanic cell pairs the half-reactions Zn²⁺ + 2e⁻ → Zn (E° = −0.76 V) and Cu²⁺ + 2e⁻ → Cu (E° = +0.34 V). Identify the anode and cathode, then calculate E°cell, ΔG°, and the order of magnitude of K at 25 °C.",
      steps: [
        "Compare reduction potentials: copper's +0.34 V beats zinc's −0.76 V, so Cu²⁺ is reduced at the cathode and Zn metal is oxidized at the anode. The overall reaction is Zn + Cu²⁺ → Zn²⁺ + Cu with n = 2 electrons transferred.",
        "Compute the cell potential: E°cell = E°cathode − E°anode = 0.34 − (−0.76) = +1.10 V. The positive sign confirms the reaction runs spontaneously as written.",
        "Convert to free energy: ΔG° = −nFE° = −(2)(96,485 C/mol)(1.10 V) = −2.12 × 10⁵ J/mol = −212 kJ/mol, comfortably spontaneous.",
        "Estimate the equilibrium constant: log K = nE°/0.0592 = (2 × 1.10)/0.0592 ≈ 37.2, so K ≈ 10³⁷ — the reaction goes essentially to completion.",
        "Sanity-check the coherence: positive E°, large negative ΔG°, and an astronomically large K are three statements of one fact, and the physical setup (zinc dissolving while copper plates out) matches what is observed in the classic Daniell cell.",
      ],
      answer: "Zn is the anode and Cu the cathode; E°cell = +1.10 V, ΔG° = −212 kJ/mol, and K ≈ 10³⁷, so the reaction is overwhelmingly product-favored.",
    },
    selfQuestions: [
      "Why does multiplying a half-reaction by two leave its E° unchanged while ΔG° doubles, and what property of voltage explains this?",
      "How would the cell potential change under nonstandard concentrations, and which direction does the Nernst equation push E as products accumulate?",
      "What distinguishes a galvanic cell from an electrolytic cell in terms of the sign of ΔG and the role of the power supply?",
      "How would you use a table of reduction potentials to predict whether a given metal will dissolve in 1 M acid?",
    ],
  },
  coordination_chemistry: {
    explanation: [
      "A coordination complex is a central metal ion holding a set of ligands — molecules or anions that donate electron pairs into the metal's empty orbitals, a textbook Lewis acid–base interaction. The number of donor atoms attached is the coordination number (six gives octahedral, four gives tetrahedral or square planar), and ligands range from monodentate (NH₃, Cl⁻, H₂O) to chelating polydentates like ethylenediamine or EDTA that grip through several atoms at once. Your ionic- and covalent-bonding background merges here: the complex ion has a net charge balanced by counterions outside the brackets.",
      "Three bookkeeping skills unlock most problems: assign the metal's oxidation state from the overall charge minus the ligand charges; count d electrons from the resulting ion's configuration; and name systematically — ligands alphabetically with Greek prefixes, then the metal with its oxidation state in Roman numerals. Crystal field theory then explains color and magnetism: ligands split the d orbitals, electrons absorb visible light to jump the gap, and strong-field ligands can force pairing into low-spin arrangements.",
      "Mind the color trap: a solution looks the color it transmits, not the color it absorbs. A complex absorbing orange-red light appears blue. And only the ligands written inside the square brackets are bonded to the metal — counterions outside dissociate freely in solution.",
    ],
    example: {
      problem: "For the compound [Co(NH₃)₅Cl]Cl₂, determine the oxidation state of cobalt, its d-electron count, the coordination number and geometry, and give the systematic name.",
      steps: [
        "Work out the complex ion's charge from the counterions: two free Cl⁻ outside the brackets mean the bracketed ion must be 2+ for neutrality.",
        "Assign cobalt's oxidation state inside the brackets: five NH₃ ligands are neutral and the bound Cl is −1, so Co + (−1) = +2 gives Co = +3.",
        "Count d electrons: neutral Co (Z = 27) is [Ar] 4s² 3d⁷; removing three electrons (both 4s, then one 3d) leaves Co³⁺ = [Ar] 3d⁶, a d⁶ ion.",
        "Count donor atoms for the geometry: five ammonia nitrogens plus one chloride make coordination number 6, so the complex is octahedral — and with NH₃ a reasonably strong-field ligand, the d⁶ set pairs up low-spin, predicting a diamagnetic ion.",
        "Name it: ligands in alphabetical order (ammine before chloro), counting prefixes, then the metal and its state — pentaamminechlorocobalt(III) chloride.",
      ],
      answer: "Cobalt is +3 and d⁶, in an octahedral complex of coordination number 6; the compound is pentaamminechlorocobalt(III) chloride.",
    },
    selfQuestions: [
      "Why does a chelating ligand like EDTA bind so much more tenaciously than six separate monodentate ligands, and what entropy argument explains it?",
      "How does the identity of the ligands decide whether a d⁶ complex is high-spin or low-spin, and what measurable property changes between the two?",
      "What would dissolve differently in water between [Co(NH₃)₅Cl]Cl₂ and [Co(NH₃)₄Cl₂]Cl, and how could a silver nitrate test tell them apart?",
      "Why does the observed color of a complex correspond to the light it does not absorb?",
    ],
  },
  nuclear_chemistry_adv: {
    explanation: [
      "Nuclear chemistry follows the nucleus rather than the electron cloud. Unstable isotopes decay by characteristic modes — alpha emission (helium-4 nucleus, common for heavy elements), beta-minus (a neutron becomes a proton, ejecting an electron), positron emission and electron capture (proton becomes neutron), and gamma release of excess energy. Balancing a nuclear equation means conserving mass number and atomic number across the arrow; chemistry's usual bookkeeping of bonds and charges is irrelevant here because the electron shells are bystanders.",
      "Every radioactive decay is kinetically first order, so the tools you built for kinetics transfer wholesale: a constant half-life t½, a decay constant k = 0.693/t½, and the age-dating workhorse t = (1/k)·ln(N₀/N). Radiocarbon dating exploits this: living tissue maintains a steady carbon-14 fraction, the clock starts at death, and the remaining fraction reveals elapsed time. Mass–energy bookkeeping via E = mc² explains why nuclear processes dwarf chemical ones — fission and fusion convert measurable mass defects into millions of times more energy per gram than combustion.",
      "Discard the intuition that two half-lives finish the job: each half-life removes half of whatever remains, so 25% survives after two and the decay tail stretches on exponentially. And because decay is a nuclear event, temperature, pressure, and chemical bonding leave its rate untouched.",
    ],
    example: {
      problem: "Carbon-14 undergoes beta-minus decay with a half-life of 5730 years. Write the nuclear equation, then find the age of a wooden artifact whose carbon-14 activity is 35% of that found in living wood.",
      steps: [
        "Balance the decay: ¹⁴C → ¹⁴N + β⁻. The mass number stays 14 while the atomic number rises from 6 to 7, because a neutron inside the nucleus converted into a proton plus the emitted electron.",
        "Convert the half-life to a decay constant: k = 0.693/5730 = 1.21 × 10⁻⁴ yr⁻¹.",
        "Apply the first-order clock with the surviving fraction N/N₀ = 0.35: t = (1/k)·ln(N₀/N) = ln(1/0.35)/(1.21 × 10⁻⁴) = 1.050/(1.21 × 10⁻⁴) ≈ 8680 years.",
        "Sanity-check against whole half-lives: one half-life (5730 yr) would leave 50% and two (11,460 yr) would leave 25%; the measured 35% sits between them, and 8680 years lands neatly between the two times — about 1.5 half-lives, since 0.5^1.5 ≈ 0.354.",
      ],
      answer: "The decay is ¹⁴C → ¹⁴N + β⁻, and the artifact is about 8700 years old (8.7 × 10³ yr).",
    },
    selfQuestions: [
      "Why does beta-minus decay raise the atomic number while leaving the mass number fixed, and which conservation laws enforce that?",
      "What assumptions about atmospheric carbon-14 does radiocarbon dating rely on, and how would a violation bias the computed age?",
      "Why is the energy released per gram in fission so much larger than in combustion, and where does that energy physically come from?",
      "How would you decide whether an unstable isotope is likely to decay by beta emission versus positron emission from its neutron-to-proton ratio?",
    ],
  },
  organic_structure_nomenclature: {
    explanation: [
      "Organic chemistry is built on carbon's reliable tetravalence: four bonds, arranged as chains, branches, and rings, with functional groups — alcohols, amines, carbonyls, halides, alkenes and the rest — serving as the reactive handles that determine behavior. Skeletons are mostly inert scenery; reactions happen at functional groups, so learning to spot and rank them is the first reading skill of the subject. Your covalent bonding and formula-writing background carries over directly; what is new is a systematic language for unambiguous structure.",
      "IUPAC nomenclature runs on three moves: find the longest carbon chain that contains the principal characteristic group, number the chain so that group gets the lowest possible locant, then attach substituent names with locants in alphabetical order. The principal group claims the suffix (-ol, -al, -one, -oic acid) and outranks mere substituents in the numbering contest. A useful companion tool is the degree of unsaturation, (2C + 2 − H)/2 for a hydrocarbon-like formula, which counts rings plus π bonds before you draw anything.",
      "The misconception to clear: two condensed formulas that look different on paper are not necessarily different compounds — the same molecule can be written from either end or with branches reordered. The systematic name is the unique identifier; if two structures generate the same name, they are the same substance.",
    ],
    example: {
      problem: "Give the IUPAC name of CH₃CH(OH)CH₂CH(CH₃)CH₃ and classify its functional group.",
      steps: [
        "Identify the functional group first: an OH bound to a carbon that carries two other carbons makes this a secondary alcohol, so the suffix is -ol and the OH carbon must get the lowest locant available.",
        "Find the longest chain through the OH-bearing carbon: tracing the backbone gives five carbons, so the parent is pentane, modified to pentanol.",
        "Number from the end nearer the OH: counting from that end places the OH on C2; numbering from the other end would put it on C4, so the first choice wins (the principal group outranks the substituent in this contest).",
        "Locate substituents on the chosen numbering: a methyl branch sits on C4.",
        "Assemble the name with locants: 4-methylpentan-2-ol. Double-check by re-deriving the structure from the name — a five-carbon chain, OH on C2, methyl on C4 — and confirming it reproduces the original formula.",
      ],
      answer: "The compound is 4-methylpentan-2-ol, a secondary alcohol.",
    },
    selfQuestions: [
      "Why does the principal characteristic group, rather than the substituents, control the numbering direction of the chain?",
      "How would the name change if the OH in this molecule were replaced by a C=O at the same position, and what suffix rules drive that?",
      "What does a degree of unsaturation of 1 allow structurally, and how would you decide between a ring and a double bond experimentally?",
      "How would you convince a friend that CH₃CH(CH₃)CH₂CH(OH)CH₃ is the very same compound as the one named above?",
    ],
  },
  stereochemistry: {
    explanation: [
      "Stereochemistry studies molecules that share the same connectivity but differ in 3D arrangement. The headline case is chirality: a carbon bearing four different groups (a stereocenter) makes a molecule non-superimposable on its mirror image, and the two mirror forms are enantiomers. Enantiomers match in melting point, boiling point, and solubility, yet rotate plane-polarized light in opposite directions and behave differently in chiral environments — which is why a drug and its mirror image can have entirely different physiological effects.",
      "The Cahn–Ingold–Prelog system labels each stereocenter: rank the four substituents by atomic number at the first point of difference (working outward atom by atom when first atoms tie), orient the lowest-priority group away from you, and read the path 1 → 2 → 3. Clockwise is R, counterclockwise is S. Molecules with several stereocenters can also form diastereomers — stereoisomers that are not mirror images — which, unlike enantiomers, differ in ordinary physical properties.",
      "The error to root out is conflating R/S with the sign of optical rotation. R and S come from an arbitrary ranking convention; (+) and (−) come from a polarimeter measurement. There is no shortcut from one to the other — an R compound can rotate light either way, and only experiment decides.",
    ],
    example: {
      problem: "A model of butan-2-ol is oriented so that the H on C2 points directly away from you. Looking at the front face you see the OH group at the top, the ethyl group at the lower right, and the methyl group at the lower left. Assign the configuration as R or S, and state the relationship between this molecule and its mirror image.",
      steps: [
        "Verify C2 is a stereocenter: it carries OH, CH₃, CH₂CH₃, and H — four different groups, so a configuration label applies.",
        "Rank by CIP rules: oxygen beats carbon, so OH is priority 1. Ethyl versus methyl is a tie at the first atom (both C), so look outward: ethyl's carbon is attached to (C, H, H) while methyl's is attached to (H, H, H), so ethyl is 2, methyl is 3, and H is 4.",
        "Confirm the viewing geometry: the lowest-priority H already points away from you, so you may read the front face directly with no mental rotation.",
        "Trace priorities 1 → 2 → 3: top (OH) to lower right (ethyl) to lower left (methyl) sweeps clockwise, so the configuration is R.",
        "Relate to the mirror image: reflecting swaps the handedness to S; the pair are enantiomers — identical in bp, mp, and density but opposite in optical rotation and distinguishable by chiral reagents.",
      ],
      answer: "The molecule is (R)-butan-2-ol, and its mirror image, (S)-butan-2-ol, is its enantiomer.",
    },
    selfQuestions: [
      "Why does swapping any two groups on a stereocenter invert the R/S label, and how can you use that fact to check assignments?",
      "What would you do differently in the assignment if the lowest-priority group pointed toward you instead of away?",
      "How do diastereomers differ from enantiomers in their physical properties, and why does that difference make them separable by ordinary distillation or chromatography?",
      "Why can two enantiomers smell different or act differently as drugs even though their bond energies are identical?",
    ],
  },
  substitution_elimination: {
    explanation: [
      "When a nucleophile or base meets an alkyl halide, two competitions decide the outcome: substitution versus elimination, and stepwise (unimolecular) versus concerted (bimolecular). SN2 and E2 happen in one step with the rate depending on both partners; SN1 and E1 go through a carbocation intermediate whose formation is rate-limiting. You already classify reactions and read structures; the new skill is predicting which of the four pathways dominates from the substrate, the reagent, and the solvent.",
      "Four factors steer the choice. Substrate: methyl and primary centers favor SN2, tertiary centers block backside attack and favor SN1/E1, secondary centers sit on the fence. Reagent: a strong, unhindered nucleophile that is a weak base pushes SN2, a strong bulky base pushes E2, a weak nucleophile in a warm protic solvent invites SN1/E1. Stereochemistry is the fingerprint of mechanism — SN2 inverts the stereocenter through backside attack, while SN1 racemizes because the flat carbocation is attacked from both faces. E2 demands an anti-periplanar hydrogen and tends to give the more substituted (Zaitsev) alkene.",
      "The common trap is treating nucleophilicity and basicity as the same property. They correlate loosely but diverge often: iodide is a superb nucleophile yet a feeble base, while a bulky alkoxide is a strong base but a clumsy nucleophile. That gap is exactly the lever that lets you steer a secondary substrate toward substitution or toward elimination by choosing the reagent.",
    ],
    example: {
      problem: "(S)-2-bromobutane is treated with sodium hydroxide in a polar aprotic solvent. Predict the dominant mechanism, name the organic product, and state its stereochemistry relative to the starting material.",
      steps: [
        "Classify the substrate: C2 of 2-bromobutane is a secondary carbon bearing the leaving group, so it can in principle run any of the four pathways — the reagent and conditions must decide.",
        "Weigh the reagent: hydroxide is both a strong nucleophile and a strong base, but it is small and unhindered, and the polar aprotic solvent leaves it unencumbered by a solvent shell. On a secondary carbon those conditions favor the concerted SN2 attack over E2 — which prefers a bulky base or heat — and rule out the carbocation routes, which need a weak nucleophile in an ionizing solvent.",
        "Predict the connectivity: hydroxide replaces bromide at C2, converting CH₃CHBrCH₂CH₃ into CH₃CH(OH)CH₂CH₃, which is butan-2-ol.",
        "Track the stereochemistry: SN2 proceeds by backside attack, inverting the configuration at the stereocenter. Bromide (priority 1) is replaced by OH (still priority 1), and the ethyl, methyl, and H rankings are unchanged, so the spatial inversion flips the descriptor.",
        "State the result and sanity-check: starting from (S)-2-bromobutane, inversion gives (R)-butan-2-ol; a single clean inversion rather than a racemic mixture is itself evidence that the reaction went by SN2 and not through a free carbocation.",
      ],
      answer: "The reaction is SN2, giving (R)-butan-2-ol by backside attack with inversion of configuration.",
    },
    selfQuestions: [
      "Why does SN2 produce inversion while SN1 produces a racemic mixture, and what does each outcome reveal about the intermediate?",
      "How could you change only the reagent to steer (S)-2-bromobutane toward elimination instead, and what alkene would dominate?",
      "Why does a tertiary substrate essentially refuse to undergo SN2 even with an excellent nucleophile?",
      "How would you explain to a friend the difference between a strong base and a strong nucleophile, with a reagent that is one but not the other?",
    ],
  },
  addition_reactions: {
    explanation: [
      "The π bond of an alkene or alkyne is electron-rich and exposed, so it behaves as a nucleophile toward electrophiles — the opposite stance from the saturated halides of substitution chemistry. Addition reactions break that π bond and attach two new groups across the former double or triple bond: hydrogen halides, water (acid-catalyzed hydration), halogens, and hydrogen (catalytic hydrogenation) all add this way. You already know functional groups and reaction types; here the focus is regiochemistry — which carbon gets which group — and the carbocation intermediates that govern it.",
      "For additions that begin by protonating the alkene, Markovnikov's rule is the organizing principle, and its real basis is carbocation stability. The proton adds so as to generate the more stable (more substituted) carbocation — tertiary beats secondary beats primary — because alkyl groups stabilize positive charge through hyperconjugation and induction. The nucleophile then attaches to that carbon. Reverse conditions exist: radical addition of HBr with peroxides gives the anti-Markovnikov product, a reminder that the rule describes the ionic mechanism, not a law of nature.",
      "The misconception to discard is that 'Markovnikov' is a memorized hydrogen-counting slogan ('the rich get richer'). Treat it instead as a consequence: identify the two possible carbocations, pick the more stable one, and the regiochemistry follows automatically — which also tells you immediately how rearrangements or radical conditions will change the answer.",
    ],
    example: {
      problem: "2-methylpropene (CH₂=C(CH₃)₂) reacts with HBr under ordinary ionic conditions (no peroxides). Predict the major product and justify the regiochemistry through the carbocation intermediate.",
      steps: [
        "Identify the two carbons of the double bond: the CH₂ end (carbon bearing two H) and the C(CH₃)₂ end (carbon bearing two methyl groups). The proton from HBr can add to either.",
        "Compare the two possible carbocations: adding H⁺ to the CH₂ carbon places the positive charge on the central carbon, which is bonded to three other carbons — a tertiary cation. Adding H⁺ to the central carbon instead would leave a primary cation on the CH₂.",
        "Apply the stability ordering: the tertiary carbocation is far more stable than the primary one, so the proton adds to the terminal CH₂ carbon, in line with Markovnikov's rule.",
        "Attach the nucleophile: bromide then bonds to the tertiary cationic carbon, giving (CH₃)₃CBr, that is 2-bromo-2-methylpropane (tert-butyl bromide).",
        "Sanity-check the logic: the bromine ends up on the more substituted carbon precisely because that is where the stable intermediate carried the charge — confirming this is the Markovnikov product, and predicting that peroxide radical conditions would instead place Br on the CH₂ end.",
      ],
      answer: "The major product is 2-bromo-2-methylpropane, formed via the more stable tertiary carbocation (Markovnikov addition).",
    },
    selfQuestions: [
      "Why does carbocation stability, rather than a hydrogen-counting rule, ultimately decide the regiochemistry of HBr addition?",
      "How would adding peroxides change the product, and what kind of intermediate replaces the carbocation in that case?",
      "What would you expect if the carbocation could rearrange to an even more stable one, and how would that show up in the product mixture?",
      "How does acid-catalyzed hydration of the same alkene parallel this mechanism, and what product would it give?",
    ],
  },
  aromatic_chemistry: {
    explanation: [
      "Benzene's six π electrons are delocalized into a closed, especially stable ring — aromaticity, formalized by Hückel's 4n+2 rule. That stability changes everything about how the ring reacts: rather than adding across the double bonds like an alkene and destroying the aromatic system, benzene undergoes electrophilic aromatic substitution (EAS), where an electrophile replaces a hydrogen and the aromatic ring is preserved. Halogenation, nitration, sulfonation, and Friedel–Crafts reactions all share this two-step pattern: the ring attacks the electrophile to form a resonance-stabilized cation, then loses a proton to restore aromaticity.",
      "When a substituent is already present, it controls both the rate and the position of the next substitution. Electron-donating groups (alkyl, OH, NH₂, OR) stabilize the intermediate cation, activate the ring, and direct the incoming electrophile to the ortho and para positions. Electron-withdrawing groups (NO₂, C=O, SO₃H, most directly bonded electronegative pulls) deactivate the ring and direct meta. Halogens are the instructive exception: they deactivate by induction yet direct ortho/para by resonance donation of a lone pair.",
      "Guard against the assumption that aromatic rings behave like ordinary alkenes. Their reluctance to add, and their insistence on substitution, both trace to the energetic cost of breaking aromaticity in the intermediate — which is also why the directing effects can be predicted by drawing the resonance structures of that intermediate and asking which substituent best stabilizes the positive charge.",
    ],
    example: {
      problem: "Toluene (methylbenzene) is nitrated with a mixture of concentrated HNO₃ and H₂SO₄. Predict the major monosubstituted products and explain the directing and activating effect of the methyl group.",
      steps: [
        "Identify the electrophile: H₂SO₄ protonates and dehydrates nitric acid to generate the nitronium ion NO₂⁺, the active electrophile in nitration.",
        "Classify the existing substituent: the methyl group is electron-donating (through hyperconjugation and induction), so it activates the ring, making toluene nitrate faster than benzene itself.",
        "Determine orientation by stabilizing the intermediate: methyl is an ortho/para director, because attack at those positions produces a cationic intermediate with a resonance form bearing the positive charge on the methyl-substituted carbon, where the donating group stabilizes it best.",
        "Name the products: substitution occurs mainly at the carbons ortho and para to the methyl group, giving 2-nitrotoluene (ortho) and 4-nitrotoluene (para); the meta isomer is minor.",
        "Weigh statistics against sterics: there are two ortho positions for every one para, but attack beside the methyl group pays a steric price. Methyl is small enough that the statistical edge wins — toluene nitration gives roughly 3:2 ortho to para — while bulkier groups like tert-butyl push the split strongly toward para.",
      ],
      answer: "Nitration gives mainly 2-nitrotoluene and 4-nitrotoluene; the methyl group activates the ring and directs ortho/para.",
    },
    selfQuestions: [
      "Why does benzene undergo substitution rather than the addition that alkenes prefer, and what role does the intermediate play in that choice?",
      "How can a halogen substituent deactivate the ring yet still direct ortho/para, and why do those two effects not contradict each other?",
      "How would you decide the position of a second substitution when the ring already carries two groups with conflicting directing preferences?",
      "Why does drawing the resonance structures of the cationic intermediate let you predict directing effects without memorizing a list?",
    ],
  },
  carbonyl_chemistry: {
    explanation: [
      "The carbonyl group, C=O, is the most important functional group in organic chemistry, and its reactivity flows from one fact: oxygen is far more electronegative than carbon, so the bond is strongly polarized, leaving the carbonyl carbon electrophilic (δ+) and the oxygen nucleophilic (δ−). Aldehydes and ketones therefore undergo nucleophilic addition: a nucleophile attacks the carbon, the π bond opens, and the oxygen becomes an alkoxide that is then protonated to an alcohol. Carboxylic acid derivatives (esters, amides, acyl halides) add a second act — nucleophilic acyl substitution — because they carry a leaving group that can depart after the nucleophile adds.",
      "Reactivity ranks predictably. Aldehydes are more electrophilic than ketones, because a ketone's two alkyl groups both donate electron density and add steric bulk around the carbon. Among acid derivatives, the better the leaving group, the more reactive: acyl chlorides exceed esters exceed amides. Powerful carbon nucleophiles — Grignard and organolithium reagents — add irreversibly to build new carbon–carbon bonds, the workhorse reaction for assembling larger molecules. Counting carbons before and after such an addition is the first habit to build.",
      "A frequent error is forgetting that organometallic reagents are destroyed by acidic protons. A Grignard reagent is a strong base as well as a nucleophile, so it cannot survive in the presence of water, alcohols, or acids — those proton sources quench it before it reaches the carbonyl. The addition is run in a dry, aprotic solvent, and the acidic aqueous workup comes only at the end.",
    ],
    example: {
      problem: "Propanal (CH₃CH₂CHO) is treated with methylmagnesium bromide (CH₃MgBr) in dry ether, followed by aqueous acid workup. Give the structure and IUPAC name of the alcohol product, and classify it.",
      steps: [
        "Identify the electrophilic site: the carbonyl carbon of propanal carries the δ+ charge, so the carbon nucleophile will attack there.",
        "Add the nucleophile: the methyl group of CH₃MgBr delivers a methyl carbanion equivalent to the carbonyl carbon, opening the C=O π bond and leaving the oxygen as a magnesium alkoxide.",
        "Protonate on workup: aqueous acid converts the alkoxide to an OH group; the carbon that was the carbonyl now bears the new methyl group, the original H, the original ethyl chain, and the OH.",
        "Assemble the structure: the product is CH₃CH₂CH(OH)CH₃ — a four-carbon chain (propanal's three carbons plus the added methyl) with OH on the second carbon.",
        "Name and classify, then count to check: the chain is butane, OH on C2 gives butan-2-ol, and the OH carbon bears two other carbons, so it is a secondary alcohol — and carbon count goes from 3 (propanal) to 4 (product), confirming one new C–C bond was formed.",
      ],
      answer: "The product is butan-2-ol (CH₃CH₂CH(OH)CH₃), a secondary alcohol formed by Grignard addition.",
    },
    selfQuestions: [
      "Why is an aldehyde more reactive toward nucleophilic addition than a ketone with a similar carbon skeleton?",
      "Why must a Grignard reaction be kept rigorously free of water and alcohols, and what happens to the reagent if it is not?",
      "How does nucleophilic acyl substitution differ from the simple addition seen with aldehydes, and what structural feature makes the difference?",
      "How would the product change if you used formaldehyde or a ketone instead of propanal, and what class of alcohol would each give?",
    ],
  },
  spectroscopy: {
    explanation: [
      "Spectroscopy is how chemists read a molecule's structure without ever seeing it directly, by measuring how it interacts with energy. Three techniques carry most of the load. Infrared (IR) spectroscopy detects bond vibrations, so it flags functional groups: a strong band near 1700 cm⁻¹ shouts carbonyl, a broad band around 3300 cm⁻¹ signals O–H or N–H. Nuclear magnetic resonance (NMR) reports on the carbon–hydrogen framework: the number of signals counts chemically distinct hydrogens, chemical shift reflects their electronic environment, and integration gives their relative numbers. Mass spectrometry (MS) weighs the molecule and its fragments, fixing the molecular formula and mass.",
      "The efficient workflow combines them with a single arithmetic anchor — the degree of unsaturation, (2C + 2 + N − H − X)/2 — computed from the formula MS provides. Each unit of unsaturation is one ring or one π bond, so the count tells you how much structural 'tension' must be accounted for before you draw anything. Then IR identifies the functional groups, and NMR maps the hydrogens onto a skeleton. The pieces constrain each other: a carbonyl in IR plus one degree of unsaturation means the molecule has no extra ring or double bond to hide.",
      "The misconception to avoid is reading any single spectrum as a full answer. IR rarely pins an exact structure; NMR signal counts can mislead if symmetry makes distinct-looking hydrogens equivalent. Structure determination is a triangulation — let the molecular formula bound the possibilities, then use each technique to eliminate candidates until one survives.",
    ],
    example: {
      problem: "An unknown compound has molecular formula C₃H₆O. Its mass spectrum shows a molecular ion at m/z = 58, its IR spectrum has a strong absorption near 1715 cm⁻¹, and its ¹H NMR shows a single peak near δ 2.1. Deduce the structure.",
      steps: [
        "Confirm the formula against the mass: C₃H₆O weighs 3(12) + 6(1) + 16 = 58, matching the molecular ion at m/z = 58, so the formula is consistent.",
        "Compute the degree of unsaturation: (2×3 + 2 − 6)/2 = (8 − 6)/2 = 1, so the molecule contains exactly one ring or one double bond.",
        "Read the IR: a strong band near 1715 cm⁻¹ is the signature of a C=O stretch, which accounts for the single degree of unsaturation — there is no additional ring or alkene.",
        "Read the NMR: one signal means all six hydrogens are chemically equivalent. With a carbonyl already placed, two identical CH₃ groups flanking it fit perfectly; their position near δ 2.1 matches methyls next to a carbonyl.",
        "Assemble and verify: CH₃COCH₃ (acetone, propan-2-one) has formula C₃H₆O, one C=O, and six equivalent methyl hydrogens giving a single NMR peak — every clue is satisfied, so the unknown is acetone.",
      ],
      answer: "The compound is acetone (propan-2-one), CH₃COCH₃ — one carbonyl and two equivalent methyl groups consistent with all three spectra.",
    },
    selfQuestions: [
      "Why does the degree of unsaturation give you a structural budget before you interpret any peak, and how would a value of 4 immediately suggest an aromatic ring?",
      "How would the ¹H NMR of acetone differ from that of propanal, which has the same number of carbons but a different arrangement?",
      "Why can a single NMR signal hide more structural complexity than it seems to, and what role does molecular symmetry play?",
      "How would you use the relationship between IR bands and degrees of unsaturation to rule out a structure that otherwise fits the formula?",
    ],
  },
  biochemistry_intro: {
    explanation: [
      "Biochemistry applies organic and physical chemistry to the molecules of life, which fall into four families: proteins (polymers of amino acids), carbohydrates, lipids, and nucleic acids. The unifying chemistry is mostly familiar — condensation reactions join monomers with loss of water, hydrolysis reverses them, and the resulting macromolecules fold into shapes dictated by the intermolecular forces you already know: hydrogen bonds, ionic attractions, and the hydrophobic effect. Your background in functional groups and acid–base equilibria is exactly the toolkit these molecules demand.",
      "Amino acids deserve special attention because they are amphoteric: each carries a basic amino group and an acidic carboxyl group, so its net charge depends on pH. At low pH both groups are protonated (net +1); at high pH both are deprotonated (net −1); in between lies the zwitterion, where the molecule is internally charged but net neutral. The pH at which the average net charge is zero is the isoelectric point, pI, and for a simple amino acid with no ionizable side chain it is the average of the two relevant pKa values. This single idea underlies how proteins are separated by electrophoresis and how enzymes respond to their surroundings.",
      "A common misconception is picturing an amino acid in solution as a neutral molecule with intact COOH and NH₂ groups. Near physiological pH it is overwhelmingly the zwitterion, with the proton already transferred from the carboxyl to the amino group — which is why amino acids behave like salts, melting high and dissolving readily in water.",
    ],
    example: {
      problem: "Glycine has two ionizable groups: the carboxyl with pKa1 = 2.34 and the protonated amino group with pKa2 = 9.60. Determine glycine's isoelectric point, and state its dominant form and net charge at pH 7.0.",
      steps: [
        "Recall what pI means: it is the pH at which glycine carries zero average net charge, sitting between the carboxyl losing its proton and the amino group losing its proton.",
        "For an amino acid whose only ionizable groups are the carboxyl and amino, the zwitterion is the neutral species, so pI is the average of the two pKa values that bracket it.",
        "Compute: pI = (pKa1 + pKa2)/2 = (2.34 + 9.60)/2 = 11.94/2 = 5.97.",
        "Evaluate the form at pH 7.0: since 7.0 is above pKa1 (carboxyl deprotonated, −1) but below pKa2 (amino still protonated, +1), the dominant species is the zwitterion ⁺H₃N–CH₂–COO⁻.",
        "Determine the net charge and sanity-check: the +1 and −1 cancel, so the net charge is essentially zero, but because pH 7.0 sits slightly above pI 5.97 the molecule is on average a touch negative — consistent with glycine migrating slowly toward the positive electrode in electrophoresis at neutral pH.",
      ],
      answer: "Glycine's isoelectric point is pI = 5.97; at pH 7.0 it exists mainly as the zwitterion with a net charge near zero (very slightly negative).",
    },
    selfQuestions: [
      "Why is the isoelectric point of a simple amino acid the average of its two pKa values, and how would a charged side chain change that calculation?",
      "Why does an amino acid in water behave more like an ionic salt than like a typical neutral organic molecule?",
      "How does the condensation that forms a peptide bond relate to the hydrolysis that digestion uses to break it, and what is conserved between them?",
      "How would you predict the direction an amino acid migrates in an electric field if you knew only its pI and the solution pH?",
    ],
  },
};
