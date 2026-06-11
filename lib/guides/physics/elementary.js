// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — PHYSICS · ELEMENTARY.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  properties_of_materials: {
    explanation: [
      "Everything around you is made of some material — wood, metal, plastic, glass, paper, cloth. Each material has properties, which are things you can notice or test about it: hard or soft, bendy or stiff, rough or smooth, see-through or not, soaks up water or keeps it out. Properties matter because they decide what a material is good for. A window needs a see-through material, so glass works. A towel needs a material that soaks up water, so cloth works.",
      "To find a property, you test the material with your senses or a simple try-out. Press it: does it dent? Bend it: does it snap or spring back? Drip water on it: does the water soak in or sit on top? One mix-up to avoid: the object and the material are not the same thing. A paper boat and a paper hat are different objects, but they are the same material, so they share the same properties — both go soggy in water. Changing the shape does not change what the material is like.",
    ],
    example: {
      problem: "You want to make a rain hat, and you can use paper, cotton cloth, or a plastic sheet. You drip 10 drops of water onto a flat piece of each material and wait one minute. Which material is best for the rain hat?",
      steps: [
        "First decide which property matters for the job. A rain hat must keep water off your head, so you are testing whether water soaks in or stays on top.",
        "Test the paper: the 10 drops sink in fast, and after a minute the paper is wet through and starting to fall apart. Paper soaks up water.",
        "Test the cotton cloth: the drops slowly spread into the cloth, and after a minute the cloth is damp on both sides. Cloth soaks up water too, just more slowly.",
        "Test the plastic sheet: all 10 drops sit on top in little beads, and the underside is still dry after a minute. Plastic does not let water through.",
        "Compare the results to the job. Only the plastic kept its other side dry, so it is the only material here with the right property for a rain hat.",
      ],
      answer: "The plastic sheet is the best choice, because it was the only material that did not soak up the water.",
    },
    selfQuestions: [
      "Which properties would matter most if you were choosing a material for a swing seat, and how could you test for them?",
      "Why does cutting a material into a new shape leave its properties the same?",
      "What should you keep the same when testing two materials, so the comparison is fair?",
      "How would you explain to a friend the difference between an object and the material it is made from?",
    ],
  },
  states_of_matter_intro: {
    explanation: [
      "Water can be an ice cube, a drink, or the invisible steam rising from soup — the same stuff in three different states. The three states of matter are solid, liquid, and gas. A solid keeps its own shape, like a rock or a crayon. A liquid flows and takes the shape of whatever holds it, like juice in a cup. A gas spreads out to fill all the space it can reach, like the air inside a balloon.",
      "A good way to sort something is to ask two questions. Does it keep its shape when you move it to a new container? If so, it is a solid. If it flows and settles into the shape of the container, it is a liquid. If it spreads out everywhere and you cannot even see it, it is probably a gas. One common mix-up: people think a gas is nothing at all because it is invisible. But gas is real material — blow up a balloon and you can see the space the air takes up, and feel it push back when you squeeze.",
    ],
    example: {
      problem: "You have an ice cube, half a cup of water, and an empty balloon. Using a square box, a round bowl, and your own breath, sort the three things into solid, liquid, and gas.",
      steps: [
        "Put the ice cube in the square box, then move it into the round bowl. It stays a cube in both — it keeps its own shape, so ice is a solid.",
        "Pour the half cup of water into the round bowl. The water flows and spreads into a round puddle shape, but when you pour it back you still have about half a cup. A liquid changes shape, not amount.",
        "Blow your breath into the balloon. The air spreads out and fills the whole balloon evenly, with no empty corner left over. Stuff that spreads to fill all the space it can is a gas.",
        "Squeeze the balloon gently as a check. You cannot see the air, but you can feel it pushing back, which shows the gas is real material taking up space.",
      ],
      answer: "The ice cube is a solid, the water is a liquid, and the air in the balloon is a gas.",
    },
    selfQuestions: [
      "What clues would you look for to decide whether sand is a solid or a liquid, since it pours like a drink but each grain keeps its shape?",
      "How could you show a friend that air is real material even though you cannot see it?",
      "What happens to the shape and the amount of juice when you pour it from a tall glass into a wide bowl, and why?",
      "Where in your home can you find all three states of matter in the same room at the same time?",
    ],
  },
  pushes_pulls: {
    explanation: [
      "A force is a push or a pull. Every time you kick a ball, drag a wagon, open a drawer, or squeeze clay, you are using a force. Forces are how anything gets moving, speeds up, slows down, turns, or changes shape. Nothing starts to move all by itself — something has to push it or pull it first.",
      "Two things about a force matter: how strong it is and which direction it goes. A gentle push moves a toy car a little; a strong push in the same direction moves it a lot. A push from the side makes it turn instead. Here is a common mix-up: when a rolling ball slows down and stops, it did not just run out of go. The ground is rubbing against the ball the whole time, and that rubbing acts like a tiny hidden push working against the motion. Stopping has a cause, just like starting.",
    ],
    example: {
      problem: "An empty wagon sits still on a flat sidewalk marked in big squares. First you give it one gentle push, then you bring it back and give it one strong push, and last you pull its handle toward the grass. What does each force do?",
      steps: [
        "Before any push, watch the wagon: it just sits there. It will not start moving until a push or a pull acts on it.",
        "Give the gentle push and count: the wagon rolls about 2 sidewalk squares, slowing the whole way, then stops. A small force got it moving slowly.",
        "Bring it back and give the strong push: this time it rolls about 6 squares before stopping. A bigger force in the same direction means faster motion and a longer roll.",
        "Notice why it stopped both times: the sidewalk rubs against the wheels, and that rubbing is a small backward push that slowly takes the motion away.",
        "Last, pull the handle toward the grass: the wagon starts moving the way you pull. The direction of a force decides which way the motion changes.",
      ],
      answer: "Each push or pull changed the wagon's motion: the stronger push sent it farther (about 6 squares instead of 2), and the sideways pull changed its direction.",
    },
    selfQuestions: [
      "What pushes and pulls do you use between waking up and finishing breakfast, and which one is the strongest?",
      "Why does a rolling ball stop sooner on grass than the same ball rolling on a smooth gym floor?",
      "How could you make a toy car turn left using only pushes, without ever picking it up?",
      "What would you tell a friend who says the wagon stopped because it got tired?",
    ],
  },
  motion_position: {
    explanation: [
      "Where is the ball? You answer by comparing it to something else: next to the slide, under the bench, behind the tree. That comparing is what position means — where something is, told from a chosen spot. Words like near, far, above, below, left, and right only make sense when you say what they are measured from. Motion means a change of position: something moved if it is now in a different place compared to that chosen spot.",
      "To tell whether something moved, pick a landmark — a thing that stays put, like a bench or a tree — and check the object's position against it twice. If the position changed, there was motion. You can even measure the change by counting steps from the landmark. A common mix-up is saying something is just far away without saying far from what. The school might be far from your house but close to the park. Position is always a comparison, never a fact about the thing all by itself.",
    ],
    example: {
      problem: "You sit on a park bench. Your friend stands 3 big steps from the bench, by the water fountain. You close your eyes for one minute, and when you open them, your friend is 10 big steps from the bench, next to the slide. Did your friend move, and how can you be sure?",
      steps: [
        "Pick a landmark that stays put. The bench does not move, so measure every position from the bench.",
        "Record the first position: your friend was 3 steps from the bench, beside the fountain.",
        "Record the second position: now your friend is 10 steps from the bench, beside the slide.",
        "Compare the two positions: 3 steps and 10 steps are different distances, and the fountain and the slide are different places. The position changed, so your friend moved while your eyes were closed.",
        "Check your landmark choice: if you had measured from your friend's own shoes, you could never tell anything, because the shoes travel along too. You need a spot that stays still to compare against.",
      ],
      answer: "Yes — your friend moved, because their position changed from 3 big steps to 10 big steps away from the bench.",
    },
    selfQuestions: [
      "How would you describe where your bed is so a visitor could find it, and which landmarks would you use?",
      "Why is it not enough to say a playground is far away, and what is missing from that sentence?",
      "When you ride in a car, the trees seem to slide backward — what landmark is your mind using, and which landmark would make the trees stay still?",
      "How could counting steps from a rock prove that a snail moved, even though it crawls too slowly to watch?",
    ],
  },
  gravity_intro: {
    explanation: [
      "Let go of a spoon and it falls. Trip over a rock and you fall too. Gravity is the pull that drags everything down toward the ground. You cannot see gravity, but you can see what it does everywhere: rain falls, leaves drift down, a thrown ball always curves back to the grass. Gravity never turns off and never takes a day off — it pulls all day and all night, on every single thing.",
      "The pull of gravity always points the same way: down, toward the ground under your feet. Things do not fall sideways or up. Even when a ball sits still on a shelf, gravity is still pulling on it — the shelf is simply holding it up. A common mix-up: a floating balloon seems to ignore gravity. It does not. Gravity pulls the balloon down too, but the air around the light balloon pushes it up even harder, the way water pushes up a beach ball. Without that helper push from the air, the balloon would drop like everything else.",
    ],
    example: {
      problem: "At the playground, you drop a tennis ball 10 times: from knee height, from the top of the slide steps, over the grass, and over the sandbox. Before each drop you ask which way the ball will go. What do the 10 drops show?",
      steps: [
        "Drop the ball from knee height 3 times over the grass. Every time it goes straight down and lands by your feet — never up, never sideways.",
        "Climb the slide steps and drop it 3 times from up high. It still falls straight down; from higher up it simply has farther to fall, so the trip takes a little longer.",
        "Drop it 4 times over the sandbox while facing different directions. No matter where you stand or face, down is the same way: toward the ground.",
        "Count the results: 10 drops, 10 falls toward the ground, 0 surprises. When the same thing happens every single time, you have found a rule of nature.",
        "Check the rule against your memory: dropped crayons, spilled juice, and falling rain all do the same thing, so the rule is not just about tennis balls.",
      ],
      answer: "All 10 drops ended the same way: the ball fell down toward the ground, because gravity pulls everything down every time.",
    },
    selfQuestions: [
      "What strange things would happen at breakfast if gravity stopped pulling for one minute?",
      "Why does a helium party balloon rise even though gravity is pulling it down the whole time?",
      "Where does 'down' point for someone standing on the other side of the world, and why is that puzzling to think about?",
      "What clues show that gravity is still pulling on a book even while it sits perfectly still on a table?",
    ],
  },
  energy_intro: {
    explanation: [
      "What do a rolling ball, a glowing lamp, a beating drum, and a warm sunny patch on the floor have in common? Each one shows energy at work — energy is what makes things happen. It comes in kinds you can spot with your senses: motion energy in things that move, heat energy in things that are warm, light energy in things that glow, and sound energy in things you can hear. Wherever something is going on, energy is there making it go.",
      "Energy can also be stored up and saved for later, then let out. A stretched rubber band, a wound-up toy, and the food in your lunch all hold stored energy, ready to turn into motion, sound, or warmth. A common mix-up is thinking energy only means electricity from a plug or a battery. Electricity is just one carrier. Your own body turns breakfast into running and shouting at recess — that is energy changing from one kind to another, with no wires anywhere.",
    ],
    example: {
      problem: "You have a wind-up walking robot toy. You wind the key 5 turns, let it go, and it walks and clicks for about 4 seconds. Then you wind the key 10 turns and let it go. What do you expect, and what does the toy show about energy?",
      steps: [
        "Think about where the toy's go comes from. Your hand turns the key, which tightens a spring inside — winding stores energy in the spring.",
        "Watch the 5-turn test: the robot walks and clicks for about 4 seconds, then stops. The stored energy came out as motion energy and sound energy until the spring ran down.",
        "Predict the 10-turn test before letting go: twice the winding should store about twice the energy, so the robot should keep going for roughly twice as long.",
        "Let it go and count: the robot walks for about 8 seconds this time. More stored energy meant more motion and more sound, just as predicted.",
        "Make sense of it: the walking did not come from nowhere — every second of it was paid for by the winding your hand did first.",
      ],
      answer: "The 10-turn robot walks for about 8 seconds, roughly twice as long, because more winding stores more energy, which comes back out as motion and sound.",
    },
    selfQuestions: [
      "What kinds of energy can you spot in your kitchen at breakfast time, and what is each one doing?",
      "Where does the energy that moves your legs at recess come from, if you trace it back step by step?",
      "How is a stretched rubber band like a wound-up toy, and what happens to its stored energy when you let go?",
      "Why does the robot toy always stop walking after a while, even though nothing visible touches it?",
    ],
  },
  light_shadows: {
    explanation: [
      "Light comes from sources like the sun, lamps, candles, and flashlights, and it travels away from them in straight lines. You see things when light bounces off them and reaches your eyes. A shadow appears when something blocks the light: behind the blocker there is a patch the light cannot reach, and that dark patch is the shadow. That is why your shadow copies your shape — it is the outline of exactly the light your body blocked.",
      "Because light travels in straight lines, you can predict a shadow before you make it. Imagine straight lines running from the light, past the edges of the object, onto the wall or ground — the dark zone between those lines is where the shadow lands. A common mix-up is thinking a shadow is dark stuff that comes out of you. A shadow is not stuff at all; it is a place where light is missing, like a hole in the brightness. That is also why a shadow can grow, shrink, or vanish the moment the light changes.",
    ],
    example: {
      problem: "A flashlight sits on a table, shining at a wall. You stand a toy dinosaur close to the wall, and its shadow is about as tall as the toy. Then you slide the toy close to the flashlight instead. What happens to the shadow, and why?",
      steps: [
        "Start with the toy near the wall and look: the shadow is sharp and about the same size as the dinosaur, because the blocked light has almost no room to spread before reaching the wall.",
        "Remember how light moves: it leaves the flashlight in straight lines that spread farther apart as they travel toward the wall.",
        "Slide the dinosaur close to the flashlight and look again: now the shadow is huge — around three times as tall as the toy — with fuzzier edges.",
        "Explain it with the straight lines: near the flashlight, the toy blocks the light early, while the lines are still close together; that blocked gap keeps spreading all the way to the wall, so the dark patch arrives big.",
        "Check by sliding the toy slowly back toward the wall: the shadow shrinks smoothly back to about toy size, which fits the straight-line idea perfectly.",
      ],
      answer: "The shadow grows much bigger — near the flashlight the toy blocks the spreading light early, so the blocked patch keeps widening all the way to the wall.",
    },
    selfQuestions: [
      "Why is your outdoor shadow long in the early morning and short at lunchtime, and what is the sun doing in between?",
      "What would happen to your shadow if two flashlights shone at you from two different sides?",
      "How would you explain to a friend why a shadow has the same shape as the thing that makes it?",
      "Why does a clear glass of water make such a weak shadow compared with a wooden block?",
    ],
  },
  sound_vibration: {
    explanation: [
      "Every sound starts with a vibration — something moving back and forth very fast. A drum skin jumps up and down, a guitar string blurs from side to side, and your throat buzzes when you hum. The vibration shakes the air around it, and that shaking travels through the air to your ears. Rest your fingers gently on your throat and hum: the tiny buzz you feel is the start of every word you say.",
      "Two simple rules connect vibration to sound. Bigger vibrations make louder sounds, and no vibration means no sound at all — stop the shaking and the sound dies instantly. A common mix-up is thinking sound leaks out of objects the way smell drifts out of a kitchen. Sound is not stored inside things; it is made fresh each time something vibrates, and the moment the moving stops, there is nothing left to hear.",
    ],
    example: {
      problem: "You stretch a rubber band over an open shoebox. You pluck it gently, then pluck it hard, then pluck it once more and quickly pinch the band still with two fingers. What do you see, hear, and feel each time?",
      steps: [
        "Pluck the band gently and look closely: it turns into a soft blur as it wobbles back and forth fast, and you hear a quiet twang. The blur is the vibration making the sound.",
        "Pluck it hard: the blur is wider, because the band swings farther on each wobble, and the twang is clearly louder. A bigger vibration makes a bigger sound.",
        "Pluck it again and immediately pinch the band still: the sound cuts off the instant the band stops moving. No vibration, no sound.",
        "Touch the box while a twang is still ringing: you can feel a faint buzz in the cardboard, which shows the vibration spreading from the band into the box and the air.",
        "Put the clues together: every sound matched a vibration you could see or feel, and the sound was loud exactly when the vibration was big.",
      ],
      answer: "The sound comes from the band's vibration: harder plucks make wider wobbles and louder twangs, and pinching the band still silences it at once.",
    },
    selfQuestions: [
      "What is vibrating when you clap your hands, and how could you test your idea?",
      "Why does resting your fingers on a ringing bell or a humming guitar string make the sound stop?",
      "How could you make the rubber band play a quieter twang or a louder twang on purpose, without swapping the band?",
      "Where can you feel a sound with your body instead of hearing it, and what does that tell you about what sound is?",
    ],
  },
  magnets_intro: {
    explanation: [
      "A magnet pulls on certain metals without touching them — hold one near a steel paper clip and the clip jumps across the gap. That invisible pull is called magnetic force. Magnets have two ends, called poles. Two magnets can pull toward each other or push apart, depending on which ends face each other. The push and pull work right through air, and even through thin things like paper or a tabletop.",
      "The most useful fact to remember: magnets do not attract everything, and they do not even attract all metals. They grab things made of iron or steel, while plastic, wood, paper, and most other metals ignore them completely. That is the big mix-up to avoid — shiny does not mean magnetic. A ball of aluminum foil and many coins are metal, yet a magnet will not pick them up. The honest way to find out is always the same: test it.",
    ],
    example: {
      problem: "You test a magnet on 6 things: a steel paper clip, a crayon, a ball of aluminum foil, a steel spoon, a wooden block, and a rubber band. Then you put a sheet of paper between the magnet and the paper clip. What sticks?",
      steps: [
        "Predict first: many people guess that all the metal things — the foil ball, the clip, and the spoon — will stick, since they are all shiny metal.",
        "Test each one: the paper clip and the steel spoon snap onto the magnet, while the crayon, the wooden block, and the rubber band do nothing at all.",
        "Now the surprise: the aluminum foil ball does not stick either, even though it is metal. So the rule is not that metal sticks — the rule is that iron and steel stick.",
        "Sort the results: 2 out of the 6 things stuck, and both of them are made of steel, which contains iron.",
        "Run the last test: hold the magnet on one side of the paper sheet and the clip on the other — the clip still clings through the paper. Magnetic force reaches through thin materials.",
      ],
      answer: "Only the 2 steel things — the paper clip and the spoon — stick to the magnet, and the pull even works through a sheet of paper.",
    },
    selfQuestions: [
      "What test would settle an argument about whether a shiny toy is steel or aluminum, and what result would you expect for each?",
      "Why is it a mistake to say that magnets attract metal, and what is the more careful rule?",
      "What do you feel when you bring two magnets close together in different ways, and what does that tell you about their two ends?",
      "Where do magnets help out around your home, and what is each one pulling on or holding shut?",
    ],
  },
  heat_temperature_intro: {
    explanation: [
      "Temperature tells you how hot or cold something is, and a thermometer measures it as a number — a higher number means hotter stuff. Heat is something different: heat is warmth on the move. Whenever a warm thing and a cool thing touch, warmth flows from the warmer one into the cooler one. That flow is what melts an ice pop in your hand, and what slowly steals the warmth from your cocoa on a chilly morning.",
      "The direction never changes: heat always moves from warmer to cooler, never the other way. That is the big mix-up to fix — when you hold an ice cube, it feels like cold is creeping into your hand, but really warmth is leaking out of your hand into the ice. Your hand loses heat; the ice gains it and melts. Left alone together, warm things cool down and cool things warm up, until everything matches.",
    ],
    example: {
      problem: "Your room reads 20 °C on the thermometer. You set out a cup of warm water that reads 40 °C and a glass of icy water that reads 5 °C, then leave both alone for an hour. What does the thermometer show afterward, and which way did heat move?",
      steps: [
        "Compare each drink with the room at the start: the warm water (40 °C) is warmer than the room (20 °C), and the icy water (5 °C) is cooler than the room.",
        "Use the rule that heat flows from warmer to cooler. The warm cup should leak heat into the cooler room air, and the warmer room air should leak heat into the icy glass.",
        "Predict the changes: the warm water should cool down toward 20 °C, and the icy water should warm up toward 20 °C — both drifting toward the room from opposite sides.",
        "Check after an hour: the warm cup reads about 24 °C and the icy glass about 17 °C, with the ice melted away. Both numbers moved toward 20 °C, just as the rule predicted.",
        "Notice what did not happen: the warm water never got warmer, and the icy water never got icier on its own. Heat moved one way only — from warmer to cooler.",
      ],
      answer: "After an hour both drinks sit near room temperature — about 24 °C and 17 °C — because heat leaked out of the warm water into the room, and from the room into the icy water.",
    },
    selfQuestions: [
      "Why does an ice pop melt faster in your hand than on a plate, and where is the heat coming from?",
      "What is really happening when someone says to close the door so the cold does not get in?",
      "How are temperature and heat different from each other, and which one does a thermometer measure?",
      "What do you expect a glass of lemonade and a bowl of soup to read on a thermometer after sitting in the same room all afternoon, and why?",
    ],
  },
};
