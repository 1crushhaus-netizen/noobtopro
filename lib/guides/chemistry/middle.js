// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — CHEMISTRY · MIDDLE.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  atoms_molecules: {
    explanation: [
      "Zoom in far enough on anything — a coin, a drop of juice, the air in a balloon — and you reach atoms, the basic building units of matter. You already know matter is made of particles too small to see; atoms are what most of those particles are, or are built from. When two or more atoms bond together into a fixed group, that group is a molecule. A chemical formula is the molecule's recipe: H₂O says each water molecule is exactly two hydrogen atoms bonded to one oxygen atom.",
      "Read a formula like a parts list: the small subscript counts the atoms of the element written just before it, and no subscript means one. So CO₂ holds one carbon and two oxygens. A common trap is imagining an atom of water. There is no such thing — water is a molecule, and the smallest possible piece of water is one whole H₂O. Split that molecule apart and you no longer have water at all; you have hydrogen and oxygen, two completely different substances.",
    ],
    example: {
      problem: "The sugar your body burns for energy is glucose, with the formula C₆H₁₂O₆. How many atoms of each element are in one glucose molecule, and how many atoms in total are in 4 glucose molecules?",
      steps: [
        "Read the subscripts as counts: C₆ means 6 carbon atoms, H₁₂ means 12 hydrogen atoms, and O₆ means 6 oxygen atoms in every single molecule.",
        "Add the counts to get the size of one molecule: 6 + 12 + 6 = 24 atoms per glucose molecule.",
        "Four identical molecules carry four times as many atoms: 4 × 24 = 96 atoms in total.",
        "Sanity-check by counting element by element: 4 × 6 = 24 carbons, 4 × 12 = 48 hydrogens, 4 × 6 = 24 oxygens, and 24 + 48 + 24 = 96 — the two routes agree.",
      ],
      answer: "One glucose molecule contains 6 carbon, 12 hydrogen, and 6 oxygen atoms (24 in all), so 4 molecules contain 96 atoms.",
    },
    selfQuestions: [
      "Why is the smallest possible piece of water a molecule rather than an atom, and what would you actually get if you split that molecule?",
      "How would you explain the difference between an atom and a molecule to a friend using building blocks or beads?",
      "What changes about a substance if every one of its molecules swaps a single atom for a different kind of atom?",
      "How does the formula CO₂ tell a different story from the formula CO, even though both contain the same two elements?",
    ],
  },
  elements_compounds: {
    explanation: [
      "Roughly 118 kinds of atoms exist, yet the world holds millions of different substances. The trick is combination. A substance built from only one kind of atom — gold, oxygen, carbon — is an element; it cannot be broken into anything simpler by ordinary chemistry. A compound is built from two or more kinds of atoms chemically bonded in a fixed ratio, like H₂O or CO₂. You already know how to count atoms in a formula, so you can spot the difference: one capital-letter element symbol means element, two or more means compound.",
      "Think of elements as letters and compounds as words: a tiny alphabet spells an enormous vocabulary, and changing one letter changes the word completely. The classic mistake is treating a compound like a mixture of its elements. Water is not hydrogen and oxygen stirred together — hydrogen burns and oxygen feeds fire, yet water puts fires out. Bonding builds a genuinely new substance with its own properties, and the recipe is fixed: H₂O is water, while H₂O₂ is peroxide, a different substance entirely.",
    ],
    example: {
      problem: "Decide whether each of these is an element, a compound, or neither: the oxygen gas O₂ in a diver's tank, the carbon dioxide CO₂ you breathe out, and the air in your classroom. Give a reason for each.",
      steps: [
        "O₂: each molecule contains two atoms, but both are oxygen atoms — only one kind of atom is present, so this is an element. Being a molecule does not stop something from being an element.",
        "CO₂: carbon and oxygen atoms are bonded in a fixed 1 to 2 ratio, so this is a compound. Its properties belong to neither parent — carbon is a black solid and oxygen feeds flames, yet CO₂ is an invisible gas that smothers them.",
        "Air: it contains nitrogen, oxygen, CO₂, and water vapor mingling freely without bonds between them, and the proportions vary from place to place — so it is neither; it is a mixture.",
        "Check each verdict with two questions: how many kinds of atoms are present, and are they actually bonded in a fixed recipe? Element needs one kind; compound needs bonds plus a fixed recipe; a mixture fails the bonding test.",
      ],
      answer: "O₂ is an element, CO₂ is a compound, and air is neither — it is a mixture of unbonded gases.",
    },
    selfQuestions: [
      "Why can a substance made of two-atom molecules still count as an element, and what would have to change for it to become a compound?",
      "How is water fundamentally different from a balloon filled with both hydrogen gas and oxygen gas?",
      "What does the fixed ratio in a compound's formula guarantee about every sample of that compound, anywhere in the world?",
      "How would you sort a tray of mystery substances into elements, compounds, and mixtures if you could see their particles?",
    ],
  },
  particle_model: {
    explanation: [
      "Every solid, liquid, and gas you have ever touched follows the same hidden rulebook: matter is made of tiny particles that are always moving, with empty space between them. The particle model is that rulebook written down. In a solid the particles sit packed in a fixed pattern and vibrate in place; in a liquid they stay close but slide past each other; in a gas they fly far apart at high speed, crashing into everything. Temperature is your window into this world — the hotter something is, the faster its particles move.",
      "Use the model to predict, not just describe. Why can you squash the air in a syringe but not the water? Gas particles have huge gaps to close up; liquid particles are already nearly touching. Why does a smell cross a room? Fast-moving gas particles spread through the spaces in the air. The classic misconception is thinking the particles themselves swell, shrink, or soften when matter is heated or changes state. They do not — individual particles stay the same size and kind; only their speed, spacing, and arrangement change.",
    ],
    example: {
      problem: "You cap an empty plastic bottle tightly in a warm kitchen at 30 °C, then leave it in a refrigerator at 5 °C. An hour later the bottle has crumpled inward. Use the particle model to explain why, and predict what happens when it warms back up.",
      steps: [
        "Sealed means a fixed number of air particles are trapped inside — none can enter or leave, so any change must come from how those particles behave.",
        "Cooling from 30 °C to 5 °C makes the trapped particles move more slowly, so they hit the bottle walls less often and with less force. The outward push from inside drops.",
        "The room's air outside the fridge door — and the air inside the fridge — has not lost its push on the outside of the bottle, so the inward push now wins and the walls cave in until the pushes balance again.",
        "Predict the reverse: back at 30 °C the same particles speed up, strike the walls harder and more often, and the bottle pops back out. That confirms the particle count never changed — only the particle speed did.",
      ],
      answer: "The bottle crumples because slower, colder air particles inside push outward more weakly than the air outside pushes inward; warming it re-inflates it.",
    },
    selfQuestions: [
      "Why does squeezing a sealed syringe of air work easily while squeezing one full of water barely moves the plunger?",
      "How does the particle model explain the smell of baking cookies reaching another room, and why does it spread faster on a warm day?",
      "What exactly changes about particles when a material is heated, and what stays exactly the same?",
      "How would you use the particle model to explain why a solid keeps its shape but a liquid takes the shape of its container?",
    ],
  },
  phase_changes_particle: {
    explanation: [
      "When ice melts or water boils, not a single particle is created, destroyed, or transformed — the same H₂O molecules simply change how they are arranged and how fast they move. You already picture solids as packed vibrating particles, liquids as close sliding ones, and gases as far-flying ones. A phase change is the journey between those pictures, and energy is the ticket: heating loosens the attractions holding particles in place, while cooling lets the attractions pull them back into order.",
      "The most surprising rule appears on a thermometer. While a substance is actually melting or boiling, its temperature stops rising even though you keep heating it. Many people assume the temperature climbs the whole time, but during a phase change the incoming energy is spent prying particles away from each other rather than speeding them up — and speed is what temperature measures. Only when the change is complete does the temperature resume climbing. The same logic runs in reverse: freezing and condensing release energy while the temperature holds steady.",
    ],
    example: {
      problem: "You steadily heat a block of ice that starts at −10 °C until it has all turned to steam. Ice melts at 0 °C and water boils at 100 °C. Describe what the thermometer shows from start to finish, and explain where and why it pauses.",
      steps: [
        "From −10 °C up to 0 °C the ice particles vibrate faster and faster in their fixed pattern, so the thermometer climbs steadily.",
        "At 0 °C the reading freezes in place: every bit of incoming energy now goes into breaking the rigid arrangement so particles can slide, not into extra speed. The mixture sits at 0 °C until the last ice crystal melts.",
        "Once it is all liquid, the energy speeds the particles up again and the temperature climbs from 0 °C toward 100 °C.",
        "At 100 °C comes the second pause: energy is spent separating particles completely so they can fly off as gas. The water stays at 100 °C until it has all boiled away, and only the steam can then get hotter.",
        "Sanity-check against experience: a drink full of ice stays near 0 °C no matter how warm the day, exactly because melting pins the temperature down.",
      ],
      answer: "The temperature climbs from −10 °C, pauses at 0 °C during melting, climbs to 100 °C, then pauses again during boiling — the two plateaus are energy reorganizing particles instead of speeding them up.",
    },
    selfQuestions: [
      "Why does the temperature of melting ice stay at 0 °C even though the stove keeps pouring energy in?",
      "What happens to the energy released when steam condenses on a cold window, and where does it go?",
      "How would a heating curve look different for a substance that melts at 50 °C instead of 0 °C?",
      "How would you convince a skeptical friend that the molecules in ice, liquid water, and steam are all identical?",
    ],
  },
  physical_chemical_changes: {
    explanation: [
      "Crushing a can, melting butter, and burning toast all change matter — but not in the same way. In a physical change the substance itself survives: it may change shape, state, or get mixed in, yet the particles are still the same substance. In a chemical change the atoms regroup into new substances with new properties: burnt toast is no longer bread, and a fried egg is no longer raw egg. You already know some changes reverse easily and some do not, and this idea sharpens that instinct into a real test.",
      "The reliable question is: did a new substance appear? Look for evidence — a color change that will not undo, a gas fizzing out of a liquid, a new smell, light, or an unexpected temperature change. Reversibility alone is a tempting but unreliable test. Sugar dissolving in tea looks dramatic and is annoying to undo, yet it is physical — the sugar is still there, sweet as ever, and evaporation brings it back. Meanwhile some chemical changes can be reversed with another reaction. Judge by what the substance is, not by how flashy the change looks.",
    ],
    example: {
      problem: "Sort these four kitchen events into physical or chemical changes, with a reason for each: ice melting in lemonade, an egg frying in a pan, sugar dissolving in hot tea, and a slice of toast burning black.",
      steps: [
        "Ice melting: the solid water becomes liquid water, but every particle is still H₂O — only the state changed, so this is a physical change.",
        "Egg frying: the clear runny white turns into a firm white solid and stays that way when cooled. The proteins have been rearranged into new substances, so this is a chemical change.",
        "Sugar dissolving: the crystals vanish from sight, yet the tea tastes sweet and gentle evaporation would leave the sugar behind unchanged — the substance survived, so it is a physical change.",
        "Toast burning: the bread blackens, smells different, and crumbles into charred material that no toaster setting can turn back into bread. New substances formed, so it is a chemical change.",
        "Interpret the pattern: the deciding question was never how dramatic the event looked, but whether a new substance was present at the end.",
      ],
      answer: "Melting and dissolving are physical changes; frying the egg and burning the toast are chemical changes, because only those two produce new substances.",
    },
    selfQuestions: [
      "Why is sugar dissolving classified as a physical change even though the crystals seem to disappear completely?",
      "What pieces of evidence would convince you a mystery change in a beaker was chemical rather than physical?",
      "Where does the rule 'chemical changes cannot be reversed' break down, and what is a better test to use instead?",
      "How could two changes look almost identical from the outside yet be different on the particle level?",
    ],
  },
  chemical_reactions_intro: {
    explanation: [
      "When vinegar meets baking soda, the violent fizz is atoms switching partners. A chemical reaction takes starting substances, called reactants, and regroups their atoms into new substances, called products. Chemists sketch this with an arrow: reactants → products. Nothing magical is added or lost — the same atoms walk in and walk out, just bonded into different groups. This is the engine behind rusting, cooking, batteries, and even the energy release happening in your cells right now.",
      "Because you cannot watch atoms directly, you learn to read the evidence: a gas appearing, a color change, a solid forming in a clear liquid, a new smell, or the mixture heating up or cooling down on its own. One clue alone can mislead — bubbles also appear when water boils, and a powder vanishing might just be dissolving, which is physical. The trap is treating any single dramatic sign as proof. Strong conclusions come from stacking clues: something new appeared AND energy changed AND the change will not simply undo.",
    ],
    example: {
      problem: "You stir a spoonful of baking soda into half a cup of vinegar. It fizzes hard, the cup turns noticeably cooler, and the white powder is gone when the fizzing stops. Which observations are good evidence of a chemical reaction, and which could happen without one?",
      steps: [
        "Start with the fizz: gas is pouring out of a liquid that was not boiling and had no gas in it before. A brand-new substance — carbon dioxide, CO₂ — strongly signals a chemical reaction.",
        "Weigh the temperature drop: the mixture cooled itself, meaning the change absorbed energy from the surroundings. Energy changes accompany reactions, so this supports the case, though some dissolving can cool water a little too.",
        "Be skeptical about the vanished powder: on its own, disappearing could just mean the baking soda dissolved, which is a physical change — this clue is weak by itself.",
        "Stack the evidence: new gas plus a clear energy change plus reactants that are genuinely used up points firmly to a reaction. In words: baking soda + vinegar → carbon dioxide + water + a new salt left dissolved in the cup.",
      ],
      answer: "The fizzing (new CO₂ gas) and the cooling (energy change) are solid evidence of a chemical reaction; the powder disappearing alone could be mere dissolving.",
    },
    selfQuestions: [
      "Why are bubbles alone not proof of a chemical reaction, and what extra observation would strengthen the case?",
      "What do the atoms in the reactants have to do during a reaction for new products to appear?",
      "How would you design a quick test to decide whether a fizzing tablet in water is reacting or just releasing trapped gas?",
      "Where does the energy come from when a reaction heats up its surroundings, and where does it go when the mixture cools instead?",
    ],
  },
  conservation_mass: {
    explanation: [
      "Burn a log and the ashes weigh far less than the wood — so where did the mass go? Nowhere, in fact: it left as invisible gases. Conservation of mass says that in any change, physical or chemical, atoms are only rearranged, never created or destroyed, so the total mass before equals the total mass after. You already met this idea with mixing and melting; now it extends to full chemical reactions, where it becomes one of the most powerful bookkeeping tools in science.",
      "The mental model is an atom headcount. Every atom that enters a change must come out the other side in some product, even if that product is a gas you cannot see. The classic misconception is believing mass is genuinely lost when something burns, fizzes, or rusts away — what is really happening is that gases carry mass into the air, or pull it in from the air, without being weighed. Seal the whole event in a closed container, weigh everything, and the books always balance to the last gram.",
    ],
    example: {
      problem: "You pour 120.0 g of vinegar into a cup on a scale and add 10.0 g of baking soda. The mixture fizzes vigorously. When the fizzing stops, the cup and its contents weigh 125.6 g. How much gas escaped, and was mass actually conserved?",
      steps: [
        "Total the starting mass: 120.0 g of vinegar + 10.0 g of baking soda = 130.0 g sitting on the scale before anything happens.",
        "Compare with the final reading: the scale shows 125.6 g, so 130.0 − 125.6 = 4.4 g of mass is no longer in the cup.",
        "Account for the missing 4.4 g: the fizz was carbon dioxide gas escaping into the room. Those atoms left the cup — they did not leave the universe.",
        "Test the law properly in your head: run the same reaction in a sealed, strong bottle and the scale would read 130.0 g the whole time, because the CO₂ would be trapped and weighed.",
        "Interpret: mass only seems to vanish when a product escapes the weighing. Count every product, including gases, and conservation of mass holds exactly.",
      ],
      answer: "About 4.4 g of carbon dioxide gas escaped; mass was conserved, since the 125.6 g in the cup plus the 4.4 g of escaped gas equals the original 130.0 g.",
    },
    selfQuestions: [
      "Why does a rusting iron nail actually gain mass over time, and where must that extra mass come from?",
      "How would you set up an experiment to prove mass is conserved in a reaction that produces a gas?",
      "What happens to the atoms in gasoline when a car burns a full tank, and how can the tank empty out without a single atom being destroyed?",
      "How does the particle picture of a reaction explain why total mass can never change, no matter how dramatic the reaction looks?",
    ],
  },
  properties_density: {
    explanation: [
      "Why does a pebble sink while a massive cargo ship floats? The answer is density — how much mass is packed into each unit of volume, computed as density = mass/volume. Density belongs to a family of characteristic properties, like melting point and conductivity, that identify a substance no matter how big the sample is: a gold ring and a gold bar both have a density of about 19.3 g/cm³. You already compare materials by look and feel; characteristic properties let you identify them with numbers.",
      "On the particle level, density depends on how heavy a substance's particles are and how tightly they pack. The common trap is confusing dense with heavy. A bathtub of foam can outweigh a steel bolt, yet steel is far denser, because density compares equal volumes — one cubic centimetre against one cubic centimetre. For an irregular object, get the volume by water displacement: submerge it and the water level rises by exactly the object's volume, since 1 mL of displaced water equals 1 cm³.",
    ],
    example: {
      problem: "A souvenir keychain stamped 'pure aluminum' has a mass of 54 g. Dropped into a measuring cylinder holding 20.0 mL of water, it raises the level to 26.0 mL. Aluminum has a density of 2.7 g/cm³. Does the stamp tell the truth?",
      steps: [
        "Find the keychain's volume by displacement: the water rose from 20.0 mL to 26.0 mL, so the keychain occupies 26.0 − 20.0 = 6.0 mL, which is 6.0 cm³.",
        "Compute its density: density = mass/volume = 54 g ÷ 6.0 cm³ = 9.0 g/cm³.",
        "Compare with the claim: 9.0 g/cm³ is more than three times aluminum's 2.7 g/cm³, so this metal packs far more mass into the same space than aluminum can.",
        "Cross-check from the other direction: a genuine 6.0 cm³ aluminum keychain would have a mass of only 2.7 × 6.0 = 16.2 g, nowhere near the measured 54 g.",
        "Interpret: 9.0 g/cm³ sits right at copper's density (about 9.0 g/cm³), so the keychain is most likely a copper-based metal with a false stamp.",
      ],
      answer: "No — its density is 9.0 g/cm³, far above aluminum's 2.7 g/cm³, so the keychain is not pure aluminum and is probably copper-based.",
    },
    selfQuestions: [
      "Why can a huge steel ship float on water while a tiny steel bolt sinks straight to the bottom?",
      "How does measuring density let you check what a metal object is made of without damaging it?",
      "What would happen to your density calculation if some air bubbles clung to the object while it was underwater?",
      "Why is density a fair way to compare materials when mass alone is not, and what does dividing by volume actually accomplish?",
    ],
  },
  mixtures_solutions_separation: {
    explanation: [
      "Most of what you handle daily — sea water, soil, air, salad dressing — is not one pure substance but several mingling together. In a mixture the components keep their own identities and properties, are not chemically bonded, and can occur in any proportions. A solution is the smoothest kind of mixture: one substance, the solute, spreads particle by particle through another, the solvent, until the result looks like a single clear substance, the way salt disappears into water.",
      "Because the components keep their properties, you can pull a mixture apart by attacking a property only one component has. Filtration catches particles too large to pass through paper; evaporation removes a liquid with a low boiling point and strands the dissolved solid; a magnet picks out iron; distillation evaporates a liquid and then condenses it back to keep it. The misconception to drop is that dissolved salt is gone or has become new stuff — its particles are merely scattered among the water particles, and evaporating the water hands back the very same salt.",
    ],
    example: {
      problem: "A beach experiment leaves you with a jar of water containing loose sand and dissolved salt. Plan the steps to recover dry sand and dry salt separately, naming the property difference each step exploits.",
      steps: [
        "Deal with the sand first: it never dissolved, so its grains are huge compared with water particles. Pour the jar through filter paper — sand is trapped while salty water passes through. This step exploits the difference in particle size and solubility. Let the sand dry.",
        "Notice why filtering cannot catch the salt: its dissolved particles are spread one by one among the water particles and slip through any filter, so a different property is needed.",
        "Heat the salty water gently until the water evaporates away. Water leaves as vapor near 100 °C while salt stays put — it would need over 800 °C just to melt — leaving dry salt crystals behind. This step exploits the gap between their boiling points.",
        "Review the plan: each separation targeted a property only one component had — grain size for the sand, then easy evaporation for the water. To keep the water as well, you would trap and condense the steam, which is distillation.",
      ],
      answer: "Filter the mixture to recover the sand, then evaporate the water to leave the salt — filtration uses particle size, evaporation uses the difference in boiling points.",
    },
    selfQuestions: [
      "Why can filter paper trap sand but never trap dissolved salt, no matter how fine the paper is?",
      "How would you separate a mixture of iron filings, salt, and sand, and in what order would you run the steps?",
      "What evidence convinces you that salt dissolved in water still exists and has not chemically changed into something new?",
      "Where does a separation plan begin when you face a brand-new mixture — what do you need to know about its components first?",
    ],
  },
  periodic_table_intro: {
    explanation: [
      "Imagine a single wall chart that organizes every kind of atom in existence — that is the periodic table. Each box is one element, and the boxes are lined up by atomic number, the count of protons in one atom of that element. The genius is in the layout: rows are called periods, and columns are called groups or families, and elements sharing a column behave like chemical relatives. Metals fill the left and middle of the table, nonmetals cluster to the upper right.",
      "Treat the table as a prediction machine rather than a poster to memorize. Find an element's box and its neighborhood tells you a story: group 1 metals all react vigorously with water, group 18 gases barely react with anything, and elements in the same column form similar compounds. A common misconception is that the order is alphabetical or just by mass — it is strictly by proton count, which is why each element has exactly one fixed seat. That layout even let early chemists predict elements nobody had discovered yet, simply from the gaps.",
    ],
    example: {
      problem: "An atom in a sample has 11 protons. Use the periodic table to identify the element, decide whether it is a metal or a nonmetal, and name one other element that should behave chemically like it.",
      steps: [
        "Match protons to atomic number: 11 protons means atomic number 11, and the box numbered 11 belongs to sodium, symbol Na. The proton count alone settles the identity.",
        "Locate the box to classify it: sodium sits at the far left of the table, in period 3 and group 1 — deep in metal territory, so sodium is a metal.",
        "Use the column to find its relatives: directly above sits lithium (atomic number 3) and directly below sits potassium (atomic number 19), so both should behave much like sodium.",
        "Check the prediction against known chemistry: group 1 metals all react energetically with water — lithium fizzes, sodium dashes about the surface, potassium bursts into flame — the same family behavior growing stronger down the column, just as the table promises.",
      ],
      answer: "The element is sodium (Na), a group 1 metal in period 3, and potassium (or lithium) should behave chemically much like it.",
    },
    selfQuestions: [
      "Why does knowing only an atom's proton count pin down exactly which element it is?",
      "What can you predict about an element you have never heard of just from the group it sits in?",
      "How would chemistry class change if the elements were arranged alphabetically instead of by atomic number?",
      "Why do elements in the same column react in similar ways even though their atoms have very different masses?",
    ],
  },
  synthetic_materials: {
    explanation: [
      "Your phone case, fleece jacket, sports drink bottle, and most medicines share a secret: none of them occurs in nature. They are synthetic materials — substances people build through chemical reactions, starting from natural resources like crude oil, plants, and minerals. You already judge materials by their properties; synthetic chemistry flips that around and designs the properties on purpose, running reactions that turn raw resources into brand-new substances such as plastics, nylon, and synthetic rubber.",
      "Every synthetic material tells the same three-part story: a natural resource, a chemical reaction that rearranges its atoms into a new substance, and a product with properties chosen for a job. The word synthetic does not mean fake or inferior — and natural does not mean chemical-free, since absolutely everything is made of chemicals. The honest comparison is a trade-off: a synthetic material may be cheaper, lighter, or tougher than its natural rival, while costing more in resources, energy, or waste that lingers. Judging those trade-offs is what the topic is really about.",
    ],
    example: {
      problem: "A soccer jersey label reads 100 percent polyester. Trace where this material comes from, explain what makes it synthetic rather than natural, and weigh one benefit and one cost of choosing it over cotton.",
      steps: [
        "Start at the resource: polyester begins as crude oil pumped from underground, which refineries split into small carbon-based molecules.",
        "Follow the chemistry: reactions link thousands of those small molecules end to end into enormous chains called polymers. The resulting substance does not exist anywhere in nature, which is exactly what makes polyester synthetic.",
        "Connect properties to purpose: the designed chains make a fabric that is lightweight, strong, and quick-drying — it wicks sweat instead of soaking it up the way cotton does, which is why sports gear favors it.",
        "Weigh the other side: polyester relies on a non-renewable resource and, unlike cotton, barely decomposes, so worn-out jerseys persist as waste for a very long time.",
        "Interpret the comparison: neither fabric simply wins. Choosing a material means matching properties to the job and accepting the costs that come bundled with the benefits.",
      ],
      answer: "Polyester is a synthetic polymer built by chemically linking small crude-oil molecules into long chains; it beats cotton at drying fast and staying light, at the cost of using oil and persisting as slow-to-decay waste.",
    },
    selfQuestions: [
      "Why is the claim that natural products are chemical-free impossible, and how would you correct it politely?",
      "What three-part story — resource, reaction, product — lies behind a synthetic material you used today?",
      "How should society weigh a synthetic material that improves daily life but creates long-lasting waste?",
      "What property would you ask chemists to design into a brand-new material, and what natural material would it replace?",
    ],
  },
};
