// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — PHYSICS · UNIVERSITY.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  vectors_kinematics_calc: {
    explanation: [
      "Calculus turns the kinematics you learned in high school from a formula sheet into two operations. Velocity is the time derivative of position, acceleration is the time derivative of velocity, and you recover position from acceleration by integrating twice and fixing the constants with initial conditions. The familiar constant-acceleration equations are not separate laws — they are what you get when you integrate a constant a, so they silently fail the moment a depends on time.",
      "Vectors make this machinery work in two or three dimensions with almost no extra cost: differentiate and integrate each component independently, then reassemble magnitude and direction at the end with the Pythagorean theorem and an arctangent. The x motion never talks to the y motion; only the clock is shared. That decoupling is exactly why projectile problems split into uniform horizontal motion and free vertical fall.",
      "A frequent trap is differentiating the speed to get acceleration. Acceleration is the derivative of the velocity vector, so an object turning at constant speed still accelerates — the direction of the vector is changing even though its magnitude is not. Whenever motion curves, expect a component of acceleration perpendicular to the velocity.",
    ],
    example: {
      problem: "A particle moves in the xy plane with position components x(t) = 2t³ − 3t² and y(t) = 8t, in meters with t in seconds. Find its velocity, speed, direction of travel, and acceleration at t = 2.0 s.",
      steps: [
        "Differentiate each position component once to get velocity: vx = dx/dt = 6t² − 6t and vy = dy/dt = 8, so the y velocity is constant while the x velocity changes with time.",
        "Evaluate at t = 2.0 s: vx = 6(4) − 6(2) = 24 − 12 = 12 m/s and vy = 8.0 m/s.",
        "Reassemble the vector: speed = √(12² + 8²) = √208 ≈ 14.4 m/s, pointing at arctan(8/12) ≈ 33.7° above the x axis.",
        "Differentiate again for acceleration: ax = dvx/dt = 12t − 6 = 12(2) − 6 = 18 m/s², and ay = 0 because vy is constant.",
        "Interpret the result: the acceleration is purely along x while the velocity has both components, so the velocity direction is changing and the path curves — exactly what nonparallel velocity and acceleration vectors imply.",
      ],
      answer: "At t = 2.0 s the velocity is (12, 8.0) m/s — speed about 14.4 m/s at 33.7° above the x axis — and the acceleration is 18 m/s² in the +x direction.",
    },
    selfQuestions: [
      "Why do the constant-acceleration equations fail when a depends on t, and what replaces them?",
      "How can an object have zero velocity at an instant but nonzero acceleration — what does its position graph look like there?",
      "What information do the initial conditions supply when you integrate acceleration back to position, and why can the math not supply it?",
      "If velocity and acceleration vectors are perpendicular at some instant, what is happening to the speed at that moment?",
    ],
  },
  newtonian_dynamics: {
    explanation: [
      "You already draw free-body diagrams and apply F = ma to single objects; university dynamics scales that skill to systems — several bodies, connecting strings, pulleys, inclines — handled with one disciplined procedure. Isolate each body, draw every force on it, choose axes (usually along the acceleration), write Newton's second law per axis per body, then solve the resulting simultaneous equations. The physics lives in the setup; the rest is algebra.",
      "Constraints are the new ingredient: an inextensible string forces both connected blocks to share one acceleration magnitude, and that shared a is what couples their equations. Internal forces like tension appear twice with equal magnitude (Newton's third law) and cancel when you add the equations, which is why summing them often yields the acceleration in one line.",
      "Resist the assumption that the tension in a string equals the weight hanging from it. That is true only at zero acceleration. When the hanging mass accelerates downward, the net force on it must point down, so the tension is strictly less than mg — checking that inequality is a fast sanity test on any pulley answer.",
    ],
    example: {
      problem: "A 4.0 kg block on a horizontal table (kinetic friction coefficient 0.25) is connected by a light string over a frictionless pulley to a hanging 2.0 kg block. Using g = 9.8 m/s², find the acceleration of the system and the tension in the string.",
      steps: [
        "Identify the forces that drive and resist the motion: the hanging weight m₂g = 2.0 × 9.8 = 19.6 N pulls the system forward, while kinetic friction on the table block opposes it with f = μk m₁g = 0.25 × 4.0 × 9.8 = 9.8 N.",
        "The string constrains both blocks to one acceleration a, so add the two Newton's-law equations (tension cancels as an internal force): m₂g − f = (m₁ + m₂)a.",
        "Solve for a: a = (19.6 − 9.8)/(4.0 + 2.0) = 9.8/6.0 ≈ 1.63 m/s².",
        "Return to the hanging block alone to get tension: m₂g − T = m₂a, so T = 2.0 × (9.8 − 1.63) ≈ 16.3 N.",
        "Sanity-check with the table block: T − f = 16.3 − 9.8 = 6.5 N, and m₁a = 4.0 × 1.63 = 6.5 N — both equations agree, and T is below the 19.6 N weight, as it must be for a block accelerating downward.",
      ],
      answer: "The system accelerates at about 1.6 m/s² and the string tension is about 16 N.",
    },
    selfQuestions: [
      "Why does tension cancel when you add the equations for two connected blocks, and when would you need it explicitly?",
      "How would the acceleration change if the pulley had significant mass — which assumption breaks first?",
      "What tells you whether a system with static friction moves at all before you compute any acceleration?",
      "How do you choose axes on an incline problem, and what goes wrong if you keep horizontal and vertical axes instead?",
    ],
  },
  rotational_motion_torque: {
    explanation: [
      "Rotation gets its own copy of Newton's second law: torque replaces force, angular acceleration replaces linear acceleration, and moment of inertia replaces mass, giving τ = Iα. Torque is force times lever arm — the perpendicular distance from the rotation axis to the line of the force — so where and in what direction you push matters as much as how hard. You already know F = ma and circular motion; this is the same logic applied to spinning.",
      "Moment of inertia is the rotational stubbornness of a body, and unlike mass it depends on how the mass is distributed: I = Σmr², so material far from the axis counts quadratically more. A hoop (I = MR²) resists spin-up twice as hard as a uniform disk of the same mass and radius (I = MR²/2). When a rope unwinds from a rotating object, the constraint a = αR ties the linear and angular worlds together.",
      "The classic mistake in falling-mass-and-pulley problems is to set the torque equal to mgR. The string tension, not the hanging weight, acts on the pulley rim — and tension drops below mg as soon as the mass accelerates. Solve the linear and rotational equations together rather than guessing the rim force.",
    ],
    example: {
      problem: "A light string is wound around a uniform solid disk of mass 2.0 kg and radius 0.20 m that spins on a frictionless fixed axle. A 1.0 kg mass hangs from the free end. Using g = 9.8 m/s², find the downward acceleration of the mass, the string tension, and the angular acceleration of the disk.",
      steps: [
        "Write Newton's second law for the hanging mass, taking down as positive: mg − T = ma, with the tension unknown because the mass accelerates.",
        "Write the rotational law for the disk: the tension acts at the rim, so TR = Iα with I = MR²/2 = 0.5 × 2.0 × 0.20² = 0.040 kg·m².",
        "Use the string constraint a = αR to eliminate α: TR = (MR²/2)(a/R) gives T = (M/2)a = 1.0a.",
        "Substitute into the linear equation: 1.0 × 9.8 − 1.0a = 1.0a, so 9.8 = 2.0a and a = 4.9 m/s²; then T = 1.0 × 4.9 = 4.9 N.",
        "Finish with α = a/R = 4.9/0.20 = 24.5 rad/s², and check the torque route independently: τ = TR = 4.9 × 0.20 = 0.98 N·m, and τ/I = 0.98/0.040 = 24.5 rad/s² — consistent.",
        "Interpret: the mass falls at half of g because the disk effectively adds M/2 = 1.0 kg of inertia, and the tension (4.9 N) is well below the 9.8 N weight, as it must be.",
      ],
      answer: "The mass accelerates down at 4.9 m/s², the tension is 4.9 N, and the disk has angular acceleration 24.5 rad/s².",
    },
    selfQuestions: [
      "Why does a hoop accelerate more slowly than a uniform disk of equal mass and radius under the same torque?",
      "What exactly does the constraint a = αR encode, and when does a string slip enough to break it?",
      "How would you convince a friend that pushing on a door near its hinge is wasted effort, using the torque definition?",
      "Where does the energy go in this pulley system — how would an energy method reproduce the 4.9 m/s² answer?",
    ],
  },
  angular_momentum: {
    explanation: [
      "Just as impulse and momentum let you skip the messy details of forces during collisions, angular momentum L = Iω lets you skip the details of torques during spins. When the net external torque on a system is zero, L is conserved — no matter what the parts of the system do to each other internally. This single statement explains spinning skaters, gyroscopic stability, and why planets sweep equal areas in equal times.",
      "The power of the law shows up when the moment of inertia changes mid-motion. Pulling mass toward the rotation axis lowers I, and since Iω must stay fixed, ω rises in exact proportion. For a point mass, L = mvr; for extended bodies, L = Iω with the appropriate I about the chosen axis. Always identify the system and the axis before claiming conservation — torque-free about one axis does not mean torque-free about another.",
      "A tempting but wrong follow-up is to assume rotational kinetic energy is conserved too. It is not: a skater pulling in her arms does real work against the effective outward pull, and that work appears as extra kinetic energy. K = L²/(2I), so at fixed L a smaller I means strictly more kinetic energy, not the same.",
    ],
    example: {
      problem: "A playground merry-go-round is a uniform disk of mass 120 kg and radius 2.0 m, rotating freely at 1.5 rad/s. A 60 kg student stands at the rim, rotating with it. The student then walks to the exact center. Treating the student as a point mass and ignoring friction, find the new angular speed and compare kinetic energies.",
      steps: [
        "Compute the initial moment of inertia: the disk contributes MR²/2 = 0.5 × 120 × 2.0² = 240 kg·m², and the student at the rim adds mr² = 60 × 2.0² = 240 kg·m², so I_i = 480 kg·m².",
        "No external torque acts about the axle (the axle force has zero lever arm and friction is ignored), so angular momentum is conserved: L = I_i ω_i = 480 × 1.5 = 720 kg·m²/s.",
        "At the center the student sits on the axis, so r = 0 and the student contributes nothing: I_f = 240 kg·m².",
        "Apply conservation: ω_f = L/I_f = 720/240 = 3.0 rad/s — halving the moment of inertia doubles the angular speed.",
        "Compare energies: K_i = ½ × 480 × 1.5² = 540 J and K_f = ½ × 240 × 3.0² = 1080 J. The extra 540 J is the work the student does walking inward against the tendency to be flung outward — L is conserved, K is not.",
      ],
      answer: "The merry-go-round speeds up to 3.0 rad/s, and the kinetic energy doubles from 540 J to 1080 J because the student does work walking inward.",
    },
    selfQuestions: [
      "Why is angular momentum conserved here even though the angular speed clearly changes?",
      "Where does the extra kinetic energy come from when the student walks inward, and where would it go on the walk back out?",
      "How would the answer change if the student walked only halfway to the center — set up the new I before computing?",
      "What external influences in a real playground would make L only approximately conserved, and how would you estimate their effect?",
    ],
  },
  statics_equilibrium: {
    explanation: [
      "Bridges, cranes, ladders, and your own skeleton all obey the same two conditions: the forces sum to zero and the torques about any point sum to zero. The force condition you know from balanced-force problems; the torque condition is the genuinely new constraint, and it is what determines how a load is shared among supports. An object can have zero net force and still rotate — equilibrium demands both.",
      "The strategic move is choosing where to take torques. Since the equilibrium conditions hold about every point, pick the pivot that makes unknown forces vanish: any force acting at the pivot has zero lever arm and drops out of the equation. Taking torques about a hinge eliminates both hinge force components at once, usually leaving a single unknown you can read off directly. For a uniform beam, gravity acts effectively at its center.",
      "Students often worry that the answer depends on the pivot choice — it never does. Different pivots produce different-looking equations, but they are algebraically equivalent once the force equations are included. A good habit is to solve with one pivot and verify the torque balance about a second point.",
    ],
    example: {
      problem: "A uniform 4.0 m strut of mass 20 kg is attached to a wall by a hinge and held horizontal by a cable that runs from its far end to the wall, making a 30° angle with the strut. A 10 kg sign hangs from the far end. Using g = 9.8 m/s², find the cable tension and the hinge force components.",
      steps: [
        "Take torques about the hinge so both unknown hinge components drop out of the equation; only the cable and the two weights contribute.",
        "Balance the torques: the cable's perpendicular component T sin30° acts at 4.0 m, the strut's weight 20 × 9.8 = 196 N acts at its 2.0 m midpoint, and the 98 N sign acts at 4.0 m, so T sin30° × 4.0 = 196 × 2.0 + 98 × 4.0 = 392 + 392 = 784 N·m.",
        "Solve for tension: T × 0.5 × 4.0 = 2.0T = 784, giving T = 392 N.",
        "Use force balance for the hinge: horizontally, the hinge must cancel the cable's pull toward the wall, so H_x = T cos30° = 392 × 0.866 ≈ 339 N directed away from the wall.",
        "Vertically, the cable supplies T sin30° = 196 N of the 294 N total weight, so the hinge supplies H_y = 294 − 196 = 98 N upward.",
        "Check torques about the far end of the strut as an independent test: hinge vertical force 98 N at 4.0 m gives 392 N·m one way, strut weight 196 N at 2.0 m gives 392 N·m the other — balanced, so the solution is consistent.",
      ],
      answer: "The cable tension is 392 N, and the hinge pushes with about 339 N horizontally (away from the wall) and 98 N upward.",
    },
    selfQuestions: [
      "Why does taking torques about the hinge simplify the problem, and what would change if you chose the far end instead?",
      "How does the required cable tension behave as the cable angle approaches zero, and what does that tell a structural designer?",
      "Why is it legitimate to treat the strut's distributed weight as a single force at its midpoint?",
      "What additional condition decides whether a leaning ladder slips, beyond the two equilibrium equations?",
    ],
  },
  fluid_mechanics: {
    explanation: [
      "Fluids transmit force as pressure — force per unit area — and three working tools cover most first-year problems: hydrostatics (p = p₀ + ρgh for depth h in a fluid of density ρ), continuity (Av is constant along a narrowing pipe because mass is conserved), and Bernoulli's equation, which is conservation of energy per unit volume for steady, incompressible, nonviscous flow: p + ½ρv² + ρgy stays constant along a streamline. Buoyancy follows from hydrostatics: the upward force equals the weight of displaced fluid.",
      "Read Bernoulli's equation as an energy budget. The ½ρv² term is kinetic energy density and ρgy is gravitational potential energy density, so pressure plays the role of the budget's flexible account: where the fluid speeds up, pressure must drop to pay for the kinetic energy. Continuity tells you where the speeding up happens — narrow sections force faster flow.",
      "Intuition often insists that squeezing flow into a narrow pipe raises the pressure there, like pinching a hose. It is the reverse: the constriction is the low-pressure region, because fluid must accelerate into it and only a pressure drop can provide that forward push. The pinched-hose spray feels forceful because of speed, not pressure.",
    ],
    example: {
      problem: "Water (density 1000 kg/m³) flows steadily through a horizontal pipe that narrows from 4.0 cm diameter to 2.0 cm diameter. In the wide section the speed is 2.0 m/s and the gauge pressure is 150 kPa. Find the speed and gauge pressure in the narrow section.",
      steps: [
        "Apply continuity with areas proportional to diameter squared: A₁/A₂ = (4.0/2.0)² = 4, so the speed in the narrow section is v₂ = 4 × 2.0 = 8.0 m/s.",
        "Since the pipe is horizontal, the ρgy terms cancel and Bernoulli reduces to p₁ + ½ρv₁² = p₂ + ½ρv₂².",
        "Solve for p₂: p₂ = p₁ + ½ρ(v₁² − v₂²) = 150000 + 0.5 × 1000 × (2.0² − 8.0²) = 150000 + 500 × (4 − 64).",
        "Evaluate: 500 × (−60) = −30000 Pa, so p₂ = 150000 − 30000 = 120000 Pa = 120 kPa.",
        "Interpret the sign: the pressure dropped by 30 kPa exactly where the water sped up — the pressure difference is the force per area that accelerated the water into the constriction, so a drop is required, not a rise.",
      ],
      answer: "The water moves at 8.0 m/s in the narrow section, where the gauge pressure falls to 120 kPa.",
    },
    selfQuestions: [
      "Why must the pressure be lower in the narrow section — what force would otherwise accelerate the water?",
      "Which of Bernoulli's assumptions (steady, incompressible, nonviscous) fails first in a real garden hose, and what does viscosity do to the pressure along the pipe?",
      "How does the continuity equation express conservation of mass, and what changes for a compressible gas?",
      "How would you use these tools to explain why a partially blocked artery is dangerous beyond the reduced flow itself?",
    ],
  },
  oscillations_waves_adv: {
    explanation: [
      "At this level a wave is a function of two variables, y(x, t), and the sinusoidal traveling wave y = A sin(kx − ωt) is the workhorse. The wave number k = 2π/λ counts radians per meter, the angular frequency ω = 2πf counts radians per second, and the pattern moves at v = ω/k = fλ. On a stretched string the medium sets that speed: v = √(T/μ) for tension T and linear mass density μ. Everything you learned about amplitude, wavelength, and frequency still holds — now packaged in one formula you can differentiate.",
      "Keep two velocities firmly separate. The wave speed v is how fast the pattern translates along x and is fixed by the medium. The transverse particle velocity is the partial derivative of y with respect to t at fixed x — each piece of string bobs up and down with maximum speed ωA, which depends on amplitude while the wave speed does not. Conflating these two is the most common error in wave problems.",
      "This framework also covers superposition phenomena: two identical waves traveling opposite ways add to a standing wave with fixed nodes, and damping or driving terms generalize simple harmonic motion to the resonant systems that dominate engineering practice.",
    ],
    example: {
      problem: "A transverse wave on a string is described by y(x, t) = 0.020 sin(40x − 800t), in SI units. The string has linear mass density 5.0 g/m. Find the wavelength, frequency, wave speed, maximum transverse particle speed, and the string tension.",
      steps: [
        "Read off the structure: comparing with A sin(kx − ωt) gives amplitude A = 0.020 m, wave number k = 40 rad/m, and angular frequency ω = 800 rad/s; the minus sign means the wave travels in the +x direction.",
        "Convert to wavelength and frequency: λ = 2π/k = 2π/40 ≈ 0.157 m and f = ω/2π = 800/2π ≈ 127 Hz.",
        "Compute the wave speed: v = ω/k = 800/40 = 20 m/s (equivalently fλ ≈ 127 × 0.157 ≈ 20 m/s — consistent).",
        "Differentiate y with respect to time at fixed x to get the particle velocity; its amplitude is ωA = 800 × 0.020 = 16 m/s, slightly less than the 20 m/s wave speed but a completely different motion — vertical, not horizontal.",
        "Use the medium relation to find tension: v = √(T/μ) means T = μv² = 0.0050 × 20² = 2.0 N.",
      ],
      answer: "λ ≈ 0.157 m, f ≈ 127 Hz, wave speed 20 m/s, maximum particle speed 16 m/s, and the string tension is 2.0 N.",
    },
    selfQuestions: [
      "Why does the maximum particle speed depend on amplitude while the wave speed does not?",
      "What physically distinguishes a standing wave from a traveling wave, and how does superposition produce the nodes?",
      "How would doubling the string tension change λ, f, and v for a wave driven at the same frequency?",
      "Why does the argument kx − ωt describe motion in the +x direction — what stays constant for a point riding a crest?",
    ],
  },
  thermodynamics_kinetic: {
    explanation: [
      "Thermodynamics tracks energy at the macroscopic level, and kinetic theory explains it from below: temperature measures the average translational kinetic energy of molecules, (3/2)kT per molecule for an ideal gas, and pressure is the drumbeat of molecular collisions on the walls. The first law, ΔU = Q − W, is conservation of energy with bookkeeping conventions: Q is heat added to the gas and W is work done by the gas as it expands.",
      "Work is where calculus enters: W is the integral of p dV along the actual path from the initial to the final volume — the area under the process curve on a pV diagram. That is why work and heat are path-dependent while internal energy is not: U of an ideal gas depends only on temperature. An isothermal expansion keeps T (and therefore U) fixed, so every joule of work the gas does must be imported as heat.",
      "Do not conflate heat and temperature. A gas can absorb heat with no temperature change (isothermal expansion) or heat up with no heat input at all (rapid adiabatic compression — a bicycle pump warms because work is done on the gas). Temperature is a state of the gas; heat is energy in transit.",
    ],
    example: {
      problem: "Two moles of an ideal gas expand isothermally at 300 K from 10 L to 25 L. Using R = 8.314 J/(mol·K), find the work done by the gas, the change in internal energy, and the heat absorbed.",
      steps: [
        "Set up the work integral: W = integral of p dV, and on an isotherm p = nRT/V, so W = nRT times the integral of dV/V from V₁ to V₂, which evaluates to nRT ln(V₂/V₁).",
        "Insert numbers: nRT = 2.0 × 8.314 × 300 = 4988 J, and ln(25/10) = ln 2.5 ≈ 0.916.",
        "Multiply: W = 4988 × 0.916 ≈ 4.6 × 10³ J — positive, as expected for an expansion pushing on its surroundings.",
        "Internal energy of an ideal gas depends only on temperature, and T is constant on an isotherm, so ΔU = 0.",
        "Apply the first law: Q = ΔU + W = 0 + 4.6 kJ, so the gas absorbs 4.6 kJ of heat — every joule of work output was paid for by heat flowing in, none by cooling.",
      ],
      answer: "The gas does about 4.6 kJ of work, its internal energy is unchanged, and it absorbs about 4.6 kJ of heat.",
    },
    selfQuestions: [
      "Why is work path-dependent on a pV diagram while internal energy change is not?",
      "How would the work compare if the same expansion happened adiabatically instead — and why must the gas cool in that case?",
      "What does kinetic theory say doubling the absolute temperature does to the average molecular speed?",
      "How would you explain to a friend the difference between heat and temperature using the isothermal expansion as the example?",
    ],
  },
  statistical_mechanics_intro: {
    explanation: [
      "Statistical mechanics rebuilds thermodynamics from counting. A macrostate is what you can measure (say, the total number of heads in a coin set, or a gas's pressure); a microstate is one complete microscopic arrangement consistent with it. The central postulate is that an isolated system is equally likely to be in any accessible microstate, so the probability of a macrostate is proportional to its multiplicity Ω — the number of microstates that realize it.",
      "Entropy quantifies that count: S = k ln Ω, with Boltzmann's constant k = 1.38 × 10⁻²³ J/K. The logarithm makes entropy additive when multiplicities multiply, and the second law becomes almost a tautology: systems drift toward the macrostates with overwhelmingly more microstates simply because there are overwhelmingly more ways to be there. For everyday particle numbers (10²³), 'overwhelmingly' is so extreme that fluctuations away from equilibrium are unobservable.",
      "The common misreading is that disorder is forced or that ordered states are forbidden. Nothing prevents all the air molecules from gathering in one corner of the room — every microstate remains equally likely. The point is purely statistical: the spread-out macrostates own astronomically more microstates, so that is where the system is found.",
    ],
    example: {
      problem: "Four distinguishable coins are tossed. Count the microstates, find the probability of the macrostate 'exactly two heads' and of 'all four heads', and compute the entropy S = k ln Ω of each macrostate using k = 1.38 × 10⁻²³ J/K.",
      steps: [
        "Count all microstates: each coin has 2 outcomes, so Ω_total = 2⁴ = 16 equally likely sequences.",
        "Count the microstates of 'exactly two heads': choosing which 2 of the 4 coins land heads gives C(4,2) = 6 microstates, so P = 6/16 = 0.375.",
        "Count 'all four heads': only 1 sequence works, so P = 1/16 ≈ 0.063 — six times less likely than the even split, purely because fewer arrangements realize it.",
        "Convert multiplicities to entropies: S(two heads) = k ln 6 = 1.38 × 10⁻²³ × 1.79 ≈ 2.5 × 10⁻²³ J/K, while S(all heads) = k ln 1 = 0.",
        "Interpret the scaling: with 4 coins the even split is only modestly favored, but the binomial peak sharpens ferociously with N — for 10²³ molecules the analogous even spread is so dominant that deviations are never seen, which is the second law in miniature.",
      ],
      answer: "There are 16 microstates; 'two heads' has probability 0.375 and entropy about 2.5 × 10⁻²³ J/K, while 'all heads' has probability 1/16 and zero entropy.",
    },
    selfQuestions: [
      "Why does the macrostate with the most microstates dominate more and more completely as the particle number grows?",
      "What does the logarithm in S = k ln Ω accomplish when you combine two independent systems?",
      "How would you answer someone who claims the second law forbids ordered states from ever occurring?",
      "What changes in the counting if the coins (or particles) are indistinguishable, and why does that matter physically?",
    ],
  },
  electrostatics_gauss: {
    explanation: [
      "Gauss's law repackages Coulomb's law as a statement about flux: the electric flux through any closed surface equals the enclosed charge divided by ε₀. Flux counts field lines crossing the surface, so the law says field lines begin and end only on charges. It is always true, but it becomes a calculation tool only when symmetry lets you argue the field's direction and constancy in advance — spheres, infinite lines, and infinite planes are the three workable geometries.",
      "The method is to choose a Gaussian surface that matches the symmetry: one where E is perpendicular to the surface with constant magnitude on part of it, and parallel to the surface (zero flux) on the rest. Then the flux integral collapses to E times an area, and the unknown E pops out algebraically. The surface is purely imaginary — a mathematical bookkeeping boundary, not a physical object.",
      "A persistent misconception: if the enclosed charge is zero, the field on the surface must be zero. False — only the net flux vanishes. A point charge sitting just outside your surface drives plenty of field through it; the inward and outward contributions merely cancel. Gauss's law constrains the total flux, never the field at individual points, unless symmetry adds the missing information.",
    ],
    example: {
      problem: "A very long, straight wire carries a uniform linear charge density of 4.0 μC/m. Use Gauss's law to find the electric field magnitude 0.50 m from the wire, taking ε₀ = 8.85 × 10⁻¹² C²/(N·m²).",
      steps: [
        "Exploit symmetry: by the cylindrical symmetry of an infinite line, E must point radially outward with the same magnitude at every point a distance r from the wire — so choose a coaxial cylindrical Gaussian surface of radius r and length L.",
        "Evaluate the flux: the two flat end caps contribute nothing (E lies parallel to them), and the curved side contributes E × 2πrL since E is perpendicular to it with constant magnitude.",
        "Apply Gauss's law with enclosed charge λL: E × 2πrL = λL/ε₀, and the arbitrary length L cancels, leaving E = λ/(2πε₀r).",
        "Substitute numbers: E = (4.0 × 10⁻⁶)/(2π × 8.85 × 10⁻¹² × 0.50) = (4.0 × 10⁻⁶)/(2.78 × 10⁻¹¹) ≈ 1.4 × 10⁵ N/C.",
        "Check the structure: the field falls as 1/r rather than 1/r² because the source is a line, not a point — doubling r halves E, and the units N/C confirm a field, not a force.",
      ],
      answer: "The field is about 1.4 × 10⁵ N/C, pointing radially away from the wire.",
    },
    selfQuestions: [
      "Why does the field of a line charge fall off as 1/r while a point charge falls off as 1/r²?",
      "What goes wrong if you try to use Gauss's law to find the field of an electric dipole or a finite rod?",
      "Why must the electrostatic field be zero inside conductor material, and what does Gauss's law then say about where excess charge sits?",
      "How can the flux through a closed surface be zero while the field on the surface is large — what would the field-line picture look like?",
    ],
  },
  potential_capacitance: {
    explanation: [
      "Electric potential is potential energy per unit charge, and it converts vector field problems into scalar bookkeeping: the field is the negative gradient of V, so field lines run downhill in potential, and the potential difference between two points is the negative integral of E along any path between them. For the uniform field between parallel plates this collapses to the workhorse relation E = V/d. You already used voltage in circuits; here it acquires its field-theoretic meaning.",
      "A capacitor stores charge and energy by holding +Q and −Q apart: C = Q/V measures how much charge per volt the geometry can hold, and for parallel plates C = ε₀A/d — bigger plates and smaller gaps store more. The stored energy U = ½CV² = Q²/(2C) lives in the field itself, which is why a dielectric slab (which weakens the internal field) raises capacitance.",
      "Beware the reflex that V = 0 implies E = 0 or vice versa. The potential is a running total of the field along a path, so the field can be strong where the potential happens to pass through zero (midway between equal and opposite charges), and the potential can be large and constant where the field vanishes (inside a charged conducting shell). Field is slope; potential is height.",
    ],
    example: {
      problem: "A parallel-plate capacitor has plate area 2.0 × 10⁻² m² and separation 1.0 mm, with vacuum between the plates. It is charged to 12 V. Using ε₀ = 8.85 × 10⁻¹² F/m, find the capacitance, the stored charge, the field between the plates, and the stored energy.",
      steps: [
        "Compute the capacitance from geometry: C = ε₀A/d = (8.85 × 10⁻¹² × 2.0 × 10⁻²)/(1.0 × 10⁻³) = 1.77 × 10⁻¹⁰ F = 177 pF.",
        "Find the charge from the definition of capacitance: Q = CV = 1.77 × 10⁻¹⁰ × 12 ≈ 2.1 × 10⁻⁹ C, i.e. +2.1 nC on one plate and −2.1 nC on the other.",
        "Get the field from the uniform-field relation: E = V/d = 12/(1.0 × 10⁻³) = 1.2 × 10⁴ V/m, directed from the positive plate to the negative plate.",
        "Compute the stored energy: U = ½CV² = 0.5 × 1.77 × 10⁻¹⁰ × 12² ≈ 1.3 × 10⁻⁸ J.",
        "Sanity-check the scale: tens of picofarads and tens of nanojoules are typical for bench-top plates — capacitors store charge readily but only modest energy, which is why farad-scale supercapacitors need enormous effective areas.",
      ],
      answer: "C ≈ 177 pF, Q ≈ 2.1 nC, E = 1.2 × 10⁴ V/m, and the stored energy is about 1.3 × 10⁻⁸ J.",
    },
    selfQuestions: [
      "If the battery is disconnected and the plates are pulled farther apart, which of Q, V, E, and U change, and why?",
      "Why does inserting a dielectric increase capacitance — what does the material do to the field between the plates?",
      "How can the potential be zero at a point where the electric field is strong — what picture reconciles them?",
      "Why does the energy formula have three equivalent forms (½CV², ½QV, Q²/2C), and when is each most convenient?",
    ],
  },
  current_resistance_circuits: {
    explanation: [
      "Current is the rate of charge flow, I = dq/dt, and resistance converts the microscopic picture — electrons drifting through a lattice, scattering as they go — into the circuit relation V = IR. University circuit analysis goes beyond series-parallel reduction to Kirchhoff's two rules, which are conservation laws in disguise: the junction rule (currents into a node sum to currents out) is conservation of charge, and the loop rule (potential changes around any closed loop sum to zero) is conservation of energy per charge.",
      "The reliable procedure: assign a current with an assumed direction to each branch, write the junction rule at the nodes, then walk each independent loop adding potential changes — a drop of IR when you traverse a resistor with the current, a rise of the emf when you pass through a battery from − to +. Solve the linear system; a negative result simply means that current flows opposite to your guess, not that you made an error.",
      "Many students believe a battery always pushes current out of its positive terminal. In multi-battery circuits a stronger source can force current backward through a weaker one — that is exactly what charging a battery means — so let the algebra decide the directions.",
    ],
    example: {
      problem: "Two batteries are connected between the same pair of nodes A and B: a 12 V battery in series with 2.0 Ω in one branch, a 6.0 V battery in series with 1.0 Ω in another, both positive terminals toward node A. A 4.0 Ω resistor forms the third branch between A and B. Find the three branch currents.",
      steps: [
        "Define unknowns: let I₁ flow from the 12 V branch into node A, I₂ flow from A to B through the 4.0 Ω resistor, and I₃ flow from A into the 6.0 V branch; the junction rule at A gives I₁ = I₂ + I₃.",
        "Walk the loop containing the 12 V battery and the 4.0 Ω resistor: +12 − 2.0 I₁ − 4.0 I₂ = 0, which with the junction rule becomes 12 = 2(I₂ + I₃) + 4I₂ = 6I₂ + 2I₃, i.e. 3I₂ + I₃ = 6.",
        "Walk the loop containing the 4.0 Ω resistor and the 6.0 V branch (from A down through the battery branch, back up through the resistor): −1.0 I₃ − 6.0 + 4.0 I₂ = 0, i.e. 4I₂ − I₃ = 6.",
        "Add the two loop equations to eliminate I₃: 7I₂ = 12, so I₂ = 12/7 ≈ 1.71 A; then I₃ = 4(12/7) − 6 = 6/7 ≈ 0.86 A and I₁ = I₂ + I₃ = 18/7 ≈ 2.57 A.",
        "Interpret I₃: it is positive flowing from A into the 6.0 V battery's positive terminal, so the 12 V source is recharging the 6.0 V battery rather than being assisted by it.",
        "Verify with node potentials: V_A = 12 − 2.0 × 2.57 ≈ 6.86 V, and the resistor branch gives 4.0 × 1.71 ≈ 6.86 V, while the battery branch gives 6.0 + 1.0 × 0.86 ≈ 6.86 V — all three branches agree.",
      ],
      answer: "I₁ ≈ 2.57 A from the 12 V branch, I₂ ≈ 1.71 A through the 4.0 Ω resistor, and I₃ ≈ 0.86 A charging the 6.0 V battery.",
    },
    selfQuestions: [
      "Which conservation law does each of Kirchhoff's rules express, and why must both hold simultaneously?",
      "What does a negative current in your solution actually tell you, and why is it not a mistake?",
      "Under what conditions does current flow into a battery's positive terminal, and what is happening energetically when it does?",
      "Why does series-parallel reduction fail for this circuit, forcing the full Kirchhoff treatment?",
    ],
  },
  magnetic_fields_forces: {
    explanation: [
      "Magnetic fields exert a force only on moving charges, and the force law has an unusual geometry: F = qvB sinθ in magnitude, directed perpendicular to both the velocity and the field (right-hand rule, reversed for negative charges). Because the force is always perpendicular to v, a magnetic field can never change a particle's speed or kinetic energy — it only steers. A charge moving perpendicular to a uniform field is steered into a circle, with the magnetic force supplying exactly the centripetal force.",
      "Setting qvB = mv²/r gives the radius r = mv/(qB): momentum per unit charge per unit field. Stiffer (higher-momentum) particles curve less; stronger fields curl them tighter. The orbital period T = 2πm/(qB) is independent of speed — faster particles travel proportionally larger circles in the same time — which is the principle behind the cyclotron and the reason mass spectrometers sort ions so cleanly.",
      "Be careful with the energy intuition: since magnetic forces do no work, any speeding-up you observe near magnets is done by electric fields (often induced ones) or by other forces. The same v × B geometry, applied to the drifting charges in a wire, yields the force on a current-carrying conductor, F = BIL for a straight segment perpendicular to the field.",
    ],
    example: {
      problem: "A proton (mass 1.67 × 10⁻²⁷ kg, charge 1.6 × 10⁻¹⁹ C) moves at 3.0 × 10⁶ m/s perpendicular to a uniform 0.50 T magnetic field. Find the radius of its circular path and the time for one revolution.",
      steps: [
        "Recognize the geometry: with v perpendicular to B, the magnetic force qvB is constant in magnitude and always perpendicular to the motion, so it acts as a centripetal force and the path is a circle.",
        "Set the magnetic force equal to the required centripetal force: qvB = mv²/r, and solve for the radius: r = mv/(qB).",
        "Substitute: r = (1.67 × 10⁻²⁷ × 3.0 × 10⁶)/(1.6 × 10⁻¹⁹ × 0.50) = (5.01 × 10⁻²¹)/(8.0 × 10⁻²⁰) ≈ 0.063 m, about 6.3 cm.",
        "Compute the period from circumference over speed: T = 2πr/v = (2π × 0.063)/(3.0 × 10⁶) ≈ 1.3 × 10⁻⁷ s — equivalently 2πm/(qB), with the speed canceling out.",
        "Note the cancellation: a proton at twice the speed would orbit a circle of twice the radius in exactly the same 0.13 μs, which is why a cyclotron can use a fixed driving frequency while particles spiral outward.",
      ],
      answer: "The proton circles with radius about 6.3 cm, completing each revolution in about 1.3 × 10⁻⁷ s (0.13 μs).",
    },
    selfQuestions: [
      "Why can a magnetic field never change a charged particle's kinetic energy, no matter how strong it is?",
      "How would the path change if the proton's velocity had a component along the field as well as across it?",
      "Why is the orbital period independent of speed, and which technology exploits that fact?",
      "How would an electron's trajectory differ from the proton's in the same field at the same speed, and why?",
    ],
  },
  induction_maxwell: {
    explanation: [
      "Faraday's law is the bridge between electricity and magnetism: a changing magnetic flux through a circuit induces an emf equal to the rate of change of that flux, emf = −N dΦ/dt for an N-turn coil. Flux Φ = BA cosθ can change because the field strengthens, the area changes, or the orientation rotates — generators exploit the last. Lenz's law fixes the sign: the induced current flows so as to oppose the change creating it, which is energy conservation enforcing itself; an aiding current would be a free-energy machine.",
      "Maxwell completed the picture by adding the symmetric partner — a changing electric field creates a magnetic field — and the resulting four equations (Gauss's laws for E and for B, Faraday's law, and the Ampere-Maxwell law) form a closed system. Their crowning prediction: self-sustaining electromagnetic waves traveling at 1/√(μ₀ε₀), which evaluates to the measured speed of light. Light is an electromagnetic wave; optics is a chapter of electromagnetism.",
      "Note carefully that flux alone induces nothing — only its rate of change does. A coil sitting in an enormous steady field has zero induced emf, while a tiny but rapidly changing field can drive large currents. When the flux varies nonlinearly in time, you must differentiate, not divide by elapsed time.",
    ],
    example: {
      problem: "A flat coil of 150 turns and area 4.0 × 10⁻³ m² lies with its plane perpendicular to a magnetic field that grows as B(t) = 0.20 t² (tesla, t in seconds). The coil's total resistance is 2.0 Ω. Find the induced emf and current at t = 3.0 s.",
      steps: [
        "Write the flux through one turn: with the field perpendicular to the coil plane, Φ(t) = B(t)A = 0.20 t² × 4.0 × 10⁻³ = 8.0 × 10⁻⁴ t² webers.",
        "Differentiate — the field grows nonlinearly, so dividing by time would be wrong: dΦ/dt = 1.6 × 10⁻³ t volts per turn.",
        "Multiply by the turn count for the total emf magnitude: emf = N dΦ/dt = 150 × 1.6 × 10⁻³ t = 0.24 t, so at t = 3.0 s the emf is 0.24 × 3.0 = 0.72 V.",
        "Apply Ohm's law to the coil circuit: I = emf/R = 0.72/2.0 = 0.36 A.",
        "Fix the direction with Lenz's law: the outward flux is increasing, so the induced current circulates to make its own magnetic field oppose the growth — viewed from the side the field points toward, the current runs clockwise. Note also that this emf grows linearly in time, so at t = 6.0 s it would be twice as large.",
      ],
      answer: "At t = 3.0 s the induced emf is 0.72 V, driving a 0.36 A current that opposes the growing flux.",
    },
    selfQuestions: [
      "Why does Lenz's law have to hold — what would a flux-aiding induced current allow you to build?",
      "What are the three independent ways to change magnetic flux through a loop, and which one do power-station generators use?",
      "How did adding the changing-electric-field term to Ampere's law lead to the prediction that light is an electromagnetic wave?",
      "Why does a constant 10 T field through a coil induce nothing while a millitesla field oscillating at high frequency can induce a large emf?",
    ],
  },
  ac_circuits: {
    explanation: [
      "When the driving voltage oscillates sinusoidally, resistors, inductors, and capacitors each respond differently. A resistor's voltage tracks the current exactly; an inductor opposes changes in current, so its voltage leads the current by 90°; a capacitor must accumulate charge before its voltage builds, so its voltage lags by 90°. Each reactive element gets a frequency-dependent effective resistance called reactance: X_L = ωL grows with frequency, X_C = 1/(ωC) shrinks with it.",
      "For a series RLC circuit, the opposing 90° phase shifts mean reactances partially cancel: the impedance is Z = √(R² + (X_L − X_C)²), and the rms current is V_rms/Z. At the resonant frequency ω₀ = 1/√(LC) the cancellation is exact, Z drops to R alone, and the current peaks — the principle behind radio tuning. The phase angle, tanφ = (X_L − X_C)/R, tells you whether the circuit behaves inductively (current lags) or capacitively (current leads).",
      "The misconception to retire: reactances and resistances do not simply add. A 75 Ω inductive reactance in series with a 265 Ω capacitive reactance contributes only |75 − 265| = 190 Ω to the impedance, because their voltage phasors point in opposite directions. Also, only the resistor dissipates average power — ideal inductors and capacitors borrow energy each half-cycle and return it.",
    ],
    example: {
      problem: "A series circuit with R = 50 Ω, L = 0.20 H, and C = 10 μF is driven by a 120 V rms, 60 Hz source. Find the impedance, the rms current, the average power dissipated, and the resonant frequency.",
      steps: [
        "Convert to angular frequency and compute reactances: ω = 2π × 60 ≈ 377 rad/s, so X_L = ωL = 377 × 0.20 ≈ 75.4 Ω and X_C = 1/(ωC) = 1/(377 × 1.0 × 10⁻⁵) ≈ 265.3 Ω.",
        "Combine into impedance — reactances subtract before joining R at right angles: Z = √(50² + (75.4 − 265.3)²) = √(2500 + (−189.9)²) = √(2500 + 36060) ≈ 196 Ω.",
        "Apply the ac Ohm's law with rms values: I_rms = V_rms/Z = 120/196 ≈ 0.61 A.",
        "Only the resistor dissipates on average: P = I_rms² R = 0.61² × 50 ≈ 18.7 W — far below the naive V × I = 73 W because the current runs about 75° out of phase with the voltage.",
        "Find resonance: f₀ = 1/(2π√(LC)) = 1/(2π√(0.20 × 1.0 × 10⁻⁵)) ≈ 112 Hz. The source at 60 Hz sits below resonance, which is why X_C dominates and the circuit behaves capacitively, with the current leading the voltage.",
      ],
      answer: "Z ≈ 196 Ω, I_rms ≈ 0.61 A, average power ≈ 19 W, and the circuit would resonate near 112 Hz.",
    },
    selfQuestions: [
      "Why do inductive and capacitive reactances subtract rather than add when combining into impedance?",
      "What happens to the current and the power factor as the driving frequency sweeps through resonance?",
      "Why do ideal inductors and capacitors dissipate no average power even while carrying large currents?",
      "How does a radio receiver use an RLC circuit to select one station's frequency out of many arriving at once?",
    ],
  },
  physical_optics: {
    explanation: [
      "Geometric optics treats light as rays, but rays cannot explain why two beams can add to darkness. Physical optics restores the wave picture: when light from two coherent sources overlaps, the fields superpose, and the result depends on the path difference. Where the paths differ by a whole number of wavelengths the waves arrive in phase and reinforce (bright fringe); where they differ by a half-integer number they cancel (dark fringe). Young's double slit turns this into a measuring instrument for the wavelength of light itself.",
      "For slits separated by d and a screen far away, bright fringes appear where d sinθ = mλ for integer m, and for small angles the fringes are evenly spaced on the screen by Δy = λL/d. Diffraction is the same superposition story applied to the continuum of points across a single opening: a slit of width a throws minima at a sinθ = mλ, and narrower openings spread light more — the ultimate limit on how finely any optical instrument can resolve.",
      "The geometry inverts naive intuition: shrinking the slit spacing or the slit width makes the pattern wider, not narrower, because smaller d demands a larger angle to accumulate one wavelength of path difference. Interference effects hide in daily life only because visible wavelengths are sub-micrometer and ordinary sources lack coherence — not because the physics is exotic.",
    ],
    example: {
      problem: "Laser light of wavelength 633 nm passes through two slits separated by 0.25 mm, and the pattern falls on a screen 2.0 m away. Find the spacing between adjacent bright fringes and the distance from the central maximum to the third-order bright fringe.",
      steps: [
        "Check the small-angle regime: the first maximum sits at sinθ = λ/d = (633 × 10⁻⁹)/(2.5 × 10⁻⁴) ≈ 2.5 × 10⁻³, a fraction of a degree, so sinθ ≈ tanθ and the linear fringe formula applies.",
        "Compute the fringe spacing: Δy = λL/d = (633 × 10⁻⁹ × 2.0)/(2.5 × 10⁻⁴) = 5.1 × 10⁻³ m ≈ 5.1 mm.",
        "Locate the third bright fringe: maxima are equally spaced in this regime, so y₃ = 3Δy ≈ 15.2 mm from the central maximum.",
        "Interpret the mechanism: at y₃ the light from one slit travels exactly 3 wavelengths (about 1.9 μm) farther than from the other, so the crests still arrive together and reinforce.",
        "Sanity-check the leverage: a quarter-millimeter slit spacing converted a 633 nm wavelength into millimeter-scale fringes — magnification by roughly L/d ≈ 8000 — which is precisely how such experiments first measured the wavelength of light.",
      ],
      answer: "Adjacent bright fringes are about 5.1 mm apart, putting the third-order bright fringe about 15 mm from the center.",
    },
    selfQuestions: [
      "Why does decreasing the slit separation spread the fringes farther apart rather than closer together?",
      "What does the requirement of coherence mean physically, and why do two separate flashlights not produce visible fringes?",
      "How does single-slit diffraction modify the ideal double-slit pattern you would calculate from two point sources?",
      "Where does the energy go at the dark fringes if light plus light yields darkness there?",
    ],
  },
  special_relativity: {
    explanation: [
      "Two postulates rebuild mechanics: the laws of physics are identical in every inertial frame, and light moves at c in every inertial frame regardless of the source's motion. Forcing both to hold means space and time measurements must differ between observers. A moving clock ticks slow by the Lorentz factor γ = 1/√(1 − v²/c²) (time dilation), and a moving object is shortened along its motion by the same factor (length contraction). At everyday speeds γ is indistinguishable from 1, which is why Newton worked so well for so long.",
      "The productive habit is to identify whose clock and whose ruler each quantity belongs to. Proper time is the interval between two events measured by the clock present at both events; proper length is measured in the object's own rest frame. Different frames disagree about durations, lengths, and even simultaneity, yet every frame's account is internally consistent, and invariants — c, the spacetime interval, rest mass — anchor the bookkeeping.",
      "Time dilation is not a mechanical defect of clocks, and it is fully reciprocal: each of two inertial observers measures the other's clock running slow, with no contradiction because they disagree about which spatially separated events are simultaneous. The famous twin asymmetry arises only when one twin turns around — accelerating out of a single inertial frame.",
    ],
    example: {
      problem: "Muons created in the upper atmosphere have a proper mean lifetime of 2.2 μs and travel at 0.98c (take c = 3.0 × 10⁸ m/s). Find the mean lifetime measured from the ground, the mean distance traveled before decay, and compare with the non-relativistic prediction.",
      steps: [
        "Compute the Lorentz factor: γ = 1/√(1 − 0.98²) = 1/√(1 − 0.9604) = 1/√0.0396 ≈ 5.03.",
        "Dilate the lifetime: the 2.2 μs is proper time (the muon's own clock attends both its birth and decay), so the ground frame measures t = γτ = 5.03 × 2.2 μs ≈ 11.1 μs.",
        "Find the ground-frame travel distance: d = vt = 0.98 × 3.0 × 10⁸ × 11.1 × 10⁻⁶ ≈ 3.3 × 10³ m — about 3.3 km.",
        "Compare with the naive calculation: without dilation, d = 0.98 × 3.0 × 10⁸ × 2.2 × 10⁻⁶ ≈ 650 m, and almost no muons would survive the roughly 10 km trip to the ground; their detection at sea level is direct evidence for relativity.",
        "Cross-check from the muon's frame: the muon sees the atmosphere contracted by γ, so the 3.3 km becomes 3300/5.03 ≈ 650 m, which it covers in its ordinary 2.2 μs — both frames agree the muon reaches the detector, each with its own bookkeeping.",
      ],
      answer: "Ground observers measure a lifetime of about 11.1 μs and a mean range of about 3.3 km — five times the 650 m a non-relativistic calculation predicts.",
    },
    selfQuestions: [
      "How do you decide which observer's measurement is the proper time in a given problem?",
      "Why is there no contradiction in two inertial observers each measuring the other's clock as slow?",
      "How do time dilation in one frame and length contraction in the other tell the same physical story for the muon?",
      "What everyday technology would fail within minutes if relativistic clock corrections were ignored, and why?",
    ],
  },
  quantum_mechanics_intro: {
    explanation: [
      "Quantum mechanics begins where classical waves and particles trade places. Light, the textbook wave, deposits energy in discrete packets E = hf (the photoelectric effect); electrons, the textbook particles, diffract like waves with de Broglie wavelength λ = h/p. The reconciliation is the wavefunction ψ: its squared magnitude gives the probability density of finding the particle, and confining the wave is what quantizes energy — only certain standing-wave patterns fit, so only certain energies exist.",
      "The particle in a one-dimensional box is the cleanest showcase. The wavefunction must vanish at the walls, so exactly n half-wavelengths fit in the width L, forcing E_n = n²h²/(8mL²). Three signatures follow: energies scale as n², shrinking the box raises every level as 1/L², and the ground state energy is not zero — a confined particle can never be at rest, a direct cousin of the uncertainty principle since pinning down position to within L demands momentum spread.",
      "Resist picturing quantization as a property of matter alone; it is a property of confinement. A free electron can take any energy — it is binding into atoms, boxes, or crystals that creates discrete levels. And ψ itself is not a smeared-out electron: detections always find a whole electron somewhere, with ψ² setting the odds of where.",
    ],
    example: {
      problem: "An electron (mass 9.11 × 10⁻³¹ kg) is confined to a one-dimensional box of width 0.50 nm, roughly an atomic diameter. Using h = 6.626 × 10⁻³⁴ J·s, find the ground-state energy in eV and the photon wavelength for the n = 2 to n = 1 transition.",
      steps: [
        "Apply the box formula for the ground state: E₁ = h²/(8mL²) with L = 5.0 × 10⁻¹⁰ m, so the numerator is (6.626 × 10⁻³⁴)² = 4.39 × 10⁻⁶⁷ and the denominator is 8 × 9.11 × 10⁻³¹ × (5.0 × 10⁻¹⁰)² = 1.82 × 10⁻⁴⁸.",
        "Divide and convert: E₁ = 4.39 × 10⁻⁶⁷/1.82 × 10⁻⁴⁸ ≈ 2.41 × 10⁻¹⁹ J, and dividing by 1.602 × 10⁻¹⁹ J/eV gives E₁ ≈ 1.5 eV — atomic confinement naturally produces electron-volt energies.",
        "Use the n² scaling for the second level: E₂ = 4E₁ ≈ 6.0 eV, so the transition releases ΔE = E₂ − E₁ = 3E₁ ≈ 4.5 eV.",
        "Convert the photon energy to wavelength with the shortcut hc ≈ 1240 eV·nm: λ = 1240/4.5 ≈ 275 nm, in the ultraviolet.",
        "Sanity-check the physics: visible photons run from about 1.8 to 3.1 eV, and real atomic transitions span the infrared to ultraviolet, so a crude box model landing at 4.5 eV is exactly the right order of magnitude — confinement at the angstrom scale sets the energy scale of chemistry.",
      ],
      answer: "The ground state lies at about 1.5 eV, and the n = 2 to n = 1 transition emits an ultraviolet photon of roughly 275 nm.",
    },
    selfQuestions: [
      "Why does confining a particle to a smaller box raise its ground-state energy, and how does this connect to the uncertainty principle?",
      "What boundary condition produces the quantization in the box model, and what plays the analogous role in a real atom?",
      "How would the energy levels change if the confined particle were a proton instead of an electron?",
      "Why can a confined quantum particle never have exactly zero kinetic energy, while a classical ball at rest in a box can?",
    ],
  },
  atomic_nuclear_physics: {
    explanation: [
      "The nucleus packs protons and neutrons into a few femtometers, where the strong force outmuscles the enormous Coulomb repulsion between protons. Its energy ledger is the binding energy: a bound nucleus weighs measurably less than its free constituents, and that mass defect, through E = mc², is the energy that would be released in forming it. The curve of binding energy per nucleon peaks near iron, which is why fusing light nuclei and splitting heavy ones both release energy.",
      "Unstable nuclei decay by alpha, beta, or gamma emission, and the process is genuinely random per nucleus yet exquisitely predictable in aggregate. Each nucleus has a fixed decay probability per unit time λ, giving dN/dt = −λN and the exponential law N(t) = N₀e^(−λt); the half-life t½ = ln2/λ is the time for any starting amount to halve. Activity (decays per second) inherits the same exponential, which underlies radiometric dating and dosage planning alike.",
      "Half-life is statistics, not scheduling: after one half-life each surviving nucleus is not 'half dead' — it is unchanged, with exactly the same chances going forward. Nuclei have no memory, which is precisely why the exponential never quite reaches zero and why two half-lives leave a quarter, not nothing.",
    ],
    example: {
      problem: "Cobalt-60, used in radiotherapy, has a half-life of 5.27 years. A hospital source must be replaced when its activity falls to 10% of the initial value. How long after installation is replacement due?",
      steps: [
        "Convert the half-life to a decay constant: λ = ln2/t½ = 0.693/5.27 ≈ 0.132 per year — a decay rate that gives each nucleus roughly a one-in-eight chance of decaying in any given year.",
        "Set up the exponential decay condition for activity: A(t) = A₀e^(−λt), and replacement occurs when A/A₀ = 0.10.",
        "Solve by taking the natural log: e^(−λt) = 0.10 gives λt = ln10 ≈ 2.303, so t = 2.303/0.132 ≈ 17.5 years.",
        "Cross-check by counting half-lives: 10% lies between 1/8 (three half-lives, 15.8 yr) and 1/16 (four half-lives, 21.1 yr), and indeed log₂(10) ≈ 3.32 half-lives × 5.27 yr ≈ 17.5 yr — consistent.",
        "Interpret: the answer is independent of the source's initial size; a source twice as strong reaches 10% of its own initial activity at exactly the same time, because exponential decay scales every starting amount identically.",
      ],
      answer: "The source reaches 10% of its initial activity after about 17.5 years.",
    },
    selfQuestions: [
      "Why does exponential decay follow from each nucleus having a constant decay probability per unit time?",
      "How would you explain to a friend that a nucleus surviving three half-lives is no closer to decaying than a fresh one?",
      "Why does the binding-energy curve peaking at iron make both fusion of light elements and fission of heavy ones exothermic?",
      "Where does the released energy in a decay physically come from, given that total mass-energy is conserved?",
    ],
  },
  particle_physics_intro: {
    explanation: [
      "Zoom in past nuclei and a compact inventory emerges: matter is built from quarks (which bind in threes into baryons like the proton, or quark-antiquark pairs called mesons) and leptons (the electron, muon, tau, and their neutrinos). Forces are carried by exchange bosons — photons for electromagnetism, gluons for the strong force, W and Z for the weak force — and the Higgs boson reflects the field that gives fundamental particles mass. Every particle has an antiparticle with identical mass and opposite charge.",
      "What makes the subject tractable is that reactions are governed by conservation laws. Energy, momentum, and charge are always conserved, and so are quantum numbers like baryon number and lepton number; a proposed reaction that violates any of them simply does not occur. Because E = mc² lets energy become mass and back, collisions can create particles that were not present before — provided every conservation law is honored, which is why high energies are needed to make heavy particles.",
      "Annihilation does not mean the disappearance of stuff: when an electron meets a positron, their entire rest energy is converted to photons, with nothing lost from the total energy-momentum ledger. And a single photon can never carry off an annihilation at rest — momentum conservation demands at least two photons flying apart back to back.",
    ],
    example: {
      problem: "An electron and a positron, each with rest energy 0.511 MeV, annihilate essentially at rest into two photons. Verify which conservation laws permit this, and find each photon's energy and wavelength (use hc ≈ 1240 eV·nm).",
      steps: [
        "Audit the conservation laws: charge goes from (−1) + (+1) = 0 to 0 — fine; lepton number goes from (+1) + (−1) = 0 to 0 — fine; photons carry no baryon or lepton number, so the reaction is allowed.",
        "Apply momentum conservation: the initial momentum is essentially zero, so a single photon (which always carries momentum E/c) is forbidden — there must be at least two photons, emitted in opposite directions with equal momenta.",
        "Apply energy conservation: the available energy is the total rest energy, 2 × 0.511 = 1.022 MeV, shared equally by symmetry, so each photon carries 0.511 MeV.",
        "Convert to wavelength: λ = hc/E = 1240 eV·nm/511000 eV ≈ 2.4 × 10⁻³ nm, about 2.4 picometers — gamma rays, far more energetic than visible light's hundreds of nanometers.",
        "Interpret: this back-to-back pair of 511 keV photons is so characteristic that PET scanners detect exactly these pairs to pinpoint where positrons annihilate inside the body — conservation laws turned into medical imaging.",
      ],
      answer: "The annihilation is allowed and must produce at least two photons; each carries 0.511 MeV with wavelength about 2.4 pm, emitted back to back.",
    },
    selfQuestions: [
      "Why does momentum conservation forbid one-photon annihilation of a pair at rest, but allow it near a heavy nucleus?",
      "How do conservation laws let physicists rule out reactions without calculating any dynamics?",
      "Why are higher and higher collision energies needed to discover heavier particles?",
      "What would running the annihilation backwards (pair production) require, and where does the threshold energy come from?",
    ],
  },
};
