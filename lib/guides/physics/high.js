// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — PHYSICS · HIGH.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  kinematics: {
    explanation: [
      "Before you can explain why something moves, you need a precise way to describe how it moves — that is kinematics. You already work with speed, velocity, and acceleration; kinematics turns those ideas into a toolkit of equations that connect position, velocity, acceleration, and time whenever acceleration is constant: v = v₀ + at, Δx = v₀t + ½at², and v² = v₀² + 2aΔx. Pick the equation that contains the three quantities you know and the one you want.",
      "The mental model for two-dimensional motion is independence: horizontal and vertical motion run on separate clocks that happen to read the same time. A projectile's horizontal velocity stays constant (no horizontal force, ignoring air resistance) while its vertical velocity changes by 9.8 m/s every second because of gravity. The two motions share only the time variable, so you solve one direction to find t and feed it into the other.",
      "The classic misconception is that an object moving horizontally falls more slowly than one dropped straight down. It does not: a ball rolled off a table and a ball dropped from table height hit the floor at the same instant, because gravity acts on the vertical motion alone. Horizontal speed never buys a projectile extra hang time.",
    ],
    example: {
      problem: "A ball rolls off a horizontal cliff edge 19.6 m above the ground, leaving the edge with a horizontal speed of 12 m/s. How long is it in the air, how far from the base of the cliff does it land, and how fast is it moving on impact? Ignore air resistance.",
      steps: [
        "Split the motion into independent parts: horizontally the velocity stays 12 m/s the whole flight; vertically the ball starts with zero velocity and accelerates downward at g = 9.8 m/s².",
        "Use the vertical motion to find the time: the drop obeys h = ½gt², so 19.6 = ½ × 9.8 × t², giving t² = 19.6/4.9 = 4.0 and t = 2.0 s.",
        "Feed that time into the horizontal motion: range = horizontal speed × time = 12 × 2.0 = 24 m from the base of the cliff.",
        "For impact speed, find the final vertical velocity first: it grows from zero at 9.8 m/s each second, so after 2.0 s it is 9.8 × 2.0 = 19.6 m/s downward.",
        "Combine the two perpendicular velocity components with the Pythagorean theorem: speed = √(12² + 19.6²) = √(144 + 384.16) = √528.16 ≈ 23 m/s.",
        "Sanity-check: the time depended only on the 19.6 m height, not on the 12 m/s launch speed — a dropped ball would land at the same moment, just at the cliff's base.",
      ],
      answer: "The ball is airborne for 2.0 s, lands 24 m from the cliff base, and strikes the ground at about 23 m/s.",
    },
    selfQuestions: [
      "Why does the horizontal launch speed have no effect on how long a projectile stays in the air?",
      "How do you decide which constant-acceleration equation to use when a problem gives you three known quantities?",
      "What changes in the analysis if the ball is launched at an angle above the horizontal instead of rolling off horizontally?",
      "Where does the independence of horizontal and vertical motion break down for a real object like a badminton shuttle?",
    ],
  },
  newtons_laws: {
    explanation: [
      "Three short statements connect force to motion and underpin all of mechanics. The first law says an object keeps its velocity — including zero — unless a net force acts on it; motion needs no force to continue, only to change. The second law makes that quantitative: net force equals mass times acceleration, Fnet = ma, so the same push accelerates a small mass more than a large one. The third law says forces come in pairs: if A pushes on B, then B pushes back on A with equal magnitude in the opposite direction.",
      "The key mental discipline is the word NET. An object can have many forces on it and still move at constant velocity, as long as they cancel. When you see acceleration, hunt for the unbalanced leftover after all forces are added with their directions. You already know balanced versus unbalanced forces; the second law just attaches a number to the imbalance.",
      "The classic misconception is that third-law pairs cancel each other. They never do, because the two forces act on different objects: the road pushes the car forward while the car pushes the road backward. Only forces acting on the same object can cancel. If you find yourself canceling an action with its reaction, you have mixed up two different free-body pictures.",
    ],
    example: {
      problem: "A 1200 kg car accelerates from rest to 24 m/s in 8.0 s on a straight road. The engine drives the wheels with a forward force of 4500 N. Find the net force on the car and the total resistive force (air drag plus rolling resistance) opposing it.",
      steps: [
        "Find the acceleration from the velocity change: a = Δv/Δt = (24 − 0)/8.0 = 3.0 m/s², directed forward along the road.",
        "Apply the second law to get the net force: Fnet = ma = 1200 × 3.0 = 3600 N forward. This is the leftover after all forces are combined, not the engine force itself.",
        "Set up the force balance along the road: the forward drive force minus the resistive force must equal the net force, so 4500 − R = 3600.",
        "Solve for the resistance: R = 4500 − 3600 = 900 N pointing backward.",
        "Sanity-check the picture: the engine supplies more force than the net value because part of it is spent fighting resistance; if drag grew to 4500 N the net force would drop to zero and the car would stop accelerating, exactly as the first law predicts.",
      ],
      answer: "The net force on the car is 3600 N forward, so the resistive forces must total 900 N backward.",
    },
    selfQuestions: [
      "Why can an object with several forces acting on it still travel in a straight line at constant speed?",
      "How would you convince a friend that the forces in a third-law pair can never cancel each other out?",
      "What happens to the acceleration in this problem as the car speeds up and air drag grows, even if the engine force stays the same?",
      "If you doubled the car's mass but kept the same net force, how would the time to reach 24 m/s change, and why?",
    ],
  },
  forces_fbd: {
    explanation: [
      "A free-body diagram is the most valuable habit you can build in mechanics: isolate ONE object, draw every force acting on it as a labeled arrow from a dot, and ignore everything the object exerts on the rest of the world. You already know how to spot pushes, pulls, gravity, and support forces; the diagram organizes them so Newton's second law can be applied one axis at a time.",
      "The working method is to choose axes that fit the motion, split any tilted force into components using sine and cosine, then write the second law separately for each axis. Along a direction with no acceleration the forces must sum to zero; along the direction of acceleration they sum to ma. Common players are weight (mg, always straight down), the normal force (perpendicular to the surface), tension (along the rope, pulling), and friction (along the surface).",
      "The most common error is treating the normal force as automatically equal to the weight. It is not a law — it is whatever value makes the perpendicular forces balance. A rope pulling upward at an angle, a hand pressing down, or a tilted surface all change the normal force. Always solve for it from the perpendicular equation instead of assuming mg.",
    ],
    example: {
      problem: "A 5.0 kg box sits on a frictionless horizontal floor. A rope pulls it with a tension of 40 N at 30° above the horizontal. Find the box's acceleration and the normal force from the floor.",
      steps: [
        "Draw the free-body diagram: weight mg = 5.0 × 9.8 = 49 N straight down, the normal force N straight up, and the 40 N tension tilted 30° above the horizontal.",
        "Resolve the tension into components: horizontal part 40 × cos 30° = 40 × 0.866 ≈ 34.6 N, vertical part 40 × sin 30° = 40 × 0.500 = 20 N upward.",
        "Apply the second law horizontally, where all the acceleration happens: 34.6 = 5.0 × a, so a ≈ 6.9 m/s² in the direction of the pull.",
        "Apply it vertically, where acceleration is zero: N + 20 − 49 = 0, so N = 29 N. The rope's upward component carries part of the weight, so the floor pushes up with less than mg.",
        "Sanity-check: if the rope were horizontal the normal force would be the full 49 N, and if the rope pulled hard enough straight up the box would leave the floor entirely — 29 N sits sensibly between those extremes.",
      ],
      answer: "The box accelerates at about 6.9 m/s² horizontally, and the floor pushes up with a normal force of 29 N.",
    },
    selfQuestions: [
      "Why does pulling a sled with an angled rope reduce the normal force, and how does that help once friction enters the picture?",
      "How do you decide which forces belong on a free-body diagram and which forces are exerted by the object on something else?",
      "What would change in the two equations if the same box were being dragged up a 30° ramp instead of across a floor?",
      "Where do students most often go wrong when splitting a force into components, and how can you check your sine and cosine choices?",
    ],
  },
  friction: {
    explanation: [
      "Surfaces grip each other, and friction is the force that expresses that grip along the surface. It comes in two varieties: static friction holds objects still and adjusts itself up to a maximum of μₛN, while kinetic friction acts on sliding objects with the nearly constant value μₖN. Here N is the normal force and μ is the coefficient of friction — a unitless number that captures how grippy the pair of surfaces is. You already know friction as the force that opposes sliding; now you can compute it.",
      "The mental model is that friction opposes RELATIVE sliding between surfaces, not motion itself. Static friction is what pushes a car forward: the tire pushes backward on the road, and friction from the road pushes the tire forward. Because static friction adjusts to whatever is needed (up to its limit), you cannot compute it from a formula unless the object is right at the verge of slipping.",
      "The big misconception is writing friction = μN in every situation. That product is the maximum available static friction or the actual kinetic friction — but the actual static friction on a non-slipping object is only as large as it needs to be. A book resting on a level table has zero friction on it, no matter how large μ is, because nothing is trying to slide it.",
    ],
    example: {
      problem: "A 2.0 kg book is shoved across a level floor and released sliding at 6.0 m/s. The coefficient of kinetic friction between book and floor is 0.30. How far does the book slide before stopping?",
      steps: [
        "Find the normal force first: the floor is level and there is no vertical acceleration, so N = mg = 2.0 × 9.8 = 19.6 N.",
        "Compute the kinetic friction force: f = μₖN = 0.30 × 19.6 = 5.88 N, pointing opposite the slide since friction opposes relative motion.",
        "Get the deceleration from the second law: a = f/m = 5.88/2.0 = 2.94 m/s², directed against the velocity.",
        "Use the kinematic relation v² = v₀² − 2ad with final velocity zero: 0 = 6.0² − 2 × 2.94 × d, so d = 36/5.88 ≈ 6.1 m.",
        "Notice the mass canceled along the way: d = v₀²/(2μₖg) = 36/(2 × 0.30 × 9.8), so a heavier book sliding at the same speed stops in the same distance — more friction force, but also more inertia.",
      ],
      answer: "The book slides about 6.1 m before friction brings it to rest.",
    },
    selfQuestions: [
      "Why is the static coefficient usually larger than the kinetic one, and what does that mean for a box you are trying to push from rest?",
      "How would you explain to a friend that friction is what accelerates a car forward, even though friction supposedly opposes motion?",
      "What happens to the stopping distance if the book is shoved twice as fast, and why is the answer not simply twice as far?",
      "When is it wrong to compute friction as μ times the normal force, and what should you do instead in those cases?",
    ],
  },
  work_energy_power: {
    explanation: [
      "When a force pushes an object through a distance, it transfers energy — that transfer is work: W = Fd cos θ, where θ is the angle between the force and the displacement. Work is measured in joules (1 J = 1 N·m). A force perpendicular to the motion does zero work, and a force opposing the motion does negative work, draining energy. You already know energy moves between forms; work is the mechanism by which forces move it.",
      "The payoff is the work-energy theorem: the NET work done on an object equals its change in kinetic energy, where KE = ½mv². This often replaces a messy force-and-acceleration analysis with simple bookkeeping between two snapshots. Power then measures how fast the energy flows: P = W/t in watts (1 W = 1 J/s), or equivalently P = Fv for a force applied at speed v.",
      "A common trap is thinking effort equals work. Holding a heavy barbell motionless feels exhausting, but physics says zero work is done on it because the displacement is zero. Likewise, carrying a bag horizontally at constant speed does no work against gravity, since the supporting force is perpendicular to the motion. Work demands a force component along the displacement.",
    ],
    example: {
      problem: "An electric motor lifts a 50 kg crate vertically through 12 m at constant speed, taking 15 s. How much work does the motor do on the crate, and what average power does it deliver?",
      steps: [
        "Constant speed means zero acceleration, so the lifting force exactly balances gravity: F = mg = 50 × 9.8 = 490 N upward.",
        "The force and the displacement point the same way (both upward), so θ = 0° and W = Fd = 490 × 12 = 5880 J.",
        "Interpret the number: the crate's kinetic energy never changed, so all 5880 J became gravitational potential energy — exactly mgh = 50 × 9.8 × 12.",
        "Divide by the time to get power: P = W/t = 5880/15 = 392 W.",
        "Sanity-check the scale: 392 W is about half a horsepower (746 W), a believable rating for a small hoist motor lifting 50 kg at a calm 0.8 m/s.",
      ],
      answer: "The motor does 5880 J of work on the crate and delivers an average power of about 392 W.",
    },
    selfQuestions: [
      "Why does a waiter carrying a tray across a level room do no work on the tray, even though his arm gets tired?",
      "How does the work-energy theorem let you skip finding acceleration in problems where the force varies in a complicated way?",
      "If the same crate were lifted in half the time, what would change about the work done and what would change about the power?",
      "When a force does negative work on an object, where does the object's energy go — and can you give a concrete example?",
    ],
  },
  conservation_energy: {
    explanation: [
      "Energy bookkeeping is the great shortcut of mechanics: in a system where only gravity and other conservative forces act, the total mechanical energy — kinetic plus potential — stays constant. Energy slides between the forms KE = ½mv² and PE = mgh, but the sum at any snapshot equals the sum at any other. You already know energy is transferred and transformed rather than created; conservation turns that idea into an equation you can solve.",
      "The working method is to pick two snapshots of the motion, choose a height reference, and write KE₁ + PE₁ = KE₂ + PE₂. The magic is what you get to ignore: the path between snapshots, the changing speed along the way, even the shape of a curving track. If friction or air resistance does act, energy is not destroyed — it leaves the mechanical ledger as thermal energy, and you account for it by subtracting the work done against friction.",
      "The frequent misconception is that a steeper or longer track changes the final speed. For frictionless motion it cannot: the speed at the bottom depends only on the vertical drop, because gravity's energy transfer cares only about height change. Two slides of the same height deliver the same final speed, just after different ride times.",
    ],
    example: {
      problem: "A 0.50 kg cart is released from rest at the top of a smooth, frictionless track 5.0 m above the ground. Find its speed at the bottom of the track and its speed at a point 1.8 m above the ground.",
      steps: [
        "Choose the ground as the height reference and write the energy ledger at release: KE = 0 (released from rest) and PE = mgh = 0.50 × 9.8 × 5.0 = 24.5 J, so total mechanical energy is 24.5 J throughout.",
        "At the bottom all of that energy is kinetic: ½mv² = mgh. The mass cancels, leaving v = √(2gh) = √(2 × 9.8 × 5.0) = √98 ≈ 9.9 m/s.",
        "At the 1.8 m point only the energy from the 3.2 m drop has converted: ½v² = g × (5.0 − 1.8), so v = √(2 × 9.8 × 3.2) = √62.72 ≈ 7.9 m/s.",
        "Check the books at 1.8 m: PE = 0.50 × 9.8 × 1.8 = 8.82 J and KE = ½ × 0.50 × 62.72 = 15.68 J, which sum to 24.5 J — the ledger balances.",
        "Notice what was never needed: the track's shape, its steepness, and the cart's mass all dropped out. Only the vertical drops mattered.",
      ],
      answer: "The cart reaches about 9.9 m/s at the bottom and is moving at about 7.9 m/s when it passes the 1.8 m mark.",
    },
    selfQuestions: [
      "Why does the final speed at the bottom of a frictionless slide depend on the height but not on the slide's shape or length?",
      "How would you modify the energy equation if friction removed 6 J of energy between the two snapshots you chose?",
      "What clues in a problem tell you to reach for energy conservation instead of Newton's second law and kinematics?",
      "If a roller coaster barely makes it over a second hill, what does that tell you about the hill's height compared with the first one?",
    ],
  },
  momentum_impulse: {
    explanation: [
      "Mass in motion carries momentum, defined as p = mv — a vector pointing along the velocity, measured in kg·m/s. To change an object's momentum you must apply a force for some time; that product, force × time, is called impulse, and the impulse-momentum theorem says impulse equals the change in momentum: FΔt = Δp. This is really Newton's second law rearranged, since F = ma can be rewritten as F = Δ(mv)/Δt.",
      "The power of the impulse picture is the trade-off it reveals: the same momentum change can come from a large force over a short time or a small force over a long time. That is why airbags, crumple zones, and bent knees on landing all work — they stretch out Δt, so the force needed to produce the same Δp shrinks. Because momentum is a vector, sign discipline matters: reversing direction means the momentum change is larger than either momentum alone.",
      "A common misconception is that a heavy object always has more momentum than a light one. Momentum is the product of mass AND velocity: a 0.045 kg golf ball leaving the tee at 70 m/s carries more momentum than a 2.0 kg textbook drifting at 1 m/s. Always multiply before comparing.",
    ],
    example: {
      problem: "A 0.145 kg baseball arrives at a bat moving at 40 m/s toward the batter and leaves at 50 m/s straight back toward the pitcher. Bat and ball are in contact for 0.0012 s. Find the impulse on the ball and the average force the bat exerts.",
      steps: [
        "Set a positive direction first — call toward the pitcher positive. The incoming velocity is then −40 m/s and the outgoing velocity is +50 m/s.",
        "Compute the two momenta: initial p = 0.145 × (−40) = −5.8 kg·m/s; final p = 0.145 × 50 = +7.25 kg·m/s.",
        "The impulse is the change: Δp = 7.25 − (−5.8) = 13.05 kg·m/s toward the pitcher. Note it exceeds either momentum alone because the direction reversed.",
        "Divide by the contact time to find the average force: F = Δp/Δt = 13.05/0.0012 ≈ 10900 N, or about 1.1 × 10⁴ N toward the pitcher.",
        "Sanity-check the scale: that force is roughly 7700 times the ball's own weight (0.145 × 9.8 ≈ 1.4 N) — enormous, but applied for barely a millisecond, which is exactly the short-time, large-force end of the impulse trade-off.",
      ],
      answer: "The bat delivers an impulse of about 13.1 kg·m/s, requiring an average force of about 1.1 × 10⁴ N directed toward the pitcher.",
    },
    selfQuestions: [
      "Why does the momentum change exceed both the initial and final momentum when an object bounces straight back?",
      "How do airbags and crumple zones use the impulse-momentum theorem to protect passengers in a crash?",
      "What sign errors are easiest to make in a rebound problem, and what habit prevents them?",
      "If a ball is caught instead of hit back at the same speed, how does the impulse compare, and what does that imply for the catcher's hands?",
    ],
  },
  collisions: {
    explanation: [
      "When two objects collide, the forces between them are huge, brief, and usually unknowable in detail — yet the total momentum of the pair is the same before and after, because the collision forces are an internal third-law pair that cancel within the system. Conservation of momentum, m₁v₁ + m₂v₂ = m₁v₁ʹ + m₂v₂ʹ, is the master equation for every collision, as long as outside forces are negligible during the brief impact.",
      "Collisions sort into types by what happens to kinetic energy. In an elastic collision kinetic energy is also conserved — think colliding billiard balls or air-track gliders with springy bumpers. In an inelastic collision some kinetic energy converts to heat, sound, and deformation; in the perfectly inelastic extreme the objects stick together and move with one shared velocity. Momentum survives every type; kinetic energy survives only the elastic kind.",
      "The misconception to root out is that momentum conservation implies energy conservation. A head-on crash where two cars crumple and stop dead conserves momentum perfectly (the totals were equal and opposite), yet nearly all the kinetic energy vanished into bent metal and heat. Check the two ledgers separately — they answer different questions.",
    ],
    example: {
      problem: "A 1200 kg car traveling at 20 m/s rear-ends a stationary 800 kg car, and the two lock bumpers and slide together. Find their common speed just after impact and the fraction of kinetic energy lost in the collision.",
      steps: [
        "Total momentum before: only the moving car contributes, so p = 1200 × 20 + 800 × 0 = 24000 kg·m/s in the direction of travel.",
        "Locked bumpers mean a perfectly inelastic collision: both cars share one final velocity v, so 24000 = (1200 + 800) × v, giving v = 24000/2000 = 12 m/s.",
        "Tally kinetic energy before: KE = ½ × 1200 × 20² = 240000 J, all in the moving car.",
        "Tally kinetic energy after: KE = ½ × 2000 × 12² = 144000 J.",
        "The collision destroyed 240000 − 144000 = 96000 J of kinetic energy — a 40% loss — which went into crumpling metal, sound, and heat, while momentum stayed exactly 24000 kg·m/s.",
        "Sanity-check the speed: 12 m/s sits between 0 and 20 m/s and is closer to the heavier car's contribution, exactly what a mass-weighted average should do.",
      ],
      answer: "The wreckage moves off at 12 m/s, and 40% of the original kinetic energy (96000 J) is lost to deformation, sound, and heat.",
    },
    selfQuestions: [
      "Why is momentum conserved in a collision even when enormous forces are involved and kinetic energy is destroyed?",
      "How can you tell from a problem's wording whether to treat a collision as elastic, inelastic, or perfectly inelastic?",
      "What would change in the analysis if the 800 kg car had been rolling toward the other car instead of sitting still?",
      "Where does the lost kinetic energy go in a real crash, and why does that loss not violate conservation of energy?",
    ],
  },
  circular_motion: {
    explanation: [
      "Moving in a circle at steady speed still means accelerating, because the direction of the velocity is constantly changing. That acceleration points toward the center of the circle — centripetal acceleration — with magnitude a = v²/r. By Newton's second law some real force must supply it: Fc = mv²/r. Centripetal force is never a new kind of force; it is a job description filled by tension, gravity, friction, or a normal force, depending on the situation.",
      "The mental model: at every instant the object 'wants' to fly off along the tangent (Newton's first law), and the inward force continuously bends its path into the circle. Cut the force — let go of the string — and the object departs along the tangent line, not outward along the radius. Notice the strong dependence on speed: doubling v quadruples the required inward force.",
      "The stubborn misconception is the outward 'centrifugal force' supposedly flinging riders to the outside of a turn. In an inertial frame no such force exists: your body tries to continue straight while the car door pushes you inward into the curve. What feels like an outward pull is your own inertia being overruled by an inward push.",
    ],
    example: {
      problem: "A 900 kg car rounds a flat, unbanked curve of radius 50 m at a steady 15 m/s. What friction force must the road supply, and what minimum coefficient of static friction between tires and road makes the turn possible?",
      steps: [
        "Find the required centripetal acceleration: a = v²/r = 15²/50 = 225/50 = 4.5 m/s², directed toward the center of the curve.",
        "Apply the second law toward the center: the only horizontal force available on a flat curve is friction from the road, so f = ma = 900 × 4.5 = 4050 N inward.",
        "This is static friction, not kinetic — the tire patches are not sliding on the pavement — and static friction can supply at most μₛN.",
        "On a flat road the normal force balances gravity: N = mg = 900 × 9.8 = 8820 N.",
        "Set the required friction equal to the maximum available to find the threshold: μₛ = 4050/8820 ≈ 0.46. Any grippier surface works; anything slicker and the car drifts outward along a wider arc.",
        "Sanity-check with the speed dependence: at 30 m/s the required force quadruples to 16200 N, needing μₛ ≈ 1.8 — beyond ordinary tires, which is why speed, not radius, is usually what betrays drivers on curves.",
      ],
      answer: "The road must supply 4050 N of friction toward the center, requiring a coefficient of static friction of at least about 0.46.",
    },
    selfQuestions: [
      "Why does a passenger feel pressed against the door in a tight turn if no outward force is actually acting on them?",
      "How does banking a curve reduce the friction needed, and which force component takes over the centripetal job?",
      "What happens to the required centripetal force if you double the speed but also double the radius of the turn?",
      "Why must the friction in this problem be static rather than kinetic, even though the car is clearly moving?",
    ],
  },
  universal_gravitation: {
    explanation: [
      "The same pull that drops an apple holds the Moon in orbit — Newton's law of universal gravitation makes that one statement quantitative: every pair of masses attracts with force F = Gm₁m₂/r², where G = 6.67 × 10⁻¹¹ N·m²/kg² and r is the center-to-center distance. You already know weight as the local pull of gravity; this law explains where weight comes from and how it weakens with distance.",
      "The inverse-square structure is the heart of the model: double the distance and the force drops to one quarter; triple it and the force falls to one ninth. The familiar g = 9.8 m/s² is just GM/r² evaluated at Earth's surface, so g itself shrinks with altitude. Because G is so tiny, gravity between everyday objects is negligible — it takes a planet-sized mass for the force to matter.",
      "The misconception worth attacking head-on: astronauts do not float because they have escaped Earth's gravity. At the International Space Station's altitude gravity is still nearly nine tenths of its surface strength. Astronauts float because station and occupants are all in continuous free fall around the Earth, falling toward it while moving sideways fast enough to keep missing it.",
    ],
    example: {
      problem: "The International Space Station orbits about 400 km above Earth's surface. Using Earth's mass M = 5.97 × 10²⁴ kg, Earth's radius 6.38 × 10⁶ m, and G = 6.67 × 10⁻¹¹ N·m²/kg², find the gravitational field strength g at the station's altitude and compare it with the surface value.",
      steps: [
        "Build the correct distance first: r is measured from Earth's center, so r = 6.38 × 10⁶ + 0.40 × 10⁶ = 6.78 × 10⁶ m. Using altitude alone is the classic setup error.",
        "Write the field strength as g = GM/r², which is the gravitational force per kilogram of orbiting mass.",
        "Compute the numerator: GM = 6.67 × 10⁻¹¹ × 5.97 × 10²⁴ = 3.98 × 10¹⁴ m³/s².",
        "Compute the denominator: r² = (6.78 × 10⁶)² = 4.60 × 10¹³ m².",
        "Divide: g = 3.98 × 10¹⁴ / 4.60 × 10¹³ ≈ 8.7 m/s² — about 88% of the surface value of 9.8 m/s².",
        "Interpret the result: gravity at the station is barely reduced, so the crew's weightlessness must come from free fall, not from any absence of gravitational pull.",
      ],
      answer: "Gravitational field strength at the station's altitude is about 8.7 m/s², still roughly 88% of its surface value.",
    },
    selfQuestions: [
      "Why does doubling the distance between two masses cut the gravitational force to a quarter rather than a half?",
      "How would you explain to a friend why astronauts float even though gravity at orbital altitude is nearly full strength?",
      "What two quantities about a planet would you need to predict the surface gravity of a world you have never visited?",
      "Why is gravitational attraction between two people in a room utterly negligible while Earth's pull on each is obvious?",
    ],
  },
  simple_harmonic_motion: {
    explanation: [
      "Many systems vibrate around a resting point — a mass bobbing on a spring, a swaying bridge, a plucked guitar string. Simple harmonic motion (SHM) is the cleanest version: it occurs whenever the restoring force is proportional to the displacement and points back toward equilibrium, as in Hooke's law F = −kx. The motion repeats with period T (seconds per cycle) and frequency f = 1/T (cycles per second), and its width is the amplitude A, the maximum distance from equilibrium.",
      "The defining surprise of SHM is that the period does not depend on the amplitude. For a mass on a spring, T = 2π√(m/k): a stiffer spring means a quicker bounce, more mass means a slower one, and a bigger pull-back changes nothing about the timing. Energy sloshes back and forth — all spring potential energy (½kx²) at the turning points, all kinetic at the center — so the speed peaks at equilibrium and falls to zero at the extremes.",
      "A frequent misconception is that the mass moves fastest where the force is biggest. It is exactly backwards: at maximum displacement the force and acceleration peak while the speed is momentarily zero, and at equilibrium the force vanishes while the speed is greatest. Force tells you how velocity is changing, not how large it is.",
    ],
    example: {
      problem: "A 0.50 kg block on a frictionless surface is attached to a spring of stiffness k = 200 N/m, pulled 0.10 m from equilibrium, and released. Find the period of the oscillation and the block's maximum speed.",
      steps: [
        "Identify the motion as SHM: the spring supplies a restoring force proportional to displacement, so the formulas for a mass-spring oscillator apply with m = 0.50 kg and k = 200 N/m.",
        "Compute the period: T = 2π√(m/k) = 2π√(0.50/200) = 2π√0.0025 = 2π × 0.050 ≈ 0.31 s, which is a frequency of about 3.2 Hz.",
        "For the maximum speed, use energy: at release all energy is spring potential, E = ½kA² = ½ × 200 × 0.10² = 1.0 J.",
        "At equilibrium all of that energy is kinetic: ½mv² = 1.0 J, so v = √(2 × 1.0/0.50) = √4.0 = 2.0 m/s.",
        "Sanity-check with the angular frequency route: ω = √(k/m) = √400 = 20 rad/s, and the maximum speed of SHM is ωA = 20 × 0.10 = 2.0 m/s — the two methods agree.",
        "Note what the amplitude did and did not control: pulling the block farther would raise the top speed but leave the 0.31 s period untouched.",
      ],
      answer: "The block oscillates with a period of about 0.31 s and reaches a maximum speed of 2.0 m/s as it passes through equilibrium.",
    },
    selfQuestions: [
      "Why does pulling the block back twice as far leave the period unchanged, even though it must now travel farther each cycle?",
      "Where in the cycle are the acceleration and the speed each at their maximum, and why are those two locations different?",
      "How does the energy picture of SHM explain why the block can never drift beyond its starting amplitude on a frictionless surface?",
      "What real-world effects make a child's swing or a car suspension deviate from ideal simple harmonic motion?",
    ],
  },
  mechanical_waves_sound: {
    explanation: [
      "A wave carries energy from place to place without carrying the medium along with it — the water bobs in place while the ripple travels. Mechanical waves need a medium and come in two geometries: transverse waves, where the medium vibrates perpendicular to the travel direction (a shaken rope), and longitudinal waves, where it vibrates along the travel direction (sound's compressions and rarefactions in air). The core relation ties the picture together: wave speed = frequency × wavelength, or v = fλ.",
      "The crucial division of labor: the SOURCE sets the frequency, and the MEDIUM sets the speed. Wavelength is the negotiated result, λ = v/f. Sound travels at about 343 m/s in room-temperature air, faster in water, faster still in steel — stiffer media snap back quicker. Pitch corresponds to frequency and loudness to amplitude; waves also reflect from boundaries, and overlapping waves add point by point (superposition), which is how standing waves form on instrument strings.",
      "The common misconception is that turning up the frequency makes a wave travel faster. In a fixed medium it does not: a high note and a low note from the same speaker reach you together. Raising f simply shortens λ so that their product stays pinned at the medium's speed.",
    ],
    example: {
      problem: "A tuning fork vibrates at 440 Hz. Find the wavelength of its sound in air, where sound travels at 343 m/s, and in fresh water, where it travels at 1480 m/s.",
      steps: [
        "Sort out what each part of the system controls: the fork fixes the frequency at 440 Hz everywhere, while each medium fixes its own wave speed.",
        "Rearrange v = fλ for wavelength: λ = v/f.",
        "In air: λ = 343/440 ≈ 0.78 m — about the height of a kitchen counter, which is why a single tone fills a room with peaks and quiet spots spaced on a human scale.",
        "In water: λ = 1480/440 ≈ 3.36 m. Same tone, but the faster medium stretches each cycle over more than four times the distance.",
        "Sanity-check the ratio: 3.36/0.78 ≈ 4.3, exactly the ratio of the two speeds (1480/343 ≈ 4.3), as it must be when frequency is held fixed by the source.",
      ],
      answer: "The 440 Hz sound has a wavelength of about 0.78 m in air and about 3.36 m in water — the frequency stays put while the medium stretches the wavelength.",
    },
    selfQuestions: [
      "Why does the frequency of a wave stay the same when it crosses from one medium into another, while wavelength and speed both change?",
      "How would you explain to a friend that the medium itself does not travel with a wave, using a stadium crowd or a rope as the picture?",
      "What properties of a medium make sound travel faster through it, and why is sound quicker in steel than in air?",
      "How does superposition of a wave with its own reflection produce a standing wave on a guitar string?",
    ],
  },
  em_waves: {
    explanation: [
      "Light is a traveling disturbance in electric and magnetic fields: a changing electric field generates a changing magnetic field, which regenerates the electric field, and the pair propagates as an electromagnetic wave. Unlike sound, EM waves need no medium and cross empty space at c = 3.00 × 10⁸ m/s, the speed of light in vacuum. The familiar wave relation still rules: c = fλ, so frequency and wavelength are locked in an inverse trade.",
      "The electromagnetic spectrum is one continuous family ordered by frequency: radio waves, microwaves, infrared, visible light (roughly 400 to 700 nm), ultraviolet, X-rays, and gamma rays. Radio wavelengths span meters; gamma wavelengths are smaller than atomic nuclei. Higher frequency means more energy carried per photon, which is why ultraviolet burns skin while radio waves pass through you unnoticed. Visible light is just the thin slice your eyes happen to detect.",
      "The misconception to drop is that radio waves are sound waves. Radio is light your eyes cannot see — transverse, medium-free, moving at c — while sound is a longitudinal pressure wave in matter, about a million times slower in air. A radio receiver converts the EM signal into electrical oscillations and only then into the pressure waves your ears hear.",
    ],
    example: {
      problem: "An FM station broadcasts at 99.5 MHz. Find the wavelength of its radio waves, then find the frequency of green light with a wavelength of 550 nm, and compare the two waves. Use c = 3.00 × 10⁸ m/s.",
      steps: [
        "Both signals are electromagnetic waves, so each obeys c = fλ with the same speed c — only f and λ differ between them.",
        "For the radio wave, convert the frequency first: 99.5 MHz = 9.95 × 10⁷ Hz.",
        "Solve for its wavelength: λ = c/f = 3.00 × 10⁸ / 9.95 × 10⁷ ≈ 3.02 m — about the length of a small car, which is why FM antennas are meter-scale.",
        "For green light, convert the wavelength: 550 nm = 5.50 × 10⁻⁷ m, then f = c/λ = 3.00 × 10⁸ / 5.50 × 10⁻⁷ ≈ 5.45 × 10¹⁴ Hz.",
        "Compare the two: the light's frequency is millions of times the radio wave's and its wavelength is correspondingly millions of times shorter — yet both race through space at the same 3.00 × 10⁸ m/s.",
      ],
      answer: "The FM signal has a wavelength of about 3.02 m, while 550 nm green light oscillates at about 5.45 × 10¹⁴ Hz; both travel at c.",
    },
    selfQuestions: [
      "Why can electromagnetic waves cross the vacuum of space while sound waves cannot?",
      "How does knowing only the frequency of an EM wave let you place it on the spectrum and predict how it interacts with matter?",
      "What stays the same and what changes as you scan from radio waves up to gamma rays?",
      "Why do antennas for different services come in such different sizes, from rooftop dishes to the tiny antenna in a phone?",
    ],
  },
  geometric_optics: {
    explanation: [
      "Treat light as rays — straight lines that bend only at surfaces — and you can predict mirrors, lenses, and prisms with nothing but geometry. Reflection follows one rule: the angle of incidence equals the angle of reflection, both measured from the normal, the line perpendicular to the surface at the point of impact. Refraction is the bending of light as it crosses into a medium where it travels at a different speed; each medium gets an index of refraction n = c/v, with larger n meaning slower light.",
      "Snell's law governs the bend: n₁ sin θ₁ = n₂ sin θ₂, angles again measured from the normal. Entering a slower medium (larger n), light bends toward the normal; returning to a faster medium it bends away. That second case hides a dramatic effect: beyond a critical angle, where sin θc = n₂/n₁, the refracted ray cannot exist and the light reflects entirely back inside — total internal reflection, the principle that traps light inside optical fibers.",
      "The classic error is measuring angles from the surface itself. Every angle in reflection and refraction is measured from the NORMAL, so a ray skimming nearly parallel to the glass has a large angle of incidence, not a small one. Mislabeling this turns every Snell's law answer upside down.",
    ],
    example: {
      problem: "A laser beam in air strikes a glass block (n = 1.52) at 40° from the normal. Find the angle of refraction inside the glass, and then find the critical angle for light trying to leave this glass back into air.",
      steps: [
        "Apply Snell's law for the entry: n₁ sin θ₁ = n₂ sin θ₂ with n₁ = 1.00 (air), θ₁ = 40°, and n₂ = 1.52.",
        "Compute the sine: sin 40° = 0.643, so sin θ₂ = 1.00 × 0.643/1.52 = 0.423.",
        "Take the inverse sine: θ₂ = arcsin(0.423) ≈ 25°. The ray bends toward the normal, as it must when entering a slower, higher-n medium.",
        "For the exit problem, the critical angle is where the refracted ray would graze the surface at 90°: sin θc = n₂/n₁ = 1.00/1.52 = 0.658.",
        "Evaluate: θc = arcsin(0.658) ≈ 41°. Light inside the glass hitting the surface at more than about 41° from the normal cannot escape and reflects totally back inside.",
        "Sanity-check the pair of results: 25° is smaller than 40° (bent toward the normal, correct for air into glass), and a modest 41° critical angle explains why glass and water trap light so readily into internal reflections.",
      ],
      answer: "The beam refracts to about 25° from the normal inside the glass, and the critical angle for glass-to-air is about 41°.",
    },
    selfQuestions: [
      "Why does light bend toward the normal when it slows down, and how could you predict the bend direction without memorizing it?",
      "Why does total internal reflection only happen when light travels from a slower medium toward a faster one?",
      "How does measuring angles from the surface instead of the normal corrupt a Snell's law calculation, and how do you catch the mistake?",
      "What everyday observations — a bent-looking straw in water, sparkle in a cut gemstone — can you now explain with refraction and the critical angle?",
    ],
  },
  electric_charge_fields: {
    explanation: [
      "Charge is to electricity what mass is to gravity: the property that lets objects exert the force. It comes in two signs — like charges repel, opposites attract — and is measured in coulombs (C), carried in tiny lumps by electrons (negative) and protons (positive). Charge is conserved: rubbing a balloon on hair does not create charge, it just transfers electrons from one surface to the other. Coulomb's law gives the force between point charges: F = kq₁q₂/r², with k = 8.99 × 10⁹ N·m²/C².",
      "The structure should look familiar — it is an inverse-square law like gravitation, but staggeringly stronger and able to repel as well as attract. The electric field extends the idea: a charge fills the space around it with a field E, defined as the force per coulomb that a small positive test charge would feel, so E = F/q and a point charge produces E = kq/r². Field lines point away from positive charge and into negative charge, and their crowding shows field strength.",
      "A persistent misconception is that the field is only there when something feels it. The field exists whether or not a test charge is present — it is the middleman that carries the interaction, and it is the more fundamental object: first the charge creates the field everywhere, then the field pushes on whatever charge shows up.",
    ],
    example: {
      problem: "A +3.0 μC charge and a −2.0 μC charge are held 0.50 m apart. Find the magnitude and direction of the force between them, and the strength of the electric field the +3.0 μC charge creates at the location of the other charge.",
      steps: [
        "Identify the interaction: the charges have opposite signs, so the force on each is attractive — each charge is pulled straight toward the other with the same magnitude, by Newton's third law.",
        "Convert to SI units before computing: 3.0 μC = 3.0 × 10⁻⁶ C and 2.0 μC = 2.0 × 10⁻⁶ C.",
        "Apply Coulomb's law with magnitudes: F = kq₁q₂/r² = 8.99 × 10⁹ × (3.0 × 10⁻⁶ × 2.0 × 10⁻⁶)/0.50².",
        "Work the arithmetic: the numerator product is 8.99 × 10⁹ × 6.0 × 10⁻¹² = 0.0539 N·m², and dividing by 0.25 m² gives F ≈ 0.22 N.",
        "For the field, use only the source charge: E = kq/r² = 8.99 × 10⁹ × 3.0 × 10⁻⁶/0.25 ≈ 1.1 × 10⁵ N/C, pointing away from the positive source.",
        "Cross-check the two answers: the force should equal field times the charge placed in it, and 1.08 × 10⁵ × 2.0 × 10⁻⁶ ≈ 0.22 N — the ledger agrees.",
      ],
      answer: "The charges attract with a force of about 0.22 N, and the +3.0 μC charge creates a field of about 1.1 × 10⁵ N/C at the other charge's location.",
    },
    selfQuestions: [
      "Why does dividing the force by the test charge give a quantity that describes the source charge's influence alone?",
      "How are Coulomb's law and Newton's law of gravitation alike, and what are the two deepest ways they differ?",
      "What happens to the force between two charges if both charges are doubled and the separation is also doubled?",
      "How would you explain to a friend where the charge comes from when a rubbed balloon sticks to a wall?",
    ],
  },
  electric_potential_current: {
    explanation: [
      "Voltage and current are the two bookkeeping quantities of electricity, and keeping them distinct is half the battle. Electric potential difference (voltage) measures energy per charge: a 9.0 V battery gives every coulomb of charge 9.0 joules of energy to spend on its trip around the circuit. Current measures flow rate: I = q/t, in amperes, where 1 A means one coulomb passing a point each second. Voltage is the push per charge; current is how much charge actually moves.",
      "A water analogy organizes the picture: voltage is like the pressure difference a pump maintains, current is like the liters per second flowing through the pipe. Combining the two definitions gives the energy delivered: E = qV, and since power is energy per time, P = IV. These two relations let you track exactly how fast a battery drains and how much energy a device consumes.",
      "The misconception to kill early is that charge or current is used up by a bulb. The same current that enters a bulb leaves it — charge is conserved. What the charge spends is its ENERGY: it arrives at high potential, hands energy to the filament as light and heat, and continues on at lower potential. Current is the courier; voltage marks how much each courier delivers.",
    ],
    example: {
      problem: "A flashlight bulb draws a steady 0.50 A from a 9.0 V battery for 2.0 minutes. How much charge passes through the bulb, how much energy does the battery deliver, and at what power?",
      steps: [
        "Convert the time to seconds so the units cooperate: 2.0 min = 120 s.",
        "Use the definition of current to count the charge: q = It = 0.50 × 120 = 60 C passing through the bulb.",
        "Each coulomb carries 9.0 J from the battery, so the energy delivered is E = qV = 60 × 9.0 = 540 J.",
        "Compute the power as the delivery rate: P = IV = 0.50 × 9.0 = 4.5 W.",
        "Sanity-check for consistency: power times time should reproduce the energy, and 4.5 W × 120 s = 540 J — the two routes agree, and 4.5 W is sensible for a small bulb.",
      ],
      answer: "In two minutes, 60 C of charge flows through the bulb, carrying 540 J of energy at a steady power of 4.5 W.",
    },
    selfQuestions: [
      "How would you explain the difference between voltage and current to a friend using a water-pipe or delivery-truck analogy?",
      "Why does the current entering a bulb equal the current leaving it, and what exactly does the bulb take from the charge?",
      "What does it mean physically to say a battery is rated at 9.0 volts, in terms of joules and coulombs?",
      "If two bulbs draw the same current but one sits across a larger voltage, which consumes energy faster and why?",
    ],
  },
  dc_circuits: {
    explanation: [
      "A circuit is a closed loop that lets charge flow, and Ohm's law is its central relation: V = IR, where resistance R (in ohms, Ω) measures how strongly a component opposes current. Given any two of voltage, current, and resistance, you can find the third. Real circuits combine resistors two basic ways: in series, single file along one path, or in parallel, side by side across the same two points.",
      "Each arrangement has its own logic. Series resistors share one current, their voltages add, and the total resistance is the sum: R = R₁ + R₂. Parallel resistors share one voltage, their currents add, and the combination resists LESS than any branch alone: 1/R = 1/R₁ + 1/R₂, because extra branches are extra lanes for traffic. Two conservation rules anchor every analysis: voltage drops around any loop sum to the battery's voltage, and current into a junction equals current out.",
      "The misconception that causes the most wrong answers is assuming the battery's full voltage appears across every component. In a series chain the voltage divides among the resistors in proportion to their resistance; only parallel branches connected directly across the battery see its full voltage. Always ask which two points a component actually spans.",
    ],
    example: {
      problem: "A 12 V battery drives a circuit with a 4.0 Ω resistor in series with a parallel pair: 6.0 Ω and 3.0 Ω. Find the total current from the battery and the current through each parallel resistor.",
      steps: [
        "Collapse the parallel pair first: 1/R = 1/6.0 + 1/3.0 = 1/2.0, so the pair behaves like a single 2.0 Ω resistor — smaller than either branch, as parallel combinations must be.",
        "Add the series resistance: total R = 4.0 + 2.0 = 6.0 Ω across the 12 V battery.",
        "Apply Ohm's law to the whole circuit: I = V/R = 12/6.0 = 2.0 A flowing from the battery and through the 4.0 Ω resistor.",
        "Find how the voltage divides: the 4.0 Ω resistor drops V = IR = 2.0 × 4.0 = 8.0 V, leaving 12 − 8.0 = 4.0 V across the parallel section.",
        "Apply Ohm's law inside each branch, which shares that 4.0 V: the 6.0 Ω branch carries 4.0/6.0 ≈ 0.67 A and the 3.0 Ω branch carries 4.0/3.0 ≈ 1.33 A.",
        "Verify with the junction rule: 0.67 + 1.33 = 2.0 A, matching the current that arrived — charge is conserved, and the smaller resistance correctly took the larger share.",
      ],
      answer: "The battery supplies 2.0 A; the parallel section splits it into about 0.67 A through the 6.0 Ω resistor and 1.33 A through the 3.0 Ω resistor.",
    },
    selfQuestions: [
      "Why does adding a resistor in parallel decrease the total resistance when adding one in series increases it?",
      "How do the loop and junction rules express conservation of energy and conservation of charge in a circuit?",
      "What systematic order of moves would you teach a friend for reducing any mixed series-parallel network?",
      "Why are the lights in a house wired in parallel, and what would daily life look like if they were wired in series?",
    ],
  },
  magnetism_induction: {
    explanation: [
      "Electricity and magnetism are two faces of one interaction. Moving charges create magnetic fields — that is why a current-carrying wire deflects a compass and why coiling wire around an iron core makes an electromagnet. Magnetic fields in turn push on moving charges and currents, always at right angles to the motion. You already know magnets attract and repel; the deeper story is that magnetism is electricity in motion.",
      "The reverse effect is induction, and it powers civilization: a CHANGING magnetic environment through a loop of wire creates a voltage, called an emf. Faraday's law makes it quantitative — the induced emf equals the number of turns times the rate of change of magnetic flux, emf = N × ΔΦ/Δt, where flux Φ = BA is field strength times the loop area it threads. Lenz's law fixes the direction: the induced current flows so its own magnetic field opposes the change that created it, which is energy conservation wearing a magnetic disguise.",
      "The essential misconception: a strong field does not induce anything. You can park a coil in an enormous steady field forever and get zero current. Only CHANGE matters — a growing or dying field, a moving magnet, a rotating or shrinking loop. Generators spin coils precisely to keep the flux through them perpetually changing.",
    ],
    example: {
      problem: "A coil of 50 turns, each with area 0.020 m², sits with its plane perpendicular to a uniform 0.60 T magnetic field. The field is switched off, dying to zero in 0.25 s. Find the average emf induced in the coil and the current driven through its total resistance of 8.0 Ω.",
      steps: [
        "Compute the initial flux through one turn: Φ = BA = 0.60 × 0.020 = 0.012 Wb, and the final flux is zero once the field is gone.",
        "The flux change per turn is therefore ΔΦ = 0.012 Wb over Δt = 0.25 s — it is this change, not the field's strength, that drives the induction.",
        "Apply Faraday's law with all 50 turns contributing: emf = N × ΔΦ/Δt = 50 × 0.012/0.25 = 2.4 V.",
        "Drive that emf through the coil's resistance with Ohm's law: I = emf/R = 2.4/8.0 = 0.30 A flowing while the field collapses.",
        "Determine the direction with Lenz's law: the coil's flux is dying, so the induced current circulates to regenerate it, creating its own field in the same direction the vanishing field pointed.",
        "Sanity-check the time dependence: had the field died in 0.025 s instead, the emf would be ten times larger — faster change, bigger push — while a field merely sitting at 0.60 T would induce nothing at all.",
      ],
      answer: "The collapsing field induces an average emf of 2.4 V, driving a current of 0.30 A through the coil while the change lasts.",
    },
    selfQuestions: [
      "Why does a magnet resting motionless inside a coil induce no current, no matter how strong the magnet is?",
      "How is Lenz's law really a statement of energy conservation, and what would go wrong if induced currents aided the change instead?",
      "What are three physically different ways to change the magnetic flux through a loop, and which does a generator use?",
      "How does induction explain why pedaling a bicycle dynamo gets harder the brighter the lamp burns?",
    ],
  },
  thermodynamics_intro: {
    explanation: [
      "Heat is energy in transit between objects at different temperatures, and thermodynamics is the accounting system for it. Temperature and heat are different quantities: temperature measures the average kinetic energy of a substance's particles, while heat (Q, in joules) is energy actually transferred because of a temperature difference. How much a substance warms per joule is set by its specific heat capacity c, through Q = mcΔT — water's unusually large c (4186 J per kg per °C) is why oceans moderate climate and why boiling a pot takes so long.",
      "The first law of thermodynamics is conservation of energy with heat included: the internal energy of a system changes by the heat added minus the work the system does on its surroundings. The second law adds direction: heat flows spontaneously from hot to cold, never the reverse, which is why engines can convert only part of their heat intake into useful work and why a refrigerator needs an energy supply to push heat the unnatural way.",
      "The everyday misconception is using heat and temperature interchangeably. A bathtub of lukewarm water holds far more thermal energy than a red-hot nail; the nail merely has a higher temperature. Equal masses of different substances given the same heat also warm by different amounts — a beach's sand scorches while the adjacent water stays cool under identical sunshine, because their specific heats differ.",
    ],
    example: {
      problem: "An electric kettle delivers 500 W of heating power to 0.25 kg of water. The specific heat of water is 4186 J per kg per °C. How much heat is needed to raise the water from 20 °C to 80 °C, and how long does the heating take if all the kettle's power goes into the water?",
      steps: [
        "Identify the temperature change: ΔT = 80 − 20 = 60 °C — only the change matters in Q = mcΔT, not the individual temperatures.",
        "Apply the specific heat equation: Q = mcΔT = 0.25 × 4186 × 60.",
        "Work the arithmetic in stages: 0.25 × 4186 = 1046.5 J/°C for this mass of water, and 1046.5 × 60 ≈ 62800 J of heat required.",
        "Power is energy per time, so the duration is t = Q/P = 62800/500 ≈ 126 s, a little over two minutes.",
        "Sanity-check against experience: a couple of minutes to bring a cup of water near 80 °C in a small kettle is realistic, and a real kettle takes slightly longer because some heat leaks to the kettle body and the air.",
      ],
      answer: "Heating the water requires about 6.3 × 10⁴ J, which the 500 W kettle supplies in roughly 126 s — about two minutes.",
    },
    selfQuestions: [
      "How would you explain to a friend why a spark at thousands of degrees can be harmless while a pot of boiling water is dangerous?",
      "Why does water's high specific heat make coastal climates milder than inland ones at the same latitude?",
      "What does the second law say about why a working engine must always discard some heat to its surroundings?",
      "How would the kettle calculation change if the same energy were delivered to 0.25 kg of sand, whose specific heat is about five times smaller?",
    ],
  },
};
