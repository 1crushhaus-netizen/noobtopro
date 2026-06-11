// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — MATH · MIDDLE.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  ratios_unit_rates: {
    explanation: [
      "A ratio compares two quantities by division instead of subtraction: 12 bars for $9 is the relationship '12 to 9', not 'three more bars than dollars'. You already know how to divide and how to read fractions, and that is the whole engine here — a ratio is a fraction wearing work clothes. A unit rate pushes the comparison down to 'per one': dollars per bar, kilometers per hour, points per game. Once everything is per one, totally different offers become directly comparable.",
      "The reliable mental move is: divide to find the per-one amount, then compare per-one amounts. The classic trap is additive thinking — believing that 2 cups of juice to 3 cups of soda is the same mix as 4 to 5 because you added 2 to both. Ratios scale by multiplying, not by adding: 2 to 3 matches 4 to 6. When two ratios are in question, ask what each one looks like per single unit and let those numbers settle the argument.",
    ],
    example: {
      problem: "A 12-pack of granola bars costs $9.00 and a 20-pack of the same bars costs $14.00. Which pack is the better deal per bar?",
      steps: [
        "Find the unit price of the 12-pack by dividing cost by count: 9 ÷ 12 = 0.75, so each bar costs $0.75.",
        "Do the same for the 20-pack: 14 ÷ 20 = 0.70, so each bar costs $0.70 there.",
        "Compare the per-one prices: $0.70 is less than $0.75, so the 20-pack is cheaper per bar by 5 cents.",
        "Sanity-check it: at the 12-pack rate of $0.75 per bar, 20 bars would cost 0.75 × 20 = $15, but the 20-pack actually charges $14 — so the bigger pack really does undercut it.",
      ],
      answer: "The 20-pack is the better deal at $0.70 per bar, compared with $0.75 per bar for the 12-pack.",
    },
    selfQuestions: [
      "Why does dividing, rather than subtracting, tell you which of two deals is better?",
      "When might the pack with the worse unit price still be the smarter purchase in real life?",
      "How would the comparison change if you computed bars per dollar instead of dollars per bar — would the better deal flip?",
      "Two ratios look different, like 6 to 9 and 10 to 15 — what test decides whether they describe the same relationship?",
    ],
  },
  proportional_relationships: {
    explanation: [
      "Two quantities are proportional when one is always the same multiple of the other: double one and the other doubles, triple one and the other triples. You already know how to multiply, divide, and scale fractions, so the new idea is just naming that constant multiplier — the constant of proportionality, usually written k. If pages printed and minutes are proportional with k = 15, then pages = 15 × minutes, every single time, with no exceptions and no leftover amount.",
      "Think of a proportional relationship as a perfectly fair vending machine: zero in, zero out, and every extra unit in buys exactly the same amount out. On a graph that means a straight line through the origin. The common trap is calling every increasing relationship proportional. A gym that charges a $20 signup fee plus $5 per visit is linear but not proportional — at zero visits you still owe $20, so doubling visits does not double cost. Always check the zero point and the constant multiple.",
    ],
    example: {
      problem: "A school printer prints 45 pages in 3 minutes at a steady rate. Write an equation relating pages p to minutes t, and find how long it takes to print 120 pages.",
      steps: [
        "Find the constant of proportionality first: 45 pages ÷ 3 minutes = 15 pages per minute, so k = 15.",
        "Write the relationship as an equation: p = 15t, meaning every minute adds exactly 15 pages starting from zero.",
        "To find the time for 120 pages, solve 120 = 15t by dividing both sides by 15: t = 120 ÷ 15 = 8 minutes.",
        "Check that the answer fits the original rate: in 8 minutes at 15 pages per minute the printer produces 8 × 15 = 120 pages, exactly what was asked.",
      ],
      answer: "The equation is p = 15t, and printing 120 pages takes 8 minutes.",
    },
    selfQuestions: [
      "How can you tell from a table of values whether a relationship is proportional without graphing it?",
      "Why does a flat starting fee break proportionality even though the cost still rises at a steady rate?",
      "What does the constant of proportionality mean in everyday words for a situation you choose, like recipes or downloads?",
      "If a graph is a straight line that misses the origin, what kind of relationship is it, and what real situations behave that way?",
    ],
  },
  percentages: {
    explanation: [
      "A percentage is a fraction with a fixed denominator of 100 — 45% literally means 45 out of every 100. That fixed base is what makes percentages so useful: prices, test scores, and battery levels all become comparable because they are rescaled onto the same 0-to-100 ruler. You already know most of this from fractions and decimals: 45% = 45/100 = 0.45, the same number in three outfits.",
      "The reliable move is to convert to a decimal and multiply: 30% of 250 is 0.30 × 250 = 75. The most common trap is treating a percentage like a fixed amount. A 10% rise followed by a 10% drop does not return you to the start, because the second 10% is taken of a different, larger number. Whenever a percentage appears, ask: a percentage of what?",
    ],
    example: {
      problem: "A jacket costs $80. The store raises the price by 25%, and a month later puts the new price on sale at 25% off. What is the final price?",
      steps: [
        "Find the raised price first: 25% of $80 is 0.25 × 80 = $20, so the new price is 80 + 20 = $100.",
        "The discount applies to the NEW price, not the original: 25% of $100 is 0.25 × 100 = $25.",
        "Subtract the discount from the raised price: 100 − 25 = $75.",
        "Sanity-check the surprise: the final price sits below the original $80 because the 25% increase was computed on 80 while the 25% decrease was computed on the larger 100 — equal percentages of different bases are different amounts.",
      ],
      answer: "The final price is $75 — lower than the original $80, because the two 25% changes acted on different bases.",
    },
    selfQuestions: [
      "Why does a 25% increase followed by a 25% decrease not cancel out — and would the order of the two changes matter?",
      "How would you explain to a friend that 45%, 0.45 and 45/100 are the same number?",
      "What happens when the 'whole' changes partway through a percentage problem, and how do you keep track of which base each percentage uses?",
      "If a quantity doubles, what percentage increase is that — and why is the answer not 200%?",
    ],
  },
  rational_number_operations: {
    explanation: [
      "Fractions, decimals, whole numbers, and all of their negatives belong to one family: the rational numbers, every number you can write as one integer over another. You already know how to add, subtract, and multiply fractions and how decimal place value works — the new challenge is letting signs ride along during those same operations. A temperature drop, a debt, or a depth below sea level is just a familiar number with a direction attached.",
      "A practical strategy is to pick one outfit and dress every number in it before combining: all decimals or all fractions, whichever divides cleanly. Then read each operation as movement — adding a positive moves right on the number line, adding a negative moves left, and subtracting a number is the same as adding its opposite. The classic trap is panicking at something like 6.2 − (−3): subtracting a negative removes a loss, which is a gain, so it lands you further right, at 9.2.",
    ],
    example: {
      problem: "A research submarine starts at −15.5 m relative to the surface, dives another 8 3/4 m to film a reef, then rises 6.2 m to follow a turtle. What is its final position?",
      steps: [
        "Get every number into the same form first: 8 3/4 = 8.75, so all three values are decimals and can be combined directly.",
        "Diving deeper means subtracting from the current position: −15.5 − 8.75 = −24.25 m after the dive.",
        "Rising means adding: −24.25 + 6.2 = −18.05 m, since moving up 6.2 brings the position closer to zero.",
        "Check with the net change: overall the sub moved −8.75 + 6.2 = −2.55 m from its start, and −15.5 − 2.55 = −18.05 m, which matches.",
      ],
      answer: "The submarine ends at −18.05 m, which is 18.05 m below the surface.",
    },
    selfQuestions: [
      "Why is subtracting a negative number the same as adding a positive one — can you justify it with money or temperature?",
      "When would you rather convert everything to fractions instead of decimals, and what kind of numbers force that choice?",
      "How does the number line help you predict the sign of an answer before you compute anything?",
      "What changes about the rules you already knew for fractions when negative signs are attached to them?",
    ],
  },
  negative_numbers: {
    explanation: [
      "Zero is not a wall — the number line keeps going to the left, and the numbers there carry a minus sign: −1, −2, −3, and everything between. You already know addition, subtraction, and how to place numbers on a line, and negatives reuse all of it. They show up wherever a quantity has two natural directions: temperatures below freezing, floors below ground level, money owed instead of owned, yards lost instead of gained.",
      "Read every calculation as motion: adding moves you right, subtracting moves you left, and a negative sign flips the direction of the move. The widespread trap is ranking negatives by their digits, deciding −10 must beat −3 because 10 beats 3. It is the reverse: −10 sits farther left, so −10 < −3 — a debt of $10 leaves you worse off than a debt of $3. When comparing, picture positions, not digits.",
    ],
    example: {
      problem: "At dawn the temperature is −7 °C. By mid-afternoon it has risen 12 °C, and after sunset it falls 15 °C from the afternoon reading. What is the night temperature, and is it colder than dawn?",
      steps: [
        "Start at −7 on the number line and move 12 to the right for the afternoon rise: −7 + 12 = 5 °C.",
        "From 5, the evening fall moves 15 to the left: 5 − 15 = −10 °C, crossing zero along the way.",
        "Compare the two below-zero readings by position: −10 lies farther left than −7, so −10 < −7 and the night is colder than dawn.",
        "Sanity-check the day as one trip: the net change was +12 − 15 = −3, and −7 − 3 = −10 °C, which agrees.",
      ],
      answer: "The night temperature is −10 °C, which is 3 degrees colder than the −7 °C dawn.",
    },
    selfQuestions: [
      "Why is −10 smaller than −3 even though 10 is bigger than 3, and how would you convince a skeptical friend?",
      "What real situations would lose meaning if negative numbers did not exist — what would we have to say instead?",
      "How does picturing motion on a number line predict whether an answer lands above or below zero?",
      "What is the relationship between a number and its opposite, and where do the two always sit on the line?",
    ],
  },
  absolute_value: {
    explanation: [
      "Absolute value answers one question: how far is this number from zero? Distance has no direction, so |−48| and |48| are both 48. You already know how the number line stretches in both directions, and absolute value simply measures the length of the walk back to zero, ignoring which side you started on. It matters whenever size counts more than sign — how big an error is, how extreme a temperature is, how far below sea level something sits.",
      "The trap is treating absolute value as a button that 'makes things positive' inside any expression. It is really a measurement taken after you know the number: |3 − 8| means find 3 − 8 = −5 first, then take its distance from zero, 5. That same idea gives a beautiful tool: the distance between any two numbers a and b is |a − b|, no matter their signs. Comparing |−48| with |35| compares sizes while a plain comparison of −48 with 35 compares positions.",
    ],
    example: {
      problem: "A delivery drone hovers 35 m above sea level while a submarine sits at −48 m. Which one is farther from sea level, and how far apart are they vertically?",
      steps: [
        "Distance from sea level is an absolute value: the drone is |35| = 35 m away and the submarine is |−48| = 48 m away.",
        "Compare the distances, not the raw numbers: 48 > 35, so the submarine is farther from sea level even though −48 < 35 as positions.",
        "The vertical gap between them is the distance between their positions: |35 − (−48)| = |35 + 48| = 83 m.",
        "Interpret why the distances add: the two are on opposite sides of sea level, so the gap is the drone's 35 m plus the submarine's 48 m.",
      ],
      answer: "The submarine is farther from sea level (48 m versus 35 m), and the two are 83 m apart vertically.",
    },
    selfQuestions: [
      "Why can an absolute value never be negative, and what would a negative distance even mean?",
      "How is comparing |−48| and |35| a different question from comparing −48 and 35?",
      "Why does |a − b| give the distance between a and b even when both numbers are negative?",
      "Where could blindly making every number positive lead you to a wrong answer in a multi-step problem?",
    ],
  },
  exponents: {
    explanation: [
      "An exponent is compressed multiplication: 3⁵ means 3 × 3 × 3 × 3 × 3, five copies of 3 multiplied together, just as multiplication once compressed repeated addition for you. The base tells you what to copy and the exponent tells you how many copies. This shorthand is how math handles things that grow by repeated doubling or tripling — chain messages, folded paper, populations — where amounts explode far faster than addition can describe.",
      "Every exponent rule falls out of counting copies: 3² × 3⁴ is two copies times four copies, six copies in all, so it equals 3⁶ — multiply same-base powers by adding exponents. The number-one trap is reading 3⁵ as 3 × 5 = 15, when it is actually 243; the exponent counts factors, it is not a factor itself. Also keep base and exponent straight: 2³ = 8 while 3² = 9, so the two jobs are not interchangeable.",
    ],
    example: {
      problem: "You send a funny video to 3 classmates. The next day, each person who received it that day sends it to 3 new people, and this repeats every day. How many new people receive the video on day 5?",
      steps: [
        "Track the first days to find the pattern: day 1 reaches 3 people, and day 2 reaches 3 × 3 = 9, since each of the 3 sends to 3 more.",
        "Each day multiplies the previous day's count by 3, so day n reaches 3^n people; day 5 is 3⁵.",
        "Build it up one factor at a time: 3² = 9, 3³ = 27, 3⁴ = 81, 3⁵ = 243.",
        "Contrast with the common misreading: 3 × 5 = 15 would be the count if 3 new people were added each day, but repeated multiplication reaches 243 — exponents grow far faster than addition.",
      ],
      answer: "On day 5 the video reaches 3⁵ = 243 new people.",
    },
    selfQuestions: [
      "Why does multiplying powers of the same base let you add the exponents — what is being counted?",
      "How would you explain the difference between 3 × 5 and 3⁵ to someone meeting exponents for the first time?",
      "What should 3⁰ equal if the pattern of dividing by 3 as the exponent drops is to keep working?",
      "Where in real life does repeated multiplication beat repeated addition so dramatically, and why does that matter?",
    ],
  },
  scientific_notation: {
    explanation: [
      "Numbers in science get awkward fast — a red blood cell is about 0.000008 m wide, and the Sun is about 150000000 km away. Scientific notation rewrites any such number as a value between 1 and 10 times a power of ten: 8 × 10⁻⁶ and 1.5 × 10⁸. You already know place value and how multiplying by 10 slides the decimal point; the exponent simply records how many slides, with negative exponents meaning slides toward smaller.",
      "Treat the two parts separately and the arithmetic becomes light: to divide, divide the front numbers and subtract the exponents. One care point: the front must stay between 1 and 10, so a result like 0.25 × 10⁴ needs one more slide to become 2.5 × 10³. The trap to dodge is judging size by the front number alone — 9 × 10³ is far smaller than 2 × 10⁶, because the exponent, not the front, sets the scale.",
    ],
    example: {
      problem: "A red blood cell is about 8 × 10⁻⁶ m wide. About how many cells would fit side by side across a 2 cm scratch, which is 2 × 10⁻² m long?",
      steps: [
        "The number of cells is the scratch length divided by one cell width: (2 × 10⁻²) ÷ (8 × 10⁻⁶).",
        "Handle the parts separately: the fronts give 2 ÷ 8 = 0.25, and the powers of ten give 10⁻² ÷ 10⁻⁶ = 10 to the power −2 − (−6) = 10⁴.",
        "The raw result 0.25 × 10⁴ is not in proper form, since 0.25 is below 1; slide once to get 2.5 × 10³, which is 2500.",
        "Check by multiplying back: 2500 cells × 8 × 10⁻⁶ m = 20000 × 10⁻⁶ m = 2 × 10⁻² m, exactly the scratch length.",
      ],
      answer: "About 2.5 × 10³, or 2500, red blood cells would fit across the 2 cm scratch.",
    },
    selfQuestions: [
      "Why must the front number stay between 1 and 10, and what goes wrong with comparisons if it does not?",
      "How does a negative exponent on the 10 differ in meaning from a negative sign on the whole number?",
      "Why do the exponents subtract when you divide two powers of ten — what is happening to the factors?",
      "How would you quickly decide which of 7 × 10⁵ and 3 × 10⁶ is larger, and what is the general rule?",
    ],
  },
  irrational_numbers_intro: {
    explanation: [
      "Some lengths refuse to be fractions. The diagonal of a 1-by-1 square is √2, and no fraction of whole numbers, however clever, equals it exactly — its decimal runs forever without ever settling into a repeating pattern. Numbers like √2, √40, and π are called irrational, and together with the rationals you already know — fractions, decimals that end or repeat, and their negatives — they fill in the complete number line with no gaps.",
      "You cannot write an irrational number down exactly in decimal form, but you can trap it as tightly as you like between rationals, and that squeeze is the working skill. A common myth is that π equals 22/7 or 3.14 — both are merely convenient approximations, since a true fraction would make π rational, which it is not. So treat values like √40 as exact names, and squeeze out a decimal estimate only when a measurement or comparison demands one.",
    ],
    example: {
      problem: "Without a calculator, estimate √40 to one decimal place.",
      steps: [
        "Trap 40 between neighboring perfect squares: 36 = 6² and 49 = 7², so √40 lies between 6 and 7, and nearer to 6 because 40 sits close to 36.",
        "Test a candidate in the gap: 6.3² = 39.69, which is just under 40, so √40 is a bit more than 6.3.",
        "Test the next tenth: 6.4² = 40.96, which overshoots 40, so √40 is trapped between 6.3 and 6.4.",
        "Decide which tenth is closer: 40 − 39.69 = 0.31 while 40.96 − 40 = 0.96, so 40 sits much nearer to 6.3², making 6.3 the better one-decimal estimate.",
      ],
      answer: "√40 ≈ 6.3, since it is trapped between 6.3 and 6.4 and lies much closer to 6.3.",
    },
    selfQuestions: [
      "Why does squeezing a square root between two perfect squares work, and how could you push the estimate to two decimal places?",
      "What is the difference between a decimal that never ends but repeats and one that never ends and never repeats?",
      "Why are 3.14 and 22/7 not the same thing as π, and when does that distinction actually matter?",
      "Which square roots of whole numbers are rational, and how can you spot them before reaching for an estimate?",
    ],
  },
  algebraic_expressions: {
    explanation: [
      "When a quantity is unknown or keeps changing, you let a letter hold its place: if each box holds s shirts, then 3 boxes hold 3s. An algebraic expression is a recipe built from such letters and numbers — 2s + 3 says double the amount, then add 3. You already use the properties of operations and spot number patterns; expressions just give the pattern a name so you can compute with it before knowing the actual value.",
      "Two skills carry most of the weight: combining like terms, where s + 2s = 3s because one batch plus two batches is three batches of the same thing, and the distributive property, where 3(2x + 5) = 6x + 15. The trap to avoid is treating the letter as an object instead of a number — reading 3s as 'three shirts' invites mistakes like 2x + 3 = 5x, which wrongly merges a number of x-batches with a plain number. The letter always stands for a value, not a thing.",
    ],
    example: {
      problem: "A student council sells s shirts on Saturday. On Sunday they sell 3 more than twice Saturday's count. Write a simplified expression for the weekend total, then evaluate it when s = 12.",
      steps: [
        "Translate Sunday into symbols: 3 more than twice Saturday is 2s + 3.",
        "Add the two days and combine like terms: s + (2s + 3) = 3s + 3, since one batch of s plus two batches of s makes three batches.",
        "Substitute s = 12 into the simplified form: 3 × 12 + 3 = 36 + 3 = 39.",
        "Verify against the unsimplified story: Sunday alone is 2 × 12 + 3 = 27, and 12 + 27 = 39, so the simplification preserved the meaning.",
      ],
      answer: "The weekend total is 3s + 3 shirts, which equals 39 shirts when s = 12.",
    },
    selfQuestions: [
      "Why is it legal to combine s and 2s but not 2s and 3 — what exactly makes terms 'like'?",
      "How could you convince someone that 3s + 3 and s + 2s + 3 give the same value for every choice of s?",
      "What does the distributive property let you do to an expression, and when does using it backwards help?",
      "How would the expression change if Sunday were 3 fewer than twice Saturday, and which words signaled the change?",
    ],
  },
  one_variable_equations: {
    explanation: [
      "An equation is a balance claim: 30 + 11w = 96 insists that both sides are the same number, even though one side hides an unknown. Solving means finding the value of the unknown that makes the claim true, and the method grows straight out of the properties of operations you already trust: whatever you do to one side, do to the other, and the balance survives. Inequalities work the same way but claim 'at least' or 'less than' instead of 'equal', so their answers are whole ranges.",
      "Think of the unknown as wrapped in layers of operations, and solve by unwrapping in reverse order — undo the addition before the multiplication, just as you take off shoes before socks because removing socks first would fail. The classic mistake is operating on only one side, or 'moving' a term across the equals sign without flipping what it does. One inequality-specific care point: multiplying or dividing both sides by a negative number reverses the direction of the inequality sign.",
    ],
    example: {
      problem: "A skateboard costs $96. You already have $30 saved and you put away $11 every week. After how many weeks can you buy it?",
      steps: [
        "Model the savings: after w weeks you hold the starting $30 plus $11 per week, so the equation is 30 + 11w = 96.",
        "Undo the addition first by subtracting 30 from both sides: 11w = 96 − 30 = 66.",
        "Undo the multiplication by dividing both sides by 11: w = 66 ÷ 11 = 6.",
        "Check the solution in the original equation: 30 + 11 × 6 = 30 + 66 = 96, so the balance holds and 6 weeks is exactly enough.",
      ],
      answer: "You can buy the skateboard after 6 weeks of saving.",
    },
    selfQuestions: [
      "Why must every operation be applied to both sides of an equation, and what breaks if it is not?",
      "How do you decide which operation to undo first when the unknown is wrapped in several?",
      "What would the setup and answer look like if the question asked when your savings exceed $96 instead of equal it?",
      "Why does multiplying an inequality by a negative number flip its direction — can you find a small example that shows it?",
    ],
  },
  linear_equations_two_var: {
    explanation: [
      "Some rules connect two changing quantities at once: coins earned and levels completed, cost and weight, distance and time. A linear equation in two variables, like c = 15L + 40, captures such a rule, and a solution is no longer a single number but a pair — a level L together with the coin total c that the rule produces. You already know how to plot pairs on the coordinate plane, and that is where these equations come alive: every solution pair is a point, and together the points line up perfectly.",
      "The straight line through those points IS the solution set, drawn rather than listed. That resolves the big misconception that an equation must have one answer: a two-variable linear equation has infinitely many solution pairs, and the line shows them all at once. To test whether a pair belongs, substitute both numbers and see whether the two sides agree; to find a missing partner, plug in the value you know and solve the leftover one-variable equation.",
    ],
    example: {
      problem: "A game gives you 40 coins to start and 15 coins per level, so your total is c = 15L + 40 after L levels. How many coins do you have after level 6, and at which level do you first reach exactly 190 coins?",
      steps: [
        "For the first question L is known, so substitute L = 6: c = 15 × 6 + 40 = 90 + 40 = 130 coins.",
        "For the second question c is known, so set 15L + 40 = 190 and subtract 40 from both sides: 15L = 150.",
        "Divide both sides by 15: L = 150 ÷ 15 = 10, so level 10 brings the total to exactly 190.",
        "Read both results as points: (6, 130) and (10, 190) sit on the same line, two of the infinitely many pairs this rule makes true.",
      ],
      answer: "You have 130 coins after level 6, and you reach exactly 190 coins at level 10.",
    },
    selfQuestions: [
      "Why does a two-variable equation have infinitely many solutions while a one-variable equation usually has just one?",
      "How would the line and its meaning change if the game gave no starting coins at all?",
      "What does it mean graphically when a pair you test makes the two sides of the equation disagree?",
      "Given any one solution pair, how could you generate several more without solving from scratch?",
    ],
  },
  systems_linear_intro: {
    explanation: [
      "One equation with two unknowns leaves infinitely many possibilities, but a second equation about the same unknowns can pin them down. A system of linear equations is a pair of conditions that must hold at the same time, and its solution is the pair of values satisfying both. Graphically, each equation draws a line of its own possibilities, and the solution is where the two lines cross — the single point that lives on both. You already solve one-variable equations, and systems reduce to exactly that.",
      "Substitution is the workhorse: solve one equation for one unknown, then substitute that expression into the other equation, leaving a single equation in a single variable. The trap is treating the equations separately — finding a pair that fits one equation and declaring victory. A genuine solution must check out in both equations, so always substitute your final pair into the equation you did not just use. If it fails there, the work has a slip somewhere.",
    ],
    example: {
      problem: "A movie theater sells adult tickets for $8 and child tickets for $5. A family buys 7 tickets for a total of $44. How many of each type did they buy?",
      steps: [
        "Name the unknowns and translate both facts: with a adult and c child tickets, the count gives a + c = 7 and the money gives 8a + 5c = 44.",
        "Solve the simpler equation for one unknown: a = 7 − c, then substitute into the money equation: 8(7 − c) + 5c = 44.",
        "Distribute and combine like terms: 56 − 8c + 5c = 44, so 56 − 3c = 44, which gives 3c = 12 and c = 4.",
        "Back-substitute to finish: a = 7 − 4 = 3, then verify in the money equation: 8 × 3 + 5 × 4 = 24 + 20 = 44, so the pair satisfies both conditions.",
      ],
      answer: "The family bought 3 adult tickets and 4 child tickets.",
    },
    selfQuestions: [
      "Why does it take two equations to pin down two unknowns, and what does one equation alone leave open?",
      "What does the solution of a system look like on a graph, and what would parallel lines mean for the answer?",
      "How do you choose which equation and which variable to use for substitution to keep the algebra light?",
      "Why is checking the final pair in both original equations a real test rather than a formality?",
    ],
  },
  functions_intro: {
    explanation: [
      "Picture a machine with an input slot and an output tray: feed it a number, and a fixed rule decides exactly what comes out. That is a function — a rule that assigns to each input exactly one output. You already work with patterns and plot pairs on the coordinate plane; a function organizes a pattern into input-output pairs you can list in a table, draw as a graph, or state as a rule like 'triple the input, then subtract 2'.",
      "The defining promise is reliability: the same input must always produce the same single output. Feeding in 9 today and getting 25, then feeding in 9 tomorrow and getting 31, would mean the rule is not a function. The misconception to drop is that a function must be a formula — a table of game scores or a graph of temperature over a day qualifies, as long as each input has exactly one output. Different inputs sharing an output is perfectly fine; one input owning two outputs is not.",
    ],
    example: {
      problem: "A number machine uses the rule: triple the input, then subtract 2. What output does the input 9 produce, and which input produces the output 19?",
      steps: [
        "Run the rule forward on 9: triple gives 3 × 9 = 27, then subtracting 2 gives 27 − 2 = 25.",
        "To find the input behind 19, run the rule backwards in reverse order: undo the subtraction first, 19 + 2 = 21, then undo the tripling, 21 ÷ 3 = 7.",
        "Confirm the backwards trip by running 7 forward: 3 × 7 − 2 = 21 − 2 = 19, exactly the target output.",
        "Notice why the backwards trip was so clean: this particular rule never gives two different inputs the same output, so 19 traces back to a single input. Being a function only promises one output per input — a rule like squaring sends both 4 and −4 to 16, so its backwards question would have two answers.",
      ],
      answer: "The input 9 produces the output 25, and the input 7 is the one that produces 19.",
    },
    selfQuestions: [
      "What makes a rule fail to be a function, and can you invent an everyday rule that fails this way?",
      "Why is it acceptable for two different inputs to share an output, but not for one input to have two outputs?",
      "How can you decide from a table of pairs whether it could represent a function?",
      "When does running a rule backwards get complicated, and what feature of the rule causes the trouble?",
    ],
  },
  slope_rate_of_change: {
    explanation: [
      "Slope puts a number on steepness: between two points on a line, it is the vertical change divided by the horizontal change — rise over run. In a real context, that very same number is a rate of change: dollars saved per week, kilometers per hour, points per game. You already plot points on the coordinate plane, so slope is the next question to ask of any two of them: for each step across, how far does the line climb or fall?",
      "On a true line, the slope is the line's personality — pick any two points and the ratio comes out identical, which is exactly what makes prediction possible. Watch for two confusions. First, height is not steepness: a line drawn high on the grid can still be flat, while a low line can be steep; slope measures tilt, not position. Second, a negative slope is not an error — it simply reports a quantity falling as you move right, like money draining from an account.",
    ],
    example: {
      problem: "Maya saves at a steady rate. In week 2 her account holds $35, and in week 6 it holds $95. How much does she save per week, and how much will she have in week 7?",
      steps: [
        "Treat the facts as points (2, 35) and (6, 95), with weeks across and dollars up.",
        "Compute rise over run: the rise is 95 − 35 = 60 dollars while the run is 6 − 2 = 4 weeks, so the slope is 60 ÷ 4 = 15 dollars per week.",
        "Interpret the slope before using it: steady saving means every single week adds exactly $15, between any two weeks you pick.",
        "Predict week 7 by extending one week past week 6: 95 + 15 = 110 dollars, and as a check, week 2 plus five weeks of saving gives 35 + 5 × 15 = 110 as well.",
      ],
      answer: "Maya saves $15 per week, so her account will hold $110 in week 7.",
    },
    selfQuestions: [
      "Why does any pair of points on the same line give the same slope, and what would differing answers tell you?",
      "What does a negative slope mean in a savings story, and what would a slope of zero mean?",
      "How is rise over run connected to a unit rate like dollars per week?",
      "Why does subtracting the coordinates in a consistent order matter when computing slope?",
    ],
  },
  angle_relationships: {
    explanation: [
      "Angles rarely appear alone — crossing lines manufacture them in related families. When two lines cross, the angles directly across the X from each other, called vertical angles, are always equal, and any two angles forming a straight line are supplementary, summing to 180°. You already know how to measure angles and recognize parallel lines; this concept is about exploiting those relationships to find unknown angles without ever touching a protractor.",
      "The high-value setup is a transversal slicing across two parallel lines, creating eight angles that look intimidating but hide a simple secret: only two different measures exist in the whole figure, and they are supplementary partners. Every angle either equals your known angle or equals 180° minus it. The trap is assuming those tidy equalities — corresponding angles matching, alternate interior angles matching — hold for any two lines. They are a special privilege of parallel lines, and without parallelism only the vertical-angle and straight-line facts survive.",
    ],
    example: {
      problem: "A transversal crosses two parallel lines, and one of the angles it forms measures 68°. Find the measure of its vertical angle, the corresponding angle at the other parallel line, and the same-side interior angle that accompanies it.",
      steps: [
        "The vertical angle sits directly across the intersection from the 68° angle, and vertical angles are always equal, so it is also 68°.",
        "Because the lines are parallel, the corresponding angle — the one occupying the matching corner at the second intersection — copies the original exactly: 68°.",
        "The same-side interior angle pairs with the 68° angle inside the parallel lines on one side of the transversal, and such a pair is supplementary: 180 − 68 = 112°.",
        "Sanity-check the whole figure: all eight angles must be either 68° or 112°, and every adjacent pair along a straight line sums to 68 + 112 = 180°, which holds.",
      ],
      answer: "The vertical and corresponding angles each measure 68°, and the same-side interior angle measures 112°.",
    },
    selfQuestions: [
      "Why are vertical angles always equal — can you argue it using two overlapping straight lines?",
      "Which angle relationships in a transversal figure collapse if the two lines are not parallel, and which survive?",
      "How could measuring just one angle let you label all eight angles in a parallel-lines figure?",
      "If a same-side interior pair summed to something other than 180°, what could you conclude about the two lines?",
    ],
  },
  area_surface_volume: {
    explanation: [
      "Three different questions hide inside one box: how much flat space a face covers (area), how much material would wrap the entire outside (surface area), and how much fits inside (volume). You already find areas of rectangles and count unit cubes for volume; this concept assembles those skills for 3D solids. Surface area is just the sum of the areas of every face, and a rectangular box's volume is length × width × height — layers of unit cubes stacked up.",
      "A reliable mental move for surface area is to unfold the solid into a flat net, so no face gets skipped or counted twice; a box has three pairs of matching faces, so you can find three face areas and double the total. The classic confusion is mixing up surface area and volume — the units expose it instantly. Surface area is measured in square units like cm² because it is flat material; volume needs cubic units like cm³ because it fills space. If your units do not match your question, the setup is wrong.",
    ],
    example: {
      problem: "A gift box measures 20 cm long, 12 cm wide, and 8 cm tall. How much wrapping paper is needed to cover it exactly, and how much space is inside?",
      steps: [
        "Find one face from each of the three pairs: top is 20 × 12 = 240 cm², front is 20 × 8 = 160 cm², and side is 12 × 8 = 96 cm².",
        "Each face has an identical partner on the opposite side of the box, so the surface area doubles the sum: 2 × (240 + 160 + 96) = 2 × 496 = 992 cm².",
        "Volume stacks layers of unit cubes: the base holds 20 × 12 = 240 cubes per layer, and 8 layers give 240 × 8 = 1920 cm³.",
        "Check the units against the questions: wrapping paper is flat material, so cm² fits, while interior space is three-dimensional, so cm³ fits — the two answers measure genuinely different things.",
      ],
      answer: "The box needs 992 cm² of wrapping paper and holds 1920 cm³ of space inside.",
    },
    selfQuestions: [
      "Why does unfolding a solid into a net help you compute surface area without missing a face?",
      "How can two boxes share the same volume but need different amounts of wrapping paper?",
      "Why does area use square units while volume uses cubic units — what is each one counting?",
      "How would you adapt the face-pairing strategy to a solid that is not a rectangular box, like a triangular prism?",
    ],
  },
  scale_similarity: {
    explanation: [
      "A map of a city and the city itself share a shape but not a size — that is the heart of scale and similarity. A scale like 1 cm : 25 km is a promise that every map centimeter stands for 25 real kilometers, no exceptions. Two figures are similar when one is a uniform enlargement or reduction of the other: all matching angles equal, all matching lengths multiplied by the same scale factor. Your skills with multiplication, division, and ratios do all the computation.",
      "The working rule is multiplicative both ways: map to real multiplies by the scale factor, real to map divides by it. The trap is additive thinking — reasoning that since one side grew by 10, every side grows by 10. Scaling multiplies; a 2 × 3 rectangle scaled by factor 3 becomes 6 × 9, not 12 × 13. One more subtlety worth storing: lengths scale by the factor k, but areas scale by k², because area stretches in two directions at once.",
    ],
    example: {
      problem: "A hiking map uses the scale 1 cm : 25 km. A trail on the map measures 6.4 cm. How long is the real trail, and how many centimeters on this map would represent a 90 km highway?",
      steps: [
        "The scale promises every map centimeter stands for 25 real kilometers, so multiply to go from map to reality: 6.4 × 25 = 160 km of real trail.",
        "Quickly estimate to keep yourself honest: 6 cm would be 150 km and 0.4 cm would be 10 km, so 160 km fits perfectly.",
        "Going from reality to the map reverses the operation, so divide: 90 ÷ 25 = 3.6 cm of map distance for the highway.",
        "Verify the round trip: 3.6 cm × 25 km per cm = 90 km, which recovers the original highway length, confirming both directions of the conversion.",
      ],
      answer: "The trail is 160 km long in reality, and the 90 km highway would span 3.6 cm on the map.",
    },
    selfQuestions: [
      "Why does scaling multiply every length by the same factor instead of adding the same amount to each?",
      "How do you decide whether a conversion calls for multiplying or dividing by the scale factor?",
      "If a drawing is enlarged by a factor of 3, why does its area grow by a factor of 9 rather than 3?",
      "What measurements would you compare to test whether two triangles are really similar?",
    ],
  },
  pythagorean_theorem: {
    explanation: [
      "Right triangles obey a remarkable bargain: square the two legs, add those squares, and you get exactly the square of the hypotenuse — a² + b² = c², where c is the longest side, the one facing the right angle. You can literally picture it with the areas you already know: build a square on each side of the triangle, and the two smaller squares' areas together equal the largest one's. It is the standard tool for any straight-line distance you cannot measure directly.",
      "Two cautions keep the theorem honest. First, it works only for right triangles — apply it to a triangle without a 90° angle and the equation simply lies to you. Second, resist the shortcut a + b = c; sides do not add, their squares do, which is why a diagonal shortcut is shorter than walking the two legs but still longer than either leg alone. Always identify which side is the hypotenuse before substituting, since c must be the side opposite the right angle.",
    ],
    example: {
      problem: "A rectangular field is 60 m by 80 m. Instead of walking along two sides from one corner to the opposite corner, you cut straight across the diagonal. How long is the shortcut, and how much walking does it save?",
      steps: [
        "The two sides and the diagonal form a right triangle, with the diagonal as the hypotenuse because it faces the field's 90° corner.",
        "Apply the theorem: diagonal² = 60² + 80² = 3600 + 6400 = 10000.",
        "Take the square root to recover the length: √10000 = 100 m for the diagonal shortcut.",
        "Compare with the two-side route: 60 + 80 = 140 m, so the shortcut saves 140 − 100 = 40 m.",
        "Sanity-check the geometry: 100 m is longer than either single side but shorter than the two sides combined, exactly what a straight-line shortcut should be.",
      ],
      answer: "The diagonal shortcut is 100 m long and saves 40 m of walking.",
    },
    selfQuestions: [
      "Why must the theorem use the squares of the side lengths rather than the lengths themselves?",
      "How can you use the theorem in reverse to test whether a triangle contains a right angle?",
      "What happens to the diagonal if both sides of the field are doubled, and why?",
      "Where would the calculation go wrong if you mistakenly treated one of the legs as the hypotenuse?",
    ],
  },
  transformations_congruence: {
    explanation: [
      "Slide a shape across the floor, spin it, or flip it over like a pancake — it remains the same shape at the same size. These three moves are the rigid motions: translations slide, rotations turn, and reflections mirror. On the coordinate plane you already know, each becomes a precise rule for the coordinates; a translation 3 left and 2 up sends every point (x, y) to (x − 3, y + 2). Two figures are congruent exactly when some sequence of rigid motions carries one onto the other.",
      "What makes rigid motions powerful is what they refuse to change: every distance between points and every angle survives untouched, so congruence is guaranteed rather than checked side by side. The misconception to clear is that moving a figure somehow alters it — a rotated rectangle may look tilted and unfamiliar, but its sides and angles are identical to the original's. Only a dilation, which enlarges or shrinks, changes size, and that is precisely why dilation is excluded from the rigid-motion club.",
    ],
    example: {
      problem: "Triangle ABC has vertices A(1, 2), B(4, 2), and C(4, 6). It is translated 3 units left and 2 units up. Find the image vertices and explain why the image is congruent to the original.",
      steps: [
        "Write the translation as a coordinate rule: 3 left subtracts 3 from x and 2 up adds 2 to y, so (x, y) → (x − 3, y + 2).",
        "Apply the rule to each vertex: A(1, 2) → A'(−2, 4), B(4, 2) → B'(1, 4), and C(4, 6) → C'(1, 8).",
        "Test a side length: AB runs from x = 1 to x = 4 at the same height, length 3, while A'B' runs from x = −2 to x = 1, also length 3.",
        "Test another: BC rises from y = 2 to y = 6, length 4, and B'C' rises from y = 4 to y = 8, also length 4 — distances are preserved.",
        "Conclude congruence: a translation moves every point the same distance in the same direction, so all sides and angles are unchanged and triangle A'B'C' is congruent to triangle ABC.",
      ],
      answer: "The image vertices are A'(−2, 4), B'(1, 4), and C'(1, 8), and the image is congruent because translations preserve all lengths and angles.",
    },
    selfQuestions: [
      "Why do translations, rotations, and reflections preserve distances while a dilation does not?",
      "How could you decide which rigid motion, or combination of motions, maps one given figure onto another?",
      "What stays the same and what changes about a figure's coordinates under a reflection across the x-axis?",
      "Why is defining congruence through motions more powerful than just comparing side lengths one by one?",
    ],
  },
  statistical_distributions: {
    explanation: [
      "A list of data values answers little until you step back and look at its overall shape. A distribution is that big picture: where the values cluster, how far they spread, where the peaks sit, and whether any values stand off alone as outliers. You already build dot plots and read graphs of data; describing a distribution means reading such a plot the way you would read a landscape — hills, plains, and the odd distant tree — rather than point by point.",
      "Useful vocabulary makes the picture speakable: a distribution can be roughly symmetric, or skewed with a long tail stretching toward high or low values; it can have one peak or several, clusters, gaps, and outliers. The trap is collapsing all of that into a single number too early. Two classes can share an average quiz score while one is tightly packed and the other wildly spread — shape and spread carry real information that no lone number, especially a mean dragged around by an outlier, can deliver alone.",
    ],
    example: {
      problem: "Eleven students report how many books they read over the summer: 1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 12. Describe the distribution and give a typical number of books for this group.",
      steps: [
        "Picture the dot plot: values pile up between 1 and 5 with the tallest stack at 3, then a wide gap, then a single value far out at 12.",
        "Name the shape from that picture: the lone high value makes a long right tail, so the distribution is skewed right with 12 as an outlier.",
        "Find the median for a typical value: with 11 ordered values the middle is the 6th, which is 3 books.",
        "Compare with the mean: the values sum to 44, so the mean is 44 ÷ 11 = 4 books — pulled a full book above the median by the single reader at 12.",
        "Choose and justify: the median of 3 represents a typical student better here, because 10 of the 11 students read 5 books or fewer.",
      ],
      answer: "The distribution is skewed right with a cluster from 1 to 5, a peak at 3, and an outlier at 12; a typical student read about 3 books (the median).",
    },
    selfQuestions: [
      "Why does an outlier drag the mean more than the median, and when does that gap matter for a summary?",
      "How would you describe the difference between a symmetric distribution and a skewed one to a friend using everyday examples?",
      "What might a gap or a second peak in a distribution reveal about the group the data came from?",
      "Which features of a distribution disappear when you report only an average, and when is that loss acceptable?",
    ],
  },
  center_variability: {
    explanation: [
      "Summarizing data well takes two numbers, not one: a center that says what is typical, and a measure of variability that says how much the values stray from typical. For center you can use the mean — the even-share value — or the median, the middle of the ordered list. For variability, the range gives the rough span, while the mean absolute deviation, MAD, averages how far values sit from the mean. Your skills at adding, dividing, and reading data plots cover all the machinery.",
      "Think of the MAD as the typical miss: if a team's mean is 10 points with a MAD of 1.6, scores usually land within a couple of points of 10, so the team is consistent. A MAD of 6 around the same mean would describe a streaky team. The standing misconception is that the mean alone tells the story — but two players can average identical points while one is steady and the other swings wildly, and only a variability measure separates them. Also remember the median resists outliers when the mean gets dragged.",
    ],
    example: {
      problem: "A basketball player scores 7, 9, 10, 10, and 14 points in five games. Find the mean and the mean absolute deviation (MAD), and interpret what they say about her consistency.",
      steps: [
        "Compute the mean as the even share: 7 + 9 + 10 + 10 + 14 = 50, and 50 ÷ 5 = 10 points per game.",
        "Find each game's distance from the mean: |7 − 10| = 3, |9 − 10| = 1, |10 − 10| = 0, |10 − 10| = 0, and |14 − 10| = 4.",
        "Average those distances for the MAD: 3 + 1 + 0 + 0 + 4 = 8, and 8 ÷ 5 = 1.6 points.",
        "Interpret the pair of numbers: she typically scores around 10, and a typical game lands within about 1.6 points of that — a steady scorer rather than a streaky one.",
      ],
      answer: "Her mean is 10 points per game with a MAD of 1.6 points, indicating consistent scoring close to her average.",
    },
    selfQuestions: [
      "Why are absolute values used when computing the MAD — what would go wrong if deviations kept their signs?",
      "When would you summarize a data set with the median instead of the mean, and what in the data signals that choice?",
      "How could two players share the same mean while one has a much larger MAD, and which would you rather have on your team?",
      "What does the range miss about a data set that the MAD captures?",
    ],
  },
  probability_intro: {
    explanation: [
      "Probability puts a number on chance, on a scale from 0 to 1: impossible events score 0, certain events score 1, and a fair coin's heads sits at 1/2. When every outcome is equally likely, the recipe comes straight from the fractions you know: count the outcomes you want, divide by all outcomes possible. Drawing from a bag of 10 marbles where 3 are blue gives a 3/10 chance of blue, and a useful companion fact says the chance of NOT blue is 1 − 3/10 = 7/10.",
      "The honest interpretation is long-run frequency: a 3/10 probability means that across many, many draws, about 3 in every 10 will be blue — it promises a trend, not a schedule. That kills two popular myths at once. A short run can easily stray from the math, so 40 draws might yield 9 or 15 blues rather than exactly 12; and past results do not bend future chances, so five reds in a row leaves the next draw's probabilities exactly where they started.",
    ],
    example: {
      problem: "A bag holds 5 red, 3 blue, and 2 green marbles. You draw one marble at random. Find the probability of blue and of not-green, and estimate how many blues to expect in 40 draws if the marble is replaced each time.",
      steps: [
        "Count the total outcomes: 5 + 3 + 2 = 10 marbles, each equally likely to be drawn.",
        "Probability of blue is favorable over total: 3/10, since 3 of the 10 marbles are blue.",
        "For not-green, subtract from certainty: 1 − 2/10 = 8/10 = 4/5, the same as counting the 5 red plus 3 blue directly.",
        "For 40 replaced draws, scale the probability up: 3/10 × 40 = 12 blues expected.",
        "Interpret the expectation honestly: 12 is the long-run typical count, so an actual session might give 10 or 14 blues without anything being wrong with the bag or the math.",
      ],
      answer: "P(blue) = 3/10, P(not green) = 4/5, and you should expect around 12 blue draws out of 40 — as a tendency, not a guarantee.",
    },
    selfQuestions: [
      "Why must every probability land between 0 and 1, and what would a value outside that range claim?",
      "How does replacing the marble after each draw keep the probabilities the same, and what changes if you stop replacing it?",
      "Why does getting five reds in a row not make blue any more likely on the next draw?",
      "How would you use the not-rule to simplify finding the chance of at least one success in a situation you invent?",
    ],
  },
};
