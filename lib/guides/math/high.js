// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — MATH · HIGH.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  quantities_units: {
    explanation: [
      "Behind every applied math problem sits a quantity: a number attached to a unit, like 54 m³ or 60 km/h. You already know how to measure, convert units, and work with rates; this concept turns those skills into a system called dimensional analysis, where units are treated like algebraic factors that multiply and cancel. Choosing the right unit and a sensible level of precision is often the difference between an answer you can defend and a number that means nothing.",
      "The core move is multiplying by conversion factors that equal 1, such as 1000 L per 1 m³, arranged so the unwanted units cancel. If the leftover units are wrong, the setup is wrong — no need to recheck the arithmetic. The common misconception is that converting is just shifting a decimal point; that shortcut only works between metric prefixes of the same base unit. Converting a compound unit like km/h to m/s needs two factors, one for each part, and the units themselves tell you whether to multiply or divide.",
    ],
    example: {
      problem: "A pump moves water at 2.4 L/s into an empty tank that holds 54 m³. How long will the pump take to fill the tank, in hours?",
      steps: [
        "Get both quantities into compatible units first. One cubic meter is 1000 liters, so the tank holds 54 × 1000 = 54,000 L.",
        "Convert the rate to liters per hour so the time comes out in hours: 2.4 L/s × 3600 s/h = 8640 L/h. The seconds cancel, leaving liters per hour, which confirms the setup.",
        "Time equals amount divided by rate: 54,000 L ÷ 8640 L/h = 6.25 h. The liters cancel and hours remain — exactly the unit the question asks for.",
        "Sanity-check the size: 8640 L/h is roughly 8.6 m³ per hour, and 6 × 8.6 ≈ 52 m³, so taking a little over 6 hours to reach 54 m³ is believable.",
      ],
      answer: "The pump fills the tank in 6.25 hours, which is 6 hours 15 minutes.",
    },
    selfQuestions: [
      "Why does multiplying by a conversion factor like 1000 L per 1 m³ leave the actual quantity unchanged even though the number changes?",
      "How can checking only the leftover units catch a setup error before you do any arithmetic?",
      "What goes wrong if you convert km/h to m/s by moving the decimal point, and why does that shortcut fail for compound units?",
      "How would you decide how many significant figures to keep when a measured rate like 2.4 L/s drives the whole calculation?",
    ],
  },
  real_complex_numbers: {
    explanation: [
      "The number system you use grew in layers: whole numbers, negatives, fractions, then irrationals like √2 and π, which together fill the real number line completely. Complex numbers add one more layer by introducing i, a number defined by i² = −1. Every complex number has the form a + bi with real numbers a and b, and the rule i² = −1 is the only new fact you need — everything else is ordinary algebra. The payoff is that every quadratic equation now has solutions, even ones like x² + 9 = 0 with no real roots.",
      "Treat a + bi like a binomial: add and subtract by combining like parts, multiply by distributing and replacing i² with −1. Division uses the conjugate: multiplying top and bottom by a − bi turns the denominator real, because (a + bi)(a − bi) = a² + b². The misconception to drop is that imaginary numbers are fake or optional decorations. They are coordinates: a + bi is the point (a, b) in the complex plane, and engineers lean on them daily to describe rotations and oscillations.",
    ],
    example: {
      problem: "Write the quotient (5 − 2i)/(3 + i) in the standard form a + bi, where a and b are real numbers.",
      steps: [
        "Division by a complex number is undone by its conjugate. Multiply the top and bottom by 3 − i, the conjugate of the denominator, which changes the form but not the value of the fraction.",
        "Expand the numerator: (5 − 2i)(3 − i) = 15 − 5i − 6i + 2i². Since i² = −1, the last term is −2, giving 15 − 11i − 2 = 13 − 11i.",
        "Expand the denominator: (3 + i)(3 − i) = 9 − i² = 9 + 1 = 10, a real number — exactly the point of using the conjugate.",
        "Divide each part by 10: the quotient is 13/10 − (11/10)i, or 1.3 − 1.1i.",
        "Check by multiplying back: (1.3 − 1.1i)(3 + i) = 3.9 + 1.3i − 3.3i − 1.1i² = 3.9 − 2i + 1.1 = 5 − 2i, the original numerator, so the answer is right.",
      ],
      answer: "The quotient is 1.3 − 1.1i, that is, a = 13/10 and b = −11/10.",
    },
    selfQuestions: [
      "Why does multiplying a complex number by its conjugate always produce a real number, and how is that like rationalizing a denominator with radicals?",
      "How would you explain to a friend what i actually is, without using the word imaginary?",
      "Where do the real numbers sit inside the complex plane, and what does that picture say about how the two systems relate?",
      "What pattern do the powers i, i², i³, i⁴ follow, and how could that repeating cycle help you simplify i^37 quickly?",
    ],
  },
  polynomial_arithmetic: {
    explanation: [
      "Polynomials are expressions built from variables and constants using only addition, subtraction, and multiplication — things like 2x³ − 11x² + 22x − 15. You already manipulate algebraic expressions and exponent rules; polynomial arithmetic organizes that into a system that behaves remarkably like the integers: add, subtract, or multiply two polynomials and you always get another polynomial. That closure is why polynomials are the workhorses of algebra, modeling everything from areas to profit curves.",
      "Adding and subtracting is collecting like terms — terms with the same variable part. Multiplying is the distributive law applied thoroughly: every term of the first factor must multiply every term of the second, and the degrees add, so a degree-1 polynomial times a degree-2 polynomial gives degree 3. The classic error is freelancing with shortcuts like claiming (a + b)² equals a² + b², which skips the cross terms; careful expansion gives a² + 2ab + b². A quick guard against slips is to evaluate both the original factors and your expansion at an easy value like x = 1 and confirm they match.",
    ],
    example: {
      problem: "Expand (2x − 3)(x² − 4x + 5), combine like terms, and verify the result by evaluating at x = 1.",
      steps: [
        "Distribute 2x across the trinomial: 2x × x² = 2x³, then 2x × (−4x) = −8x², then 2x × 5 = 10x.",
        "Distribute −3 the same way: −3 × x² = −3x², then −3 × (−4x) = +12x, then −3 × 5 = −15. Keeping each sign attached to its term prevents the most common errors.",
        "Collect like terms: the x² terms give −8x² − 3x² = −11x², and the x terms give 10x + 12x = 22x, so the product is 2x³ − 11x² + 22x − 15.",
        "Verify at x = 1: the factors give (2 − 3)(1 − 4 + 5) = (−1)(2) = −2, and the expansion gives 2 − 11 + 22 − 15 = −2. The match is strong evidence the expansion is correct.",
      ],
      answer: "The product is 2x³ − 11x² + 22x − 15.",
    },
    selfQuestions: [
      "Why must the product of a degree-1 and a degree-2 polynomial always have degree 3, and what does that predict about the term count before combining?",
      "How is multiplying two polynomials like multiplying two multi-digit numbers place by place?",
      "Why does checking at a single value like x = 1 catch most expansion errors yet still fall short of a guarantee?",
      "What exactly goes missing when someone writes (a + b)² = a² + b², and why does the error vanish when a or b is zero?",
    ],
  },
  factoring_identities: {
    explanation: [
      "Factoring runs multiplication in reverse: it rewrites a polynomial as a product of simpler pieces, the way 60 = 2² × 3 × 5 breaks an integer into primes. Building on your work with expressions, exponents, and integer factors, the skill is recognizing structure: a shared common factor, the difference of squares a² − b² = (a − b)(a + b), perfect-square trinomials, and grouping patterns. Factored form is powerful because a product is zero exactly when one of its factors is zero — so factoring turns equation solving into reading off roots.",
      "Work in a fixed order: pull out the greatest common factor first, then look for a recognizable identity, then try grouping on four-term polynomials. After each move, ask whether any factor can still be broken down; factoring completely means no factor hides a remaining pattern. A common misconception is treating a² + b², the sum of squares, like the difference of squares — over the real numbers it does not factor, and forcing (a + b)(a + b) onto it invents a middle term that does not exist. Multiply your factors back together when in doubt; factoring claims are cheap to verify.",
    ],
    example: {
      problem: "Factor 2x³ + 3x² − 8x − 12 completely.",
      steps: [
        "No factor is shared by all four terms, but four terms suggest grouping. Pair them: (2x³ + 3x²) + (−8x − 12).",
        "Factor each pair: x²(2x + 3) from the first and −4(2x + 3) from the second. Both groups now expose the same binomial, which is the signal that grouping is working.",
        "Pull out the common binomial: x²(2x + 3) − 4(2x + 3) = (2x + 3)(x² − 4).",
        "The second factor is a difference of squares, x² − 4 = (x − 2)(x + 2), so the complete factorization is (2x + 3)(x − 2)(x + 2).",
        "Check with x = 1: the original gives 2 + 3 − 8 − 12 = −15, and the factors give (5)(−1)(3) = −15. The values agree, supporting the factorization.",
      ],
      answer: "2x³ + 3x² − 8x − 12 = (2x + 3)(x − 2)(x + 2).",
    },
    selfQuestions: [
      "Why does the zero-product property make factored form so much more useful than expanded form for solving equations?",
      "How do you decide which factoring strategy to try first, and what clues in a polynomial point toward grouping?",
      "Why does x² + 4 refuse to factor over the real numbers while x² − 4 splits so easily?",
      "How would you convince a skeptic that your factorization is both complete and correct without re-deriving it from scratch?",
    ],
  },
  quadratics: {
    explanation: [
      "A quadratic function has the form f(x) = ax² + bx + c with a ≠ 0, and its graph is a parabola — the shape traced by thrown balls, satellite dishes, and profit curves. You already know functions, exponents, and algebraic manipulation; quadratics add a toolkit of equivalent forms. Standard form shows the y-intercept, factored form shows the roots, and vertex form a(x − h)² + k shows the maximum or minimum. Much of the skill is choosing the form that exposes what you need.",
      "To solve ax² + bx + c = 0 you can factor, complete the square, or use the quadratic formula x = (−b ± √(b² − 4ac))/(2a), which always works. The discriminant b² − 4ac announces in advance how many real solutions exist: two when positive, one when zero, none when negative. The frequent misconception is that the vertex sits at a root or at the y-intercept; in fact it lies at x = −b/(2a), on the axis of symmetry, exactly halfway between the roots whenever roots exist.",
    ],
    example: {
      problem: "A ball is launched from a platform so that its height after t seconds is h(t) = −5t² + 20t + 25 meters. Find the maximum height and the time when the ball hits the ground.",
      steps: [
        "The coefficient of t² is negative, so the parabola opens downward and the vertex is the maximum. The vertex time is t = −b/(2a) = −20/(2 × (−5)) = 2 s.",
        "Evaluate the height there: h(2) = −5(4) + 20(2) + 25 = −20 + 40 + 25 = 45, so the peak is 45 m.",
        "The ball lands when h(t) = 0. Divide −5t² + 20t + 25 = 0 by −5 to get the cleaner equation t² − 4t − 5 = 0.",
        "Factor: t² − 4t − 5 = (t − 5)(t + 1), so t = 5 or t = −1. A negative time is before launch, so reject t = −1.",
        "Sanity check: the ball takes 2 s to rise from 25 m to 45 m but 3 s to fall from 45 m all the way to 0 m. The longer descent covers more height, so the asymmetry makes physical sense.",
      ],
      answer: "The ball reaches a maximum height of 45 m at t = 2 s and hits the ground at t = 5 s.",
    },
    selfQuestions: [
      "How does the discriminant reveal the number of real solutions before you finish solving, and what does each case look like on the graph?",
      "Why is the vertex halfway between the two roots when they exist, and what breaks in that statement when there are no real roots?",
      "When would you choose completing the square over the quadratic formula, given that both always work?",
      "How would the landing time change if the same ball were launched from the ground instead of from a 25 m platform?",
    ],
  },
  rational_expressions: {
    explanation: [
      "A rational expression is a ratio of polynomials, such as 3/(x − 2), and it inherits its rules from ordinary fractions: common denominators to add, multiply straight across, divide by flipping. What is new is the domain — any value that makes a denominator zero is simply not allowed, and those excluded values silently shape every problem. You already handle fractions and polynomial algebra; here the two merge, and bookkeeping the forbidden values becomes part of the work.",
      "To solve a rational equation, factor every denominator, record the excluded values, then multiply both sides by the least common denominator to clear the fractions. That clearing step can manufacture solutions that were never legal, because multiplying by an expression that equals zero at some x erases information. So the final move is non-negotiable: test each candidate against the excluded list and discard any that land on it. The misconception to avoid is canceling terms instead of factors — you may cancel only whole factors shared by an entire numerator and denominator, never individual terms inside a sum.",
    ],
    example: {
      problem: "Solve 3/(x − 2) + 1/x = 4/(x² − 2x).",
      steps: [
        "Factor the right-hand denominator: x² − 2x = x(x − 2). Every denominator is now built from x and x − 2, so the excluded values are x = 0 and x = 2.",
        "Multiply both sides by the least common denominator x(x − 2): the left side becomes 3x + (x − 2) and the right side becomes 4.",
        "Solve the cleared equation: 3x + x − 2 = 4 gives 4x = 6, so x = 3/2.",
        "Check against the exclusions: 3/2 is neither 0 nor 2, so it survives.",
        "Verify numerically: at x = 3/2 the left side is 3/(−1/2) + 1/(3/2) = −6 + 2/3 = −16/3, and the right side is 4/((9/4) − 3) = 4/(−3/4) = −16/3. Both sides match.",
      ],
      answer: "The only solution is x = 3/2.",
    },
    selfQuestions: [
      "Why can multiplying both sides of an equation by a variable expression create extraneous solutions, and at exactly which step does information get lost?",
      "How do the excluded values of a rational expression show up on its graph?",
      "Why is it illegal to cancel the x in (x + 3)/x while canceling the x in 3x/x is perfectly fine?",
      "How would you explain to a friend the difference between simplifying a rational expression and solving a rational equation?",
    ],
  },
  radical_expressions: {
    explanation: [
      "A radical expression contains a root — √x, ∛x, or higher — and it ties straight back to exponents, because √x is x^(1/2) and the exponent laws you already trust keep working. That link explains rules like √(ab) = √a × √b for nonnegative a and b, and it is why simplifying √72 into 6√2 is really just factoring out perfect squares. Radicals appear wherever the Pythagorean theorem does, so distances, diagonals, and falling-object times all speak this language.",
      "Solving a radical equation means isolating the radical and raising both sides to the matching power. Squaring both sides, though, is not fully reversible: it makes 3 and −3 look identical, so it can smuggle in extraneous solutions — candidates that satisfy the squared equation but not the original. Checking every candidate in the original equation is part of the method, not an optional courtesy. The misconception to retire is √(a² + b²) = a + b; with a = 3 and b = 4 the left side is 5 while the right side is 7, so a root never splits across addition.",
    ],
    example: {
      problem: "Solve √(2x + 7) = x − 4, and identify any extraneous solutions.",
      steps: [
        "Before squaring, note that the square root on the left is never negative, so any genuine solution needs x − 4 ≥ 0, that is, x ≥ 4.",
        "The radical is already isolated, so square both sides: 2x + 7 = (x − 4)² = x² − 8x + 16.",
        "Bring everything to one side: x² − 10x + 9 = 0, which factors as (x − 1)(x − 9) = 0, giving candidates x = 1 and x = 9.",
        "Test x = 1 in the original equation: the left side is √9 = 3 but the right side is 1 − 4 = −3. They disagree, so x = 1 is extraneous — squaring erased the sign difference.",
        "Test x = 9: the left side is √(18 + 7) = √25 = 5 and the right side is 9 − 4 = 5. This one holds, and it also respects the x ≥ 4 requirement spotted at the start.",
      ],
      answer: "The only solution is x = 9; the candidate x = 1 is extraneous.",
    },
    selfQuestions: [
      "Why does squaring both sides of an equation sometimes create solutions the original equation rejects, and at exactly which moment is the information lost?",
      "How does writing √x as x^(1/2) let the exponent laws explain why √a × √b = √(ab) for nonnegative numbers?",
      "What changes when the equation uses a cube root instead of a square root, and why do extraneous solutions stop appearing?",
      "How could you tell before doing any algebra that √(2x + 7) = x − 4 cannot have a solution smaller than 4?",
    ],
  },
  exponential_functions: {
    explanation: [
      "An exponential function multiplies by the same factor over each equal step of input: f(x) = a × b^x, where a is the starting amount and b is the growth factor. Compare that with the linear functions you know, which add the same amount each step — exponential change compounds, so it starts deceptively slowly and then runs away. Populations, investments, radioactive decay, and viral spread all follow this multiply-each-period pattern, growing when b > 1 and decaying when 0 < b < 1.",
      "The mental model is repeated multiplication wearing function notation. A quantity that doubles every 3 hours has been multiplied by 2 exactly t/3 times after t hours, so the model is N(t) = N₀ × 2^(t/3) — the exponent counts how many doubling periods have elapsed. The common misconception is reading 5% growth per year as adding a fixed amount annually; it actually multiplies by 1.05 each year, taking 5% of an ever-larger base, and over decades the gap between those two readings becomes enormous.",
    ],
    example: {
      problem: "A bacteria culture starts with 500 cells and doubles every 3 hours. Write a function for the population after t hours, find the population at t = 12 hours, and find the equivalent hourly growth rate.",
      steps: [
        "Each 3-hour block multiplies the population by 2, and t hours contain t/3 such blocks, so the model is N(t) = 500 × 2^(t/3).",
        "At t = 12 the exponent is 12/3 = 4 doublings: N(12) = 500 × 2⁴ = 500 × 16 = 8000 cells.",
        "For the hourly rate, one hour is a third of a doubling period, so the hourly factor is 2^(1/3) ≈ 1.26 — roughly 26% growth per hour, not 33%, because compounding does part of the work.",
        "Check the rate: 1.26³ ≈ 2.00, so three hours of 26% compounding really does double the count. Counting directly, 500 → 1000 → 2000 → 4000 → 8000 over four periods confirms N(12).",
      ],
      answer: "N(t) = 500 × 2^(t/3); the culture reaches 8000 cells at t = 12 hours, growing about 26% per hour.",
    },
    selfQuestions: [
      "How can you tell from a table of data whether a relationship is linear or exponential, and do you compare differences or ratios?",
      "Why does the same percentage growth rate produce larger and larger absolute increases as time passes?",
      "What does N(1.5) mean in the bacteria model, and how do you make sense of a fractional number of doublings?",
      "How would the model and its long-run behavior change if the culture instead lost half its cells every 3 hours?",
    ],
  },
  logarithms: {
    explanation: [
      "A logarithm answers one question: what exponent turns the base into this number? Writing log₂ 32 = 5 states exactly that 2⁵ = 32 — the logarithm and the exponential are the same fact read in opposite directions. You already solve equations like 3^x = 81 by spotting the exponent; logarithms make that move available even when nothing is spottable, as in 1.05^t = 1.5. They also compress huge ranges into small ones, which is why earthquake magnitude, pH, and decibels are all logarithmic scales.",
      "Three laws carry the subject, each a translated exponent rule: log(xy) = log x + log y, log(x/y) = log x − log y, and log(x^n) = n log x. The power law is the workhorse — it pulls an unknown exponent down to ground level where ordinary algebra can reach it. The misconception to dodge is splitting log(x + y) into log x + log y; logs convert multiplication into addition, not addition into anything, and log(x + y) simply does not simplify. Remember the domain too: only positive numbers have logarithms.",
    ],
    example: {
      problem: "An investment of $2000 grows by 5% per year, so its value after t years is 2000 × 1.05^t. How long until the investment is worth $3000? Give t to two decimal places.",
      steps: [
        "Isolate the exponential, the only part containing t: divide both sides of 2000 × 1.05^t = 3000 by 2000 to get 1.05^t = 1.5.",
        "Take a logarithm of both sides (any base works; base 10 here): log(1.05^t) = log 1.5, and the power law turns the left side into t × log 1.05.",
        "Solve for t: t = log 1.5 ÷ log 1.05 ≈ 0.17609 ÷ 0.02119 ≈ 8.31 years.",
        "Sanity-check by bracketing: 1.05⁸ ≈ 1.477 falls just short of 1.5, while 1.05⁹ ≈ 1.551 overshoots, so a crossing time between 8 and 9 years — close to the low end — fits perfectly.",
      ],
      answer: "It takes about t ≈ 8.31 years; the investment passes $3000 during its ninth year.",
    },
    selfQuestions: [
      "How does the power rule log(x^n) = n log x follow from the exponent rule for a power of a power?",
      "How would you explain to a friend why log(xy) splits into a sum while log(x + y) refuses to split at all?",
      "What happens to log x as x slides toward zero from above, and why does no real logarithm exist for negative numbers?",
      "Why does the choice of logarithm base not affect the answer when you solve 1.05^t = 1.5?",
    ],
  },
  sequences_series_hs: {
    explanation: [
      "A sequence is an ordered list of numbers produced by a rule, and a series is the sum of its terms. Two families dominate: arithmetic sequences add a constant difference d each step, so aₙ = a₁ + (n − 1)d, while geometric sequences multiply by a constant ratio r, so aₙ = a₁ × r^(n−1). You have spotted such patterns for years; what is new is the function viewpoint — a sequence is a function on the counting numbers — plus compact formulas that jump straight to term 50 without listing 49 predecessors.",
      "The summing formulas come from honest tricks worth understanding rather than memorizing. An arithmetic series pairs first with last: every pair has the same total, so the sum is n × (a₁ + aₙ)/2 — the number of terms times the average term. A geometric series subtracts a shifted copy of itself, leaving Sₙ = a₁(1 − rⁿ)/(1 − r). The common slip is using n where n − 1 belongs: the 20th term sits only 19 steps beyond the first, so aₙ contains (n − 1) copies of d, never n.",
    ],
    example: {
      problem: "A theater has 18 seats in the first row, and each row behind it has 4 more seats than the row in front. With 20 rows total, how many seats are in the back row, and how many seats does the theater hold altogether?",
      steps: [
        "Row sizes form an arithmetic sequence with a₁ = 18 and d = 4. The 20th row lies 19 steps beyond the first, so a₂₀ = 18 + 19 × 4 = 18 + 76 = 94 seats.",
        "For the total, pair rows from the outside in: row 1 with row 20 gives 18 + 94 = 112, and row 2 with row 19 gives 22 + 90 = 112 — every pair matches because each step in adds 4 on one side and removes 4 on the other.",
        "Twenty rows form 10 such pairs, so the total is 10 × 112 = 1120. The formula says the same thing: S₂₀ = 20 × (18 + 94)/2 = 20 × 56 = 1120.",
        "Interpret the formula: (18 + 94)/2 = 56 is the average row size, and 20 average rows of 56 seats is 1120 — the pairing trick and the average reading agree.",
      ],
      answer: "The back row has 94 seats and the theater holds 1120 seats in total.",
    },
    selfQuestions: [
      "Why does pairing the first and last terms of an arithmetic series always give equal pair sums, and where does the n/2 in the formula come from?",
      "How do you decide from a handful of terms whether a sequence is arithmetic, geometric, or neither?",
      "What breaks in the geometric sum formula when r = 1, and how would you compute that sum instead?",
      "In what sense is an arithmetic sequence a linear function and a geometric sequence an exponential one?",
    ],
  },
  function_transformations: {
    explanation: [
      "Function notation packages a rule under a name — f(x) = x² says feed in x, get back x² — and transformations describe how to move or reshape the entire graph at once. The rigid motions you used on shapes now act on graphs: g(x) = f(x) + 5 shifts up 5, g(x) = f(x − 3) shifts right 3, g(x) = −f(x) reflects across the x-axis, and g(x) = 2f(x) stretches vertically by factor 2. One parent graph plus a short list of moves generates a whole family of functions.",
      "Keep this model: changes outside the function act on outputs and behave as expected, while changes inside act on inputs and run backwards. That inside reversal is the classic misconception — f(x + 3) shifts LEFT, not right, because the input x = −3 now produces what x = 0 used to produce. Order matters as well: in −2f(x + 3) + 5, the stretch and reflection must act before the upward shift. Tracking one landmark point through the moves, in order, keeps a multi-step transformation honest.",
    ],
    example: {
      problem: "Let f(x) = x² and g(x) = −2(x + 3)² + 5. List the transformations that turn the graph of f into the graph of g, and find where the point (2, 4) on f ends up.",
      steps: [
        "Read g as −2 × f(x + 3) + 5. Inside: x + 3 shifts the graph 3 units left. Outside, in order: multiply outputs by 2 (vertical stretch), negate them (reflection across the x-axis), then add 5 (shift up).",
        "Push the point (2, 4) through: the left shift moves the input from 2 to −1, and the output chain runs 4 → 8 → −8 → −3 after the stretch, reflection, and upward shift.",
        "Verify with the formula: g(−1) = −2(−1 + 3)² + 5 = −2 × 4 + 5 = −3, so the image (−1, −3) is correct.",
        "Track the vertex as a second landmark: (0, 0) on f moves to (−3, 5), since stretching and reflecting an output of 0 leaves 0 before the +5. A downward-opening parabola with vertex (−3, 5) and maximum value 5 — the whole picture is consistent.",
      ],
      answer: "g shifts f left 3, stretches it vertically by 2, reflects it across the x-axis, and raises it 5; the point (2, 4) lands at (−1, −3).",
    },
    selfQuestions: [
      "Why does replacing x with x − 3 move a graph to the right when subtraction feels like it should pull things back?",
      "How do the graphs of f(2x) and 2f(x) differ, and which points does each transformation leave fixed?",
      "Why does swapping the order of a vertical stretch and a vertical shift change the result, while two shifts commute?",
      "How could you reconstruct the full list of transformations just from where the vertex and one other point land?",
    ],
  },
  inverse_functions: {
    explanation: [
      "An inverse function undoes another: if f sends 4 to 8, then f⁻¹ sends 8 back to 4. Formally f⁻¹(f(x)) = x for every x in the domain, which means inputs and outputs trade places — the domain of f becomes the range of f⁻¹ and vice versa, and the two graphs are mirror images across the line y = x. Inverses surround you already: subtraction undoes addition, a logarithm undoes an exponential, and converting Celsius back to Fahrenheit undoes the conversion that went the other way.",
      "To find a formula, write y = f(x), swap x and y, and solve for y — the algebra of the solve IS the undoing procedure, executed in reverse order. Not every function qualifies: f must be one-to-one, meaning no two inputs share an output, or the reversal is ambiguous; the horizontal line test checks this on a graph. The misconception lodged inside the notation is reading f⁻¹(x) as 1/f(x). The superscript names the inverse function, not a reciprocal — the inverse of f(x) = x + 5 is x − 5, nothing like 1/(x + 5).",
    ],
    example: {
      problem: "Find the inverse of f(x) = 2x/(x − 3), state which value is excluded from the domain of f⁻¹, and verify the inverse using x = 4.",
      steps: [
        "Write y = 2x/(x − 3) and swap the variables: x = 2y/(y − 3). Solving this for y rebuilds the rule in reverse.",
        "Clear the fraction by multiplying both sides by (y − 3): xy − 3x = 2y. Collect the y terms on one side: xy − 2y = 3x, so y(x − 2) = 3x.",
        "Divide by x − 2, which demands x ≠ 2: y = 3x/(x − 2). So f⁻¹(x) = 3x/(x − 2), with x = 2 excluded from its domain.",
        "That exclusion is no accident: f has horizontal asymptote y = 2, so 2 never appears as an output of f — and a value that f never produces cannot be fed backwards through f⁻¹.",
        "Verify with a round trip: f(4) = 8/(4 − 3) = 8, and f⁻¹(8) = 24/(8 − 2) = 24/6 = 4. The inverse returns 8 to 4, exactly as required.",
      ],
      answer: "f⁻¹(x) = 3x/(x − 2), defined for all x ≠ 2; the round trip f(4) = 8 and f⁻¹(8) = 4 confirms it.",
    },
    selfQuestions: [
      "Why must a function pass the horizontal line test before an inverse function can exist, and how can restricting the domain rescue a failing function?",
      "Why are the graphs of a function and its inverse reflections of each other across the line y = x?",
      "How does the domain exclusion of f⁻¹ encode the range of f, and why must that connection always hold?",
      "What goes wrong when someone reads f⁻¹(x) as 1/f(x), and how does the notation invite that mix-up?",
    ],
  },
  systems_equations_inequalities: {
    explanation: [
      "A system gathers several conditions that must hold at once, and solving it means finding every point that satisfies all of them simultaneously. You have solved pairs of linear equations; high school widens the cast to linear–quadratic systems, where a line meets a parabola, and to systems of inequalities, whose solution is a shaded region rather than a point. Geometrically each equation draws a curve and each solution is an intersection — so a line can meet a parabola twice, once, or never.",
      "Substitution is the universal tool: solve one equation for a variable, substitute into the other, and two equations in two unknowns collapse into one equation in one unknown. Elimination — adding multiples of equations to cancel a variable — is quicker when everything is linear. For inequalities, graph each boundary, pick the correct side with a test point, and intersect the shaded regions. The misconception to avoid is stopping once x is found: a system's solution is a complete point, so each x must be paired with its own y by substituting back.",
    ],
    example: {
      problem: "Find all points where the line y = 2x − 1 intersects the parabola y = x² − 4x + 7.",
      steps: [
        "Both formulas equal y at an intersection, so set them equal: x² − 4x + 7 = 2x − 1. Substitution has collapsed the system into a single equation in x.",
        "Move everything to one side: x² − 6x + 8 = 0. This factors as (x − 2)(x − 4) = 0, so x = 2 or x = 4.",
        "Each x needs its partner y; use the simpler equation, the line: x = 2 gives y = 2 × 2 − 1 = 3, and x = 4 gives y = 2 × 4 − 1 = 7. The candidate points are (2, 3) and (4, 7).",
        "Confirm both points in the parabola: 2² − 8 + 7 = 3 and 4² − 16 + 7 = 7, matching the line's values. Two distinct intersections means the line cuts clean through the parabola.",
      ],
      answer: "The line meets the parabola at the two points (2, 3) and (4, 7).",
    },
    selfQuestions: [
      "What does the discriminant of the combined equation reveal about the three ways a line can meet a parabola?",
      "Why does adding a multiple of one equation to another leave the solution set of a system unchanged?",
      "How does the solution of a system of inequalities differ in kind from the solution of a system of equations, and how would you report each one?",
      "What features of a system signal that substitution will be easier than elimination, or the other way around?",
    ],
  },
  right_triangle_trig: {
    explanation: [
      "Right-triangle trigonometry converts angle information into length information. In a right triangle, the ratios between side lengths depend only on the acute angle — a direct consequence of similarity, since all right triangles sharing that angle are scaled copies of one another. Naming the sides relative to the chosen angle θ — opposite, adjacent, hypotenuse — defines the three ratios: sin θ = opposite/hypotenuse, cos θ = adjacent/hypotenuse, and tan θ = opposite/adjacent. From one known side and one acute angle, every other measurement of the triangle is within reach.",
      "The practical workflow: sketch the triangle, mark the angle, label which sides are known and wanted, then pick the one ratio that connects them. To recover an angle from two sides, use the inverse functions sin⁻¹, cos⁻¹, or tan⁻¹. The classic mistake is labeling sides in absolute terms — opposite and adjacent are relative to the angle in use, and they swap when you switch to the other acute angle. A close second is a calculator left in the wrong angle mode; if the output makes no sense against your sketch, check the mode before anything else.",
    ],
    example: {
      problem: "From a point on level ground 40 m from the base of a vertical tower, the angle of elevation to the top is 52°. Find the height of the tower and the straight-line distance to its top, each to one decimal place.",
      steps: [
        "Sketch the right triangle: the 40 m ground distance is adjacent to the 52° angle, the height h is opposite it, and the line of sight is the hypotenuse.",
        "Height connects opposite and adjacent, which is tangent's job: tan 52° = h/40, so h = 40 × tan 52° ≈ 40 × 1.2799 ≈ 51.2 m.",
        "The line-of-sight distance d pairs adjacent with hypotenuse, so use cosine: cos 52° = 40/d, giving d = 40/cos 52° ≈ 40/0.6157 ≈ 65.0 m.",
        "Cross-check with the Pythagorean theorem: 40² + 51.2² = 1600 + 2621.4 = 4221.4, and √4221.4 ≈ 65.0 — two independent routes land on the same hypotenuse.",
      ],
      answer: "The tower is about 51.2 m tall, and its top is about 65.0 m from the observation point.",
    },
    selfQuestions: [
      "Why do the trigonometric ratios of an angle stay the same regardless of the triangle's size, and which earlier geometric idea guarantees it?",
      "How do you choose among sine, cosine, and tangent for a given problem before reaching for the calculator?",
      "What happens to the tangent ratio as the angle of elevation climbs toward 90°, and what does that mean about the tower in the picture?",
      "How are sin θ and cos(90° − θ) related, and how does the side-labeling of the two acute angles explain it?",
    ],
  },
  unit_circle_trig: {
    explanation: [
      "The unit circle frees trigonometry from triangles. Center a circle of radius 1 at the origin; an angle θ measured counterclockwise from the positive x-axis lands at a point whose coordinates ARE the trig values: (cos θ, sin θ). Suddenly sine and cosine make sense for any angle — 240°, negative angles, angles past a full turn — not just the acute angles a right triangle can hold. Radian measure belongs here too: an angle's radian measure is the arc length it cuts on the unit circle, with a full turn equal to 2π.",
      "The working method is reference angles: every angle relates to an acute angle made with the x-axis, and the quadrant decides the signs — cosine follows the x-coordinate, positive on the right half, while sine follows the y-coordinate, positive on the top half. Memorize only the first-quadrant values for 30°, 45°, and 60° plus the axis points; everything else is a reference angle and a sign decision. The misconception to flush out is that sine or cosine can exceed 1: both are coordinates of a point glued to a radius-1 circle, so each lives forever inside [−1, 1].",
    ],
    example: {
      problem: "Find the exact values of cos 240° and sin 240°, convert 240° to radians, and verify that your values satisfy the Pythagorean identity.",
      steps: [
        "Locate the angle: 240° is 60° past 180°, so the terminal side lies in quadrant III, and the reference angle is 240° − 180° = 60°.",
        "Recall the first-quadrant values: cos 60° = 1/2 and sin 60° = √3/2. In quadrant III both coordinates are negative, so cos 240° = −1/2 and sin 240° = −√3/2.",
        "Convert to radians by multiplying by π/180: 240 × π/180 = 4π/3.",
        "Verify the identity: (−1/2)² + (−√3/2)² = 1/4 + 3/4 = 1. The point really does sit on the unit circle, exactly as the definition demands.",
      ],
      answer: "cos 240° = −1/2 and sin 240° = −√3/2, with 240° equal to 4π/3 radians.",
    },
    selfQuestions: [
      "Why does defining cosine and sine as coordinates extend them to angles that no right triangle could ever contain?",
      "How does an angle's quadrant determine the signs of its sine and cosine, and how could you rebuild that rule from the picture instead of memorizing it?",
      "What does the identity sin(θ + 360°) = sin θ mean geometrically on the unit circle?",
      "Why is radian measure considered the natural unit for angles once arc length enters the picture?",
    ],
  },
  trig_identities: {
    explanation: [
      "A trigonometric identity is an equation true for every allowed angle — not a puzzle to solve but a rewriting rule. The bedrock is sin²θ + cos²θ = 1, which is the Pythagorean theorem read off the unit circle, joined by quotient identities like tan θ = sin θ/cos θ and the angle-sum formulas. Identities matter because trig equations rarely arrive in solvable form; the craft lies in converting a mixed expression into a single function of a single angle so that ordinary algebra can take over.",
      "Solving a trigonometric equation runs in two phases. Phase one is algebra: use identities to reach one trig function, then treat it like a variable — factor, isolate, apply the quadratic playbook. Phase two is geometry: a value like sin x = −1/2 corresponds to specific unit-circle points, and you must list every angle in the requested interval that reaches them. The recurring trap is stopping at the calculator's single inverse-function answer; an equation typically has several solutions per period, and the rest are silently discarded unless you sketch the circle and harvest them all.",
    ],
    example: {
      problem: "Solve 2cos²x + sin x − 1 = 0 for all x in the interval [0, 2π).",
      steps: [
        "Two different functions appear, so unify them with the Pythagorean identity: cos²x = 1 − sin²x turns the equation into 2(1 − sin²x) + sin x − 1 = 0.",
        "Expand and tidy: 2 − 2sin²x + sin x − 1 = 0 becomes −2sin²x + sin x + 1 = 0; multiplying by −1 gives 2sin²x − sin x − 1 = 0, a quadratic in s = sin x.",
        "Factor the quadratic: 2s² − s − 1 = (2s + 1)(s − 1) = 0, so sin x = −1/2 or sin x = 1.",
        "Read the circle: sin x = 1 happens only at x = π/2, while sin x = −1/2 happens at the quadrant III and IV angles with reference π/6, namely x = 7π/6 and x = 11π/6.",
        "Spot-check x = 7π/6: cos 7π/6 = −√3/2, so 2cos²x = 2 × 3/4 = 3/2, and 3/2 + (−1/2) − 1 = 0. The solution checks out in the original equation.",
      ],
      answer: "The solutions in [0, 2π) are x = π/2, x = 7π/6, and x = 11π/6.",
    },
    selfQuestions: [
      "In what sense is sin²θ + cos²θ = 1 the Pythagorean theorem in disguise, and where is the right triangle hiding?",
      "Why does a single value of sin x usually correspond to two angles in each period rather than one?",
      "When an equation mixes sine and cosine, what guides your choice of which one to eliminate?",
      "How would the solution set change if the interval [0, 2π) were replaced by all real numbers?",
    ],
  },
  trig_graphs: {
    explanation: [
      "Graphed against time, sine and cosine become waves — and waves run the physical world, from sound and tides to alternating current and daylight hours. The general form y = A sin(B(x − C)) + D packs four dials: |A| is the amplitude (half the wave's total height), 2π/B is the period (the length of one full cycle), C is the phase shift (horizontal), and D sets the midline (vertical). Each dial is one of the function transformations you already use, applied to a periodic parent graph.",
      "Read a formula in this order: midline first, then amplitude (maximum = D + |A|, minimum = D − |A|), then period, then shift — and watch for the one trap that catches nearly everyone. The phase shift can be read only AFTER factoring B out of the argument: in sin(2x − π/3) the shift is not π/3, because rewriting the argument as 2(x − π/6) reveals the true shift of π/6. When sketching, plot the midline crossings and the extremes — five key points per cycle — and the curve practically draws itself.",
    ],
    example: {
      problem: "For y = 3 sin(2x − π/3) + 1, find the amplitude, period, phase shift, and midline, then find the coordinates of the first maximum to the right of x = 0.",
      steps: [
        "Amplitude is |A| = 3 and the midline is y = 1, so the wave oscillates between 1 − 3 = −2 and 1 + 3 = 4.",
        "B = 2 gives period 2π/2 = π: the wave repeats every π units, twice as often as plain sine.",
        "Factor the argument before reading the shift: 2x − π/3 = 2(x − π/6), so the graph is shifted π/6 to the right — not π/3.",
        "A sine curve peaks where its argument equals π/2, so set 2x − π/3 = π/2. Then 2x = π/2 + π/3 = 5π/6, giving x = 5π/12, where y reaches the maximum 1 + 3 = 4.",
        "Check: at x = 5π/12 the argument is 5π/6 − 2π/6 = π/2 and sin(π/2) = 1, so y = 3 × 1 + 1 = 4. The point (5π/12, 4) also sits within the first period, as expected.",
      ],
      answer: "Amplitude 3, period π, phase shift π/6 right, midline y = 1; the first maximum right of 0 is at (5π/12, 4).",
    },
    selfQuestions: [
      "Why is the period 2π/B rather than B itself, and what does doubling B do to the wave physically?",
      "How can you read the maximum and minimum values of the graph straight from A and D without plotting anything?",
      "Why must B be factored out of the argument before reading the phase shift, and what error results from skipping that step?",
      "How would you choose A, B, C, and D to model a real periodic quantity, like the hours of daylight across a year?",
    ],
  },
  congruence_proof: {
    explanation: [
      "Two figures are congruent when a sequence of rigid motions — translations, rotations, reflections — carries one exactly onto the other, forcing all matching sides and angles to be equal. For triangles you never need all six matches: the shortcut criteria SSS, SAS, ASA, and AAS each guarantee congruence from just three well-chosen pieces. A geometric proof is a chain of justified statements — every claim cites a given fact, a definition, or a previously proven result — so the conclusion inherits certainty from its premises.",
      "Build proofs from both ends at once: ask which criterion could finish the job (SAS needs two sides and the included angle), then hunt the diagram for free information — vertical angles, shared sides, midpoints, angles made by parallel lines. Once congruence is established, the principle that corresponding parts of congruent triangles are congruent (CPCTC) releases the remaining equalities. The misconception to bury is SSA: two sides and a non-included angle do NOT force congruence, because the free angle lets the third side swing into two different triangles. The included angle is what locks the shape.",
    ],
    example: {
      problem: "Segments AB and CD bisect each other at point M. Prove that triangle AMC is congruent to triangle BMD, and conclude that AC = BD.",
      steps: [
        "Plan before writing: both triangles meet at M, so aim for two sides and the included angle at M — an SAS setup.",
        "Since M bisects AB, the two halves are equal: AM = MB. Since M bisects CD, the same definition gives CM = MD.",
        "Angles AMC and BMD are vertical angles formed by the two crossing segments, so angle AMC = angle BMD — and in each triangle this angle sits between the two sides already matched.",
        "Two sides and the included angle of triangle AMC equal the corresponding parts of triangle BMD, so triangle AMC ≅ triangle BMD by SAS.",
        "By CPCTC, the corresponding sides AC and BD are equal. The rigid motion behind the proof is concrete: rotating triangle AMC by 180° about M lands it exactly on triangle BMD.",
      ],
      answer: "Triangle AMC ≅ triangle BMD by SAS, and therefore AC = BD by CPCTC.",
    },
    selfQuestions: [
      "Why does SAS guarantee congruence while SSA fails, and what picture exposes the failure?",
      "How does the rigid-motion definition of congruence explain why corresponding parts must match once congruence is proven?",
      "What free pieces of information do geometric diagrams routinely hide, and how do you train yourself to notice them?",
      "How do you choose which congruence criterion to aim for before writing the first statement of a proof?",
    ],
  },
  similarity_transformations: {
    explanation: [
      "Similar figures share a shape but not necessarily a size: one is the image of the other under a dilation — a uniform scaling from a center point — possibly combined with rigid motions. All corresponding angles are equal and all corresponding sides share one scale factor k. For triangles, the angle–angle (AA) criterion does the heavy lifting: two matching angles force the third to match, since a triangle's angles always total 180°, so the triangles must be scaled copies. Similarity powers indirect measurement, maps, and the very definition of the trigonometric ratios.",
      "Working a similarity problem is disciplined bookkeeping: establish similarity (usually by AA), write the correspondence of vertices in order, then set up ratios between whole corresponding sides. The notorious trap appears when a line parallel to one side cuts across a triangle: the small triangle's side must be compared with the large triangle's WHOLE side, never with the leftover piece. Remember also that areas scale by k², not k — doubling every length quadruples the area — so a scale factor must be squared before it touches an area.",
    ],
    example: {
      problem: "In triangle ABC, point D lies on side AB and point E lies on side AC, with DE parallel to BC. Given AD = 6, DB = 4, and DE = 9, find BC.",
      steps: [
        "Establish similarity: DE parallel to BC makes angle ADE equal to angle ABC (corresponding angles), and angle A is shared, so triangle ADE is similar to triangle ABC by AA.",
        "Find the scale factor from whole corresponding sides measured from vertex A: AD/AB = 6/(6 + 4) = 6/10 = 3/5. Using AD/DB = 6/4 here is the classic error — DB is a leftover piece, not a side of either triangle.",
        "Apply the ratio to the wanted pair: DE/BC = 3/5, so BC = 9 × 5/3 = 15.",
        "Verify the proportion: 9/15 reduces to 3/5, matching 6/10 — the small triangle really is a 3/5-scale copy of the large one.",
      ],
      answer: "BC = 15, because triangle ADE is a 3/5-scale copy of triangle ABC.",
    },
    selfQuestions: [
      "Why do two matching angles force triangles to be similar, while two matching sides alone force nothing at all?",
      "What distinguishes the ratio AD/AB from AD/DB in the parallel-line setup, and why does only one belong in the similarity proportion?",
      "If the scale factor between two similar figures is 3, what happens to their perimeters and their areas, and why do the two answers differ?",
      "How does similarity justify defining sine and cosine as ratios that depend only on the angle, never on the triangle's size?",
    ],
  },
  circles: {
    explanation: [
      "A circle is the set of all points at a fixed distance — the radius — from a center, and that single constraint generates a surprising web of theorems about chords, tangents, arcs, and angles. The headline result is the inscribed angle theorem: an angle whose vertex sits on the circle measures exactly half the central angle intercepting the same arc. Arc length and sector area follow from proportional reasoning you already own — an arc's fraction of the whole circle equals its central angle's fraction of 360°.",
      "Approach circle problems by asking where each angle's vertex sits: at the center (the angle equals its arc), on the circle (half its arc), or at a point of tangency (a radius meets a tangent at 90°). For lengths and areas, form the fraction angle/360° and multiply by the circumference 2πr or the area πr². The common slip is treating an inscribed angle as equal to its central angle; the inscribed vertex sits farther from the arc, and its angle is exactly half — forgetting the halving doubles every downstream answer.",
    ],
    example: {
      problem: "Points A, B, and C lie on a circle with center O and radius 9 cm, and the central angle AOB measures 100°. Find the inscribed angle ACB, the length of minor arc AB, and the area of sector AOB, giving lengths and areas exactly and to one decimal place.",
      steps: [
        "Angle ACB is inscribed and intercepts the same arc AB as the central angle, so it measures half of 100°, which is 50°.",
        "Arc AB takes up 100/360 = 5/18 of the circle. The full circumference is 2π × 9 = 18π cm, so the arc length is (5/18) × 18π = 5π ≈ 15.7 cm.",
        "The sector uses the same fraction of the full area π × 9² = 81π cm²: area = (5/18) × 81π = 22.5π ≈ 70.7 cm².",
        "Sanity-check with a quarter circle: 90° would give an arc of 4.5π ≈ 14.1 cm and a sector of 20.25π ≈ 63.6 cm², and both answers for 100° sit slightly above those values, as they should.",
      ],
      answer: "Angle ACB = 50°, arc AB = 5π ≈ 15.7 cm, and sector AOB has area 22.5π ≈ 70.7 cm².",
    },
    selfQuestions: [
      "Why is an inscribed angle exactly half its central angle, and what special case appears when the inscribed angle intercepts a semicircle?",
      "How does the single fraction angle/360° unify arc length and sector area into one idea?",
      "Why must a tangent line be perpendicular to the radius drawn to the point of tangency?",
      "How would the arc length and sector area change if the radius doubled while the central angle stayed at 100°?",
    ],
  },
  conic_sections: {
    explanation: [
      "Slice a double cone with a plane and the cut edge traces a circle, ellipse, parabola, or hyperbola — the conic sections. Algebraically they are graphs of second-degree equations in x and y, and each carries a defining distance property: an ellipse is the set of points whose distances to two foci have a constant sum, a hyperbola a constant difference, and a parabola equal distances to a focus and a line. These curves earn their keep in physics — orbits are ellipses, headlight reflectors are parabolas, and some navigation systems run on hyperbolas.",
      "Most problems hand you a scrambled equation and ask for the geometry hidden inside. The decoding tool is completing the square in x and y separately, which produces a standard form exposing the center, vertices, and foci. Classify the type early from the squared terms: both squares with same-sign coefficients give an ellipse (a circle when they are equal), opposite signs give a hyperbola, and a single squared variable gives a parabola. The frequent slip while completing the square: a constant added inside parentheses gets multiplied by the coefficient outside, so adding 9 inside 9(x² − 6x) really adds 81 to the equation, not 9.",
    ],
    example: {
      problem: "Identify the conic 9x² + 4y² − 54x + 8y + 49 = 0 and find its center, vertices, and foci.",
      steps: [
        "Both x² and y² appear with positive but unequal coefficients (9 and 4), so the curve is an ellipse. Group by variable: 9(x² − 6x) + 4(y² + 2y) + 49 = 0.",
        "Complete each square, compensating for the outside coefficients: 9(x² − 6x + 9) − 81 + 4(y² + 2y + 1) − 4 + 49 = 0, since the 9 inside the first group is worth 9 × 9 = 81 and the 1 inside the second is worth 4.",
        "Combine constants (−81 − 4 + 49 = −36) and move them across: 9(x − 3)² + 4(y + 1)² = 36. Dividing by 36 gives the standard form (x − 3)²/4 + (y + 1)²/9 = 1.",
        "The larger denominator, 9, sits under the y-term, so the major axis is vertical: center (3, −1), a = 3, b = 2, and the vertices lie 3 above and below the center at (3, 2) and (3, −4).",
        "Locate the foci on the major axis with c² = a² − b² = 9 − 4 = 5: c = √5 ≈ 2.24, so the foci are (3, −1 + √5) and (3, −1 − √5), safely inside the vertices as foci must be.",
      ],
      answer: "An ellipse centered at (3, −1) with a vertical major axis: vertices (3, 2) and (3, −4), foci (3, −1 + √5) and (3, −1 − √5).",
    },
    selfQuestions: [
      "How can you classify a conic from the signs and presence of its squared terms before completing any squares?",
      "Why does adding a constant inside 9(x² − 6x) change the equation by nine times that constant, and how do you compensate correctly?",
      "What happens to an ellipse as its two foci slide together into a single point?",
      "Why do ellipses use c² = a² − b² while hyperbolas use c² = a² + b², and what does the sign difference say about where the foci sit?",
    ],
  },
  analytic_geometry: {
    explanation: [
      "Coordinate geometry lets algebra prove geometric claims: place a figure on the plane and every property becomes a computation. Three formulas do most of the work, and each flows from ideas you already hold — the distance formula √((x₂ − x₁)² + (y₂ − y₁)²) is the Pythagorean theorem dressed in coordinates, the midpoint formula averages the coordinates, and slope measures direction, with parallel lines sharing slopes and perpendicular lines having slopes that multiply to −1. Claims like 'this triangle is right-angled' become checkable arithmetic.",
      "A coordinate proof has a rhythm: compute the relevant distances or slopes, compare them, and translate the comparison back into geometric language. Two independent routes to the same conclusion — verifying a right angle both by perpendicular slopes and by the Pythagorean converse — turn a calculation into a convincing argument. The misconception to evict is that opposite slopes mean perpendicular lines; the true test is opposite RECIPROCALS, like 4/3 and −3/4, whose product is −1. Slopes of 2 and −2 are merely mirror-steep, not perpendicular.",
    ],
    example: {
      problem: "Triangle PQR has vertices P(1, 1), Q(4, 5), and R(8, 2). Show that it is an isosceles right triangle and find its area.",
      steps: [
        "Compute the three side lengths with the distance formula: PQ = √((4 − 1)² + (5 − 1)²) = √(9 + 16) = 5, QR = √((8 − 4)² + (2 − 5)²) = √(16 + 9) = 5, and PR = √((8 − 1)² + (2 − 1)²) = √(49 + 1) = √50.",
        "Two equal sides (PQ = QR = 5) make the triangle isosceles. For the right angle, test the Pythagorean converse: PQ² + QR² = 25 + 25 = 50 = PR², so the angle between PQ and QR — the angle at Q — is right.",
        "Confirm by slopes as an independent route: slope of PQ = (5 − 1)/(4 − 1) = 4/3 and slope of QR = (2 − 5)/(8 − 4) = −3/4. Their product is −1, so the segments are perpendicular at Q.",
        "The two legs are the perpendicular sides, so area = (1/2) × 5 × 5 = 12.5 square units. As a final plausibility check, the hypotenuse √50 ≈ 7.07 is indeed the longest side.",
      ],
      answer: "Triangle PQR is an isosceles right triangle with its right angle at Q, and its area is 12.5 square units.",
    },
    selfQuestions: [
      "How is the distance formula the Pythagorean theorem wearing coordinates, and which right triangle does it secretly draw?",
      "Why does the product of the slopes of perpendicular lines equal −1, and where does that rule break down for vertical lines?",
      "What is gained by verifying the right angle through two different methods within one coordinate proof?",
      "How would you choose convenient coordinates to prove a general fact, such as the diagonals of a rectangle being equal?",
    ],
  },
  solid_geometry: {
    explanation: [
      "Three-dimensional measurement extends area thinking by one dimension: prisms and cylinders obey volume = base area × height because they are a base stacked straight upward; pyramids and cones hold exactly one third of the matching prism or cylinder; and a sphere of radius r encloses (4/3)πr³. Surface area, by contrast, stays two-dimensional — it unrolls a solid into flat or curved pieces and totals them. Real objects are usually composites — a silo is a cylinder wearing a hemispherical cap — so the key skill is decomposing a solid into pieces with known formulas.",
      "Keep volume and surface area in separate mental drawers: volume measures filling, carries cubic units, and scales by k³ under a length scale factor k, while surface area measures wrapping, carries square units, and scales by k². The frequent error with composites is double-counting hidden faces — where a hemisphere sits on a cylinder, neither the flat disk of the cap nor the cylinder's top belongs in the surface area, since both are interior. Volumes of pieces, though, simply add. Rough bounds catch most slips: a capped silo must hold more than its bare cylinder but less than a full-height cylinder.",
    ],
    example: {
      problem: "A grain silo consists of a cylinder of radius 4 m and height 10 m topped by a hemisphere of the same radius. Find the silo's total volume, exactly and to the nearest cubic meter.",
      steps: [
        "Decompose the solid into a cylinder and a hemisphere sharing radius 4 m. The cylinder's volume is πr²h = π × 4² × 10 = 160π m³.",
        "A full sphere of radius 4 holds (4/3)π × 4³ = 256π/3 m³, so the hemisphere holds half of that: 128π/3 m³.",
        "Add the pieces over a common denominator: 160π = 480π/3, so the total is 480π/3 + 128π/3 = 608π/3 m³.",
        "Convert to a decimal: 608π/3 ≈ 636.7, so the silo holds about 637 m³.",
        "Bound-check the result: a full 14 m cylinder would hold 224π ≈ 703.7 m³ and the bare 10 m cylinder holds 160π ≈ 502.7 m³; the answer lands between them, exactly where a dome-capped silo should.",
      ],
      answer: "The silo's volume is 608π/3 m³, approximately 637 m³.",
    },
    selfQuestions: [
      "Why does a cone hold exactly one third of the cylinder with the same base and height, and how could you demonstrate that with sand or water?",
      "Which surfaces vanish when two solids are joined into a composite, and how do you keep them out of a surface-area total?",
      "If every length of a solid is scaled by 3, what happens to its surface area and its volume, and why do the two answers differ?",
      "When a problem wants both an exact answer in π and a decimal, at which point should the rounding happen, and what goes wrong if you round early?",
    ],
  },
  vectors_intro: {
    explanation: [
      "A vector packages magnitude and direction into a single object — a displacement of 6 km northeast is a vector, while the bare 6 km is a scalar. In coordinates, a vector is written by components, like v = (4, 1), recording movement along each axis; addition stacks displacements tip-to-tail by adding components, and multiplying by a scalar stretches or flips the vector. Magnitude comes from the Pythagorean theorem, |v| = √(x² + y²), and direction from trigonometry — vectors are where your coordinate, triangle, and slope skills converge.",
      "Translate every vector problem into components, compute there, and convert back to magnitude-and-direction only at the end; components turn geometry into arithmetic. The central misconception is adding magnitudes: walking 4 km and then 3 km does NOT generally leave you 7 km from the start — only perfectly aligned legs add lengths, and perpendicular legs give √(4² + 3²) = 5 km. Magnitudes obey the triangle inequality, not simple addition. When reporting a direction, anchor it to a stated reference, such as an angle north of east, so the answer cannot be misread.",
    ],
    example: {
      problem: "A hiker's morning leg is the displacement (4, 1) km — 4 km east and 1 km north — and the afternoon leg is (2, 5) km. Find the total displacement, its magnitude, and its direction as an angle north of east.",
      steps: [
        "Add the legs componentwise: total = (4 + 2, 1 + 5) = (6, 6) km, meaning the hiker ends 6 km east and 6 km north of the start.",
        "Magnitude by the Pythagorean theorem: |total| = √(6² + 6²) = √72 = 6√2 ≈ 8.49 km.",
        "Direction from the components: tan θ = north/east = 6/6 = 1, so θ = tan⁻¹(1) = 45° north of east.",
        "Contrast displacement with distance walked: the legs measure √(16 + 1) = √17 ≈ 4.12 km and √(4 + 25) = √29 ≈ 5.39 km, totaling about 9.51 km of walking — more than the 8.49 km displacement, exactly as the triangle inequality demands.",
      ],
      answer: "The total displacement is (6, 6) km: magnitude 6√2 ≈ 8.49 km, directed 45° north of east.",
    },
    selfQuestions: [
      "Why does adding vectors componentwise agree with the tip-to-tail picture of stacking displacements?",
      "Under what condition does the magnitude of a sum equal the sum of the magnitudes, and what does the triangle inequality say in every other case?",
      "How do scalars and vectors differ in the information they carry, and which everyday quantities belong to each kind?",
      "What does multiplying a vector by −2 do to its magnitude and its direction, and why?",
    ],
  },
  matrices_intro: {
    explanation: [
      "A matrix is a rectangular grid of numbers treated as one object — rows by columns, so a 2×2 matrix holds four entries. Matrices organize linear information: the coefficients of a system of equations, a transformation of the plane, or the connections in a network. Addition and scalar multiplication work entry by entry, just as you would guess; the genuinely new operation is matrix multiplication, whose row-times-column rule is engineered so that multiplying matrices composes the transformations or substitutions they represent.",
      "To multiply, run along a row of the left matrix and down a column of the right, multiplying the pairs and summing: the entry in row i, column j of the product comes from row i of the left and column j of the right. The sizes must cooperate — the left matrix needs as many columns as the right has rows. The misconception that costs the most points is assuming AB = BA; matrix multiplication is not commutative, and swapping the order usually changes every entry. For a 2×2 matrix, the determinant ad − bc is the quick invertibility test: zero means the matrix flattens the plane and cannot be undone.",
    ],
    example: {
      problem: "Let A be the 2×2 matrix with rows (2, 1) and (3, 4), and let B be the 2×2 matrix with rows (1, −2) and (0, 5). Compute AB and BA, and find the determinant of A.",
      steps: [
        "Each entry of AB is a row of A times a column of B. Top row of AB: 2 × 1 + 1 × 0 = 2, then 2 × (−2) + 1 × 5 = −4 + 5 = 1.",
        "Bottom row of AB: 3 × 1 + 4 × 0 = 3, then 3 × (−2) + 4 × 5 = −6 + 20 = 14. So AB has rows (2, 1) and (3, 14).",
        "For BA the roles reverse, rows now coming from B: 1 × 2 + (−2) × 3 = −4 and 1 × 1 + (−2) × 4 = −7 give the top row, while 0 × 2 + 5 × 3 = 15 and 0 × 1 + 5 × 4 = 20 give the bottom. BA has rows (−4, −7) and (15, 20).",
        "Compare: AB and BA disagree in every entry — a vivid reminder that order matters in matrix multiplication.",
        "Determinant of A: ad − bc = 2 × 4 − 1 × 3 = 8 − 3 = 5. Nonzero, so A is invertible and the system it represents has exactly one solution.",
      ],
      answer: "AB has rows (2, 1) and (3, 14); BA has rows (−4, −7) and (15, 20); det A = 5, so A is invertible.",
    },
    selfQuestions: [
      "Why is matrix multiplication defined by the row-times-column rule instead of multiplying matching entries?",
      "What does a determinant of zero mean about the system of equations or the transformation a matrix represents?",
      "How does writing a linear system as a single matrix equation change the way you think about solving it?",
      "Why does the order of multiplication matter for matrices when it never matters for ordinary numbers?",
    ],
  },
  probability_combinatorics: {
    explanation: [
      "Counting is the engine of probability: when outcomes are equally likely, a probability is favorable outcomes over total outcomes, and both counts often demand combinatorics. The multiplication principle starts everything — a sequence of choices multiplies the number of options at each stage. Permutations count ordered arrangements; combinations count unordered selections, with C(n, k) = n!/(k!(n − k)!) ways to choose k items from n when order is irrelevant. The addition rule P(A or B) = P(A) + P(B) − P(A and B) and the complement rule P(not A) = 1 − P(A) round out the toolkit.",
      "Ask one decisive question before any count: does order matter? Choosing a committee is a combination — the same four people in any order form the same committee — while electing a president and a treasurer is a permutation. For multi-condition counts, count each requirement separately and multiply. The misconception to dismantle is that 'or' always means plain addition; when events overlap, the outcomes in both get counted twice, and subtracting the overlap repairs the total. And when a problem says at least one, the complement is almost always the shorter road.",
    ],
    example: {
      problem: "A club has 6 women and 5 men. A committee of 4 people is chosen at random. What is the probability that the committee contains exactly 2 women and 2 men?",
      steps: [
        "Committees are unordered, so count with combinations. Total possible committees: C(11, 4) = (11 × 10 × 9 × 8)/(4 × 3 × 2 × 1) = 7920/24 = 330.",
        "Count the favorable committees in two stages: choose 2 women from 6 in C(6, 2) = 15 ways, and choose 2 men from 5 in C(5, 2) = 10 ways.",
        "By the multiplication principle, any pair of women can join any pair of men, so the favorable count is 15 × 10 = 150.",
        "Divide: P(exactly 2 women) = 150/330 = 5/11 ≈ 0.455. Plausibility: a 2–2 split is the most balanced outcome from a nearly even club, so it should be the likeliest single split yet still well below certainty — and 5/11 fits that profile.",
      ],
      answer: "The probability of exactly 2 women and 2 men is 5/11, about 0.455.",
    },
    selfQuestions: [
      "How do you decide whether a counting problem needs permutations or combinations, and what changes in the resulting formula?",
      "Why does the multiplication principle justify counting the women and the men separately and then multiplying?",
      "Why does P(A or B) require subtracting P(A and B), and in which situations can that subtraction be skipped safely?",
      "How would the complement rule shorten a question asking for the probability of at least one woman on the committee?",
    ],
  },
  conditional_probability: {
    explanation: [
      "Conditional probability measures chance under partial information: P(A | B), read as the probability of A given B, is the chance of A once you know B happened. The definition P(A | B) = P(A and B)/P(B) is a renormalization — B becomes the new universe, and you ask what fraction of it also contains A. Independence gains a precise meaning here: A and B are independent exactly when P(A | B) = P(A), so learning B changes nothing. Medical testing, spam filtering, and risk assessment all live on this idea.",
      "Tree diagrams and two-way tables make conditioning mechanical: multiply along a branch for an and-probability, add branches for a total, then divide to condition. The misconception with real-world consequences is confusing P(A | B) with P(B | A) — the probability of a positive test given disease is not the probability of disease given a positive test, and the two can differ wildly when the condition is rare. Always ask which event is known and which is in question; the known one goes behind the bar.",
    ],
    example: {
      problem: "At a school, 60% of students play a sport. Among athletes, 30% also play an instrument; among non-athletes, 50% play an instrument. A randomly chosen student plays an instrument. What is the probability that this student plays a sport?",
      steps: [
        "Build the two branches that lead to an instrument player: P(sport and instrument) = 0.60 × 0.30 = 0.18, and P(no sport and instrument) = 0.40 × 0.50 = 0.20.",
        "Total the instrument players across both branches: P(instrument) = 0.18 + 0.20 = 0.38, so 38% of the school plays an instrument.",
        "Condition on what is known: P(sport | instrument) = P(sport and instrument)/P(instrument) = 0.18/0.38 = 9/19 ≈ 0.474.",
        "Interpret the shift: although 60% of all students are athletes, an instrument player is slightly more likely to be a non-athlete (10/19), because non-athletes take up instruments at a higher rate — the new information genuinely moved the odds.",
      ],
      answer: "P(plays a sport | plays an instrument) = 9/19, about 0.47.",
    },
    selfQuestions: [
      "Why does dividing by P(B) correctly rescale probabilities once B becomes the new universe of possibilities?",
      "How can P(A | B) and P(B | A) differ dramatically, and what real-world mistakes grow out of confusing them?",
      "What pattern would independence between two events create in a two-way table of counts?",
      "Why did learning that the student plays an instrument push the probability of being an athlete below the school-wide 60%?",
    ],
  },
  sampling_design: {
    explanation: [
      "Statistics can only be as trustworthy as the data collection behind it. A census measures everyone; a sample measures a part to estimate the whole, and the gold standard is random selection, which gives every member a known chance of inclusion and lets sample results generalize to the population. Designs differ in ambition: observational studies watch what happens on its own, while experiments impose treatments using random assignment — and only experiments support cause-and-effect claims, because randomization balances out the lurking variables that otherwise supply rival explanations.",
      "Bias is a systematic tilt that no amount of extra data can fix: convenience samples reach whoever is easiest, voluntary response samples attract the strongly opinionated, and leading wording nudges answers. Stratified sampling improves on simple randomness when the population has known subgroups — sampling each stratum in proportion guarantees every group its voice. The stubborn misconception is that a big sample cures bias; a million skewed responses just estimate the wrong number very precisely. Representativeness comes from HOW you select, never from how many you select.",
    ],
    example: {
      problem: "A principal wants to estimate average nightly homework time at a school of 1200 students: 400 ninth graders, 320 tenth, 280 eleventh, and 200 twelfth. Design a stratified random sample of 60 students proportional to grade size, and explain why it beats surveying 60 volunteers from the honor society.",
      steps: [
        "Compute each grade's share of the school and apply it to the sample of 60. Ninth grade: 400/1200 = 1/3 of the school, so 60 × 1/3 = 20 students.",
        "Repeat for the rest: tenth gets 320/1200 × 60 = 16, eleventh gets 280/1200 × 60 = 14, and twelfth gets 200/1200 × 60 = 10. Within each grade, draw the students at random from the full roster.",
        "Verify the design: 20 + 16 + 14 + 10 = 60, and each grade's share of the sample matches its share of the school, so no grade's homework habits can dominate by luck of the draw.",
        "Compare with the volunteer plan: honor society volunteers are a convenience sample with voluntary response on top — students who likely study more than average — so their mean would overestimate homework time no matter how carefully it were computed. Random selection, not sample size, is what earns generalization.",
      ],
      answer: "Randomly select 20, 16, 14, and 10 students from grades 9 through 12 respectively; the volunteer survey would be biased toward heavy studiers regardless of its size.",
    },
    selfQuestions: [
      "Why can random assignment in an experiment justify causal claims while even a careful observational study cannot?",
      "How does stratified sampling reduce the luck-of-the-draw imbalance that a simple random sample still allows?",
      "Why does enlarging a biased sample sharpen the estimate of the wrong value instead of fixing the bias?",
      "What sources of bias could still creep into a perfectly selected sample, and how might question wording be one of them?",
    ],
  },
  descriptive_statistics: {
    explanation: [
      "Descriptive statistics compresses a dataset into a few honest numbers and pictures: measures of center (mean, median), measures of spread (range, interquartile range, standard deviation), and the distribution's shape — symmetric, skewed, or studded with outliers. You have computed means and read plots before; the upgrade here is the standard deviation, the typical distance of data points from their mean, and the z-score, which counts how many standard deviations a value sits from the mean and puts scores from different scales on one comparable footing.",
      "Match the summary to the shape: the mean and standard deviation suit roughly symmetric data, but both chase outliers, so skewed data is served better by the median and IQR. To compute a sample standard deviation: find the mean, square each deviation from it, average the squares dividing by n − 1, and take the square root. The misconception to correct is that center tells the whole story — two classes can share a mean of 82 while one ranges from 80 to 84 and the other from 60 to 100, which are utterly different teaching situations. Spread is information, not noise.",
    ],
    example: {
      problem: "Five quiz scores are 72, 78, 81, 85, and 94. Find the mean, the sample standard deviation, and the z-score of the 94, then interpret the z-score.",
      steps: [
        "Mean: (72 + 78 + 81 + 85 + 94)/5 = 410/5 = 82.",
        "Deviations from the mean: −10, −4, −1, 3, and 12. They sum to zero, a built-in check that the mean is correct.",
        "Square and total the deviations: 100 + 16 + 1 + 9 + 144 = 270. Divide by n − 1 = 4 to get the sample variance: 270/4 = 67.5.",
        "Take the square root for the standard deviation: √67.5 ≈ 8.22, so scores typically sit about 8 points from the mean.",
        "z-score of the top score: (94 − 82)/8.22 ≈ 1.46, meaning the 94 lies about one and a half standard deviations above the mean — strong, but not an extreme outlier.",
      ],
      answer: "Mean 82, sample standard deviation about 8.22, and the 94 has z ≈ 1.46 — roughly 1.5 standard deviations above average.",
    },
    selfQuestions: [
      "Why do deviations from the mean always sum to zero, and how does that fact force the squaring step in the variance?",
      "When would the median and IQR describe a dataset more honestly than the mean and standard deviation?",
      "What comparisons does a z-score make possible that raw scores cannot, and what assumptions hide inside such comparisons?",
      "How would adding a single score of 40 to this dataset change the mean, the median, and the standard deviation differently?",
    ],
  },
  inference_regression_intro: {
    explanation: [
      "Inference asks what a sample can responsibly say about a population, and regression asks how one quantity changes with another. The least-squares line ŷ = a + bx is the line minimizing the squared vertical misses, called residuals, between data and predictions; the correlation coefficient r, trapped between −1 and 1, grades the strength and direction of a linear relationship, and r² reports the fraction of variation in y that the line accounts for. Both topics share one discipline: every conclusion ships with uncertainty attached, never as bare fact.",
      "Tidy relationships connect the regression pieces: the slope is b = r × (sy/sx), where sx and sy are the standard deviations of the two variables, and the line always passes through the point of means (x̄, ȳ), so the intercept is a = ȳ − b × x̄. A residual — observed minus predicted — measures how far a real point falls from the line. The misconception headlines are built on: correlation is not causation, since ice cream sales and drowning rates rise together through summer heat, not through each other. And predicting far outside the data's x-range, called extrapolation, is fiction dressed as arithmetic.",
    ],
    example: {
      problem: "For 20 students, hours studied (x) and exam score (y) have x̄ = 4, sx = 2, ȳ = 70, sy = 5, and correlation r = 0.8. Find the least-squares line, predict the score for 7 hours of study, and find the residual for a student who studied 7 hours and scored 80.",
      steps: [
        "Slope first: b = r × sy/sx = 0.8 × 5/2 = 2, so each extra hour of study is associated with about 2 more exam points.",
        "The line passes through the point of means (4, 70), so the intercept is a = 70 − 2 × 4 = 62, and the line is ŷ = 62 + 2x.",
        "Predict at x = 7: ŷ = 62 + 2 × 7 = 76 points.",
        "The residual is observed minus predicted: 80 − 76 = 4, so this student outperformed the line's prediction by 4 points.",
        "Frame the strength honestly: r² = 0.64 means study hours account for 64% of score variation, leaving 36% to everything else — and since hours were not randomly assigned, associated with is the only defensible verb.",
      ],
      answer: "The line is ŷ = 62 + 2x; the prediction at 7 hours is 76 points, and the student's residual is +4 points.",
    },
    selfQuestions: [
      "Why does the least-squares method minimize squared vertical distances rather than plain or horizontal ones?",
      "What does r² = 0.64 tell you, and what does it leave completely unsaid about the remaining 36%?",
      "Why is predicting the score for 15 hours of study dangerous here, even though the formula happily produces a number?",
      "What change to this study's design would let it support a causal claim about studying and scores?",
    ],
  },
  limits_intro: {
    explanation: [
      "A limit describes where a function's outputs are heading as the input approaches a target — whether or not the function ever arrives there. Writing that the limit of f(x) as x approaches 4 equals 1/6 claims f(x) gets arbitrarily close to 1/6 as x closes in on 4 from both sides. This is the gateway idea of calculus: the slope of a curve at a point and the exact area under a curve are both defined as limits. Crucially, a limit cares only about the approach, never about the value at the target itself, which may be different or missing entirely.",
      "Many limits yield to direct substitution, but the interesting ones land on 0/0 — an indeterminate form, meaning the form alone decides nothing and the expression must be rewritten. Factoring and canceling, or multiplying by a conjugate when square roots appear, removes the shared factor that causes the 0/0 and exposes the true limiting value. The misconception to abandon: 0/0 is not 0, not 1, and not automatically undefined — different functions wearing the 0/0 form approach genuinely different limits, which is exactly why the algebra has to dig deeper.",
    ],
    example: {
      problem: "Evaluate the limit of (√(x + 5) − 3)/(x − 4) as x approaches 4, and support the answer numerically.",
      steps: [
        "Try substitution first: at x = 4 the numerator is √9 − 3 = 0 and the denominator is 0 — the indeterminate form 0/0, a signal to rewrite rather than quit.",
        "Multiply the numerator and denominator by the conjugate √(x + 5) + 3. The numerator becomes (x + 5) − 9 = x − 4, by the difference-of-squares pattern (p − q)(p + q) = p² − q².",
        "The expression is now (x − 4)/((x − 4)(√(x + 5) + 3)). For x ≠ 4 the common factor cancels, leaving 1/(√(x + 5) + 3) — legal because the limit ignores the point x = 4 itself.",
        "Substitute into the simplified form: 1/(√9 + 3) = 1/6 ≈ 0.1667.",
        "Numerical support from both sides: at x = 4.01 the original expression evaluates to about 0.16662, and at x = 3.99 to about 0.16672 — both closing in on 1/6.",
      ],
      answer: "The limit is 1/6, approximately 0.1667.",
    },
    selfQuestions: [
      "Why is 0/0 called indeterminate rather than undefined, and what does that distinction tell you to do next?",
      "How can a function have a limit at a point where it is not even defined?",
      "Why is canceling the factor x − 4 legitimate inside a limit when the cancellation changes the function at that one point?",
      "How do one-sided limits sharpen the picture when a function behaves differently on the two sides of a point?",
    ],
  },
};

