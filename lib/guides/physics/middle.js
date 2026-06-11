// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — PHYSICS · MIDDLE.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  speed_velocity_acceleration: {
    explanation: [
      "You already know how to say where something is and that objects move from place to place. Speed puts a number on that motion: speed = distance ÷ time, so a runner covering 100 m in 20 s moves at 5 m/s. Velocity is speed with a direction attached — 5 m/s north is a different velocity from 5 m/s south, even though the speedometer reading is identical. That direction matters whenever you care where something ends up, not just how fast it got there.",
      "Acceleration measures how quickly velocity changes: acceleration = change in velocity ÷ time, with units of m/s². The common trap is thinking acceleration only means speeding up. Slowing down is acceleration too (the velocity is changing), and so is turning at constant speed, because the direction part of velocity is changing. A useful habit: whenever you read m/s², say it as 'meters per second of speed gained or lost, every second' — it turns an abstract unit into a story about the motion.",
    ],
    example: {
      problem: "A cyclist rides 120 m down a straight street in 20 s at a steady pace. Then she sprints, going from 6 m/s to 10 m/s in 2 s. Find her steady speed and her acceleration during the sprint.",
      steps: [
        "Start with the steady stretch: speed = distance ÷ time = 120 m ÷ 20 s = 6 m/s. That means she covers 6 meters during every second of that stretch.",
        "For the sprint, find how much the velocity changed: 10 m/s − 6 m/s = 4 m/s of extra speed gained.",
        "Divide the change by the time it took: acceleration = 4 m/s ÷ 2 s = 2 m/s². In words, she gains 2 m/s of speed during each second of the sprint.",
        "Sanity-check by replaying the sprint: starting at 6 m/s, after one second she is at 8 m/s, and after two seconds she is at 10 m/s — exactly the final speed given, so the numbers hang together.",
      ],
      answer: "Her steady speed is 6 m/s, and her sprint acceleration is 2 m/s².",
    },
    selfQuestions: [
      "Why is a car driving around a curve at a perfectly constant 30 km/h still accelerating?",
      "How would you explain to a friend when the difference between speed and velocity actually matters, using a trip they take every day?",
      "What does a negative acceleration tell you about a motion, and why does it not always mean the object is moving backward?",
      "Two runners finish a race with the same average speed — in what different ways could their motion during the race have looked?",
    ],
  },
  newtons_laws_intro: {
    explanation: [
      "Every push and pull you have ever felt is a force, and Newton's three laws describe how forces and motion are connected. The first law says an object keeps doing what it is doing — staying still or coasting at constant velocity — unless a net force acts on it. The second law makes it quantitative: net force = mass × acceleration, so the same push accelerates a skateboard far more than a loaded moving truck. The third law says forces come in pairs: when you push a wall, the wall pushes back on you just as hard.",
      "The oldest misconception in physics is that keeping something moving requires a constant push. It feels true because friction is always secretly pushing back; stop pedaling and friction, not a lack of effort, slows the bike. Remove friction — think of an ice rink or deep space — and things coast forever. So train yourself to ask two questions about any situation: what are ALL the forces acting, and what is the mass? Force changes motion; it does not maintain it.",
      "One more careful point about the third law: the action and reaction forces act on DIFFERENT objects, so they never cancel each other. The Earth pulls you down and you pull the Earth up; you accelerate noticeably and the Earth does not, because the same size of force meets wildly different masses.",
    ],
    example: {
      problem: "You pull a 25 kg wagon along a sidewalk with a force of 65 N while friction drags backward with 15 N. What is the wagon's acceleration?",
      steps: [
        "First find the net force, because only the leftover force changes motion: 65 N forward − 15 N backward = 50 N forward.",
        "Apply Newton's second law rearranged for acceleration: acceleration = net force ÷ mass = 50 N ÷ 25 kg = 2 m/s².",
        "Interpret the number: as long as you keep pulling this hard, the wagon gains 2 m/s of speed every second.",
        "Sanity-check with the mass: if a friend hopped in and doubled the mass to 50 kg, the same 50 N net force would only produce 1 m/s² — more mass means more inertia, so the same force changes the motion less.",
      ],
      answer: "The wagon accelerates at 2 m/s² in the direction of your pull.",
    },
    selfQuestions: [
      "Why does a rolling ball on grass stop on its own, and what would happen to it on a perfectly frictionless surface?",
      "If action and reaction forces are always equal, how does anything ever start moving — what resolves the apparent standoff?",
      "How would the same 100 N push affect a shopping cart versus a parked car, and which law predicts the difference?",
      "What changes about a problem when you are told the net force is zero, even though several forces are acting?",
    ],
  },
  gravity_weight: {
    explanation: [
      "Things fall because Earth pulls on them — that much you have seen your whole life. The new idea is splitting two words people mix up daily: mass and weight. Mass is the amount of matter in an object, measured in kilograms, and it is the same everywhere in the universe. Weight is the force of gravity pulling on that mass, measured in newtons, and it depends on where you are standing. The link is simple: weight = mass × gravitational field strength, and near Earth's surface that strength is about 10 N for every kilogram.",
      "The classic misconception is that mass and weight are the same thing because, on Earth, they always change together. Travel breaks the illusion: an astronaut on the Moon has exactly the same mass as at home — same atoms, same difficulty to shove around — but weighs only about one-sixth as much, because the Moon's gravity is weaker. So when a problem says an object 'weighs' some number of newtons, it is telling you about a force, and when it gives kilograms, it is telling you about mass; keep the two in separate mental boxes.",
    ],
    example: {
      problem: "An astronaut has a mass of 60 kg. Using 10 N/kg for Earth's gravitational field strength and 1.6 N/kg for the Moon's, find her weight in both places.",
      steps: [
        "On Earth, weight = mass × field strength = 60 kg × 10 N/kg = 600 N. This is the downward force Earth's gravity exerts on her.",
        "On the Moon the rule is the same but the field strength is smaller: weight = 60 kg × 1.6 N/kg = 96 N.",
        "Note what did NOT change: her mass is 60 kg in both places, because moving location does not add or remove matter.",
        "Sanity-check the ratio: 96 N ÷ 600 N = 0.16, about one-sixth — exactly what you expect, since the Moon's gravity is roughly one-sixth of Earth's.",
      ],
      answer: "She weighs 600 N on Earth and only 96 N on the Moon, while her mass stays 60 kg in both places.",
    },
    selfQuestions: [
      "Why does a bathroom scale give a misleading reading if you think of it as measuring mass rather than force?",
      "How would you convince a friend that an astronaut floating in orbit still has all of their mass?",
      "What would happen to your weight and your mass on a planet with gravity three times stronger than Earth's?",
      "Why do heavy and light rocks dropped together hit the ground at nearly the same time, even though gravity pulls harder on the heavy one?",
    ],
  },
  balanced_unbalanced_forces: {
    explanation: [
      "Almost everything around you has several forces acting on it at once — gravity down, the floor pushing up, maybe a push or a pull from the side. What matters for motion is the combination. When the forces cancel out completely, they are balanced and the motion does not change. When they do not cancel, the leftover is called the net force, the forces are unbalanced, and the object speeds up, slows down, or turns in the direction of that leftover force.",
      "Here is the misconception to root out: balanced forces do NOT mean the object is sitting still. They mean the motion is not changing — a parked car and a car cruising at a perfectly steady 80 km/h on a straight highway both have balanced forces. Stillness is just one special case. A good mental routine: list every force with its direction, add the ones pointing the same way, subtract the opposing ones, and ask what is left over. Zero leftover means the current motion continues; any leftover means change.",
    ],
    example: {
      problem: "In a tug-of-war, team A pulls left with 600 N and team B pulls right with 600 N, and the rope marker does not move. Then a new player joins team B and adds 150 N. What is the net force on the rope now, and what happens?",
      steps: [
        "Start with the original standoff: 600 N left versus 600 N right gives a net force of 600 − 600 = 0 N. The forces are balanced, so the marker's motion does not change — it was at rest, so it stays at rest.",
        "Add the new player: team B now pulls with 600 + 150 = 750 N to the right, while team A still pulls 600 N to the left.",
        "Find the new net force: 750 N − 600 N = 150 N pointing toward team B's side. The forces are now unbalanced.",
        "Interpret the result: the rope accelerates toward team B — not because B's force is huge, but because there is a leftover force. Notice that during the standoff there were big forces everywhere, yet they counted for zero change; balanced never means force-free.",
      ],
      answer: "The net force is 150 N toward team B, so the rope starts accelerating in that direction.",
    },
    selfQuestions: [
      "Why can an object with several large forces acting on it still keep a perfectly constant velocity?",
      "How would you explain the difference between zero net force and zero force to someone using a book resting on a table?",
      "What clues in a motion — speeding up, slowing down, turning — tell you the forces must be unbalanced?",
      "A skydiver eventually falls at a steady speed; what must be true about the forces on her at that moment, and why?",
    ],
  },
  kinetic_potential_energy: {
    explanation: [
      "Energy is the ability to make things happen, and two of its most useful forms have to do with motion and position. Kinetic energy is the energy of a moving object: kinetic energy = 1/2 × mass × speed², measured in joules (J). Gravitational potential energy is stored by lifting something against gravity: potential energy = mass × gravitational strength × height, also in joules. A drawn bowstring or a stretched spring stores elastic potential energy the same way — energy parked in position, waiting to become motion.",
      "The detail most people miss is that little ² on the speed. Because speed is squared, doubling your speed does not double kinetic energy — it quadruples it, and tripling speed makes it nine times larger. This is not a math curiosity: it is why a car crash at 60 km/h is four times more violent than one at 30 km/h, and why stopping distances grow so fast. Whenever speed changes in a problem, expect the energy to change much more dramatically than your gut suggests.",
    ],
    example: {
      problem: "A 40 kg student rides a skateboard at 3 m/s. Find her kinetic energy, then find it again when she speeds up to 6 m/s. How do the two compare?",
      steps: [
        "Use kinetic energy = 1/2 × mass × speed². First square the speed: 3 × 3 = 9.",
        "Multiply through: 0.5 × 40 kg × 9 = 180 J at 3 m/s.",
        "Now at the doubled speed: 6 × 6 = 36, so kinetic energy = 0.5 × 40 × 36 = 720 J.",
        "Compare the two: 720 ÷ 180 = 4. Doubling the speed quadrupled the kinetic energy, because the speed gets squared before anything else happens.",
        "Sanity-check the scale: 720 J is about the energy needed to lift this same 40 kg student 1.8 m straight up, since 40 × 10 × 1.8 = 720 J — substantial for a skateboarder, but nothing like a lightning bolt.",
      ],
      answer: "She has 180 J of kinetic energy at 3 m/s and 720 J at 6 m/s — four times as much, not twice.",
    },
    selfQuestions: [
      "Why does doubling an object's speed quadruple its kinetic energy, while doubling its mass only doubles it?",
      "Where in a playground swing's path is potential energy largest, where is kinetic energy largest, and how do you know?",
      "How would you estimate which has more kinetic energy: a slow-moving truck or a fast-moving bicycle, and what numbers would you need?",
      "What everyday objects store potential energy right now around you, and what would have to happen to release it?",
    ],
  },
  energy_transfer: {
    explanation: [
      "Energy never appears from nowhere and never vanishes — it only moves between objects and changes form. That rule, conservation of energy, is one of the most reliable accounting tricks in all of science. You already know energy shows up as motion, heat, light, and sound; conservation says that if you add up every form before and after an event, the totals match. A falling ball trades stored gravitational energy for kinetic energy, joule for joule, all the way down.",
      "The misconception to drop is that energy gets 'used up.' When your phone battery dies or a ball stops bouncing, the energy is not gone — it has leaked into less useful forms, mostly heat spread thinly into the surroundings, plus a little sound. Physicists say it has dissipated. The skill to build is bookkeeping: name the energy store the system starts with, name where each joule goes, and refuse to let any of it disappear off the books.",
    ],
    example: {
      problem: "A 2 kg ball is nudged off a shelf 5 m above the floor. Using 10 N/kg for gravity and ignoring air resistance, how fast is the ball moving just before it hits the floor?",
      steps: [
        "Find the energy stored at the start: potential energy = mass × gravitational strength × height = 2 × 10 × 5 = 100 J.",
        "Apply conservation: with no air resistance, every joule of potential energy becomes kinetic energy during the fall, so just before impact the kinetic energy is 100 J.",
        "Set up the kinetic energy formula and solve for speed: 1/2 × 2 × speed² = 100, which simplifies to speed² = 100, so speed = √100 = 10 m/s.",
        "Sanity-check the endpoints: at the shelf the ball has 100 J potential and 0 J kinetic; at the floor it has 0 J potential and 100 J kinetic. The total is 100 J at both moments, exactly as conservation demands.",
        "Interpret the aftermath: when the ball smacks the floor, that 100 J does not vanish — it spreads out as sound and a tiny amount of heat in the ball and floor.",
      ],
      answer: "The ball hits the floor moving at 10 m/s, carrying the full 100 J as kinetic energy.",
    },
    selfQuestions: [
      "When a bouncing ball finally comes to rest, where exactly has all of its original energy gone?",
      "How would air resistance change the energy bookkeeping of a falling object, and which numbers in the chain would shrink?",
      "Why is 'energy efficient' a better phrase than 'energy saving' once you know energy is conserved no matter what?",
      "How would you trace the energy in a flashlight beam all the way back to its earlier stores, step by step?",
    ],
  },
  thermal_energy_transfer: {
    explanation: [
      "Hot and cold are familiar, but thermal energy gives them a particle-level meaning: the particles of every object are constantly jiggling, and thermal energy is the total energy of all that jiggling. Temperature measures the average jiggle, not the total — a bathtub of warm water holds far more thermal energy than a tiny cup of boiling water, even though the cup has the higher temperature. Heat is thermal energy on the move, and it always flows from the hotter object to the colder one until both reach the same temperature.",
      "Heat travels three ways: conduction (particle-to-particle contact, like a metal spoon heating up in soup), convection (warm fluid rising and circulating, like air above a radiator), and radiation (energy carried by invisible waves, like the warmth of sunshine, which needs no material at all). The misconception worth killing: cold does not 'get in.' A drafty window does not leak cold into your room — heat leaks out. Cold is not a substance; it is just having less thermal energy.",
    ],
    example: {
      problem: "A mug holds 250 g of water at 20 °C. It takes about 4 J of energy to warm 1 g of water by 1 °C. How much energy must a microwave transfer to the water to bring it to 80 °C?",
      steps: [
        "Find how many degrees the water must climb: 80 °C − 20 °C = 60 °C.",
        "Work out the cost for a single gram: 4 J per degree × 60 degrees = 240 J for each gram of water.",
        "Scale up to the whole mug: 250 grams × 240 J per gram = 60,000 J, which is 60 kJ.",
        "Sanity-check the proportions: doubling the water or doubling the temperature rise would each double the energy needed — which matches everyday experience that a full kettle takes longer to boil than a half-full one.",
      ],
      answer: "The microwave must transfer about 60,000 J (60 kJ) of energy to the water.",
    },
    selfQuestions: [
      "Why can a swimming pool at 25 °C hold more thermal energy than a cup of tea at 95 °C?",
      "Which of conduction, convection, and radiation is at work when you warm your hands near a campfire without touching it, and how can you tell?",
      "Why does a metal bench feel colder than a wooden one on the same winter morning, even though both are at the same temperature?",
      "How would you redesign a lunchbox to slow down all three kinds of heat transfer at once?",
    ],
  },
  wave_properties: {
    explanation: [
      "A wave is a traveling disturbance that carries energy from one place to another without carrying the material along with it. Watch a buoy when a wave passes: the buoy bobs up and down, but it does not surf to shore — the water mostly stays put while the energy moves on. You have felt this with vibrations making sound. Three numbers describe any wave: amplitude (how far it swings from rest, which sets how much energy it carries), wavelength (the distance from one crest to the next), and frequency (how many complete waves pass per second, measured in hertz, Hz).",
      "These pieces connect through one tidy rule: wave speed = frequency × wavelength. The misconception to avoid is thinking you can make a wave travel faster by shaking the source harder or faster. Cranking up amplitude makes a taller wave; cranking up frequency packs the crests closer together (shorter wavelength); but the SPEED is set by the medium the wave travels through — water depth, string tension, the air itself. Frequency and wavelength trade off so their product, the speed, stays put.",
    ],
    example: {
      problem: "A buoy bobs up and down once every 4 s as ocean waves pass, and the crests are 8 m apart. How fast are the waves traveling?",
      steps: [
        "One full wave passes every 4 s, so the frequency is 1 ÷ 4 = 0.25 Hz — a quarter of a wave each second.",
        "Apply the wave equation: speed = frequency × wavelength = 0.25 Hz × 8 m = 2 m/s.",
        "Cross-check with plain reasoning: a whole 8 m wavelength slides past in 4 s, and 8 m ÷ 4 s = 2 m/s. Both routes agree.",
        "Interpret what would NOT change this: taller waves (bigger amplitude) would pound the buoy harder but still travel at 2 m/s — the medium, not the wave's size, sets the speed.",
      ],
      answer: "The waves travel at 2 m/s across the water.",
    },
    selfQuestions: [
      "Why does increasing a wave's frequency shorten its wavelength instead of speeding the wave up?",
      "Which property of a wave would you change to make it carry more energy, and what would that look like on water?",
      "How would you measure the frequency, wavelength, and speed of ripples in a bathtub using only a ruler and a stopwatch?",
      "If a wave crosses from deep water into shallow water and slows down, what must happen to its wavelength, and why?",
    ],
  },
  sound_waves: {
    explanation: [
      "Pluck a rubber band and you can see the blur of vibration that you hear as sound. A sound wave is that vibration passed along through a material: the source shoves nearby air particles, they shove their neighbors, and a chain of squeezes and stretches races outward at about 340 m/s in air. Because sound is particles shoving particles, it needs a medium — in the vacuum of space there is nothing to shove, so there is no sound at all. It travels faster through water and faster still through solids, where particles sit closer together.",
      "Two wave properties map directly onto what you hear: frequency sets pitch (more vibrations per second sounds higher), and amplitude sets loudness (bigger vibrations sound louder). The misconception to correct is that sound arrives instantly. It is quick, but 340 m/s is nothing like light speed — that is why you see a firework burst before you hear the bang, and why thunder lags behind lightning by about 3 s for every kilometer of distance.",
    ],
    example: {
      problem: "You clap your hands facing a canyon wall and hear the echo 2 s later. Sound travels at 340 m/s in air. How far away is the wall?",
      steps: [
        "Find the total distance the sound covered: distance = speed × time = 340 m/s × 2 s = 680 m.",
        "Pause before answering — the sound made a round trip, traveling to the wall AND back to your ears. The 680 m covers both legs.",
        "Halve it for the one-way distance: 680 m ÷ 2 = 340 m to the wall.",
        "Sanity-check the trap: answering 680 m would only be right if the clock stopped the instant the sound reached the wall, but you timed until the echo returned, so dividing by 2 is essential.",
      ],
      answer: "The canyon wall is 340 m away — half of the 680 m round trip the echo traveled.",
    },
    selfQuestions: [
      "Why does an astronaut on the Moon need a radio to talk, even when standing right next to a crewmate?",
      "How could you estimate how far away a storm is using the gap between lightning and thunder, and what numbers would you use?",
      "What changes about a guitar string's vibration when the note gets higher versus when it gets louder?",
      "Why might you hear an approaching train through the steel rail before you hear it through the air?",
    ],
  },
  em_spectrum_intro: {
    explanation: [
      "Light is a wave with a superpower: unlike sound, it needs no material to travel through, which is how sunlight crosses 150 million km of empty space to reach you. Visible light is just one member of a much larger family called the electromagnetic spectrum. Radio waves, microwaves, infrared, visible light, ultraviolet, X-rays, and gamma rays are all the same kind of wave at different wavelengths — radio waves can be meters long, while gamma waves are smaller than an atom. In empty space, every one of them travels at the same speed: about 300,000 km/s.",
      "The whole rainbow you can see is a sliver of this family; your eyes are simply tuned to that narrow band. As wavelength shortens, the waves carry more energy — which is why ultraviolet can burn skin while radio passes through you harmlessly. The misconception to clear up: radio waves are not sound waves. They are members of the light family that carry coded signals through space; the radio receiver converts those signals into the vibrations your ears then hear as sound.",
    ],
    example: {
      problem: "The Sun is about 150,000,000 km from Earth, and light travels through space at about 300,000 km/s. How long does sunlight take to reach Earth?",
      steps: [
        "Time is distance divided by speed: time = 150,000,000 km ÷ 300,000 km/s.",
        "Simplify by canceling zeros: 150,000,000 ÷ 300,000 is the same as 1,500 ÷ 3, which equals 500 s.",
        "Convert to friendlier units: 500 s = 480 s + 20 s, which is 8 minutes and 20 seconds.",
        "Interpret the result: you always see the Sun as it was about 8 minutes ago. And because every electromagnetic wave moves at the same speed in space, a radio message or an X-ray burst from the Sun would take exactly as long.",
      ],
      answer: "Sunlight takes about 500 s — roughly 8 minutes and 20 seconds — to reach Earth.",
    },
    selfQuestions: [
      "Why can light cross empty space when sound cannot, and what does that tell you about how the two waves work?",
      "How would you explain to a friend what microwaves, X-rays, and the colors of a rainbow have in common?",
      "Why is a sunburn caused by ultraviolet light rather than by the much larger amount of visible light hitting your skin?",
      "What happens to the energy of electromagnetic waves as the wavelength gets shorter, and where on the spectrum would you look for the most dangerous ones?",
    ],
  },
  electricity_intro: {
    explanation: [
      "Flip a switch and energy arrives instantly — here is the machinery behind that trick. A circuit is a complete loop of conducting material; electric current is the flow of charge around that loop, measured in amperes (A). The battery provides the push, called voltage and measured in volts (V), and everything in the loop resists the flow a little, a property called resistance, measured in ohms (Ω). The three are tied together by one rule worth memorizing: current = voltage ÷ resistance. More push means more current; more resistance means less.",
      "A good mental picture is a bike chain: the battery is your legs, the current is the chain looping around, and the bulb or motor is the wheel where the energy gets delivered. The misconception to retire is that current gets 'used up' by a bulb. The same current flows into and out of the bulb — what gets transferred is energy, carried by the moving charge and handed over as light and heat. Break the loop anywhere, and the whole flow stops at once.",
    ],
    example: {
      problem: "A flashlight bulb with a resistance of 18 Ω is connected to a 9 V battery in a simple loop. How much current flows in the circuit?",
      steps: [
        "Identify the roles: the 9 V battery supplies the push, and the bulb's 18 Ω is the only thing resisting the flow.",
        "Apply the rule: current = voltage ÷ resistance = 9 V ÷ 18 Ω = 0.5 A.",
        "Interpret the loop: that same 0.5 A flows through every point of the circuit — out of the battery, through the bulb, and back. The bulb takes energy from the charge, not the charge itself.",
        "Sanity-check with a swap: a 9 Ω bulb on the same battery would draw 9 ÷ 9 = 1 A. Halving the resistance doubles the current, exactly as the rule predicts.",
      ],
      answer: "A current of 0.5 A flows everywhere in the loop.",
    },
    selfQuestions: [
      "Why does the entire string of lights go dark when a single bulb in a simple loop burns out?",
      "How would you explain the difference between current and voltage using water in pipes or riders on a ski lift?",
      "What happens to the current if you keep the same battery but add a second bulb into the loop, and why?",
      "If current is not used up by a bulb, what exactly does the battery run out of over time?",
    ],
  },
  magnetism_intro: {
    explanation: [
      "Magnets push and pull without touching — you have felt that strange grip since you first stuck one to a fridge. Every magnet has two poles, north and south; like poles repel and opposite poles attract, and the invisible region of influence around a magnet is its magnetic field. Only a few metals respond strongly — iron, nickel, and cobalt — which corrects a common belief that magnets grab all metal: an aluminum can or a copper coin will not stick no matter how strong the magnet.",
      "The deeper surprise is that electricity and magnetism are two faces of the same thing. Any electric current creates a magnetic field around its wire, and coiling the wire concentrates that field. Wrap the coil around an iron core and you have an electromagnet: a magnet you can switch on and off, reverse, and strengthen at will — more current or more turns of wire means a stronger pull. That controllability is why electromagnets, not permanent magnets, run scrapyard cranes, electric motors, and doorbells.",
    ],
    example: {
      problem: "An electromagnet made with 50 turns of wire around an iron nail lifts about 10 paper clips. Using the same battery and nail, roughly how many clips should a 150-turn version lift?",
      steps: [
        "Identify the relationship: with the same current, an electromagnet's strength grows roughly in proportion to its number of turns, because each loop of wire adds its own contribution to the field.",
        "Find the scaling factor: 150 turns ÷ 50 turns = 3, so the new coil has three times the turns.",
        "Scale the result: about 10 clips × 3 = 30 paper clips.",
        "Sanity-check the realism: this is an estimate, not a guarantee — extra wire adds a little resistance, which trims the current slightly — but the direction is reliable: more turns, stronger magnet, and a real test should land near 30 clips.",
      ],
      answer: "The 150-turn electromagnet should lift roughly 30 paper clips — about three times as many.",
    },
    selfQuestions: [
      "Why would a magnet stick to a steel door but not to an aluminum window frame, even though both are metal?",
      "What are two different changes you could make to an electromagnet to strengthen it, and why does each one work?",
      "How would you use a compass to detect whether a current is flowing through a nearby wire?",
      "Why are electromagnets chosen over permanent magnets for a scrapyard crane, and what would go wrong with a permanent one?",
    ],
  },
  simple_machines: {
    explanation: [
      "Ramps, levers, pulleys, wheels and axles, wedges, and screws are humanity's oldest force tricks. A simple machine does not add energy — it reshapes how you supply it, usually letting you apply a smaller force over a longer distance. Slide a heavy box up a long ramp and you push with far less force than lifting it straight up, but you push for far more meters. The bookkeeping uses an idea you can compute: work = force × distance, measured in joules, and an ideal machine leaves that product unchanged.",
      "The misconception to flatten is that machines 'save work.' They do not — they trade force for distance (or the reverse: a lever can trade extra force for less distance, which is how tweezers work). The ratio of the load you move to the force you apply is the mechanical advantage. In real life friction always demands a little extra, so you actually do slightly MORE total work with the machine; you accept that tax because a small, manageable push beats an impossible heave.",
    ],
    example: {
      problem: "A box weighing 400 N must be raised 1.5 m onto a truck bed. Instead of lifting it, you slide it up a 6 m ramp. Ignoring friction, how much force does the ramp require?",
      steps: [
        "First find the work the job requires no matter how you do it: lifting straight up takes work = force × distance = 400 N × 1.5 m = 600 J.",
        "The ramp lets you spread that same 600 J over the full 6 m of its length, so the needed push is force = work ÷ distance = 600 J ÷ 6 m = 100 N.",
        "Compute the mechanical advantage two ways: 400 N ÷ 100 N = 4, and ramp length ÷ height = 6 ÷ 1.5 = 4. They agree, which is a good internal check.",
        "Interpret the trade: you push with one quarter of the force but over four times the distance, and 100 N × 6 m = 600 J — exactly the work of the direct lift. The ramp made the job manageable, not smaller.",
        "Note the real-world correction: with friction you would push somewhat harder than 100 N, so the actual work would exceed 600 J — machines never beat the energy books.",
      ],
      answer: "An ideal push of 100 N up the ramp does the job — one quarter of the box's 400 N weight, applied over four times the distance.",
    },
    selfQuestions: [
      "Why does a longer ramp make a load easier to move even though the total work stays the same?",
      "Where in your home do you use levers without noticing, and which ones trade force for distance versus distance for force?",
      "How would friction change the force and work calculations for a real ramp, and why do people still use ramps anyway?",
      "If a pulley system lets you lift a 300 N load with 100 N of effort, what must be true about how much rope you pull through?",
    ],
  },
};
