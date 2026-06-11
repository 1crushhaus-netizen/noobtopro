// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — CHEMISTRY · HIGH.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  atomic_structure: {
    explanation: [
      "Every element's identity comes down to one number: how many protons sit in its nucleus. You already know matter is built from atoms; now you are looking inside one. The nucleus packs protons (positive) and neutrons (neutral) into a tiny, dense core, while electrons (negative) occupy the vast space around it. The atomic number Z counts protons and defines the element; the mass number A counts protons plus neutrons and tells you which version of the atom you have.",
      "The counting rules are mechanical once you see them: protons always equal Z, neutrons equal A − Z, and electrons equal Z in a neutral atom — adjusted up or down when the atom carries a charge. A common trap is thinking a charged atom (an ion) gained or lost protons. It never does in ordinary chemistry: only electrons move. Strip a proton from the nucleus and you no longer have an ion of the same element — you have a different element entirely.",
      "Keep the scale in mind: the nucleus holds essentially all the mass but almost none of the volume. Electrons weigh roughly 1/1800 of a proton, which is why mass number ignores them, yet those nearly massless electrons control all of the atom's chemistry, because they are what other atoms actually touch.",
    ],
    example: {
      problem: "A phosphorus ion is written ³¹P³⁻ — mass number 31, charge 3−. How many protons, neutrons, and electrons does it contain?",
      steps: [
        "Identify the element first: the symbol P means phosphorus, and the periodic table gives phosphorus atomic number 15. So there are exactly 15 protons — that proton count is what makes it phosphorus at all.",
        "Neutrons come from the mass number: A − Z = 31 − 15 = 16 neutrons. The mass number lumps together everything heavy in the nucleus, so subtracting the protons leaves the neutrons.",
        "The 3− charge means the ion holds 3 more electrons than protons (extra negatives), so electrons = 15 + 3 = 18.",
        "Sanity-check with the charge formula: charge = protons − electrons = 15 − 18 = −3, which matches the 3− in the symbol. Notice the protons never changed — only the electron count did.",
      ],
      answer: "The ³¹P³⁻ ion has 15 protons, 16 neutrons, and 18 electrons.",
    },
    selfQuestions: [
      "Why does changing the number of protons create a different element, while changing neutrons or electrons does not?",
      "If the charge on this ion had been 3+ instead of 3−, which particle count would change, in which direction, and why?",
      "Why can the mass number safely ignore electrons, and where in the atom is nearly all of the mass concentrated?",
      "How would you explain the difference between atomic number and mass number to a friend who confuses them?",
    ],
  },

  isotopes_atomic_mass: {
    explanation: [
      "Not all atoms of an element are identical. Isotopes share the same number of protons — so they are the same element with the same chemistry — but carry different numbers of neutrons, and therefore different masses. Carbon-12 and carbon-14 are both carbon; the suffix is the mass number. Since you already know protons fix identity, isotopes are simply the allowed variations in the neutron count on top of that fixed identity.",
      "This explains an odd fact about the periodic table: the atomic mass printed there is almost never a whole number, because it is a weighted average over every naturally occurring isotope. Think of it like a course grade: each isotope's mass counts in proportion to its abundance. Multiply each isotope mass by its fractional abundance, then add. The classic mistake is averaging the isotope masses straight down the middle — the true average sits closer to the more abundant isotope, sometimes much closer, and no single atom actually has the average mass.",
    ],
    example: {
      problem: "Natural copper is 69.15% copper-63 (mass 62.93 amu) and 30.85% copper-65 (mass 64.93 amu). Calculate the average atomic mass of copper.",
      steps: [
        "Convert the percent abundances to decimal fractions: 0.6915 and 0.3085. Check that they cover everything: 0.6915 + 0.3085 = 1.0000, so these two isotopes account for all natural copper.",
        "Weight each mass by its abundance. Copper-63 contributes 62.93 × 0.6915 = 43.52 amu of the average.",
        "Copper-65 contributes 64.93 × 0.3085 = 20.03 amu.",
        "Add the contributions: 43.52 + 20.03 = 63.55 amu.",
        "Sanity-check: 63.55 lies between the two isotope masses but noticeably closer to 62.93, exactly as it should, because copper-63 is more than twice as abundant — and 63.55 matches the value printed on the periodic table.",
      ],
      answer: "The average atomic mass of copper is 63.55 amu, pulled toward the more abundant copper-63.",
    },
    selfQuestions: [
      "Why does the average atomic mass land closer to the more abundant isotope, and what would equal abundances do to it?",
      "Why do two isotopes of the same element behave almost identically in chemical reactions despite their different masses?",
      "Given an element's average atomic mass and the masses of its two isotopes, how could you work backwards to find the abundances?",
      "Why is the mass on the periodic table almost never a whole number, even though every individual atom has a whole-number mass number?",
    ],
  },

  electron_config_intro: {
    explanation: [
      "Electrons around a nucleus are not scattered at random — they fill energy levels in a strict order, and writing that order down is the electron configuration. It matters because the outermost electrons decide everything about an element's bonding behavior, and because the periodic table's entire shape is a map of how those levels fill. You already know each element's atom has Z electrons when neutral; the configuration says where they sit.",
      "Picture seats filling from lowest energy upward (the aufbau principle). The levels split into subshells with fixed capacities: any s subshell holds 2 electrons, p holds 6, d holds 10. The filling order starts 1s, 2s, 2p, 3s, 3p, 4s, 3d, and the superscript on each subshell counts the electrons placed there, so all superscripts must add up to the total electron count.",
      "A common stumble is assuming the third shell must be completely full before the fourth starts. It is not: 4s sits lower in energy than 3d, so potassium and calcium fill 4s while 3d is still empty. The table itself encodes this — the row (period) an element sits in tells you its outermost occupied shell, and the column tells you how the outer subshells end.",
    ],
    example: {
      problem: "Write the full electron configuration of a neutral sulfur atom (Z = 16), state how many valence electrons it has, and predict the charge of the ion sulfur is most likely to form.",
      steps: [
        "Sulfur has 16 protons, so a neutral atom has 16 electrons to place in order of increasing energy.",
        "Fill the subshells in sequence: 1s² uses 2 (14 left), 2s² uses 2 (12 left), 2p⁶ uses 6 (6 left), 3s² uses 2 (4 left), and the final 4 go into 3p, giving 3p⁴.",
        "Write it out and audit the count: 1s² 2s² 2p⁶ 3s² 3p⁴, and 2 + 2 + 6 + 2 + 4 = 16, matching Z. The configuration is complete.",
        "Valence electrons are those in the outermost shell, n = 3 here: 3s² 3p⁴ gives 6 valence electrons. That is consistent with sulfur sitting in period 3 of the table, in the oxygen family.",
        "An atom with 6 valence electrons is 2 short of a stable octet, so sulfur tends to gain 2 electrons and form the S²⁻ ion rather than lose 6.",
      ],
      answer: "Sulfur is 1s² 2s² 2p⁶ 3s² 3p⁴, has 6 valence electrons, and typically forms S²⁻.",
    },
    selfQuestions: [
      "Why do elements in the same column of the periodic table show such similar chemistry, in terms of their configurations?",
      "How would the configuration of the S²⁻ ion differ from neutral sulfur, and which noble gas would it match?",
      "Why do electrons fill the lowest-energy subshells first, and what would be unstable about doing otherwise?",
      "How does an element's period number connect to its electron configuration, and what does its group tell you?",
    ],
  },

  periodic_trends: {
    explanation: [
      "The periodic table is more than a list — its layout predicts behavior. Because columns share the same outer electron arrangement, elements in a group react alike, and because nuclear charge and shell count change in a regular way across the grid, properties like atomic radius, ionization energy (the energy to remove an electron), and electronegativity (the pull on shared electrons) follow smooth, predictable trends.",
      "The mental model is a tug-of-war between the nucleus pulling electrons in and the number of shells pushing the outer electrons farther out. Moving across a period, protons are added but new electrons join the same shell, so the pull wins: atoms shrink, electrons get harder to remove, and electronegativity rises. Moving down a group, each row adds a whole new shell that also shields the outer electrons from the nucleus, so atoms grow and outer electrons come off more easily.",
      "The classic misconception is that atoms must get bigger across a period because they hold more electrons. They actually get smaller — the added electrons crowd into the same shell while the growing positive charge reels everything in tighter. Size is set by how strongly the outer shell is held, not by how many electrons are aboard.",
    ],
    example: {
      problem: "Rank sodium (Na), magnesium (Mg), and potassium (K) from largest to smallest atomic radius, and decide which of the three has the lowest first ionization energy.",
      steps: [
        "Place each element on the table: Na is period 3, group 1; Mg is period 3, group 2; K is period 4, group 1.",
        "Compare shell counts first, since shells dominate size: K has four occupied shells while Na and Mg have three, so K is the largest of the three.",
        "Na and Mg sit in the same period, so they have the same shells — but Mg has one more proton pulling on that same shell, so Mg is smaller than Na. The ranking is K > Na > Mg.",
        "Ionization energy runs roughly opposite to radius: the largest atom holds its outer electron farthest from the nucleus and behind the most shielding inner shells, so K gives up an electron most easily and has the lowest first ionization energy.",
        "Sanity-check against real behavior: potassium is the most violently reactive metal of the three, exactly what you expect for the atom that loses an electron most cheaply.",
      ],
      answer: "Atomic radius: K > Na > Mg; potassium has the lowest first ionization energy.",
    },
    selfQuestions: [
      "Why do atoms shrink across a period even though each step adds another electron?",
      "How do the radius and ionization-energy trends together explain why group 1 metals get more reactive going down the column?",
      "Where do the smooth trends get messy or break down, and what does that tell you about treating them as rules versus tendencies?",
      "How would you use the tug-of-war picture of nuclear pull versus shielding to explain electronegativity to a friend?",
    ],
  },

  ionic_bonding: {
    explanation: [
      "When a metal meets a nonmetal, electrons change hands rather than being shared. The metal, which holds its few outer electrons loosely, gives them up to become a positive cation; the nonmetal, hungry to complete its octet, accepts them and becomes a negative anion. The oppositely charged ions then attract each other in every direction, locking into a rigid, repeating crystal lattice. You already know why each side wants this from periodic trends: both ions end up with a stable noble-gas electron arrangement.",
      "Writing the formula is a charge-balancing exercise: the compound must be electrically neutral overall, so you need the smallest whole-number ratio of cations to anions whose charges cancel. The quick route is to find the least common multiple of the two charges. Strong attractions throughout the lattice are also why ionic compounds tend to be brittle, high-melting solids that conduct only when melted or dissolved.",
      "The big misconception is reading a formula like NaCl as a molecule — one sodium handcuffed to one chlorine. There are no molecules in an ionic solid. The formula only reports the ratio of ions in an endless three-dimensional lattice where every ion touches several oppositely charged neighbors.",
    ],
    example: {
      problem: "Aluminum reacts with oxygen to form an ionic compound. Predict the charges on each ion, work out the formula, and name the compound.",
      steps: [
        "Read the charges off the table: aluminum is in group 13 with 3 valence electrons, so it loses all 3 to form Al³⁺; oxygen is in group 16 with 6 valence electrons, so it gains 2 to form O²⁻.",
        "Balance the charges with the smallest whole-number ratio. The least common multiple of 3 and 2 is 6, so you need two Al³⁺ (total 6+) for every three O²⁻ (total 6−).",
        "Write the ratio as subscripts, cation first: Al₂O₃.",
        "Verify neutrality: 2 × (+3) + 3 × (−2) = +6 − 6 = 0, so the formula is electrically neutral as required. The name is aluminum oxide — the metal keeps its name and the nonmetal takes an -ide ending.",
      ],
      answer: "The compound is Al₂O₃, aluminum oxide, built from Al³⁺ and O²⁻ ions in a 2:3 ratio.",
    },
    selfQuestions: [
      "Why does the metal lose electrons and the nonmetal gain them, rather than the other way around?",
      "How does the lattice structure explain why ionic compounds are brittle and have high melting points?",
      "What does a subscript in an ionic formula physically describe, given that no individual molecules exist in the crystal?",
      "How would the formula change if you swapped aluminum for a group 2 metal like calcium, and why?",
    ],
  },

  covalent_bonding: {
    explanation: [
      "Nonmetals solve the octet problem differently: instead of transferring electrons, two nonmetal atoms share pairs of them, and each shared pair is a covalent bond. Both atoms count the shared electrons toward their own octet, so both can reach a noble-gas arrangement without anyone fully giving anything up. Sharing produces true molecules — discrete units like H₂O or CO₂ — which is why covalent substances are often gases, liquids, or soft solids with low melting points.",
      "A Lewis structure is the bookkeeping tool: count all valence electrons in the molecule, connect atoms with single bonds in a sensible skeleton (the less electronegative atom usually goes in the center), spread the remaining electrons as lone pairs starting with the outer atoms, and if any atom still falls short of an octet, convert lone pairs into extra shared pairs to make double or triple bonds.",
      "Two corrections worth making early: a double bond shares four electrons (two pairs), not two; and sharing is rarely equal. When the bonded atoms differ in electronegativity, the shared pair sits closer to the stronger puller, making the bond polar — covalent and ionic bonding are two ends of one sliding scale, not separate worlds.",
    ],
    example: {
      problem: "Draw the Lewis structure of carbon dioxide, CO₂: find the total valence electrons, place the bonds and lone pairs, and confirm every atom has an octet.",
      steps: [
        "Count the supply: carbon brings 4 valence electrons and each oxygen brings 6, so the total is 4 + 2 × 6 = 16 electrons to place.",
        "Build the skeleton with carbon in the center (it is less electronegative than oxygen) and a single bond to each oxygen. Two single bonds use 4 electrons, leaving 12.",
        "Distribute the remaining 12 as lone pairs on the outer atoms: 6 on each oxygen. Now each oxygen has an octet (2 bonding + 6 nonbonding), but carbon has only 4 electrons around it — 4 short.",
        "Fix carbon's deficit by sharing more: move one lone pair from each oxygen into the bonding region, turning both bonds into double bonds, written O=C=O.",
        "Audit the result: carbon now shares four pairs (8 electrons), each oxygen has two bonding pairs plus two lone pairs (8 electrons), and the total is still 16. Every atom has an octet, so the structure is complete.",
      ],
      answer: "CO₂ is O=C=O — two double bonds to the central carbon, with two lone pairs left on each oxygen.",
    },
    selfQuestions: [
      "What signals during the Lewis procedure tell you a molecule needs a double or triple bond?",
      "Why do molecular (covalent) substances usually melt at far lower temperatures than ionic ones?",
      "How does a difference in electronegativity between two bonded atoms change where the shared pair spends its time?",
      "Where does the octet guideline break down, and why should you treat it as a strong default rather than a law?",
    ],
  },

  metallic_bonding: {
    explanation: [
      "Picture a metal as a lattice of positive ions sitting in a shared sea of electrons. Each metal atom releases its outer electrons into a common pool that belongs to the whole crystal rather than to any single atom, and the attraction between the fixed cations and this mobile electron sea is the metallic bond. You already know metals sit on the left of the periodic table and hold their valence electrons loosely — metallic bonding is what those loose electrons do when there is no nonmetal around to take them.",
      "This one model explains the familiar metal package. Conductivity: the delocalized electrons drift the moment a voltage is applied, and they also ferry heat quickly. Malleability: because no electron is tied to a particular neighbor, planes of cations can slide past each other while the electron sea keeps gluing everything together — the crystal dents instead of shattering. Bond strength scales with the glue: more delocalized electrons per atom, higher cation charge, and smaller cations all mean stronger bonding and higher melting points.",
      "Do not picture metals as ionic compounds with fixed partners or as molecules with fixed shared pairs. The defining feature is that the bonding electrons are delocalized — owned by the entire lattice — which is exactly what an ionic crystal lacks, and why salt shatters under a hammer while copper flattens.",
    ],
    example: {
      problem: "Sodium melts at about 98 °C while magnesium melts at about 650 °C, yet both are period 3 metals. Use the metallic bonding model to explain the gap, and explain why both metals still conduct electricity well.",
      steps: [
        "Count the glue each atom contributes: sodium (group 1) releases 1 electron per atom into the sea, leaving Na⁺ cations, while magnesium (group 2) releases 2 per atom, leaving Mg²⁺ cations.",
        "Compare the attractions: magnesium has doubly charged cations attracted to twice the density of delocalized electrons, and Mg²⁺ is also smaller than Na⁺, so the cations sit closer to the electron sea. Every factor strengthens magnesium's bonding.",
        "Connect strength to melting: melting requires loosening the cations from their lattice positions against that attraction, so magnesium's much stronger bonding demands far more energy — hence roughly 650 °C versus 98 °C.",
        "Address conductivity separately: both metals have mobile, delocalized electrons that drift under an applied voltage, so both conduct well. Conductivity needs mobile charge, not strong bonding, which is why soft, low-melting sodium is still an excellent conductor.",
      ],
      answer: "Magnesium melts far higher because each atom supplies two electrons to the sea and forms smaller, doubly charged Mg²⁺ cations, giving much stronger attractions; both metals conduct because their electron seas are mobile either way.",
    },
    selfQuestions: [
      "Why can a metal be hammered into a sheet while an ionic crystal with similar bond strength shatters?",
      "How does the electron-sea model explain why metals conduct heat as well as electricity?",
      "What should happen to melting points going down group 1, and which part of the model predicts it?",
      "How would you explain the difference between delocalized and shared-pair electrons to a friend who just learned covalent bonding?",
    ],
  },

  naming_formulas: {
    explanation: [
      "Chemical names are a precision language: one name must point to exactly one formula and back again. The first decision is always which naming system applies. A metal with a nonmetal means ionic rules: name the cation, then the anion with an -ide ending (or its polyatomic name like sulfate or nitrate), and never use counting prefixes because the charges already fix the ratio. Two nonmetals mean covalent rules: use prefixes (mono-, di-, tri-, tetra-) because the same pair of elements can form several different molecules, like CO and CO₂.",
      "Ionic formulas come from charge balance, which you already know from ionic bonding: find each ion's charge, then take the smallest ratio that cancels to zero. Transition metals add one wrinkle — many can form more than one cation, so a Roman numeral in the name, as in iron(III), states the charge outright. Polyatomic ions like SO₄²⁻, NO₃⁻, OH⁻, and CO₃²⁻ travel as a unit; when you need more than one, parentheses keep the unit intact.",
      "The classic error is mixing the systems — calling CaCl₂ calcium dichloride. Prefixes belong to covalent compounds only; for ionic compounds the name calcium chloride is already unambiguous, because Ca²⁺ and Cl⁻ can combine in only one neutral ratio.",
    ],
    example: {
      problem: "Write the chemical formula for iron(III) sulfate, showing how the charges determine every subscript.",
      steps: [
        "Decode the name: the Roman numeral (III) says the iron cation is Fe³⁺, and sulfate is the polyatomic anion SO₄²⁻ — a charge you recall from the common-ion list rather than derive.",
        "Balance the charges with the smallest whole numbers: the least common multiple of 3 and 2 is 6, so use two Fe³⁺ (total 6+) and three SO₄²⁻ (total 6−).",
        "Assemble the formula, wrapping the polyatomic ion in parentheses because there is more than one of it: Fe₂(SO₄)₃. Without parentheses the subscript would scramble the sulfate unit.",
        "Verify neutrality: 2 × (+3) + 3 × (−2) = 0, so Fe₂(SO₄)₃ is the correct neutral formula.",
      ],
      answer: "Iron(III) sulfate is Fe₂(SO₄)₃ — two Fe³⁺ ions balancing three SO₄²⁻ ions.",
    },
    selfQuestions: [
      "Why do covalent compounds need counting prefixes while ionic compounds must not use them?",
      "Why does iron's name carry a Roman numeral when calcium's never does?",
      "When exactly are parentheses required in a formula, and what would go wrong without them?",
      "Starting from a bare formula like Cu(NO₃)₂, what sequence of decisions recovers its correct name?",
    ],
  },

  balancing_equations: {
    explanation: [
      "A chemical equation is a before-and-after inventory of atoms: reactants on the left, products on the right, and an arrow for the transformation. Because atoms are never created or destroyed in a reaction — the conservation of mass you already know — every element must appear in equal numbers on both sides. Balancing means choosing whole-number coefficients (the multipliers in front of each formula) until the inventory matches.",
      "Work systematically: balance one element at a time, start with elements that appear in only one substance per side, and save lone elements (like a bare metal or O₂) for last since their coefficients adjust freely without disturbing anything else. When an element comes in mismatched group sizes — say twos on one side and threes on the other — jump straight to the least common multiple instead of nudging coefficients one at a time.",
      "The cardinal sin is changing a subscript to force a balance. Coefficients say how many units react; subscripts say what the substance is. Turning H₂O into H₂O₂ does not balance water — it silently swaps water for hydrogen peroxide, a different chemical entirely.",
    ],
    example: {
      problem: "Iron rusts in oxygen according to the unbalanced equation Fe + O₂ → Fe₂O₃. Balance it.",
      steps: [
        "Take inventory: the left has 1 Fe and 2 O; the right has 2 Fe and 3 O. Nothing matches yet.",
        "Tackle oxygen first because it appears in awkward group sizes — packets of 2 on the left and 3 on the right. The least common multiple is 6, so place a 2 before Fe₂O₃ (giving 6 O) and a 3 before O₂ (also 6 O).",
        "Now repair iron: 2 Fe₂O₃ contains 4 Fe, so put a 4 in front of the lone Fe on the left. Saving the lone element for last meant this fix disturbed nothing else.",
        "Final audit: 4 Fe + 3 O₂ → 2 Fe₂O₃ gives Fe: 4 = 4 and O: 6 = 6. Balanced, and the coefficients 4, 3, 2 share no common factor, so they are already in lowest terms.",
        "Read the result as a recipe: every 4 atoms (or moles) of iron consume 3 molecules (or moles) of O₂ to make 2 formula units (or moles) of Fe₂O₃ — the ratio holds at any scale.",
      ],
      answer: "The balanced equation is 4 Fe + 3 O₂ → 2 Fe₂O₃.",
    },
    selfQuestions: [
      "Why does changing a subscript break the chemistry even when it seems to fix the atom count?",
      "Why is it efficient to balance lone elements last, and what makes their coefficients safe to adjust?",
      "What do the final coefficients mean at the scale of individual particles versus the scale of moles?",
      "How would you quickly convince someone that a finished equation really is balanced?",
    ],
  },

  mole_molar_mass: {
    explanation: [
      "Atoms are far too small to count one at a time, so chemistry uses a bulk counting unit: the mole, which is 6.022 × 10²³ particles (Avogadro's number), the same way a dozen is 12. The unit is sized so the bridge to the lab bench is effortless: one mole of a substance has a mass in grams numerically equal to its formula mass in amu. Carbon's atoms average 12.0 amu, so one mole of carbon weighs 12.0 g — that number, 12.0 g/mol, is its molar mass.",
      "To get a compound's molar mass, add up the molar masses of every atom in the formula, multiplying through any subscripts and parentheses. Then conversions become one-step arithmetic: divide grams by molar mass to get moles, multiply moles by molar mass to get grams, and multiply moles by 6.022 × 10²³ to count particles.",
      "Keep the idea straight: a mole is a count, not a mass. A mole of feathers and a mole of lead contain identical numbers of particles but wildly different masses, just as a dozen eggs and a dozen bowling balls weigh nothing alike. Mass per mole differs between substances precisely because their particles differ in mass.",
    ],
    example: {
      problem: "How many moles are in 18.5 g of calcium hydroxide, Ca(OH)₂, and roughly how many formula units is that? Use Ca = 40.1, O = 16.0, H = 1.0 g/mol.",
      steps: [
        "Compute the molar mass, remembering the subscript 2 outside the parentheses doubles everything inside: 40.1 + 2 × (16.0 + 1.0) = 40.1 + 34.0 = 74.1 g/mol.",
        "Convert mass to moles by dividing by molar mass: 18.5 g ÷ 74.1 g/mol = 0.250 mol. The division makes sense dimensionally — grams divided by grams-per-mole leaves moles.",
        "Count the particles: 0.250 mol × 6.022 × 10²³ formula units/mol ≈ 1.51 × 10²³ formula units of Ca(OH)₂.",
        "Sanity-check the size: 18.5 g is almost exactly one quarter of 74.1 g, so getting one quarter of a mole confirms the arithmetic.",
      ],
      answer: "18.5 g of Ca(OH)₂ is 0.250 mol, or about 1.51 × 10²³ formula units.",
    },
    selfQuestions: [
      "Why is the molar mass in g/mol numerically the same as the formula mass in amu — what makes that no coincidence?",
      "Why do chemists insist on converting to moles instead of comparing substances gram for gram?",
      "If you had 18.5 g of a compound with twice the molar mass, what would happen to the mole count and the particle count?",
      "How would you explain to a friend what Avogadro's number actually counts and why it is so enormous?",
    ],
  },

  stoichiometry: {
    explanation: [
      "Stoichiometry turns a balanced equation into quantitative predictions: given an amount of one substance, it tells you how much of any other substance the reaction consumes or produces. It works because the coefficients you learned to balance are mole ratios — exact exchange rates between substances — and because the mole, which you can reach from any mass, is the common currency.",
      "Every mass-to-mass problem travels the same three-leg highway: convert the given mass to moles using its molar mass, hop across the equation using the coefficient ratio, then convert the new moles back to mass with the other substance's molar mass. Writing each leg with units and canceling them is your built-in error detector — if the units do not cancel to what you want, the setup is wrong.",
      "The trap to avoid is applying coefficients directly to grams. A ratio of 1 : 3 in the equation means 1 mole to 3 moles, never 1 gram to 3 grams, because different substances pack different masses into each mole. Skipping the mole conversion is the single most common stoichiometry error.",
    ],
    example: {
      problem: "Propane burns by C₃H₈ + 5 O₂ → 3 CO₂ + 4 H₂O. What mass of CO₂ is produced when 11.0 g of propane burns completely? Use C = 12.0, H = 1.0, O = 16.0 g/mol.",
      steps: [
        "Confirm the equation is balanced before trusting its ratios: C is 3 = 3, H is 8 = 8, and O is 10 on the left versus 3 × 2 + 4 × 1 = 10 on the right. Safe to proceed.",
        "Leg one — mass to moles of the given: M(C₃H₈) = 3 × 12.0 + 8 × 1.0 = 44.0 g/mol, so 11.0 g ÷ 44.0 g/mol = 0.250 mol propane.",
        "Leg two — cross the equation: the coefficients say 3 mol CO₂ form per 1 mol C₃H₈, so 0.250 mol × 3 = 0.750 mol CO₂.",
        "Leg three — moles back to mass: M(CO₂) = 12.0 + 2 × 16.0 = 44.0 g/mol, so 0.750 mol × 44.0 g/mol = 33.0 g of CO₂.",
        "Sanity-check: propane and CO₂ happen to share the molar mass 44.0 g/mol, so the 3:1 mole ratio shows up directly as a 3:1 mass ratio here — 33.0 g really is three times 11.0 g, a coincidence worth noticing rather than expecting.",
      ],
      answer: "Burning 11.0 g of propane produces 33.0 g of CO₂.",
    },
    selfQuestions: [
      "Why must every stoichiometry path pass through moles rather than jumping from grams to grams?",
      "How would the calculation change if only a limited amount of oxygen were available instead of excess?",
      "How would you extend the same three-leg method to find the mass of O₂ consumed by the 11.0 g of propane?",
      "What goes wrong, numerically and conceptually, if someone reads the coefficients as gram ratios?",
    ],
  },

  reaction_types: {
    explanation: [
      "Most reactions you will meet fall into a handful of recurring patterns, and recognizing the pattern lets you predict products before you ever see them. The big five: synthesis (two substances combine into one, A + B → AB), decomposition (one breaks apart, AB → A + B), single replacement (a lone element swaps in for its kind in a compound), double replacement (two dissolved compounds trade partners), and combustion (a fuel reacts with O₂, hydrocarbons yielding CO₂ and H₂O).",
      "Classify by looking at the cast of reactants. Two elements alone suggest synthesis; one compound alone, often heated, suggests decomposition; an element next to a compound flags single replacement, with the activity series deciding whether the swap actually happens; two ionic compounds in solution flag double replacement, which only proceeds if swapping partners produces a precipitate, a gas, or water. After predicting products, always re-balance the new equation.",
      "Treat the five types as useful filing folders, not laws of nature. Plenty of reactions fit two folders at once — magnesium burning in oxygen is both combustion and synthesis — and many real reactions fit none. The classification is a prediction aid, not a complete map of chemistry.",
    ],
    example: {
      problem: "Aqueous silver nitrate is mixed with aqueous sodium chloride. Predict the products, classify the reaction, and write the balanced equation with state labels.",
      steps: [
        "Survey the reactants: AgNO₃(aq) and NaCl(aq) are two ionic compounds dissolved in water, the signature setup for a double replacement, so try swapping partners: silver with chloride, sodium with nitrate.",
        "Write the candidate products with correct charges: Ag⁺ and Cl⁻ make AgCl, while Na⁺ and NO₃⁻ make NaNO₃ — both combine 1:1 because all four ions carry single charges.",
        "Check for a driving force, since a swap with no driving force is no reaction at all: solubility rules say nitrates and sodium salts stay dissolved, but AgCl is famously insoluble, so a solid precipitate forms and the reaction genuinely proceeds.",
        "Assemble and balance: AgNO₃(aq) + NaCl(aq) → AgCl(s) + NaNO₃(aq). Counting each element shows everything is already 1:1:1:1, so the equation is balanced as written.",
      ],
      answer: "A double replacement (precipitation) reaction: AgNO₃(aq) + NaCl(aq) → AgCl(s) + NaNO₃(aq), with white solid AgCl falling out of solution.",
    },
    selfQuestions: [
      "How does spotting a reaction's type cut down the work of predicting its products?",
      "What evidence tells you a double replacement actually happened rather than the ions just remaining mixed in solution?",
      "How would you use the activity series to decide whether a proposed single replacement reaction occurs?",
      "Why can one reaction legitimately belong to two categories at once, and what example would you give?",
    ],
  },

  gas_laws: {
    explanation: [
      "Gases are the state where the particle model pays off most directly: molecules in constant random motion, far apart, colliding with the container walls — and each wall collision contributes to pressure. Four variables describe any gas sample: pressure P, volume V, temperature T, and amount n in moles. The named laws you may have met — Boyle (P and V inversely related), Charles (V grows with T) — are each just one slice of a single master relationship, the ideal gas law PV = nRT, where R is a constant (0.0821 L·atm/(mol·K) when pressure is in atmospheres).",
      "Each connection is mechanical once you think in collisions. Squeeze the volume and the same molecules hit the walls more often: pressure rises. Heat the gas and molecules move faster, hitting harder and more often: pressure or volume must rise. Add moles and there are more colliders. Notably absent is the gas's identity — at ordinary conditions, ideal behavior depends only on how many particles there are, not what they are.",
      "The non-negotiable rule: temperature must be in kelvin (K = °C + 273). Celsius has an arbitrary zero, so going from 10 °C to 20 °C is nowhere near doubling the molecular motion. Kelvin starts at absolute zero, where motion effectively stops, making temperature truly proportional to molecular kinetic energy — feed Celsius into a gas law and every answer comes out wrong.",
    ],
    example: {
      problem: "What volume does 0.500 mol of nitrogen gas occupy at 25 °C and a pressure of 1.20 atm? Use R = 0.0821 L·atm/(mol·K).",
      steps: [
        "List the variables and fix the units first: n = 0.500 mol, P = 1.20 atm, and T = 25 + 273 = 298 K — the Celsius-to-kelvin conversion is the step you must never skip.",
        "Rearrange the ideal gas law for the unknown: PV = nRT becomes V = nRT/P.",
        "Substitute and compute the numerator: 0.500 × 0.0821 × 298 = 12.2 L·atm.",
        "Divide by the pressure: V = 12.2 ÷ 1.20 = 10.2 L.",
        "Sanity-check against a benchmark: near 0 °C and 1 atm, one mole of any ideal gas fills about 22.4 L, so half a mole should be around 11 L; our sample is a bit warmer (more volume) but at higher pressure (less volume), so 10.2 L is exactly the right neighborhood.",
      ],
      answer: "The 0.500 mol of N₂ occupies about 10.2 L at 25 °C and 1.20 atm.",
    },
    selfQuestions: [
      "Why does every gas law demand kelvin, and what specifically breaks if you plug in Celsius?",
      "Using the collision picture, what happens to pressure when volume is halved at constant temperature, and why?",
      "Why does the identity of the gas not appear anywhere in PV = nRT?",
      "Under what conditions does a real gas stop behaving ideally, and which assumptions of the model fail there?",
    ],
  },

  solutions_concentration: {
    explanation: [
      "Dissolving salt in water gives a solution — solute dispersed uniformly through solvent — but chemistry needs to know how much is in there, not just that it dissolved. The workhorse measure is molarity: M = moles of solute per liter of solution. A 0.200 M solution carries 0.200 mol of solute in every liter, which makes molarity a direct bridge between a volume you can measure with glassware and a mole count you can feed into stoichiometry.",
      "Read the definition carefully: the denominator is liters of final solution, not liters of water added. That is why solutions are prepared by dissolving the solute first and then adding solvent up to the target volume mark. Dilution follows from one conserved idea — adding solvent changes the volume but not the moles of solute — which is exactly the content of M₁V₁ = M₂V₂: the same moles spread through more liquid.",
      "The misconception to dodge is thinking dilution removes solute or that concentration is an amount. Concentration is a density of particles, amount is the particle count; pouring half a solution down the drain halves the moles but leaves the molarity untouched, while adding water leaves the moles untouched and lowers the molarity.",
    ],
    example: {
      problem: "You need 250.0 mL of a 0.200 M sodium chloride solution. What mass of NaCl should you weigh out? Use Na = 23.0, Cl = 35.5 g/mol.",
      steps: [
        "Convert the volume into the units molarity speaks: 250.0 mL = 0.2500 L of final solution.",
        "Find the moles the solution must contain, straight from the definition M = n/V rearranged: n = M × V = 0.200 mol/L × 0.2500 L = 0.0500 mol of NaCl.",
        "Convert moles to a weighable mass: M(NaCl) = 23.0 + 35.5 = 58.5 g/mol, so mass = 0.0500 mol × 58.5 g/mol = 2.93 g.",
        "Sanity-check: a full liter of 0.200 M NaCl would need 0.200 × 58.5 = 11.7 g, and a quarter of a liter should need a quarter of that — 11.7 ÷ 4 = 2.93 g. Consistent.",
        "Note the technique the definition forces: dissolve the 2.93 g in less water first, then fill up to the 250.0 mL mark — adding 250 mL of water to the solid would overshoot the final volume and undershoot the concentration.",
      ],
      answer: "Weigh out 2.93 g of NaCl and dilute to a final volume of 250.0 mL.",
    },
    selfQuestions: [
      "Why is molarity defined per liter of solution rather than per liter of solvent, and how does that change lab procedure?",
      "How does the dilution equation M₁V₁ = M₂V₂ follow from the fact that moles of solute are conserved?",
      "If a solution warms up and expands slightly, what happens to its molarity even though nothing was added?",
      "How would you use a known molarity and a measured volume to feed a reaction calculation, and why is that pairing so useful?",
    ],
  },

  acids_bases_intro: {
    explanation: [
      "Lemon juice, vinegar, soap, and drain cleaner sit on a single chemical axis. Acids release hydrogen ions (H⁺) into solution; bases release hydroxide ions (OH⁻) or soak up H⁺. Mixed together they neutralize each other, producing water and a salt. The pH scale compresses the huge range of possible H⁺ concentrations into a convenient 0–14 ruler: pH = −log[H⁺], with 7 neutral at 25 °C, lower numbers acidic, higher numbers basic.",
      "Because the scale is logarithmic, each step of one pH unit means a tenfold change in H⁺ concentration — that is the point most worth internalizing. The common misconception is reading pH like a linear scale, as if pH 2 were merely twice as acidic as pH 4; it is actually 100 times more concentrated in H⁺. Also keep strong versus concentrated separate: a strong acid like HCl dissociates completely into ions, which is a statement about behavior, while concentration is a statement about how much was dissolved — a dilute strong acid and a concentrated weak acid can even have similar pH.",
    ],
    example: {
      problem: "A solution of hydrochloric acid has a concentration of 0.010 M. Find its pH, classify the solution, and determine how many times more concentrated its H⁺ is compared with black coffee at pH 5.0.",
      steps: [
        "Use the strength of HCl: as a strong acid it dissociates completely, so every dissolved HCl donates its H⁺ and [H⁺] = 0.010 M = 1.0 × 10⁻² M. For a weak acid this shortcut would not be allowed.",
        "Apply the definition: pH = −log(1.0 × 10⁻²) = 2.00, since the logarithm of 10⁻² is exactly −2.",
        "Classify: pH 2.00 is well below 7, so the solution is strongly acidic — consistent with stomach acid, which is similar in strength.",
        "Compare with the coffee using the tenfold-per-unit rule: the pH difference is 5.0 − 2.0 = 3.0 units, so the acid has 10³ = 1000 times the H⁺ concentration.",
        "Verify directly from the concentrations: 1.0 × 10⁻² M versus 1.0 × 10⁻⁵ M is indeed a factor of 1000, confirming the shortcut.",
      ],
      answer: "The solution has pH 2.00, is strongly acidic, and carries 1000 times the H⁺ concentration of pH 5.0 coffee.",
    },
    selfQuestions: [
      "Why is a logarithmic scale a sensible choice for reporting acidity, given the range of possible H⁺ concentrations?",
      "What does it mean chemically when an acid and a base neutralize each other, and what ends up in the beaker?",
      "If you dilute a strong acid by a factor of ten, what happens to its pH, and why does repeating this never push pH past 7?",
      "How would you explain the difference between a strong acid and a concentrated acid to a friend who uses the words interchangeably?",
    ],
  },

  thermochemistry_intro: {
    explanation: [
      "Every chemical or physical change comes with an energy transaction. Reactions that release heat to the surroundings are exothermic (burning fuel, hand warmers); reactions that absorb heat are endothermic (cold packs, melting ice). Thermochemistry is the accounting system for these flows, and its basic measuring trick is simple: let the heat flow into or out of something whose warming you can track — usually water — and read the temperature change.",
      "The central tool is q = mcΔT: heat transferred equals mass times specific heat capacity times temperature change. Specific heat c is the joules needed to raise 1 g of a substance by 1 °C, and water's value, 4.18 J/(g·°C), is unusually large — water is a heat sponge, which is why coastal climates are mild and why water makes a good coolant. A positive q means the substance absorbed energy; negative means it released energy.",
      "Keep heat and temperature distinct — conflating them is the classic error. Temperature measures how vigorously particles are moving on average; heat is energy in transit between objects at different temperatures. A bathtub at 40 °C holds vastly more thermal energy than a teaspoon of water at 90 °C, despite the lower temperature, because energy scales with the amount of matter as well.",
    ],
    example: {
      problem: "A kettle heats 250.0 g of water from 22.0 °C to 98.0 °C. How much heat does the water absorb? The specific heat of water is 4.18 J/(g·°C).",
      steps: [
        "Find the temperature change first: ΔT = 98.0 − 22.0 = 76.0 °C. Only the change matters to the formula, not the individual readings.",
        "Set up q = mcΔT with everything in matching units: q = 250.0 g × 4.18 J/(g·°C) × 76.0 °C.",
        "Compute in stages to stay honest: 250.0 × 4.18 = 1045 J/°C — the energy to lift this particular mass of water by one degree — and then 1045 × 76.0 = 79,420 J.",
        "Convert to friendlier units and fix the sign: 79,420 J ≈ 79.4 kJ, and q is positive because the water absorbed energy from the kettle element (endothermic from the water's point of view).",
        "Sanity-check the scale: tens of kilojoules to nearly boil a large mug of water matches everyday experience — an electric kettle delivering about 2000 J each second would need roughly 40 seconds.",
      ],
      answer: "The water absorbs about 79,400 J, or 79.4 kJ, of heat.",
    },
    selfQuestions: [
      "How would you explain the difference between heat and temperature using two containers of water of very different sizes?",
      "Why does water's unusually high specific heat matter for climates, oceans, and engine coolants?",
      "In a calorimetry experiment, why does measuring the water's q tell you the reaction's q, and why do the signs flip?",
      "What happens to the heat required if you double the mass of water but halve the temperature change, and why?",
    ],
  },

  reaction_rates_intro: {
    explanation: [
      "Some reactions finish in a flash — an airbag inflates in milliseconds — while others, like iron rusting, take years. Reaction rate measures the speed: how fast a reactant's concentration falls or a product's concentration rises per unit time, typically in M/s. Collision theory explains what sets the pace, building on your particle model: particles must collide, with enough energy to rearrange bonds (the activation energy) and in a workable orientation, before they can react.",
      "Every rate-boosting factor works by improving collisions. Higher concentration packs more particles into the same space, so collisions come more often. Higher temperature makes particles move faster, producing both more frequent and more energetic collisions — a double effect, which is why temperature changes rate so steeply. Grinding a solid raises surface area, exposing more particles to attack. A catalyst is subtler: it provides an alternative pathway with a lower activation energy, so a larger fraction of the existing collisions succeed.",
      "Two corrections about catalysts: they are not consumed — the same catalyst molecules emerge unchanged and keep working — and they do not create more product; they only deliver the same product sooner. Also expect rates to change over time: reactions typically start fast and slow down as reactants are used up and collisions become rarer.",
    ],
    example: {
      problem: "Hydrogen peroxide decomposes by 2 H₂O₂ → 2 H₂O + O₂. In a flask, the H₂O₂ concentration falls from 0.800 M to 0.200 M over 150 s. What is the average rate of disappearance of H₂O₂ over this interval?",
      steps: [
        "Find the change in concentration: 0.800 − 0.200 = 0.600 M of H₂O₂ was consumed during the interval.",
        "Divide the change by the elapsed time to get the average rate: 0.600 M ÷ 150 s = 0.00400 M/s, or 4.00 × 10⁻³ M/s.",
        "Mind the convention: the concentration change is negative for a reactant (it is disappearing), but rates are reported as positive numbers, so the sign is dropped when stating a rate of disappearance.",
        "Interpret what 'average' hides: the reaction ran fastest near the start, when the concentration — and so the collision frequency — was highest, and slower near the end; the instantaneous rate at 150 s is below this 0.00400 M/s average.",
      ],
      answer: "The average rate of disappearance of H₂O₂ is 4.00 × 10⁻³ M/s over the 150 s interval.",
    },
    selfQuestions: [
      "Why does a modest temperature increase speed a reaction so dramatically, given the two effects it has on collisions?",
      "Why does crushing a solid reactant into powder accelerate its reaction, in collision terms?",
      "Why do most reactions slow down as they proceed, and what would a graph of concentration versus time look like because of it?",
      "How can a catalyst make a reaction faster without being used up or changing how much product forms?",
    ],
  },

  nuclear_chemistry_intro: {
    explanation: [
      "Ordinary chemistry only rearranges electrons; nuclear chemistry changes the nucleus itself, which means one element can genuinely turn into another. Unstable isotopes shed energy through radioactive decay: alpha decay ejects a helium nucleus (2 protons, 2 neutrons), beta decay converts a neutron into a proton while firing out an electron, and gamma emission releases pure high-energy radiation with no particle change. Because nuclear forces dwarf chemical bond energies, these processes release millions of times more energy per atom than any reaction in a beaker — the realm of reactors, medical isotopes, and radiometric dating.",
      "The clockwork of decay is the half-life: the time for half of any sample's radioactive nuclei to decay. It is a fixed fingerprint of each isotope, utterly indifferent to temperature, pressure, or chemical form — nothing in a lab can hurry a nucleus. To track a sample, count how many half-lives fit into the elapsed time and halve the amount that many times.",
      "The standard misconception is linear thinking: if half is gone after one half-life, surely all is gone after two. No — each half-life halves what remains, so the sequence runs 1/2, 1/4, 1/8, 1/16, approaching zero but never cleanly arriving. And the decayed atoms have not vanished; they have transmuted into a different element, with total mass-energy conserved.",
    ],
    example: {
      problem: "Iodine-131, used in thyroid treatment, has a half-life of 8.0 days. If a hospital receives a 64 mg sample, what mass of iodine-131 remains after 32 days?",
      steps: [
        "Count the half-lives that fit in the elapsed time: 32 days ÷ 8.0 days per half-life = 4 half-lives.",
        "Halve the sample once per half-life: 64 → 32 → 16 → 8 → 4 mg. Each arrow is one 8-day period acting on whatever remained, not on the original amount.",
        "Confirm with the compact formula: remaining = 64 × (1/2)⁴ = 64 ÷ 16 = 4.0 mg. The fraction left is 1/16, about 6% of the original.",
        "Interpret the fate of the rest: the other 60 mg of iodine-131 did not disappear — beta decay converted those nuclei into stable xenon-131, a different element, while the atoms themselves remain.",
      ],
      answer: "After 32 days (4 half-lives), 4.0 mg of the original 64 mg of iodine-131 remains.",
    },
    selfQuestions: [
      "Why is a half-life immune to temperature and chemical environment when ordinary reaction rates are so sensitive to both?",
      "Why does a sample not vanish completely after two half-lives, and what does the remaining-amount pattern look like over time?",
      "How do alpha and beta decay each change an atom's identity, and how would you track the atomic number through a decay?",
      "What makes nuclear processes release so much more energy than chemical ones, given what each process actually rearranges?",
    ],
  },
};

