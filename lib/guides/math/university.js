// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — MATH · UNIVERSITY.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  limits_continuity: {
    explanation: [
      "A limit records the value a function approaches, not the value it lands on. You already met the idea informally in precalculus; at university the limit becomes the load-bearing definition under everything else — derivatives, integrals, and series are all limits in disguise. Writing 'the limit as x → a of f(x) = L' claims that f(x) can be forced as close to L as you like by taking x close enough to a, with x = a itself deliberately ignored.",
      "Continuity is the special case where the approach and the landing agree: f is continuous at a when f(a) exists, the limit exists, and the two are equal. The productive mental model is a checklist of three separate failures — hole, jump, or blow-up — each breaking a different clause. The classic misconception is that a 0/0 form means the limit does not exist. It means the opposite: the form is indeterminate, so you must do algebra (factor, rationalize, or use a known limit) before you can conclude anything.",
      "A reliable workflow: substitute first, and if you get a number, you are done by continuity. If you get 0/0, manipulate the expression into an equivalent form where substitution works. If you get a nonzero number over zero, examine one-sided behavior, because the function is heading to plus or minus infinity.",
    ],
    example: {
      problem: "Let f(x) = (√(x + 4) − 2)/x for x ≠ 0. Find the limit of f(x) as x → 0, and state the value c you should assign to f(0) to make f continuous at 0.",
      steps: [
        "Substitute x = 0 first: the numerator is √4 − 2 = 0 and the denominator is 0, so the form is 0/0 — indeterminate, which licenses algebra rather than a conclusion.",
        "Rationalize by multiplying numerator and denominator by the conjugate √(x + 4) + 2. The numerator becomes (x + 4) − 4 = x, so f(x) = x divided by x(√(x + 4) + 2).",
        "Cancel the common factor x, valid because the limit process only cares about x near 0, never x = 0 itself. This leaves f(x) = 1/(√(x + 4) + 2) for all x ≠ 0.",
        "Now substitution is safe: as x → 0 the expression tends to 1/(√4 + 2) = 1/4.",
        "Sanity-check numerically: at x = 0.01, (√4.01 − 2)/0.01 ≈ 0.2498, which is hugging 0.25 as expected. Defining f(0) = 1/4 makes the function value equal the limit, which is exactly the definition of continuity at 0.",
      ],
      answer: "The limit is 1/4, so setting c = f(0) = 1/4 makes f continuous at 0.",
    },
    selfQuestions: [
      "Why does cancelling the factor x in a limit computation not contradict the rule against dividing by zero?",
      "What are the three distinct ways continuity can fail at a point, and what does each look like on a graph?",
      "How would you explain to a classmate why a 0/0 form is called indeterminate rather than undefined?",
      "Where in the definitions of the derivative and the definite integral is a limit secretly doing the work?",
    ],
  },
  derivatives: {
    explanation: [
      "The derivative f'(x) is the limit of the difference quotient (f(x + h) − f(x))/h as h → 0: the exact rate of change of f at a single point, and the slope of the tangent line there. You already understand slope as rise over run for lines; differentiation extends that idea to curves by zooming in until the curve is indistinguishable from a line. At university this is the workhorse concept — every model with a changing quantity speaks in derivatives.",
      "Computing from the limit definition every time would be painful, so you build a toolkit: the power rule (d/dx of x^n is n x^(n−1)), linearity, the product rule (uv)' = u'v + uv', the quotient rule, and above all the chain rule, which says the derivative of f(g(x)) is f'(g(x)) × g'(x) — multiply the outer rate by the inner rate. The right mental model is decomposition: read an expression as a recipe of nested operations, then differentiate layer by layer from the outside in.",
      "A persistent misconception is that the product rule should be (uv)' = u'v', differentiating each factor. A quick counterexample kills it: with u = v = x, that would give (x²)' = 1, but the power rule says 2x. Rates of products mix the pieces — each factor takes a turn changing while the other holds still.",
    ],
    example: {
      problem: "Let f(x) = x² e^(3x). Find f'(x), then compute the slope of the tangent line at x = 1.",
      steps: [
        "Recognize the structure: f is a product of u(x) = x² and v(x) = e^(3x), so the product rule applies, and v itself is a composition needing the chain rule.",
        "Differentiate each factor: u'(x) = 2x by the power rule, and v'(x) = 3 e^(3x) because the chain rule multiplies e^(3x) by the derivative of the inner function 3x.",
        "Assemble with the product rule: f'(x) = u'v + uv' = 2x e^(3x) + x² × 3 e^(3x) = e^(3x)(2x + 3x²).",
        "Evaluate at x = 1: f'(1) = e³(2 + 3) = 5e³ ≈ 5 × 20.086 ≈ 100.4, so the tangent there is very steep.",
        "Sanity-check the form: both terms of f'(x) keep the factor e^(3x), which never vanishes, so f'(x) = 0 only where 2x + 3x² = x(2 + 3x) = 0, at x = 0 and x = −2/3 — sensible critical points for this shape.",
      ],
      answer: "f'(x) = e^(3x)(2x + 3x²), and the tangent slope at x = 1 is 5e³ ≈ 100.4.",
    },
    selfQuestions: [
      "Why does the chain rule multiply two rates together — what is each rate measuring in the composition?",
      "How would you convince someone the product rule cannot simply be the product of the derivatives?",
      "What does the difference quotient (f(x + h) − f(x))/h represent geometrically before the limit is taken?",
      "Which differentiation rule would you reach for first on x² sin(x⁵), and how do you see that structure quickly?",
    ],
  },
  applications_derivatives: {
    explanation: [
      "Once you can differentiate, the derivative becomes an instrument: it locates maxima and minima, classifies the shape of graphs, drives related-rates problems, and powers approximations like linearization and Newton's method. The optimization workflow matters far beyond mathematics — minimize cost, maximize yield, find the most efficient design — and it all rests on one fact you can now prove: at an interior extreme point of a differentiable function, f'(x) = 0.",
      "The mental model for optimization is a pipeline: model the quantity to optimize as a function of one variable (using the constraint to eliminate others), differentiate, solve f'(x) = 0 for critical points, then certify each candidate with the second-derivative test or a sign chart, and finally answer the actual question asked, with units. The most common error is stopping at f'(x) = 0. A vanishing derivative only flags a candidate — it might be a maximum, a minimum, or neither, and on a closed interval the endpoints compete too.",
    ],
    example: {
      problem: "A closed cylindrical can must hold 500 cm³. Find the radius r and height h that minimize the total surface area (top, bottom, and side).",
      steps: [
        "Write down the two ingredients: the constraint πr²h = 500 and the objective A = 2πr² + 2πrh (two disks plus the unrolled side).",
        "Use the constraint to eliminate h: h = 500/(πr²), so A(r) = 2πr² + 2πr × 500/(πr²) = 2πr² + 1000/r, a function of r alone on r > 0.",
        "Differentiate and set to zero: A'(r) = 4πr − 1000/r² = 0 gives r³ = 1000/(4π) = 250/π ≈ 79.58, so r ≈ 4.30 cm.",
        "Certify it is a minimum: A''(r) = 4π + 2000/r³ is positive for every r > 0, so the critical point is a genuine minimum — and the only one, since A blows up as r → 0 and as r → ∞.",
        "Recover the height: h = 500/(πr²) ≈ 500/(π × 18.50) ≈ 8.60 cm. Notice h ≈ 2r — the optimal can is exactly as tall as it is wide, a tidy structural check on the algebra.",
      ],
      answer: "The minimal-area can has r ≈ 4.30 cm and h ≈ 8.60 cm (height equal to the diameter), using about 349 cm² of material.",
    },
    selfQuestions: [
      "Why does f'(x) = 0 identify only candidates for extremes rather than guaranteeing one?",
      "How does the constraint equation earn its keep in an optimization problem with two natural variables?",
      "What changes in the workflow when the domain is a closed interval like 1 ≤ r ≤ 3 instead of r > 0?",
      "Where else have you seen the optimal shape of a design emerge from setting a derivative to zero, and why is that pattern so common?",
    ],
  },
  integrals_ftc: {
    explanation: [
      "A definite integral is the limit of Riemann sums: chop an interval into slivers, multiply each sliver's width by a function value, add, and refine. It computes accumulated change — area under a curve, distance from velocity, total charge from current. You already know area formulas for rectangles and triangles; integration is the upgrade that handles curved boundaries by treating area as a sum of infinitely many infinitely thin rectangles.",
      "The fundamental theorem of calculus is the reason this is computable: if F is any antiderivative of f (meaning F'(x) = f(x)), then the integral of f from a to b equals F(b) − F(a). Differentiation and integration are inverse processes, so accumulating a rate recovers total change. The model to internalize: integrand = rate, integral = net amount.",
      "Two misconceptions to retire. First, the definite integral is signed — regions below the x-axis count negatively, so an integral of zero can hide large areas that cancel. Second, the '+ C' belongs to indefinite integrals only; in a definite integral the constant subtracts away in F(b) − F(a), which is why no one writes it there.",
    ],
    example: {
      problem: "Evaluate the integral of f(x) = 6x² − 4x + 3 from x = 1 to x = 3 using the fundamental theorem of calculus.",
      steps: [
        "Find an antiderivative term by term with the reversed power rule: F(x) = 2x³ − 2x² + 3x, since 6x² antidifferentiates to 2x³, −4x to −2x², and 3 to 3x.",
        "Verify by differentiating back: F'(x) = 6x² − 4x + 3, which matches the integrand exactly — always worth the five seconds.",
        "Apply the fundamental theorem: the integral equals F(3) − F(1).",
        "Compute each piece: F(3) = 2(27) − 2(9) + 9 = 54 − 18 + 9 = 45, and F(1) = 2 − 2 + 3 = 3.",
        "Subtract: 45 − 3 = 42. As a plausibility check, the integrand runs from 5 at x = 1 up to 45 at x = 3, so an average height around 21 over a width of 2 is entirely consistent with 42.",
      ],
      answer: "The integral of 6x² − 4x + 3 from 1 to 3 equals 42 square units of accumulated area.",
    },
    selfQuestions: [
      "Why does any antiderivative work in F(b) − F(a), when antiderivatives differ by a constant?",
      "How does the Riemann-sum picture explain why regions below the x-axis contribute negatively?",
      "What real quantity does the integral compute when the integrand is a velocity, and how does that differ from total distance traveled?",
      "How would you explain to a friend why accumulating a rate of change recovers the total change?",
    ],
  },
  integration_techniques: {
    explanation: [
      "Differentiation is mechanical, but integration is pattern recognition: most integrands must be transformed before any basic antiderivative applies. The core toolkit is substitution (the chain rule run backwards), integration by parts (the product rule run backwards), partial fractions for rational functions, and trigonometric substitution for roots of quadratics. Fluency here is what makes later courses — differential equations, probability, physics — feel routine instead of impossible.",
      "Integration by parts comes from rearranging (uv)' = u'v + uv': the integral of u dv equals uv minus the integral of v du. The strategy is to trade a hard integral for an easier one, so choose u as the factor that simplifies when differentiated (polynomials, logarithms) and dv as the factor you can integrate cleanly (exponentials, sines, cosines). A common misconception is that any split works; choose badly and the new integral is worse than the old one — picking u = e^(2x) in the example below would do exactly that.",
      "Build the habit of pattern-scanning before computing: a function next to its own derivative suggests substitution, a product of unrelated types suggests parts, a ratio of polynomials suggests partial fractions. The first thirty seconds of looking usually saves ten minutes of algebra.",
    ],
    example: {
      problem: "Evaluate the integral of x e^(2x) from x = 0 to x = 1.",
      steps: [
        "Scan the structure: x and e^(2x) are unrelated types and substitution finds no inner-derivative pair, so integration by parts is the tool.",
        "Choose u = x because differentiating it simplifies to du = dx, and dv = e^(2x) dx because it integrates cleanly to v = e^(2x)/2.",
        "Apply the parts formula: the integral becomes x e^(2x)/2 minus the integral of e^(2x)/2 dx — note the new integral has no polynomial factor, confirming the trade was a good one.",
        "Finish the remaining integral: e^(2x)/2 antidifferentiates to e^(2x)/4, so an antiderivative is F(x) = x e^(2x)/2 − e^(2x)/4.",
        "Evaluate from 0 to 1: F(1) = e²/2 − e²/4 = e²/4, and F(0) = 0 − 1/4 = −1/4, so the integral is e²/4 + 1/4 = (e² + 1)/4 ≈ 2.097.",
        "Sanity-check: the integrand rises from 0 to e² ≈ 7.39 over a unit interval and is convex, so an answer around 2.1 — well below the midpoint estimate of 3.7 — is reasonable.",
      ],
      answer: "The integral of x e^(2x) from 0 to 1 is (e² + 1)/4 ≈ 2.097.",
    },
    selfQuestions: [
      "Why is integration by parts described as the product rule run in reverse, and where does the minus sign come from?",
      "What goes wrong, concretely, when you pick u = e^(2x) and dv = x dx in this example?",
      "How do you recognize within seconds that an integrand calls for substitution rather than parts?",
      "What features of an integrand would push you toward partial fractions, and what must you check about the degrees first?",
    ],
  },
  applications_integration: {
    explanation: [
      "Integration turns slicing into computation. Any quantity you can approximate by cutting a region or object into thin pieces — area between curves, volume of a solid, arc length, work done by a varying force, mass from a density — becomes a definite integral when the slices shrink. You already trust the area interpretation; applications generalize the same Riemann-sum logic to one new geometry at a time.",
      "For solids of revolution, the disk method is the flagship: rotate the region under y = f(x) about the x-axis, and each vertical slice of thickness dx sweeps out a thin disk of radius f(x), hence volume π f(x)² dx. Summing slices gives V as the integral of π f(x)² from a to b. The reliable discipline is to draw one generic slice, write its tiny contribution, and only then integrate — the formula should be rebuilt, not recalled.",
      "The standard trap is squaring carelessly: the disk integrand is π times the radius squared, and when there is a hole you need π(outer radius)² − π(inner radius)², which is not the same as π(outer − inner)². Squaring and subtracting do not commute, and the difference is exactly the cross term that the washer shape physically contains.",
    ],
    example: {
      problem: "The region under y = √x from x = 0 to x = 4 is rotated about the x-axis. Find the volume of the resulting solid.",
      steps: [
        "Picture one slice: at position x, a vertical strip of thickness dx sweeps out a disk of radius y = √x when rotated about the x-axis.",
        "Write the slice's volume: dV = π(radius)² dx = π(√x)² dx = πx dx — the square conveniently removes the root.",
        "Sum the slices as an integral: V equals the integral of πx from x = 0 to x = 4.",
        "Compute with the fundamental theorem: π × (x²/2 evaluated from 0 to 4) = π × (16/2 − 0) = 8π.",
        "Check against a bounding cylinder: the solid fits inside a cylinder of radius 2 and length 4 with volume 16π, and our 8π is exactly half of that — plausible for a shape that flares out like a horn from a point.",
      ],
      answer: "The solid of revolution has volume 8π ≈ 25.13 cubic units.",
    },
    selfQuestions: [
      "Why does the disk method square the function, and what geometric object does each slice represent?",
      "How would the setup change if the same region were rotated about the y-axis instead?",
      "Why is π(R² − r²) the right washer integrand rather than π(R − r)², and what does the difference represent?",
      "What other quantities besides volume can you compute by the slice-and-sum strategy, and what does a single slice contribute in each?",
    ],
  },
  sequences_series: {
    explanation: [
      "An infinite series asks whether adding infinitely many numbers can settle on a finite total. The answer lives in partial sums: the series converges exactly when the sequence of partial sums has a limit. You have summed finite geometric and arithmetic progressions before; the university-level question is qualitative first — converge or diverge? — because most convergent series have no closed-form sum, and the convergence verdict alone is what later work (power series, Fourier series, probability) depends on.",
      "Think of the convergence tests as a triage protocol. First, the nth-term test: if the terms do not tend to 0, the series diverges immediately. Then match the series to a template: geometric (converges when the common ratio satisfies |r| < 1), p-series (converges when p > 1), comparison against a known series, the ratio test for factorials and exponentials, and the alternating series test for sign-flipping terms.",
      "The single most damaging misconception: terms shrinking to zero is necessary but nowhere near sufficient. The harmonic series 1 + 1/2 + 1/3 + … has terms tending to 0 yet diverges — its partial sums creep past every bound. Shrinking terms make convergence possible; only shrinking fast enough makes it actual.",
    ],
    example: {
      problem: "Determine whether the series with terms a_n = n²/3^n (summed from n = 1 to infinity) converges or diverges.",
      steps: [
        "Triage: the terms mix a polynomial n² against an exponential 3^n, and exponential-versus-polynomial contests are the ratio test's specialty.",
        "Form the ratio of consecutive terms: a_(n+1)/a_n = ((n + 1)²/3^(n+1)) × (3^n/n²) = (1/3) × ((n + 1)/n)².",
        "Take the limit as n → ∞: ((n + 1)/n)² → 1, so the ratio tends to L = 1/3.",
        "Apply the ratio test verdict: L = 1/3 < 1, so the series converges absolutely — the exponential denominator eventually crushes the polynomial growth in the numerator.",
        "Sanity-check with early terms: 1/3, 4/9, 9/27 = 1/3, 16/81 ≈ 0.198, 25/243 ≈ 0.103 — after a brief rise the terms decay roughly geometrically, consistent with the test.",
      ],
      answer: "The series of n²/3^n converges absolutely by the ratio test, since the limiting ratio 1/3 is less than 1.",
    },
    selfQuestions: [
      "Why does the harmonic series diverge even though its terms tend to zero?",
      "How do you decide which convergence test to try first when handed an unfamiliar series?",
      "What does the ratio test's limit L actually measure about the long-run behavior of the terms?",
      "Why does the ratio test return no verdict when L = 1, and what kind of series typically lands there?",
    ],
  },
  power_taylor_series: {
    explanation: [
      "A power series is a polynomial that never ends: a sum of coefficients times powers of (x − a), convergent on an interval around the center a. Taylor series are the bridge from functions to power series — they rebuild e^x, sin x, cos x, ln(1 + x) out of their derivatives at a single point, with the coefficient of (x − a)^n equal to the nth derivative at a divided by n factorial. This is how calculators evaluate transcendental functions and how physicists replace hard models with manageable polynomial ones.",
      "The working mental model: a degree-n Taylor polynomial is the polynomial that agrees with f at the center to the nth derivative — the best polynomial impersonation of f near a. Truncating leaves an error, and the error is controllable: for an alternating series whose terms shrink steadily to zero, the error is smaller than the first omitted term, and Taylor's remainder theorem bounds it in general. That control is the whole point — an approximation without an error bound is a guess.",
      "Watch the misconception that a Taylor series automatically equals its function everywhere. Convergence holds only on the interval of convergence, and accuracy degrades as you leave the center; the geometric series for 1/(1 − x) is perfect on |x| < 1 and meaningless at x = 2.",
    ],
    example: {
      problem: "Use the degree-4 Maclaurin polynomial of cos x to approximate cos(0.2), and bound the error of the approximation.",
      steps: [
        "Recall the Maclaurin expansion of cosine: cos x = 1 − x²/2 + x⁴/24 − x⁶/720 + …, an alternating series for x = 0.2 with steadily shrinking terms.",
        "Evaluate the kept terms at x = 0.2: the quadratic term is 0.04/2 = 0.02 and the quartic term is 0.0016/24 ≈ 0.0000667.",
        "Assemble the degree-4 approximation: cos(0.2) ≈ 1 − 0.02 + 0.0000667 = 0.9800667.",
        "Bound the error with the alternating series estimate: the error is at most the first omitted term, x⁶/720 = 0.000064/720 ≈ 8.9 × 10⁻⁸, so the approximation is trustworthy to six decimal places.",
        "Interpret the result: a true value near 0.98006658 confirms it — three polynomial terms reproduce cosine to within about 9 × 10⁻⁸, because powers of the small number 0.2 collapse extremely fast.",
      ],
      answer: "cos(0.2) ≈ 0.9800667, with error below 10⁻⁷ by the alternating series bound.",
    },
    selfQuestions: [
      "Why do higher powers of (x − a) contribute so little when x is close to the center a?",
      "How does matching derivatives at one point manage to control a polynomial's behavior on a whole interval?",
      "What happens to the accuracy of this cosine approximation at x = 2, and which fix would you try?",
      "How would you explain the alternating series error bound to someone using the picture of partial sums hopping back and forth past the limit?",
    ],
  },
  parametric_polar_calc: {
    explanation: [
      "Some curves refuse to be graphs of y = f(x) — orbits, spirals, loops that cross themselves. Parametric equations handle them by letting a parameter t drive both coordinates, x = x(t) and y = y(t), like a timestamped flight path; polar coordinates handle them by locating points with a radius r and angle θ. Calculus transfers to both settings: you can still ask for slopes, arc lengths, and areas, and you already own every tool needed — the chain rule and the definite integral.",
      "For parametric slope, the chain rule gives dy/dx = (dy/dt)/(dx/dt): the slope of the path is the vertical speed divided by the horizontal speed. For polar area, slices are thin pie wedges, giving area as the integral of r²/2 with respect to θ. The reliable misconception to disarm: dy/dx is not obtained by differentiating y(t) alone. Differentiating y(t) gives a rate per unit of t, not per unit of x; forgetting to divide by dx/dt is the most common parametric error.",
    ],
    example: {
      problem: "A curve is given by x = t², y = t³ − 3t. Find the slope dy/dx of the tangent line at t = 2, and the point where it touches the curve.",
      steps: [
        "Differentiate each coordinate with respect to the parameter: dx/dt = 2t and dy/dt = 3t² − 3.",
        "Form the slope as the ratio of rates: dy/dx = (3t² − 3)/(2t), valid wherever dx/dt ≠ 0.",
        "Evaluate at t = 2: dy/dx = (12 − 3)/4 = 9/4, so the curve climbs 9 vertical units for every 4 horizontal units there.",
        "Locate the point of tangency from the original equations: x = 2² = 4 and y = 8 − 6 = 2, so the tangent touches at (4, 2).",
        "Check the trouble spot the formula warns about: at t = 0, dx/dt = 0 while dy/dt = −3 ≠ 0, so the curve has a vertical tangent there — the slope formula failing is information, not breakdown.",
      ],
      answer: "At t = 2 the curve passes through (4, 2) with tangent slope dy/dx = 9/4.",
    },
    selfQuestions: [
      "Why does dividing dy/dt by dx/dt produce the slope of the path through the plane?",
      "What is the geometric meaning of points where dx/dt = 0 but dy/dt ≠ 0, and where both vanish at once?",
      "How does the wedge picture explain the r²/2 in the polar area formula, rather than just r?",
      "When a parametric curve crosses itself, what does that imply about tangent lines at the crossing point?",
    ],
  },
  partial_derivatives: {
    explanation: [
      "Real models rarely depend on one input: temperature varies with position and time, revenue with price and volume. A function f(x, y) defines a surface over the plane, and partial derivatives are the natural extension of f'(x): the partial ∂f/∂x differentiates with respect to x while y is held frozen, and ∂f/∂y does the reverse. Each one is an ordinary single-variable derivative along one axis direction, so every rule you know — product, chain, power — carries over unchanged.",
      "Picture standing on the surface at a point: ∂f/∂x is the slope you feel walking due east, ∂f/∂y the slope walking due north. The pair (f_x, f_y) summarizes the local terrain to first order. The misconception to avoid: treating the other variable as a constant is not an approximation or a simplification trick — it is the definition. Each partial deliberately measures sensitivity to one input alone, and combining sensitivities across directions is a separate job (the gradient and the total differential handle it).",
    ],
    example: {
      problem: "Let f(x, y) = x²y³ − 4xy. Compute both partial derivatives, then evaluate them at the point (2, 1) and interpret the results.",
      steps: [
        "For ∂f/∂x, freeze y and differentiate in x: the term x²y³ has constant coefficient y³, giving 2xy³, and −4xy gives −4y. So f_x = 2xy³ − 4y.",
        "For ∂f/∂y, freeze x: x²y³ differentiates to 3x²y², and −4xy to −4x. So f_y = 3x²y² − 4x.",
        "Evaluate at (2, 1): f_x(2, 1) = 2(2)(1) − 4(1) = 4 − 4 = 0, and f_y(2, 1) = 3(4)(1) − 4(2) = 12 − 8 = 4.",
        "Interpret: at (2, 1) the surface is momentarily flat in the x-direction — an east-west walk neither climbs nor falls to first order — while a step north raises f at 4 output units per unit of y.",
        "Cross-check f_x numerically: f(2.01, 1) = 4.0401 − 8.04 = −3.9999 versus f(2, 1) = −4, a change of 0.0001 over a step of 0.01 — a measured slope of 0.01, consistent with an exact first-order slope of 0.",
      ],
      answer: "f_x = 2xy³ − 4y and f_y = 3x²y² − 4x; at (2, 1) they equal 0 and 4 respectively.",
    },
    selfQuestions: [
      "Why is holding the other variable constant part of the definition of a partial derivative rather than an approximation?",
      "What does the pair of slopes (f_x, f_y) at a point let you predict about small moves in arbitrary directions?",
      "How would you check a computed partial derivative numerically, and which step-size pitfalls should you watch for?",
      "What does it mean about the surface when both partials vanish at a point, and why is that not enough to declare a local minimum?",
    ],
  },
  gradients: {
    explanation: [
      "Partial derivatives give slopes along the axes, but you can walk across a surface in any direction. The gradient ∇f = (f_x, f_y) packages the partials into a single vector that answers every directional question at once: the directional derivative of f in the direction of a unit vector u is the dot product ∇f · u. You already know dot products measure alignment, so the conclusion falls out — the rate of change is largest when you walk exactly along ∇f.",
      "Internalize three facts as one picture. The gradient points in the direction of steepest ascent; its length |∇f| is that steepest rate; and it is perpendicular to the level curve through the point, because walking along a contour changes nothing, forcing ∇f · u = 0 there. This is why streams cross elevation contours at right angles and why gradient descent in machine learning steps against ∇f.",
      "The recurring slip is using a direction vector without normalizing it. The directional derivative compares rates per unit of distance, so the formula demands a unit vector; feeding it a length-5 vector silently multiplies the answer by 5.",
    ],
    example: {
      problem: "Let f(x, y) = x²y + y³. At the point (1, 2), find the directional derivative of f in the direction of v = (3, 4), and the maximum possible rate of increase at that point.",
      steps: [
        "Compute the gradient: f_x = 2xy and f_y = x² + 3y², so ∇f = (2xy, x² + 3y²).",
        "Evaluate at (1, 2): ∇f(1, 2) = (2 × 1 × 2, 1 + 3 × 4) = (4, 13).",
        "Normalize the direction: |v| = √(9 + 16) = 5, so the unit vector is u = (3/5, 4/5) — skipping this step would inflate the answer fivefold.",
        "Take the dot product: D_u f = (4)(3/5) + (13)(4/5) = 12/5 + 52/5 = 64/5 = 12.8 output units per unit step.",
        "For the maximum rate, no direction beats the gradient itself: the top rate is |∇f| = √(4² + 13²) = √185 ≈ 13.6, achieved walking in the direction of (4, 13). Note 12.8 falls below 13.6, as it must — v points close to, but not exactly along, the gradient.",
      ],
      answer: "The directional derivative toward (3, 4) is 64/5 = 12.8, and the maximum rate of increase is √185 ≈ 13.6, in the direction of ∇f = (4, 13).",
    },
    selfQuestions: [
      "Why must the gradient be perpendicular to level curves — what would a nonzero rate along a contour contradict?",
      "How does the dot product formula encode the idea that walking partly along the gradient earns part of the maximum rate?",
      "What goes wrong numerically when you forget to normalize the direction vector, and how could you catch the mistake?",
      "How would you use the gradient to find the direction of fastest decrease, and what rate goes with it?",
    ],
  },
  multiple_integrals: {
    explanation: [
      "A double integral accumulates a quantity over a two-dimensional region: volume under a surface, total mass from an area density, average temperature over a plate. The Riemann logic is unchanged from one variable — tile the region with small rectangles of area dA, multiply each by a function value, sum, refine. Fubini's theorem makes it computable: integrate one variable at a time, as an iterated integral, holding the outer variable fixed during the inner pass.",
      "All the craft lives in setting limits. For a rectangle the bounds are constants, but for a general region the inner limits are functions of the outer variable: you sweep a line across the region and record where it enters and exits. Always draw the region first; the sketch dictates the limits, not the other way around.",
      "The classic misconception is that swapping the order of integration just swaps the limit labels. Inner limits must depend only on the outer variable, and reversing the order over a non-rectangular region means re-describing the region from scratch — sometimes that re-description is the only way to make an integral doable.",
    ],
    example: {
      problem: "Evaluate the double integral of f(x, y) = x + y over the triangular region bounded by y = 0, y = x, and x = 2.",
      steps: [
        "Sketch the region: a triangle with vertices (0, 0), (2, 0), and (2, 2). For each fixed x between 0 and 2, y runs from the floor y = 0 up to the slanted edge y = x.",
        "Set up the iterated integral with those limits: the outer integral takes x from 0 to 2, the inner takes y from 0 to x — inner limits depending on x, exactly as a non-rectangular region demands.",
        "Do the inner pass with x frozen: the integral of (x + y) dy from 0 to x is xy + y²/2 evaluated at y = x, giving x² + x²/2 = 3x²/2.",
        "Do the outer pass: the integral of 3x²/2 from 0 to 2 is x³/2 evaluated from 0 to 2, which is 8/2 = 4.",
        "Sanity-check the size: the triangle has area 2, and on it x + y ranges from 0 to 4 with the larger values near (2, 2), so an average height of 2 — total 4 — sits right in the believable band.",
      ],
      answer: "The double integral of x + y over the triangle equals 4.",
    },
    selfQuestions: [
      "Why must the inner limits of an iterated integral be free of the inner variable, and what would it even mean if they were not?",
      "How would you re-describe this triangle to integrate in the order dx dy instead, and what limits result?",
      "What does the double integral compute when f(x, y) = 1, and why is that a useful special case to remember?",
      "When would switching the order of integration turn an impossible inner antiderivative into an easy one?",
    ],
  },
  vector_calculus: {
    explanation: [
      "Vector calculus studies fields — a vector attached to every point, like wind velocity or an electric field — and the integrals that probe them: line integrals for work along a path, flux integrals for flow through a boundary. Its crown jewels are three bridge theorems. Green's theorem converts a line integral around a closed plane curve into a double integral of ∂Q/∂x − ∂P/∂y over the enclosed region; Stokes' theorem lifts this to surfaces with curl; the divergence theorem converts flux through a closed surface into a volume integral of divergence.",
      "Each theorem says the same thing: the total of a derivative inside a region equals the behavior on its boundary — the fundamental theorem of calculus promoted a dimension. Think of curl as local spin (what a tiny paddle wheel would do) and divergence as local sourcing (whether a tiny sphere gains or loses fluid); net circulation around a loop is then the sum of all the tiny spins inside it.",
      "The standard misconception is treating the theorems as unconditional shortcuts. Green's theorem needs a closed curve with counterclockwise orientation and a field whose components have continuous partials on the whole enclosed region; a singularity inside, as with the classic vortex field at the origin, voids the conversion entirely.",
    ],
    example: {
      problem: "Use Green's theorem to evaluate the line integral of F = (x² − y, x + y²) counterclockwise around the circle x² + y² = 9.",
      steps: [
        "Check the hypotheses: the circle is closed and counterclockwise, and both components P = x² − y and Q = x + y² are polynomials, smooth everywhere — Green's theorem applies with no caveats.",
        "Compute the integrand of the area integral: ∂Q/∂x = 1 and ∂P/∂y = −1, so ∂Q/∂x − ∂P/∂y = 1 − (−1) = 2.",
        "Convert via Green's theorem: the circulation equals the double integral of the constant 2 over the disk of radius 3, which is just 2 times the disk's area.",
        "Evaluate: the disk has area π × 3² = 9π, so the line integral equals 2 × 9π = 18π ≈ 56.5.",
        "Appreciate the shortcut: parametrizing the circle and integrating directly would grind through trigonometric terms, but the curl-like quantity is constant, so the whole circulation reduces to one area fact — every interior point contributes the same tiny spin of 2.",
      ],
      answer: "The counterclockwise circulation of F around the circle is 18π ≈ 56.5.",
    },
    selfQuestions: [
      "Why do the x² and y² parts of this field contribute nothing to the circulation, and what property of a field guarantees zero circulation altogether?",
      "How does Green's theorem echo the fundamental theorem of calculus, and what plays the role of the two endpoints?",
      "What breaks if the curve is traversed clockwise, or if the field has a singularity inside the region?",
      "How would you decide between computing a line integral directly versus converting it with Green's theorem?",
    ],
  },
  vector_spaces: {
    explanation: [
      "Linear algebra begins by abstracting what you already do with arrows in the plane: add them, scale them. A vector space is any collection closed under those two operations — column vectors in Rⁿ, but equally polynomials, matrices, or solutions of a linear differential equation. The central vocabulary is span (everything reachable by linear combinations), linear independence (no vector is redundant), basis (an independent spanning set), and dimension (the size of any basis).",
      "The productive mental model is reachability and redundancy. The span of a set is the territory its combinations cover; independence asks whether each vector adds new territory. Three vectors in R³ might span all of space, or only a plane, or a line — counting vectors tells you nothing until you test independence, usually by asking whether some combination equals the zero vector with not-all-zero coefficients.",
      "The misconception to flush out: independence is not pairwise. Three vectors can be pairwise non-parallel yet still dependent, because one may lie in the plane spanned by the other two. Dependence is a team property — it is about whether the whole set carries redundancy, not whether any two members look alike.",
    ],
    example: {
      problem: "Determine whether the vectors v₁ = (1, 2, 3), v₂ = (2, 1, 0), and v₃ = (4, 5, 6) are linearly independent in R³, and describe their span.",
      steps: [
        "Test whether v₃ is reachable from the first two: seek scalars a and b with a v₁ + b v₂ = v₃, which gives the system a + 2b = 4, 2a + b = 5, 3a = 6.",
        "The third equation involves only a (since v₂ has third coordinate 0): a = 2. Substitute into the first: 2 + 2b = 4, so b = 1.",
        "Verify against the unused second equation: 2(2) + 1 = 5, which matches — the system is consistent, so v₃ = 2v₁ + v₂ exactly.",
        "Conclude dependence: v₃ adds no new territory, so the set is linearly dependent. Note that no two of these vectors are parallel — pairwise checks would have missed this completely.",
        "Describe the span: v₁ and v₂ are independent (neither is a scalar multiple of the other), so the three vectors together span only the plane through the origin containing v₁ and v₂ — a 2-dimensional subspace of R³, with {v₁, v₂} as a basis.",
      ],
      answer: "The set is linearly dependent, since v₃ = 2v₁ + v₂; the span is the 2-dimensional plane spanned by v₁ and v₂.",
    },
    selfQuestions: [
      "Why can three pairwise non-parallel vectors in R³ still fail to be independent?",
      "How does the definition of independence via the zero vector connect to the idea of no vector being redundant?",
      "What does it tell you geometrically when n vectors in Rⁿ fail to span the whole space?",
      "Why do sets like polynomials of degree at most 3 deserve the name vector space, and what plays the role of the arrows?",
    ],
  },
  linear_transformations: {
    explanation: [
      "A linear transformation is a function between vector spaces that respects the structure: T(u + v) = T(u) + T(v) and T(cv) = c T(v). Rotations, reflections, scalings, projections, and shears all qualify; translations do not, because they move the origin. The decisive theorem of the subject: a linear map from Rⁿ to Rᵐ is completely determined by where it sends the standard basis vectors, and stacking those images as columns produces the standard matrix A, after which applying T is just matrix-vector multiplication.",
      "Think of a linear map as a controlled distortion of space: grid lines stay parallel and evenly spaced, and the origin stays put. Because every vector is a combination of basis vectors, linearity propagates the basis images to everything — two function values (in R²) pin down the entire map. The common misconception is that any formula with x and y is linear; T(x, y) = (x + 1, y) and T(x, y) = (x², y) both fail, the first because T(0, 0) ≠ (0, 0), the second because doubling the input does not double the output.",
    ],
    example: {
      problem: "Let T: R² → R² be the linear transformation T(x, y) = (2x + y, x − 3y). Find the standard matrix A of T, and use it to compute T(4, −1).",
      steps: [
        "Find the images of the standard basis: T(1, 0) = (2, 1) and T(0, 1) = (1, −3) — these two outputs encode the entire transformation.",
        "Assemble A by columns: the first column is T(1, 0) and the second is T(0, 1), so A has first row (2, 1) and second row (1, −3).",
        "Apply A to the vector (4, −1) by taking row-by-column dot products: first entry 2(4) + 1(−1) = 8 − 1 = 7, second entry 1(4) + (−3)(−1) = 4 + 3 = 7.",
        "So T(4, −1) = (7, 7). Cross-check straight from the formula: 2(4) + (−1) = 7 and 4 − 3(−1) = 7 — the matrix and the formula agree, as they must.",
        "Confirm linearity is doing the work: (4, −1) = 4e₁ − e₂, so T(4, −1) = 4T(e₁) − T(e₂) = 4(2, 1) − (1, −3) = (8 − 1, 4 + 3) = (7, 7), the same answer assembled from basis images alone.",
      ],
      answer: "The standard matrix has rows (2, 1) and (1, −3), and T(4, −1) = (7, 7).",
    },
    selfQuestions: [
      "Why does knowing T on the standard basis vectors determine T on every vector in the space?",
      "How can you tell quickly that a translation like T(x, y) = (x + 1, y) cannot be linear?",
      "What does the composition of two linear maps correspond to at the matrix level, and why does order matter?",
      "How would you read off from the columns of a matrix what the transformation does to the unit square?",
    ],
  },
  determinants: {
    explanation: [
      "The determinant compresses a square matrix into one number with a geometric meaning: the factor by which the matrix scales area (in 2 × 2) or volume (in 3 × 3), with a negative sign recording an orientation flip. That single number answers structural questions instantly — a matrix is invertible exactly when its determinant is nonzero, which is also exactly when the corresponding linear system has a unique solution and the columns are linearly independent.",
      "For computation, cofactor expansion works along any row or column: each entry multiplies the determinant of the smaller matrix left after deleting its row and column, with signs alternating in a checkerboard pattern. Strategy matters — expand along the row or column with the most zeros, since each zero kills a whole term. For larger matrices, row reduction is faster, tracking how each row operation affects the determinant.",
      "The misconception that costs the most points: the determinant is not linear over addition, so det(A + B) is generally not det(A) + det(B). The reliable rules are multiplicative ones — det(AB) = det(A)det(B), and scaling a single row scales the determinant by that factor, so scaling an entire n × n matrix by c scales the determinant by c to the power n.",
    ],
    example: {
      problem: "Compute the determinant of the 3 × 3 matrix A with rows (2, 1, 3), (0, 4, −1), and (5, 2, 1), and state whether A is invertible.",
      steps: [
        "Choose the expansion line strategically: column 1 contains a zero (the entry 0 in row 2), so expanding down column 1 leaves only two terms to compute.",
        "First term: entry 2 at position (1,1) carries sign +, times the minor from deleting row 1 and column 1, det of rows (4, −1) and (2, 1), which is 4(1) − (−1)(2) = 6. Contribution: 2 × 6 = 12.",
        "The entry 0 at position (2,1) contributes nothing — exactly why the column was chosen.",
        "Third term: entry 5 at position (3,1) carries sign + (checkerboard: row 3, column 1), times det of rows (1, 3) and (4, −1), which is 1(−1) − 3(4) = −13. Contribution: 5 × (−13) = −65.",
        "Total: det(A) = 12 + 0 − 65 = −53. Double-check by expanding along row 1: 2(4 + 2) − 1(0 + 5) + 3(0 − 20) = 12 − 5 − 60 = −53 — same value, as expansion along any line must give.",
        "Interpret: det(A) = −53 ≠ 0, so A is invertible, its columns are independent, and as a map it scales volume by 53 while reversing orientation.",
      ],
      answer: "det(A) = −53, so A is invertible and scales volumes by a factor of 53 with an orientation flip.",
    },
    selfQuestions: [
      "Why does a zero determinant mean the matrix squashes space into a lower dimension?",
      "How does the option to expand along any row or column help you pick the least painful computation?",
      "Why does det(AB) = det(A)det(B) make sense if you think of determinants as volume-scaling factors?",
      "What happens to a determinant under each of the three row operations, and how does that turn row reduction into a determinant algorithm?",
    ],
  },
  eigenvalues: {
    explanation: [
      "Most vectors get knocked off their line when a matrix acts on them — but a few special directions survive, merely stretched or compressed. An eigenvector v of A satisfies Av = λv for a scalar λ, the eigenvalue: the matrix acts on that direction like simple multiplication. These invariant directions are the skeleton of the transformation, and they power everything from stability analysis of differential equations to vibration modes to ranking algorithms.",
      "The computation runs in two acts. Eigenvalues first: Av = λv rearranges to (A − λI)v = 0, which has a nonzero solution exactly when det(A − λI) = 0 — the characteristic equation, a polynomial in λ. Then, for each root λ, solve (A − λI)v = 0 for the eigenvectors; the matrix A − λI is built to be singular, so the system is guaranteed to have a free variable.",
      "Two corrections worth making early. The zero vector is never an eigenvector — every λ would trivially work, carrying no information — but the number 0 can perfectly well be an eigenvalue, precisely when A is singular. And eigenvectors are only determined up to scale: any nonzero multiple of an eigenvector is an equally valid representative of the same invariant direction.",
    ],
    example: {
      problem: "Find the eigenvalues and corresponding eigenvectors of the 2 × 2 matrix A with rows (4, 1) and (2, 3).",
      steps: [
        "Set up the characteristic equation: det(A − λI) = (4 − λ)(3 − λ) − (1)(2) = λ² − 7λ + 12 − 2 = λ² − 7λ + 10 = 0.",
        "Factor: λ² − 7λ + 10 = (λ − 5)(λ − 2), so the eigenvalues are λ₁ = 5 and λ₂ = 2. Quick check: their sum 7 equals the trace 4 + 3 and their product 10 equals det(A) = 12 − 2 — both identities hold.",
        "Eigenvector for λ₁ = 5: A − 5I has rows (−1, 1) and (2, −2), and both rows demand y = x, so v₁ = (1, 1) (or any nonzero multiple).",
        "Eigenvector for λ₂ = 2: A − 2I has rows (2, 1) and (2, 1), demanding 2x + y = 0, so v₂ = (1, −2).",
        "Verify by direct action: A(1, 1) = (4 + 1, 2 + 3) = (5, 5) = 5(1, 1), and A(1, −2) = (4 − 2, 2 − 6) = (2, −4) = 2(1, −2) — both directions survive, stretched by exactly their eigenvalues.",
      ],
      answer: "The eigenvalues are 5 and 2, with eigenvectors (1, 1) and (1, −2) respectively (up to nonzero scaling).",
    },
    selfQuestions: [
      "Why does demanding a nonzero solution of (A − λI)v = 0 force the determinant of A − λI to vanish?",
      "What do the trace and determinant of a matrix tell you about its eigenvalues before you solve anything?",
      "How would you interpret a matrix having eigenvalue 0, both algebraically and geometrically?",
      "Why is any scalar multiple of an eigenvector still an eigenvector, and what does that say about what an eigenvector really represents?",
    ],
  },
  orthogonality: {
    explanation: [
      "An inner product equips a vector space with geometry: the dot product u · v defines lengths via |v| = √(v · v) and declares u and v orthogonal when u · v = 0 — the n-dimensional generalization of perpendicular, with the Pythagorean theorem you have trusted since school holding in any dimension. Orthogonality is what makes bases comfortable: coordinates against an orthogonal basis are computed by independent dot products instead of by solving a coupled linear system.",
      "The workhorse construction is projection: the component of b along a nonzero vector a is proj = ((a · b)/(a · a)) a, the closest point to b on the line through a. The leftover b − proj is orthogonal to a by construction — that residual is the error of the best approximation, and the same decomposition scaled up gives least-squares fitting and Gram-Schmidt orthogonalization.",
      "Mind the misconception that orthogonal means unrelated or independent in some loose sense. Orthogonality is a precise metric statement — inner product exactly zero — and it is stronger than linear independence: orthogonal nonzero vectors are always independent, but independent vectors are usually not orthogonal.",
    ],
    example: {
      problem: "In R³, find the projection of b = (1, 2, 2) onto a = (2, 1, 0), and verify that the residual b − proj is orthogonal to a.",
      steps: [
        "Compute the two needed dot products: a · b = 2(1) + 1(2) + 0(2) = 4, and a · a = 4 + 1 + 0 = 5.",
        "Form the projection: proj = (4/5) a = (8/5, 4/5, 0) — the multiple of a closest to b, scaled by how strongly b aligns with a relative to a's own length squared.",
        "Compute the residual: b − proj = (1 − 8/5, 2 − 4/5, 2 − 0) = (−3/5, 6/5, 2).",
        "Verify orthogonality: a · (b − proj) = 2(−3/5) + 1(6/5) + 0(2) = −6/5 + 6/5 = 0, exactly as the construction promises.",
        "Interpret the split: b decomposes into a part along a with length |proj| = (4/5)√5 ≈ 1.79 and a perpendicular part of length √(9/25 + 36/25 + 4) ≈ 2.41 — the second is the distance from b to the line through a, the irreducible error of approximating b by multiples of a.",
      ],
      answer: "The projection is (8/5, 4/5, 0), and the residual (−3/5, 6/5, 2) is orthogonal to a since their dot product is 0.",
    },
    selfQuestions: [
      "Why does the projection formula divide by a · a, and what goes wrong dimensionally without it?",
      "How does the orthogonality of the residual capture the idea that the projection is the closest point on the line?",
      "Why are orthogonal nonzero vectors automatically linearly independent, while the converse fails?",
      "Where does repeated projection-and-subtraction appear in Gram-Schmidt, and what does it produce?",
    ],
  },
  first_order_odes: {
    explanation: [
      "A differential equation relates an unknown function to its own derivative, and first-order equations — involving only y and y' — are where modeling begins: population growth, radioactive decay, cooling, mixing tanks, RC circuits. Solving one means finding every function whose rate behaves as prescribed; the general solution carries an arbitrary constant, and an initial condition like y(0) = 2 pins down the one trajectory passing through that point.",
      "The first tool is separation of variables: when the equation can be written so that all y-dependence sits with dy and all x-dependence with dx, integrate both sides independently. When that fails, linear first-order equations yield to the integrating factor method. Reading the equation's type before computing is the actual skill — separable, linear, or neither determines the entire plan of attack.",
      "Resist the temptation to bolt the constant on at the end. The + C must appear at the moment of integration, before any exponentiation or rearrangement, because subsequent algebra transforms the constant — in exponential solutions, an additive C becomes a multiplicative one, which is why the final form is A e^(x³) rather than e^(x³) + C.",
    ],
    example: {
      problem: "Solve the initial value problem dy/dx = 3x²y with y(0) = 2.",
      steps: [
        "Classify first: the right side factors as (3x²)(y), a pure function of x times a pure function of y, so the equation is separable.",
        "Separate: dy/y = 3x² dx, valid where y ≠ 0 (and y = 0 is itself an equilibrium solution, noted and set aside since our initial value is 2, not 0).",
        "Integrate both sides: ln|y| = x³ + C, attaching the constant now, at the integration step.",
        "Exponentiate: |y| = e^(x³ + C) = e^C e^(x³), and absorbing the sign and e^C into one constant gives y = A e^(x³) — the additive constant has become multiplicative.",
        "Apply the initial condition: y(0) = A e⁰ = A = 2, so y = 2e^(x³).",
        "Verify by substitution: y' = 2e^(x³) × 3x² = 3x²y, and y(0) = 2 — both the equation and the initial condition check out exactly.",
      ],
      answer: "The solution is y = 2e^(x³), the unique trajectory through (0, 2).",
    },
    selfQuestions: [
      "Why does the additive constant of integration turn into a multiplicative constant in exponential-type solutions?",
      "What information does an initial condition add to the general solution, and what does it select geometrically?",
      "How do you recognize a separable equation quickly, and what structural feature rules separation out?",
      "What is special about the constant solution y = 0 here, and why does it deserve a separate check before you divide by y?",
    ],
  },
  linear_odes: {
    explanation: [
      "Second-order linear differential equations with constant coefficients — a y'' + b y' + c y = 0 — govern oscillating springs, RLC circuits, and damped vibrations, and they reward you with a complete, finite recipe. The key insight: exponential functions are eigenfunctions of differentiation, so guessing y = e^(rx) converts the differential equation into the characteristic polynomial a r² + b r + c = 0, an ordinary quadratic you have solved since high school.",
      "The roots dictate the solution's personality. Two distinct real roots give a combination of two exponentials; a repeated root gives e^(rx) and x e^(rx); complex roots p ± qi give e^(px) times sines and cosines — oscillation with growing or decaying amplitude. Superposition then says the general solution is c₁y₁ + c₂y₂ for any two independent solutions, with two constants because two integrations are buried in a second derivative.",
      "The matching misconception: one initial condition is not enough. A second-order equation needs both y(0) and y'(0) — position and velocity — to single out a trajectory, and the two constants are found by solving a small simultaneous system, not one at a time.",
    ],
    example: {
      problem: "Solve y'' − 5y' + 6y = 0 with initial conditions y(0) = 1 and y'(0) = 0.",
      steps: [
        "Substitute the exponential ansatz y = e^(rx): each derivative pulls down a factor of r, giving the characteristic equation r² − 5r + 6 = 0.",
        "Factor: (r − 2)(r − 3) = 0, so r = 2 and r = 3 — two distinct real roots, hence the general solution y = A e^(2x) + B e^(3x).",
        "Impose the first condition: y(0) = A + B = 1.",
        "Impose the second: y'(x) = 2A e^(2x) + 3B e^(3x), so y'(0) = 2A + 3B = 0.",
        "Solve the pair: from the first, A = 1 − B; substituting, 2(1 − B) + 3B = 2 + B = 0 gives B = −2 and A = 3.",
        "Verify: y = 3e^(2x) − 2e^(3x) has y(0) = 3 − 2 = 1 and y'(0) = 6 − 6 = 0, and plugging into the equation gives (12 − 30 + 18)e^(2x) + (−18 + 30 − 12)e^(3x) = 0 — everything cancels, as required.",
      ],
      answer: "The solution is y = 3e^(2x) − 2e^(3x).",
    },
    selfQuestions: [
      "Why does the guess y = e^(rx) turn a differential equation into an algebra problem?",
      "How do complex characteristic roots produce real oscillating solutions, and what controls the oscillation's decay?",
      "Why does a second-order equation need exactly two initial conditions, and what do they mean physically for a spring?",
      "What changes in the general solution when the characteristic equation has a repeated root, and why is a second independent solution needed at all?",
    ],
  },
  systems_odes: {
    explanation: [
      "When several quantities evolve and influence each other — predator and prey, two coupled tanks, competing currents — you get a system of differential equations, written compactly as x' = Ax for a vector x(t) and matrix A. Eigentheory is the master key: along an eigenvector v with eigenvalue λ, the system decouples into one-dimensional growth or decay, giving the building-block solution e^(λt) v. When the matrix has a full set of independent eigenvectors, superposing one block per eigenpair gives the general solution.",
      "Think of eigenvectors as the system's natural axes. Initial conditions aligned with an eigenvector stay on that line forever, evolving by a pure exponential; every other start is a mixture of the modes, each running at its own clock rate. Long-run behavior is read straight off the eigenvalues: the mode with the largest eigenvalue eventually dominates, and any positive eigenvalue is enough to make the origin unstable.",
      "A misconception to intercept: the constants c₁ and c₂ do not multiply whole coordinates of the answer — they weight entire eigenvector modes. Fitting an initial condition means expressing x(0) as a combination of eigenvectors, a small linear system, not a coordinate-by-coordinate match.",
    ],
    example: {
      problem: "Solve the system x₁' = x₁ + 2x₂, x₂' = 2x₁ + x₂ with initial condition (x₁(0), x₂(0)) = (3, 1).",
      steps: [
        "Write the coefficient matrix A with rows (1, 2) and (2, 1), and find its eigenvalues: det(A − λI) = (1 − λ)² − 4 = 0 gives 1 − λ = ±2, so λ₁ = 3 and λ₂ = −1.",
        "Find the eigenvectors: for λ₁ = 3, A − 3I has rows (−2, 2) and (2, −2), both forcing x₂ = x₁, so v₁ = (1, 1); for λ₂ = −1, A + I has identical rows (2, 2), forcing x₂ = −x₁, so v₂ = (1, −1).",
        "Assemble the general solution from the modes: x(t) = c₁ e^(3t) (1, 1) + c₂ e^(−t) (1, −1).",
        "Fit the initial condition by decomposing (3, 1) over the eigenvectors: c₁ + c₂ = 3 and c₁ − c₂ = 1, so adding gives c₁ = 2 and then c₂ = 1.",
        "Write out the components: x₁(t) = 2e^(3t) + e^(−t) and x₂(t) = 2e^(3t) − e^(−t). Check the ODE at the level of x₁: its derivative is 6e^(3t) − e^(−t), while x₁ + 2x₂ = 2e^(3t) + e^(−t) + 4e^(3t) − 2e^(−t) = 6e^(3t) − e^(−t) — identical.",
        "Read the long-run story: the e^(3t) mode along (1, 1) explodes while the e^(−t) mode dies, so trajectories asymptotically hug the line x₂ = x₁ — the unstable axis of a saddle at the origin, exactly what the opposite-sign eigenvalues 3 and −1 predict.",
      ],
      answer: "x₁(t) = 2e^(3t) + e^(−t) and x₂(t) = 2e^(3t) − e^(−t), with the (1, 1) growth mode dominating as t increases.",
    },
    selfQuestions: [
      "Why does an initial condition lying exactly on an eigenvector produce motion that never leaves that line?",
      "How do the signs of the eigenvalues determine whether the origin attracts, repels, or saddles nearby trajectories?",
      "What would change in the solution recipe if the eigenvalues came out complex, and what would trajectories look like?",
      "How is fitting c₁ and c₂ to an initial condition the same problem as writing a vector in a new basis?",
    ],
  },
  laplace_transforms: {
    explanation: [
      "The Laplace transform converts a function of time y(t) into a function of a new variable s, defined as the integral of e^(−st) y(t) from t = 0 to infinity. Its power for differential equations is that it converts calculus into algebra: differentiation in t becomes multiplication by s, with the transform of y' equal to sY(s) − y(0). Initial conditions enter automatically at the start instead of being fitted at the end — a major advantage for engineering problems with switches, impulses, and piecewise forcing.",
      "The workflow is a round trip: transform the whole equation, solve algebraically for Y(s), then invert back to y(t) using a table of standard pairs — 1/s pairs with the constant 1, 1/(s + a) with e^(−at), and partial fractions break complicated Y(s) into those recognizable pieces. Most of the labor lives in the partial-fraction step, which is pure algebra.",
      "Two cautions. The transform is linear, but it does not turn products into products — the transform of a product of two time functions is not the product of their transforms. And the s-domain is bookkeeping, not physics: Y(s) has no direct physical reading; only after inversion does the answer mean anything in time.",
    ],
    example: {
      problem: "Use the Laplace transform to solve y' + 3y = 6 with y(0) = 1.",
      steps: [
        "Transform every term using linearity and the derivative rule: y' becomes sY − y(0) = sY − 1, the term 3y becomes 3Y, and the constant 6 becomes 6/s.",
        "Assemble the algebraic equation: sY − 1 + 3Y = 6/s, so (s + 3)Y = 1 + 6/s = (s + 6)/s.",
        "Solve for the transform: Y(s) = (s + 6)/(s(s + 3)).",
        "Split by partial fractions: write (s + 6)/(s(s + 3)) = A/s + B/(s + 3); clearing denominators gives s + 6 = A(s + 3) + Bs, and choosing s = 0 yields A = 2 while s = −3 yields −3B = 3, so B = −1.",
        "Invert term by term from the table: 2/s returns the constant 2, and −1/(s + 3) returns −e^(−3t), so y(t) = 2 − e^(−3t).",
        "Verify in the time domain: y(0) = 2 − 1 = 1, and y' + 3y = 3e^(−3t) + 6 − 3e^(−3t) = 6 — the solution rises from 1 toward the steady state 2, as a stable first-order system driven by a constant should.",
      ],
      answer: "y(t) = 2 − e^(−3t), which starts at 1 and settles at the steady-state value 2.",
    },
    selfQuestions: [
      "Why does turning differentiation into multiplication by s make differential equations easier rather than just different?",
      "How do initial conditions enter a Laplace solution, and why is that more convenient than fitting constants afterward?",
      "What role do partial fractions play in the inversion step, and why must the table pairs be matched exactly?",
      "Which kinds of forcing functions — switches, impulses, ramps — make the Laplace approach especially attractive, and why?",
    ],
  },
  probability_theory: {
    explanation: [
      "Probability theory makes uncertainty computable by building on three axioms: probabilities are nonnegative, the whole sample space has probability 1, and probabilities of mutually exclusive events add. From counting rules and conditional probability — which you have already used — the theory assembles the machinery of serious inference: the multiplication rule P(A and B) = P(A)P(B given A), the law of total probability for averaging over scenarios, and Bayes' theorem for reversing the direction of a conditional.",
      "Bayes' theorem deserves a mental picture, not just a formula: when an effect can arise from several causes, the probability of a particular cause given the observed effect is that cause's share of all the ways the effect happens. Weight each scenario by how often it occurs and how often it produces the effect, then divide the share of interest by the total.",
      "The misconception that wrecks the most real decisions is confusing P(A given B) with P(B given A) — the probability of a positive test given disease is not the probability of disease given a positive test. The two can differ wildly when the base rates of the underlying scenarios are lopsided, which is precisely when intuition is least trustworthy.",
    ],
    example: {
      problem: "A factory runs two production lines. Line A makes 60% of all units and 2% of its output is defective; line B makes 40% and 5% of its output is defective. A randomly chosen unit turns out to be defective. What is the probability it came from line B?",
      steps: [
        "Set up the scenarios and the target: the causes are A and B with P(A) = 0.6 and P(B) = 0.4, the effect is the event D (defective), and the question asks for P(B given D) — note this reverses the given conditionals, which point from line to defect rate.",
        "Compute each route to a defect with the multiplication rule: P(A and D) = 0.6 × 0.02 = 0.012, and P(B and D) = 0.4 × 0.05 = 0.020.",
        "Total the routes with the law of total probability: P(D) = 0.012 + 0.020 = 0.032 — overall, 3.2% of all units are defective.",
        "Apply Bayes' theorem as a share: P(B given D) = P(B and D)/P(D) = 0.020/0.032 = 0.625.",
        "Interpret: although line B makes only 40% of the units, it accounts for 62.5% of the defects, because its defect rate is 2.5 times higher. A concrete check with 1000 units: 12 defects from A and 20 from B gives 20 out of 32 — the same 0.625.",
      ],
      answer: "The probability the defective unit came from line B is 0.020/0.032 = 0.625, or 62.5%.",
    },
    selfQuestions: [
      "Why can P(B given D) be so different from P(D given B), and which real decisions hinge on not confusing them?",
      "How does the law of total probability act as the denominator inside Bayes' theorem?",
      "What happens to the answer if line B's share of production shrinks toward zero while its defect rate stays fixed?",
      "How would you rebuild this calculation as a tree or a table of 1000 imaginary units, and why does that recasting help intuition?",
    ],
  },
  random_variables: {
    explanation: [
      "A random variable attaches a number to every outcome of a random process — the number of defects in a batch, the sum of two dice, the wait time for a bus — so that uncertainty becomes something you can do arithmetic on. Its distribution lists each possible value with its probability, and from the distribution flow the two headline summaries: the expected value E[X], a probability-weighted average, and the variance Var(X) = E[X²] − (E[X])², which measures spread around that average.",
      "Read E[X] as a long-run average over many repetitions, not a prediction for one trial: a variable taking values 0, 1, 2 can have mean 1.1 even though 1.1 never occurs. The computational shortcut worth memorizing is the variance identity — compute E[X²] by weighting squared values, then subtract the square of the mean.",
      "The order of operations there is the classic trap: E[X²] is not (E[X])², and the gap between them is exactly the variance. Squaring first emphasizes large values, so E[X²] always meets or exceeds (E[X])², with equality only for a constant — a useful built-in sanity check, since a negative variance always signals an arithmetic slip.",
    ],
    example: {
      problem: "A help desk replaces X laptop batteries per day, where X takes the value 0 with probability 0.2, the value 1 with probability 0.5, and the value 2 with probability 0.3. Find the mean, variance, and standard deviation of X.",
      steps: [
        "Check the distribution is legitimate: 0.2 + 0.5 + 0.3 = 1, so the probabilities account for every possibility exactly once.",
        "Compute the mean as a weighted average: E[X] = 0(0.2) + 1(0.5) + 2(0.3) = 0 + 0.5 + 0.6 = 1.1 batteries per day.",
        "Compute the second moment by weighting the squared values: E[X²] = 0²(0.2) + 1²(0.5) + 2²(0.3) = 0 + 0.5 + 1.2 = 1.7.",
        "Apply the variance identity: Var(X) = E[X²] − (E[X])² = 1.7 − 1.21 = 0.49 — positive, as it must be, and notice how E[X²] = 1.7 differs from (E[X])² = 1.21.",
        "Take the square root for the standard deviation: σ = √0.49 = 0.7 batteries, a spread measure in the same units as X. Interpretation: over many days the average settles near 1.1 with typical day-to-day deviations of about 0.7 — even though no single day can ever produce 1.1 batteries.",
      ],
      answer: "E[X] = 1.1 batteries per day, Var(X) = 0.49, and the standard deviation is 0.7 batteries.",
    },
    selfQuestions: [
      "Why can the expected value be a number the random variable never actually takes, and what does it really describe?",
      "How does the identity Var(X) = E[X²] − (E[X])² follow from the definition of variance as expected squared deviation?",
      "What would happen to the mean and the variance if every value of X were doubled, and why do they scale by different factors?",
      "When would you prefer reporting a standard deviation over a variance, and what do its units have to do with it?",
    ],
  },
  statistical_inference: {
    explanation: [
      "Inference runs probability in reverse: instead of deducing data from a known distribution, you observe a sample and reason back to the population that produced it. The pivotal fact is the central limit theorem — for large samples, the sample mean is approximately normal around the true mean μ with standard error σ/√n. Because the standard error shrinks like 1 over the square root of n, averaging is a noise-suppression machine, and you can say precisely how much trust a given sample size buys.",
      "A confidence interval converts that into a usable statement: sample mean ± (critical value) × (standard error), where the 95% critical value of 1.96 comes from the normal distribution. The procedure traps the true mean in 95% of repetitions — confidence describes the long-run reliability of the method, not a probability about any single computed interval.",
      "That is also the misconception to root out: once an interval like (500.0, 504.0) is computed, the true mean is not 95% likely to be inside it — μ is a fixed number, in or out, and randomness lived in the sampling, not in μ. Saying 'the method captures the truth 19 times in 20' is both correct and more honest.",
    ],
    example: {
      problem: "A coffee roaster's filling machine has a known standard deviation of σ = 8 g. A quality check of n = 64 randomly chosen bags has a sample mean of 502 g. Build a 95% confidence interval for the true mean fill weight, and judge whether the machine is meeting its 500 g target.",
      steps: [
        "Compute the standard error of the mean: σ/√n = 8/√64 = 8/8 = 1 g — averaging 64 bags shrinks bag-to-bag noise of 8 g down to 1 g of uncertainty about the mean.",
        "Pick the critical value for 95% confidence from the normal distribution: 1.96 standard errors on each side.",
        "Form the margin of error: 1.96 × 1 = 1.96 g.",
        "Build the interval: 502 ± 1.96 gives (500.04, 503.96) — the data are consistent with true mean fills between roughly 500.0 and 504.0 grams.",
        "Draw the inference: the target value 500 sits just outside the interval, so at the 95% level the data suggest the machine is overfilling slightly — a systematic excess of about 2 g per bag, small but real money across thousands of bags.",
        "Sanity-check the logic: with n = 16 instead of 64, the standard error would be 2 g and the interval 502 ± 3.92 would comfortably contain 500 — the same sample mean would not justify the overfilling conclusion, which shows how sample size, not luck, sharpens inference.",
      ],
      answer: "The 95% confidence interval is (500.04, 503.96) g; since 500 g lies just outside it, the data indicate the machine is overfilling by about 2 g on average.",
    },
    selfQuestions: [
      "Why does the standard error shrink with √n rather than with n, and what does that imply about the cost of extra precision?",
      "What exactly does the 95% refer to in a confidence interval, and why is it a statement about the method rather than about μ?",
      "How would the interval change if σ were unknown and had to be estimated from the sample, and which distribution replaces the normal?",
      "What trade-off do you accept when moving from 95% to 99% confidence with the same data?",
    ],
  },
};
