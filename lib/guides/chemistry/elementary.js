// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — CHEMISTRY · ELEMENTARY.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  material_properties: {
    explanation: [
      "Look around you: wood, metal, plastic, glass, paper, fabric. These are materials — the stuff that objects are made from. A property is something you can notice or test about a material. Is it hard or soft? Rough or smooth? Bendy or stiff? Does water soak in or roll off? Properties matter because they decide what a material is good for. A raincoat is made from waterproof material on purpose, and a window is made from see-through glass on purpose.",
      "Keep the object and the material separate in your head. A spoon is an object, and it can be made of metal, plastic, or wood. The shape is the same each time, but the materials behave very differently. To find a property, do a small fair test: press it, bend it gently, drop water on it, or hold a magnet near it. Whatever you observe in the test — it bent, it stayed dry, it stuck to the magnet — that is a property.",
      "Here is a common mix-up: thinking that size is a property of the material. A tiny chip of glass and a big sheet of glass are both hard, smooth, and see-through. Size and shape belong to the object, not to the material. The properties of a material stay the same no matter how big or small the piece is, which is exactly why testing a small sample tells you about the whole batch.",
    ],
    example: {
      problem: "You are stirring a pot of hot soup and need to leave the spoon resting in the pot for a while. You can pick a metal spoon, a thin plastic spoon, or a wooden spoon. Which spoon is the best choice, and which properties tell you so?",
      steps: [
        "Decide which property matters most here: the soup is hot, so the big question is how each material behaves when it gets hot.",
        "Think about metal: heat travels through metal quickly, so a metal spoon left resting in hot soup soon becomes too hot to touch.",
        "Think about thin plastic: it warms up more slowly than metal, but very hot liquid can make thin plastic soft and bendy, and that is not safe near food.",
        "Think about wood: heat travels through wood very slowly, and wood stays stiff in hot water, so the handle stays cool and the spoon keeps its shape.",
        "Sanity-check against real life: cooks really do keep wooden spoons by the stove, which matches what the properties predict.",
      ],
      answer: "The wooden spoon is the best choice, because wood stays cool to hold and keeps its shape in hot soup.",
    },
    selfQuestions: [
      "Why is it smarter to test a material's properties before choosing it for a job, instead of going by how it looks?",
      "What properties would you want in a material for a window, and which everyday materials would fail your test?",
      "How would you explain to a friend the difference between an object and the material it is made from?",
      "If you cut a bar of soap in half, what changes about it and which properties stay exactly the same?",
    ],
  },
  classifying_materials: {
    explanation: [
      "You already know how to spot properties like hard, soft, waterproof, and stretchy. Classifying means picking one property as a sorting rule and putting materials into groups that follow it. People sort materials this way all the time. It helps them find the right material for a job quickly — waterproof fabric for a tent, strong metal for a bike frame, soft cotton for a pillow.",
      "The trick is to choose the rule before you start sorting. Say it out loud: does it soak up water, yes or no? Then test every item the same way and place each one in a group. The same objects can land in different groups when you change the rule. A steel fork belongs in the sinks-in-water group, the sticks-to-a-magnet group, and the hard group all at once, depending on which rule you are using.",
      "A common mistake is sorting by looks alone. Two cups can both be white, but if one is paper and one is plastic, they behave very differently in the rain. Color tells you little about what a material can do. A good sorting rule uses a property you can test with your hands, with water, or with a magnet — not just something you notice at a glance.",
    ],
    example: {
      problem: "You have six things from the kitchen: a steel fork, a paper towel, a plastic cup, a cotton sock, a glass jar, and a dry sponge. Sort them into two groups using this rule: does it soak up water?",
      steps: [
        "Agree on a fair test first: put three drops of water on each item and watch whether the drops sink in or sit on top.",
        "Test the paper towel, the cotton sock, and the sponge: the drops disappear into each one, so these three soak up water.",
        "Test the steel fork, the plastic cup, and the glass jar: the drops stay as little beads on the surface, so these three do not soak up water.",
        "Count to make sure nothing was missed: 3 items in the soaks-up group plus 3 items in the does-not group makes all 6 items sorted.",
      ],
      answer: "The paper towel, cotton sock, and sponge form the soaks-up-water group; the fork, cup, and jar form the does-not-soak group.",
    },
    selfQuestions: [
      "Why can the same set of objects end up in different groups when you change the sorting rule?",
      "What sorting rule would help you pack for a rainy camping trip, and how would you test each item against it?",
      "How could two materials look almost the same but land in different groups once you test them?",
      "What makes a sorting test fair, and what could go wrong if you tested each item a different way?",
    ],
  },
  states_of_matter_elem: {
    explanation: [
      "Matter is the stuff everything is made of, and it takes up space. It comes in three everyday states: solid, liquid, and gas. An ice cube, the water in your glass, and the invisible air around you are all matter. Knowing the state of something tells you how it will behave — whether it will hold still, pour out, or drift away and spread through a room.",
      "Each state has a simple test. A solid keeps its own shape: a spoon stays spoon-shaped wherever you put it. A liquid flows and takes the shape of its container, but the amount stays the same when you pour it from a tall glass into a wide bowl. A gas spreads out to fill all the space it can reach, the way air fills every corner of a balloon.",
      "Two things trip people up. First, air seems like nothing, but it is real matter: it puffs up balloons and pushes back when you squeeze a closed bottle. Second, powders like sugar pour, so they look like liquids. But each grain of sugar keeps its own shape, so each grain is a tiny solid. A pile only pours because thousands of small solids tumble over each other.",
    ],
    example: {
      problem: "On the breakfast table you see a bowl of sugar, a glass of milk, and a balloon someone blew up. Decide whether each thing is a solid, a liquid, or a gas, and explain the test you used.",
      steps: [
        "Start with the milk: tip the glass a little and the milk flows and takes the shape of the glass, so milk is a liquid.",
        "Now the air inside the balloon: it spreads out to fill the whole balloon evenly, and if you untie the knot it escapes and spreads through the room, so it is a gas.",
        "The sugar is the tricky one: the pile pours almost like a liquid, so look closer at a single grain instead of the whole pile.",
        "One grain of sugar sits on your fingertip and keeps its own shape without flowing, so sugar is a solid — a heap of very tiny solids.",
        "Check each answer against the tests: keeps its shape means solid, flows but keeps its amount means liquid, spreads to fill all the space means gas.",
      ],
      answer: "The sugar is a solid, the milk is a liquid, and the air inside the balloon is a gas.",
    },
    selfQuestions: [
      "How would you convince a friend that air is real matter even though you cannot see it?",
      "Why does a powder pour like a liquid even though every single grain is a solid?",
      "What test would you run on a mystery material to decide its state, and why might one test not be enough?",
      "Where in your home could you find water as a solid, a liquid, and a gas all in the same day?",
    ],
  },
  changes_of_state: {
    explanation: [
      "You already know matter can be a solid, a liquid, or a gas. A change of state happens when one of these turns into another. Melting turns a solid into a liquid, like an ice cube becoming water in your warm hand. Freezing turns a liquid into a solid, like juice becoming an ice pop. Evaporation turns a liquid into a gas that drifts invisibly into the air, like a puddle slowly disappearing.",
      "The key idea: it is the same stuff before and after, just in a new state. Warming pushes matter toward melting and evaporation; cooling pushes it toward freezing. Water freezes and ice melts at the same temperature, 0 °C — below it, liquid water turns solid; above it, ice turns liquid. Evaporation also has a partner change called condensation, when invisible water gas in the air turns back into liquid drops, like the mist on a cold window.",
      "When a puddle dries up, it is tempting to say the water is gone. It is not gone. It evaporated: it turned into an invisible gas called water vapor and floated into the air. The very same water can show up again later as drops on a cold glass or as rain. Drying is a change of state, not a disappearing act.",
    ],
    example: {
      problem: "You pour liquid juice into a mold and put it in the freezer overnight. The next hot afternoon you eat the ice pop outside, and a few drops fall onto the sidewalk. By evening the drops are gone. Name each change of state in this story.",
      steps: [
        "In the freezer, the liquid juice turns into a solid ice pop, and a liquid turning into a solid is called freezing.",
        "Out in the hot afternoon, the solid pop turns soft and drippy: the solid is becoming liquid again, which is melting.",
        "The fallen drops sit as liquid on the warm sidewalk, and by evening they have turned into invisible water vapor in the air — a liquid turning into a gas is evaporation.",
        "Notice the pattern: cooling caused the freezing, while warmth caused both the melting and the evaporation, and the juice's water was the same stuff the whole time.",
      ],
      answer: "The story shows freezing in the freezer, then melting in the afternoon heat, then evaporation of the drops on the sidewalk.",
    },
    selfQuestions: [
      "Why does a puddle dry faster on a hot, breezy day than on a cool, still one?",
      "How would you explain where the water goes when wet laundry dries on a clothesline?",
      "Melting and freezing both happen at 0 °C for water — what decides which one actually happens?",
      "What clues would tell you that the drops on the outside of a cold glass came from the air, not from inside the glass?",
    ],
  },
  heating_cooling_matter: {
    explanation: [
      "Heating and cooling are two of the easiest ways to change matter. Warm something up and it may soften, melt, or dry out faster. Cool something down and it may harden or freeze. You see this every day: chocolate melts in a warm pocket, butter hardens in the fridge, and a wet swimsuit dries in the sun. Heat is the mover behind most changes of state.",
      "Picture heating and cooling as opposite pushes on the same slide. Heating pushes a material toward soft, then runny, then gas. Cooling pushes it back toward firm and solid. For many materials the push works both ways: melt chocolate gently, let it cool, and you get solid chocolate again. The material did not become something new — it only changed state.",
      "But heating does not always just melt things. Sometimes strong heat builds a brand-new material instead. A raw egg turns white and firm in a hot pan, and no amount of cooling makes it raw again. Bread becomes brown toast, never bread again. So watch carefully: did heating only soften or melt the material, or did it create a new one with a new color, smell, or texture?",
    ],
    example: {
      problem: "You take three same-size pats of butter. You put one in the fridge, leave one on a sunny windowsill, and drop one into a frying pan that is still warm from cooking. After ten minutes, what has happened to each pat, and which change can cooling undo?",
      steps: [
        "The fridge pat: cooling makes butter firmer, so after ten minutes it is hard and barely dents when you press it.",
        "The windowsill pat: gentle warmth from the sun softens butter, so it turns squishy and shiny and starts to slump out of shape.",
        "The warm-pan pat: the pan holds plenty of heat even after cooking, so this pat melts all the way into a yellow liquid puddle.",
        "Now test what cooling can undo: pour the melted butter into a dish and chill it, and it sets into a firm pat again, so the melting is undone by cooling.",
        "Check the pattern: more warmth pushed the butter further toward liquid, and taking warmth away pushed it back toward solid — opposite pushes, just as expected.",
      ],
      answer: "The fridge pat turns hard, the windowsill pat turns soft, and the pan pat melts to liquid — and cooling can turn the melted butter solid again.",
    },
    selfQuestions: [
      "Which changes caused by heating can be undone by cooling, and which ones make a new material instead?",
      "Why does a chocolate bar melt in your pocket while a metal coin in the same pocket does not?",
      "How would you set up a fair test of how warmth changes a material, and what would you keep the same?",
      "What signs would tell you that heating made a brand-new material instead of just melting the old one?",
    ],
  },
  mixing_materials: {
    explanation: [
      "When you stir two or more materials together, you make a mixture. In a mixture, each material is still itself, even when it is hard to see. Trail mix is an easy one: you can still pick out every raisin. Salt water is sneakier: the salt seems to vanish into the water. Mixing happens all the time in cooking, cleaning, and painting, so it pays to understand what really goes on.",
      "Some solids spread out so evenly in a liquid that they seem to disappear. That is called dissolving. Salt and sugar dissolve in water: the grains break into pieces far too small to see, and those pieces spread through the whole drink. Other materials do not dissolve. Sand stirred into water just swirls around for a moment and then settles to the bottom, still plainly sand.",
      "Dissolved is not the same as gone. Stir sugar into water and taste it: every sip is sweet, so the sugar is still in there. A scale agrees — the water with its dissolved sugar weighs as much as the water and the sugar did separately. You can even get the sugar back by letting the water evaporate, which leaves the solid grains behind.",
    ],
    example: {
      problem: "You have two clear cups of warm water. You stir a spoonful of salt into the first cup and a spoonful of sand into the second. Before stirring, the first cup with its salt weighed 210 g in total. What do you see happen in each cup, and what does the first cup weigh after stirring?",
      steps: [
        "Watch the salt cup as you stir: the grains get smaller and smaller until you cannot see them at all, and the water turns clear again — the salt has dissolved.",
        "Prove the salt is still there: one tiny taste of the water is salty, so the salt spread through the water instead of vanishing.",
        "Because dissolving only spreads the salt out and nothing left the cup, the scale still reads 210 g after stirring.",
        "Now watch the sand cup: the water goes cloudy while you stir, then the sand sinks and piles up at the bottom, still easy to see — sand does not dissolve in water.",
        "Compare the two cups: both hold mixtures, but only in the salt cup did the solid dissolve and disappear from view.",
      ],
      answer: "The salt dissolves and its cup still weighs 210 g; the sand never dissolves and settles in a pile at the bottom of its cup.",
    },
    selfQuestions: [
      "How could you get the salt back out of salt water, and why does that plan work?",
      "What evidence shows that dissolved sugar is still in the water even though you cannot see it?",
      "Why does stirring sand into water never make the sand disappear the way salt does?",
      "If you mixed raisins, oats, and seeds for a snack, what makes that a mixture, and how is it different from salt water?",
    ],
  },
  reversible_irreversible: {
    explanation: [
      "Some changes can be undone, and some cannot. A reversible change lets you get the starting material back: melt an ice cube, refreeze the water, and you have ice again. An irreversible change makes a new material you cannot turn back: a burnt match never becomes a fresh match. Sorting changes into these two boxes is one of the most useful habits in science.",
      "Here is the test to run in your head. After the change, is the original material still there, just in a new state, place, or shape? Then the change is reversible — melting, freezing, dissolving, and mixing dry things usually are. Or did a brand-new material appear, often with a new color, a new smell, or bubbles? Cooking, burning, and rusting all make new materials, so they are irreversible.",
      "Do not confuse hard to undo with impossible to undo. Separating sand from water is fussy work, but it can be done, so mixing them was reversible. Toasting bread looks like a small change — the slice is only a little browner — but that brown, crunchy layer is a new material, and no fridge or freezer will ever turn toast back into soft bread.",
    ],
    example: {
      problem: "While making breakfast you watch four changes: ice cubes melting in a jug of juice, bread turning into toast, an egg frying in a pan, and sugar dissolving in warm tea. Sort the four changes into reversible and irreversible, giving a reason for each.",
      steps: [
        "Melting ice: the water from the cubes is still water, and a freezer could turn it back into ice, so this change is reversible.",
        "Toasting bread: the toast is browner, crunchier, and smells different — a new material formed, and no amount of cooling makes it soft bread again, so this is irreversible.",
        "Frying an egg: the clear, runny part turns white and firm and stays that way forever, so a new material formed and this change is irreversible too.",
        "Dissolving sugar: the tea tastes sweet, so the sugar is still in there, and letting the tea dry up would leave the sugar behind, so this change is reversible.",
        "Check the pattern: the two reversible changes only changed state or spread a material out, while the two irreversible ones made materials with new colors and textures.",
      ],
      answer: "Melting ice and dissolving sugar are reversible; toasting bread and frying an egg are irreversible.",
    },
    selfQuestions: [
      "What clues in color, smell, or texture hint that a change has made a brand-new material?",
      "Why is dissolving salt in water called reversible even though the salt seems to vanish?",
      "How would you decide whether a mystery change in the kitchen was reversible without being told?",
      "Why does freezing not undo cooking — what is different about the kind of change cooking makes?",
    ],
  },
  particles_intro: {
    explanation: [
      "Everything around you — water, air, this page, even you — is built from particles: pieces of matter far too small to see, even with a magnifying glass. There are unimaginably many of them. One drop of water holds more particles than there are people on Earth. This single idea explains a surprising amount about how solids, liquids, and gases behave.",
      "Picture the three states as three crowds. In a solid, the particles are packed tightly in fixed spots, so the solid keeps its shape. In a liquid, they stay close but slide past each other, so liquids pour. In a gas, they zoom around with big spaces between them, so gases spread out to fill a whole room. The particles themselves stay the same stuff — only their spacing and movement change.",
      "People often imagine the particles in a solid sitting perfectly still. They never stop. Even in solid ice, the particles jiggle in place, and warming matter makes its particles move faster. That is why smells drift across a room and why things mix faster in warm drinks: moving particles spread things around all on their own, with no stirring needed.",
    ],
    example: {
      problem: "You fill one clear glass with warm water and another with cold water, then gently add one drop of food coloring to each glass without stirring. In which glass does the color spread evenly first, and what does this tell you about particles?",
      steps: [
        "Watch both glasses: in each one the color slowly drifts outward in little swirls even though nobody is stirring, so something invisible must be moving it around.",
        "Bring in the particle idea: water is made of tiny moving particles, and as they move they bump the coloring around the glass.",
        "Compare the glasses over a few minutes: the warm water's color spreads evenly first, while the cold water's color takes much longer.",
        "Connect warmth to speed: warmer water means faster-moving particles, and faster particles bump and spread the coloring more quickly.",
        "Sanity-check: if water were one solid block of stuff with no moving parts, the drop would just sit there until you stirred — the slow spreading on its own is exactly what moving particles predict.",
      ],
      answer: "The color spreads evenly in the warm glass first, showing that water is made of moving particles that move faster when warm.",
    },
    selfQuestions: [
      "How does the particle idea explain why you can smell dinner cooking from another room?",
      "What would you expect to see if you repeated the food-coloring test with icy water, and why?",
      "How can the same kind of particles make a solid keep its shape but let a liquid pour?",
      "Why does squeezing a sealed bag of air feel springy — what are the particles inside doing?",
    ],
  },
  conservation_matter_intro: {
    explanation: [
      "Matter does not pop out of existence, and it does not appear from nowhere. When you melt it, freeze it, cut it, squash it, or mix it, the amount of matter stays the same. Scientists call this conservation of matter. It is why a scale is such a powerful tool: if nothing got in and nothing got out, the weight before a change equals the weight after.",
      "A good mental picture is a closed box. Imagine the change happening inside a sealed, see-through box sitting on a scale. Melt ice in the box: same reading. Dissolve salt in water in the box: the reading is the water's weight plus the salt's weight. Crush a cracker to crumbs in the box: same reading. Changing the state, shape, or look of matter never changes how much of it there is.",
      "Sometimes a scale really does read less after a change — when a puddle dries, or soup simmers with the lid off. That does not break the rule. The missing matter escaped into the air as a gas: it left the box, it was not destroyed. Whenever weight seems to vanish, hunt for the escape route instead of deciding the matter is gone.",
    ],
    example: {
      problem: "An empty plastic bottle weighs 110 g. You drop in 90 g of ice cubes and screw the cap on tightly, so the whole thing weighs 200 g on the scale. You leave the bottle on the scale until all the ice has melted. What does the scale read then?",
      steps: [
        "Check the starting total: 110 g of bottle plus 90 g of ice makes 110 + 90 = 200 g, which matches what the scale shows.",
        "Name the change that happens: the ice melts, meaning the solid water turns into liquid water — the same stuff in a new state.",
        "Look for escape routes: the cap is screwed on tightly, so no water and no vapor can leave the bottle.",
        "Apply conservation of matter: nothing was added and nothing escaped, so the amount of matter inside is unchanged and the scale still reads 200 g.",
        "Sanity-check with your eyes: the puddle of melted water looks different from the pile of cubes, but a new look and shape do not mean a new weight.",
      ],
      answer: "The scale still reads 200 g, because melting changed the state of the ice but not the amount of matter inside the sealed bottle.",
    },
    selfQuestions: [
      "Why would the scale read less over time if you left the cap off the bottle on a warm day?",
      "How would you use a scale to show a friend that dissolving sugar does not destroy it?",
      "When wood burns in a campfire and only a little ash is left, where did the rest of the matter go?",
      "Why does crushing a cracker into crumbs change how it looks but not how much it weighs?",
    ],
  },
};
