// ---------------------------------------------------------------------------
// Curated written guides (Phase D, RANKS_PLAN §12.3) — MATH · ELEMENTARY.
// Original content authored for noobtopro; no third-party lesson text is
// reproduced. One guide per curriculum concept (lib/curriculum.js), loaded
// lazily via lib/guides/index.js; shape rules in lib/guides/validate.js.
// ---------------------------------------------------------------------------

export const GUIDES = {
  counting_cardinality: {
    explanation: [
      "When you count a pile of toys, you are doing two jobs at once. First you match one number word to each toy: one, two, three, and so on, touching each toy exactly once. Then comes the magic part: the last number you say is not just the name of the last toy. It tells you how many toys are in the whole pile. That idea — the final count names the size of the group — is the foundation that every other piece of math is built on.",
      "Here is the mental picture to keep: counting is like handing out tickets. Every object gets exactly one ticket, no object gets two, and no object is skipped. The number on the last ticket tells you the size of the crowd. Some people think counting in a different order could change the answer, but it cannot. As long as every object gets one ticket, the pile has the same count whether you start from the left, the right, or the middle.",
    ],
    example: {
      problem: "Maya counts a pile of crayons from left to right and finishes on the number 13. Then she counts the very same pile again, starting from the right side instead. What number will she finish on this time?",
      steps: [
        "Think about what the first count did: Maya touched each crayon once and gave it one number word. The last word, 13, names the size of the whole pile, not just one crayon.",
        "Counting from the other end does not add any crayons and does not take any away. The pile still holds exactly the same crayons as before.",
        "Since each crayon still gets exactly one number word, the new count must finish on the same number. The order you count in never changes how many things there are.",
        "You can test this idea with a small group: count 5 coins left to right, then right to left. Both counts end on 5 every single time.",
      ],
      answer: "She will finish on 13 again — the same pile gives the same count no matter where she starts.",
    },
    selfQuestions: [
      "Why does the last number you say while counting describe the whole group instead of just the last object?",
      "What could go wrong with a count if you skip an object or touch the same object twice?",
      "How would you convince a friend that counting a pile from the right gives the same answer as counting from the left?",
      "When might it be smarter to count things in pairs or in groups of ten instead of one at a time?",
    ],
  },
  place_value_base_ten: {
    explanation: [
      "Our whole number system runs on one clever trick: where a digit sits decides what it is worth. With only ten digits, 0 through 9, you can write any number ever needed, because each spot in a number is worth ten times the spot to its right. In 473, the 4 does not mean four — it means four hundreds. The 7 means seven tens, which is seventy. Only the 3 means plain old three.",
      "Picture numbers as bundles. Ten loose straws make one bundle of ten. Ten bundles of ten make one big pack of one hundred. Writing 473 is just a tidy record: 4 packs, 7 bundles, 3 loose straws. A common mix-up is reading the 7 in 473 as just seven. It is really 70, because it lives in the tens place. Whenever a number puzzles you, unpack it into its hundreds, tens, and ones, and it usually stops being puzzling.",
    ],
    example: {
      problem: "A school collects pencils for art class. Helpers fill 4 big boxes with 100 pencils each, 7 small bags with 10 pencils each, and have 3 loose pencils left over. How many pencils did they collect in all?",
      steps: [
        "Count the big boxes first: each one holds 100 pencils, so 4 boxes hold 4 × 100 = 400 pencils.",
        "Now the bags: each bag holds 10 pencils, so 7 bags hold 7 × 10 = 70 pencils.",
        "Add the groups from biggest to smallest: 400 + 70 = 470, and then 470 + 3 = 473 pencils.",
        "Look closely at the answer 473: the digit 4 records the boxes of 100, the 7 records the bags of 10, and the 3 records the loose pencils. The written number is simply a tidy list of the groups.",
      ],
      answer: "The school collected 473 pencils — 4 hundreds, 7 tens, and 3 ones.",
    },
    selfQuestions: [
      "Why is the 5 in 52 worth more than the 5 in 25, even though it is the very same digit?",
      "What happens to the value of a digit when it moves one place to the left in a number?",
      "How would you use bundles of straws to show why ten ones can be traded for one ten?",
      "What would be hard about writing big numbers if every spot in a number were worth the same amount?",
    ],
  },
  addition_subtraction: {
    explanation: [
      "Putting amounts together and taking them apart are the two most useful moves in arithmetic. Addition joins groups: 36 buttons plus 27 buttons makes one bigger collection. Subtraction works the other way: it can take some away, or it can measure the gap between two amounts, like how many more stickers your friend has than you. You already know counting and place value, and both moves lean on them hard.",
      "The best mental habit is to work with tens and ones instead of single counts. To add 36 + 27, add 20 first to get 56, then 7 more to get 63 — friendly chunks instead of 27 tiny hops. The two operations also undo each other, which gives you a free checking tool: if 45 + 18 = 63, then 63 − 18 must be 45.",
      "One trap to avoid: when subtracting, some people line up the digits and always take the smaller digit from the bigger one, whichever row it is in. That fails in a problem like 63 − 18, because the 3 ones are fewer than the 8 you must remove. The fix is regrouping: break one ten into ten ones, so the 63 becomes 5 tens and 13 ones, and then the subtraction works honestly.",
    ],
    example: {
      problem: "A jar holds 36 buttons. You drop in 27 more, and later you take out 18 buttons for a craft project. How many buttons are in the jar now?",
      steps: [
        "First join the two groups. Split 27 into friendly parts: 36 + 20 = 56, then 56 + 7 = 63. The jar holds 63 buttons after you drop yours in.",
        "Now remove 18. Take the tens away first: 63 − 10 = 53. Then take the ones: 53 − 8 = 45.",
        "Notice the ones place in 63 − 18: you cannot take 8 ones from 3 ones, so one ten must be broken into ten ones. That is exactly why the always-take-small-from-big shortcut gives wrong answers.",
        "Check by adding back: 45 + 18 = 63, which matches the jar before the craft. Since addition undoes subtraction, the answer holds.",
      ],
      answer: "There are 45 buttons left in the jar.",
    },
    selfQuestions: [
      "How does breaking a number into tens and ones make adding in your head easier?",
      "Why can you check a subtraction problem with addition, and how would you show this to a friend?",
      "What does subtraction mean besides taking away — how can it compare two amounts?",
      "Where does the extra ten come from when the ones add up past 9, like in 36 + 27?",
    ],
  },
  multiplication_division: {
    explanation: [
      "Equal groups are everywhere: 8 rows of chairs, 6 muffins in every box, 4 wheels on every car. Multiplication counts equal groups fast — instead of adding 7 + 7 + 7 + 7 + 7 + 7 + 7 + 7, you say 8 × 7 and you are done. Division runs the same story backwards: it shares a total into equal groups, or asks how many equal groups fit inside a total.",
      "Think of every multiplication fact as a little package holding three numbers: 8, 7, and 56 belong together because 8 groups of 7 make 56. Division just asks for a missing piece of that same package, so 56 ÷ 8 = 7 and 56 ÷ 7 = 8 come free with the fact 8 × 7 = 56. One careful point: in multiplication the order does not matter, since 8 × 7 and 7 × 8 give the same total, but in division the order matters a lot. Sharing 56 chairs among 8 rows is nothing like sharing 8 chairs among 56 rows, so always ask which number is the total being shared.",
    ],
    example: {
      problem: "The gym helpers must set up 56 chairs in 8 equal rows for a school concert. How many chairs go in each row?",
      steps: [
        "Division shares a total into equal groups. Here the total of 56 chairs is shared into 8 rows, so the question is 56 ÷ 8.",
        "Reach for a multiplication fact you know: 8 × 7 = 56. That says 8 rows of 7 chairs use exactly 56 chairs.",
        "So each row gets 7 chairs, because 56 ÷ 8 = 7. Multiplication and division are partner facts about the same equal groups.",
        "Sanity check by skip-counting by 7 eight times: 7, 14, 21, 28, 35, 42, 49, 56. You land exactly on 56, so no chairs are missing and none are left over.",
      ],
      answer: "Each row gets 7 chairs, using all 56 chairs exactly.",
    },
    selfQuestions: [
      "How are multiplication and repeated addition connected, and when is multiplying clearly faster?",
      "Why do 56 ÷ 8 and 56 ÷ 7 give different answers, and what does each answer tell you about the rows?",
      "What does it mean when a division does not come out even, like sharing 13 cookies among 4 friends?",
      "How could you use an array of dots to show that 8 × 7 and 7 × 8 describe the same picture?",
    ],
  },
  properties_of_operations: {
    explanation: [
      "Numbers follow a few friendly rules, and knowing them is like having permission slips to rearrange your work. Order does not change a sum or a product: 3 + 8 equals 8 + 3, and 3 × 8 equals 8 × 3 — these are often called turn-around facts. Grouping does not matter either: adding three numbers, you may combine whichever pair you like first. And you can break a number apart, work on the pieces, then put the results together, like finding 4 × 27 as 4 × 20 plus 4 × 7.",
      "The point of these rules is not to memorize names — it is to turn hard arithmetic into easy arithmetic. Faced with 38 + 25 + 12, a sharp eye spots that 38 and 12 make a tidy 50, and the problem collapses. But be careful where the permission slips apply: they work for addition and multiplication only. Subtraction and division refuse to be turned around — 9 − 5 is not the same as 5 − 9 — so never reorder those without thinking.",
    ],
    example: {
      problem: "Add 38 + 25 + 12 in your head by choosing a smarter order. What is the total?",
      steps: [
        "Scan for numbers that fit together nicely. The ones digits of 38 and 12 are 8 and 2, and 8 + 2 = 10, so 38 + 12 makes a tidy 50.",
        "Order does not change a sum, so you are allowed to add 38 + 12 first even though 25 sits between them: 38 + 12 = 50.",
        "Finish with the easy part: 50 + 25 = 75.",
        "Check the slow way, left to right: 38 + 25 = 63, then 63 + 12 = 75. Same total — rearranging changed the work, not the answer.",
      ],
      answer: "The total is 75, found faster by pairing 38 with 12 first.",
    },
    selfQuestions: [
      "Why is it safe to add numbers in any order but not to subtract them in any order?",
      "How does breaking 6 × 14 into 6 × 10 and 6 × 4 make the problem easier, and why does it still give the right answer?",
      "What pairs of numbers do you hunt for when you want to make a long addition easy in your head?",
      "How would you explain a turn-around fact like 3 × 8 = 8 × 3 using a picture of rows and columns?",
    ],
  },
  factors_multiples: {
    explanation: [
      "Some numbers fit perfectly inside other numbers. A factor of 24 is any number that divides 24 with nothing left over — like 6, since 6 × 4 = 24. Multiples run in the other direction: the multiples of 6 are its skip-counting list, 6, 12, 18, 24, 30, and on forever. The two ideas are partners: saying 6 is a factor of 24 and saying 24 is a multiple of 6 describe the same neat fit.",
      "Picture factors as ways to arrange objects in equal rows. You can lay out 24 juice boxes in 2 rows of 12 or 4 rows of 6, so 2, 12, 4, and 6 are all factors. Because rows and columns come together, factors arrive in pairs, and that makes hunting for them organized: test 1, 2, 3, and so on, writing down each partner. People often mix the two words up, so keep this anchor: a factor of a number is never bigger than the number itself, while its multiples are never smaller.",
    ],
    example: {
      problem: "You want to arrange 24 juice boxes into equal rows with none left over. Find every number of rows that works — in other words, find all the factors of 24.",
      steps: [
        "Test numbers in order and record each partner. One row of 24 works, so 1 and 24 form the first factor pair.",
        "Since 24 is even, 2 works: 2 × 12 = 24, giving the pair 2 and 12. Three rows work too, because 3 × 8 = 24.",
        "Keep going: 4 × 6 = 24, so 4 and 6 pair up. But 5 fails — 5 × 4 = 20 is too small and 5 × 5 = 25 is too big, so skip-counting by 5 never lands exactly on 24.",
        "The next number to try is 6, and 6 already appears in your list as the partner of 4. When the pairs start repeating, the hunt is over.",
        "List everything found, in order: 1, 2, 3, 4, 6, 8, 12, 24. That is every way to make equal rows.",
      ],
      answer: "The factors of 24 are 1, 2, 3, 4, 6, 8, 12, and 24 — eight possible row arrangements.",
    },
    selfQuestions: [
      "Why do factors almost always come in pairs, and which special numbers give a pair where both partners are the same?",
      "How do you know when you can safely stop testing numbers while hunting for factors?",
      "What is the difference between the factors of 12 and the multiples of 12, and which list goes on forever?",
      "How could skip-counting help you decide whether 7 is a factor of 42?",
    ],
  },
  fractions_meaning_equivalence: {
    explanation: [
      "Cut a sandwich into equal pieces and take some of them — that is what a fraction records. The bottom number, called the denominator, tells how many equal pieces the whole was cut into. The top number, the numerator, tells how many of those pieces you have. So 2/3 means the whole was cut into 3 equal pieces and you have 2. The word equal is doing serious work here: if the pieces are different sizes, the numbers stop meaning anything fair.",
      "The same amount can wear different fraction names. Half a sandwich is 1/2, but cut each half again and the very same amount is 2/4. Fractions that name the same amount are called equivalent. A common trap is thinking a bigger bottom number means a bigger fraction. It is the opposite: cutting a sandwich into more pieces makes each piece smaller, so 1/8 of a sandwich is less than 1/3 of it. More cuts, smaller bites.",
    ],
    example: {
      problem: "Lena eats 2/3 of a chocolate bar. Theo eats 4/6 of a chocolate bar that is exactly the same size. Figure out who ate more chocolate.",
      steps: [
        "Picture Lena's bar cut into 3 equal pieces. She eats 2 of them, so 2 of the 3 equal parts are gone.",
        "Now imagine cutting each of those 3 pieces in half. The bar becomes 6 smaller equal pieces, and Lena's 2 eaten pieces become 4 of the small ones.",
        "The extra cuts added nothing and removed nothing — Lena's eaten amount is simply renamed from 2/3 to 4/6. Both names describe the same amount of chocolate.",
        "Theo ate 4/6 of a same-size bar, so his amount matches Lena's exactly. Cutting into more pieces changes the names, never the amount.",
      ],
      answer: "They ate the same amount of chocolate, because 2/3 and 4/6 are two names for one amount.",
    },
    selfQuestions: [
      "Why must the pieces be equal before the top and bottom numbers of a fraction mean anything?",
      "How can two fractions made of completely different numbers describe the same amount?",
      "What happens to the size of each piece when you cut the same sandwich into more and more pieces?",
      "How would you fold a strip of paper to show that 1/2, 2/4, and 4/8 all land at the same spot?",
    ],
  },
  comparing_fractions: {
    explanation: [
      "Which is more, 5/8 of a sandwich or 3/4 of one? Comparing fractions means deciding which part is bigger — but the contest is only fair when both fractions come from same-size wholes. Three quarters of a giant pizza beats three quarters of a tiny one, so before comparing numbers, always check that the wholes match.",
      "You have a few honest strategies. If the bottom numbers match, the pieces are the same size, so just compare the counts on top. If the top numbers match, the fraction with the bigger bottom is smaller, because its pieces are skinnier. And the half benchmark is powerful: knowing 4/8 is exactly half tells you instantly that 5/8 is past half. The classic mistake is treating the tops and bottoms like separate whole numbers — deciding 5/8 beats 3/4 because 5 beats 3. That ignores piece size, and piece size is the whole game. Rename the fractions into matching pieces first, then compare.",
    ],
    example: {
      problem: "Jo eats 5/8 of her sandwich. Sam eats 3/4 of his sandwich, and both sandwiches are the same size. Who eats more?",
      steps: [
        "Eighths and fourths are different sized pieces, so the counts 5 and 3 cannot be compared directly. First make the pieces match.",
        "Mentally cut each of Sam's fourths in half: 3/4 becomes 6/8. He still has exactly the same amount, just renamed in eighths.",
        "Now both amounts are counted in eighths: Sam ate 6 of them, Jo ate 5. Since 6/8 is more than 5/8, Sam ate more.",
        "Check against the half benchmark: half a sandwich is 4/8. Jo is 1 piece past half and Sam is 2 pieces past half, so Sam being ahead makes sense.",
      ],
      answer: "Sam eats more: 3/4 equals 6/8, which beats Jo's 5/8 by one eighth of a sandwich.",
    },
    selfQuestions: [
      "Why is it unfair to compare 1/2 of a large pizza with 3/4 of a small one?",
      "When two fractions have the same top number, how can you tell which is bigger just by looking at the bottoms?",
      "How does comparing each fraction to one half help you put a messy list of fractions in order quickly?",
      "What goes wrong when someone compares fractions by treating the tops and bottoms as separate whole numbers?",
    ],
  },
  fraction_add_subtract: {
    explanation: [
      "Once two fractions are counted in the same size pieces, adding them is as easy as adding apples: 2 eighths plus 3 eighths is 5 eighths, just like 2 apples plus 3 apples is 5 apples. The piece size — eighths — is the thing being counted, and the top numbers are the counts. Subtracting works the same way: take 5/8 away from 8/8 and 3 eighths remain.",
      "This explains the one rule that matters: the bottom number does not get added. Writing 2/8 + 3/8 = 5/16 is the classic mistake, and you can see why it fails — nobody cut the mile or the pizza into sixteenths, and sixteenths are smaller pieces anyway, so the total would shrink instead of grow. The denominator is a label for piece size, like the word apples; you would never add 2 apples and 3 apples and get 5 apple-apples. When the bottoms do not match, rename one or both fractions into equal pieces first, and only then count.",
    ],
    example: {
      problem: "Ana walks 2/8 of a mile to the park, rests, then walks 3/8 of a mile more to reach the library. How far has she walked in total, and how much less than a whole mile is that?",
      steps: [
        "Both distances use the same piece size — eighths of a mile — so you may simply count pieces: 2 pieces + 3 pieces = 5 pieces.",
        "That makes 2/8 + 3/8 = 5/8 of a mile. The bottom number stays 8 because the pieces are still eighths; only how many she walked changed.",
        "Adding the bottoms to get 5/16 would be wrong: sixteenths are smaller pieces that nobody cut, and a total should not come out smaller than its parts.",
        "A whole mile is 8/8. Subtract the part she walked: 8/8 − 5/8 = 3/8 of a mile still short of a full mile.",
        "Check that the parts rebuild the whole: 5/8 + 3/8 = 8/8, exactly one mile. The pieces fit back together perfectly.",
      ],
      answer: "Ana has walked 5/8 of a mile, which is 3/8 of a mile less than a whole mile.",
    },
    selfQuestions: [
      "Why does the bottom number stay the same when you add fractions that already have matching pieces?",
      "What would you do first to add 1/2 and 1/4, where the piece sizes do not match?",
      "How is adding 2 eighths and 3 eighths like adding 2 apples and 3 apples?",
      "How can drawing one bar split into eighths help you check a fraction sum or difference?",
    ],
  },
  fraction_multiply: {
    explanation: [
      "Taking a fraction of something is what multiplying by a fraction means. Finding 3/4 of 20 cupcakes is a two-move job you already own: split 20 into 4 equal groups (that is division), then take 3 of those groups (that is multiplication). The same thinking handles a fraction of a fraction: half of a half of a pancake is a quarter of it, which you can see by folding paper in half twice.",
      "Here is the surprise worth sitting with: multiplying does not always make things bigger. Years of whole-number practice teach that times means more, but 3/4 of 20 is 15 — smaller than 20. That is not a trick; taking three quarters of a tray means leaving some behind, so the answer must shrink. Whenever you multiply by a fraction less than 1, expect a smaller result, and use that expectation to catch errors: if you compute 3/4 of 20 and get 26, something went wrong.",
    ],
    example: {
      problem: "A bakery tray holds 20 cupcakes. The baker puts sprinkles on 3/4 of them. How many cupcakes get sprinkles?",
      steps: [
        "Read 3/4 of 20 as instructions: split the 20 cupcakes into 4 equal groups, then take 3 of those groups.",
        "One fourth of 20 is 20 ÷ 4 = 5 cupcakes in each group.",
        "Three of those groups make 3 × 5 = 15 cupcakes with sprinkles.",
        "Check using the leftover group: the plain cupcakes are the remaining fourth, 5 of them, and 15 + 5 = 20, so every cupcake is accounted for.",
        "Notice that 15 is smaller than 20. Multiplying by a fraction less than 1 takes a part of the amount, so the result shrinks — exactly as it should.",
      ],
      answer: "15 cupcakes get sprinkles, and the other 5 stay plain.",
    },
    selfQuestions: [
      "Why does multiplying a number by a fraction smaller than 1 give a smaller answer?",
      "How would you find 2/3 of 18 using the divide-then-multiply idea?",
      "What everyday situations ask you to take a fraction of an amount rather than the whole thing?",
      "How is finding half of a half like folding paper twice, and what part of the whole do you end up holding?",
    ],
  },
  decimals_place_value: {
    explanation: [
      "Place value does not stop at the ones — it keeps going to the right of a little dot called the decimal point. The first spot after the point counts tenths, and the next one counts hundredths. So 0.4 means 4 tenths, the same amount as the fraction 4/10, and 0.35 means 35 hundredths. You meet this system every day in money: a dime is one tenth of a dollar and a penny is one hundredth, so $2.35 is 2 dollars, 3 dimes, and 5 pennies.",
      "Keep one rule front and center: digits only mean something through the place they occupy. The classic stumble is reading 0.35 as bigger than 0.4 because 35 looks bigger than 4. But 0.4 is 40 hundredths, and 40 beats 35. A handy fix is to give both numbers the same number of decimal places — write 0.4 as 0.40 — and then compare. Tacking a zero on the end changes nothing, because 4 tenths and 40 hundredths are the same amount, just counted in smaller pieces.",
    ],
    example: {
      problem: "Two paper frogs have a jumping contest. Priya's frog jumps 0.4 meters and Marco's frog jumps 0.35 meters. Whose frog jumped farther?",
      steps: [
        "It is tempting to say 35 beats 4, but those digits live in different places. The 4 in 0.4 sits in the tenths place, so it means 4 tenths of a meter.",
        "Rewrite 0.4 using hundredths so both jumps use the same size pieces: 4 tenths equals 40 hundredths, so 0.4 = 0.40.",
        "Now compare like with like: 40 hundredths is more than 35 hundredths, so 0.4 m is the longer jump.",
        "Money tells the same story: $0.40 is more than $0.35. Priya's frog wins by 0.40 − 0.35 = 0.05 m, which is 5 hundredths of a meter.",
      ],
      answer: "Priya's frog jumped farther: 0.4 m equals 0.40 m, which beats 0.35 m by 0.05 m.",
    },
    selfQuestions: [
      "Why does writing a zero on the end of 0.4 leave its value completely unchanged?",
      "How are dimes and pennies like the tenths and hundredths places of a dollar amount?",
      "What mistake is someone making when they read 0.35 as bigger than 0.4, and how would you straighten out their thinking?",
      "Where would 0.4 and 0.35 sit on a number line that runs from 0 to 1?",
    ],
  },
  rounding_estimation: {
    explanation: [
      "An exact answer is not always worth the work. Rounding trades a fussy number for a nearby friendly one — 487 becomes 500 — and estimation uses those friendly numbers to get close-enough answers fast. This is not lazy math; it is a safety net. A quick estimate done before or after an exact calculation will catch big mistakes, like a slipped digit, the moment they happen.",
      "To round, find the two friendly neighbors your number sits between, then pick the nearer one. Rounding 487 to the nearest hundred, the neighbors are 400 and 500; since 487 is past the halfway mark of 450, it rounds up to 500. When a number lands exactly halfway, everyone agrees to round up. One misunderstanding to drop: an estimate is not a wrong answer. It is a deliberately rough answer, chosen because speed matters more than the last digit — and its real job is telling you whether an exact answer is believable.",
    ],
    example: {
      problem: "At the book fair, one box holds 487 stickers and another holds 316. About how many stickers are there altogether, rounding each number to the nearest hundred? Then find the exact total and compare.",
      steps: [
        "Round 487 first: it sits between 400 and 500, and its tens digit is 8, putting it past the halfway mark of 450. It rounds up to 500.",
        "Round 316 next: it sits between 300 and 400, and its tens digit is 1, well below the halfway mark of 350. It rounds down to 300.",
        "Estimate: 500 + 300 = 800 stickers, quick enough to do while standing at the table.",
        "Now the exact sum: hundreds give 400 + 300 = 700, tens give 80 + 10 = 90, ones give 7 + 6 = 13, and 700 + 90 + 13 = 803.",
        "Compare the two results: 803 lands very close to the 800 estimate, so the exact answer is trustworthy. A result far away, like 703, would have warned you to recheck.",
      ],
      answer: "The estimate is 800 stickers and the exact total is 803 — the close match confirms the addition.",
    },
    selfQuestions: [
      "How do you find the two friendly neighbors a number sits between before you round it?",
      "When is a fast estimate more useful than a slow exact answer in everyday life?",
      "Why can rounding both numbers up make an estimate noticeably too high, and how could you adjust for that?",
      "What should you suspect when your exact answer lands far away from your estimate?",
    ],
  },
  measurement_units: {
    explanation: [
      "Every measurement is secretly a count. When a ribbon measures 125 centimeters, that means 125 copies of a small agreed-on chunk — one centimeter — fit along it end to end. Different kinds of measuring use different chunks: centimeters and meters for length, grams and kilograms for mass, milliliters and liters for liquid, minutes and hours for time. The chunk is called a unit, and a number without its unit is an unfinished sentence: 3 of what?",
      "Units come in sizes, and the sizes trade neatly: 100 centimeters make a meter, 1000 grams make a kilogram, 60 minutes make an hour. Switching to a smaller unit makes the number grow — 2 meters becomes 200 centimeters — while the actual length never changes; you are just counting with smaller chunks. The mistake to watch for is mixing units inside one calculation, like subtracting 75 centimeters straight from 2 meters. Always convert to matching units first, then do the arithmetic.",
    ],
    example: {
      problem: "A ribbon is 2 meters long. You snip off 75 centimeters to wrap a gift. How many centimeters of ribbon are left?",
      steps: [
        "You cannot subtract 75 from 2 directly, because meters and centimeters are different sized units. Put both lengths in the same unit first.",
        "One meter is 100 centimeters, so the ribbon is 2 × 100 = 200 centimeters long.",
        "Now subtract matching units: 200 − 75 = 125 centimeters of ribbon remain.",
        "Sense check: you cut off less than half of the ribbon, since 75 is less than half of 200, and 125 cm is a bit more than a full meter. That fits the story.",
      ],
      answer: "125 centimeters of ribbon remain — a little more than 1 full meter.",
    },
    selfQuestions: [
      "Why does a measurement need both a number and a unit before it tells you anything useful?",
      "When you switch from meters to centimeters, why does the number get bigger while the ribbon stays the same length?",
      "Which unit would you choose to weigh a paper clip, and what makes kilograms a clumsy choice for it?",
      "How is reading a clock a kind of measuring, and what units does it count?",
    ],
  },
  money: {
    explanation: [
      "Money is place value you can hold in your hand. A dollar is 100 cents, a quarter is 25 cents, a dime is 10, a nickel is 5, and a penny is 1. A price like $2.35 reads just like a place-value chart: 2 dollars, then 35 cents. Because the coins have fixed values, counting money rewards smart ordering — start with the biggest coins and bills, then let the small ones finish the job.",
      "The cashier's secret for making change is counting up instead of subtracting. To find the change from $5 on a $3.75 total, climb from $3.75 to $4.00 with a quarter, then from $4.00 to $5.00 with a dollar — change found, no borrowing needed. And drop the idea that more coins means more money: one quarter beats a pile of 20 pennies, because each coin's value, not the size of the pile, is what counts.",
    ],
    example: {
      problem: "You buy a notebook for $2.35 and a pen for $1.40. You pay with a $5 bill. How much change should you get back?",
      steps: [
        "Add the prices first, keeping dollars with dollars and cents with cents: $2 + $1 = $3, and 35 cents + 40 cents = 75 cents, so the total is $3.75.",
        "Change is the gap between what you handed over and what you spent: $5.00 − $3.75.",
        "Count up like a cashier: from $3.75, a quarter (25 cents) reaches $4.00, and one more dollar reaches $5.00.",
        "Add the count-up pieces: 25 cents + $1.00 = $1.25 of change.",
        "Check by going backwards: $3.75 + $1.25 = $5.00 exactly, so the change is right.",
      ],
      answer: "You should get $1.25 back from your $5 bill.",
    },
    selfQuestions: [
      "Why is counting up from the total often easier than subtracting when you make change?",
      "How can one quarter be worth more than a whole handful of pennies?",
      "What different sets of coins could make exactly 60 cents, and which set uses the fewest coins?",
      "How does knowing that 100 cents make a dollar help you add prices like $2.35 and $1.40?",
    ],
  },
  data_line_plots: {
    explanation: [
      "Numbers you collect from the real world — heights of plants, votes for a class pet, hours of sleep — are called data, and a messy list of them hides more than it shows. Putting data into a picture makes the story jump out. A tally chart counts in groups of five, a bar graph compares categories with bar heights, and a line plot stacks an X above a number line for every single measurement.",
      "When you read a line plot, remember what one X is: one real plant, one real vote, one real measurement. Reading the plot means counting and comparing Xs — totals, gaps, and clusters. The slippery spot is the tallest stack. A tall tower of Xs above the number 5 does not mean those plants are the tallest; it means 5 was the most common measurement. Height of a stack shows how often a value happened, while the position along the number line shows how big the value is. Keep those two directions straight and line plots become easy.",
    ],
    example: {
      problem: "A class measures 9 bean plants to the nearest inch and makes a line plot: 3 plants are 4 inches tall, 4 plants are 5 inches tall, and 2 plants are 6 inches tall. How much taller is the tallest plant than the shortest, and how many plants are at least 5 inches tall?",
      steps: [
        "Each X on the plot stands for one plant, stacked above its height. Count all the Xs first: 3 + 4 + 2 = 9, matching the 9 plants, so no measurement is missing.",
        "The smallest height with an X above it is 4 inches and the largest is 6 inches. The gap between tallest and shortest is 6 − 4 = 2 inches.",
        "For plants at least 5 inches tall, count the Xs above 5 and above 6: 4 + 2 = 6 plants.",
        "Notice the tallest stack sits above 5 inches. That tells you 5 inches was the most common height — not that those plants are the tallest ones in the group.",
      ],
      answer: "The tallest plant beats the shortest by 2 inches, and 6 of the 9 plants are at least 5 inches tall.",
    },
    selfQuestions: [
      "What can a line plot show you at a glance that a plain list of the same numbers hides?",
      "Why does the tallest stack of Xs point to the most common value rather than the biggest value?",
      "How would the plot change if one more plant grew to 6 inches, and what new comparisons could you make?",
      "What question would you like to survey your class about, and which kind of display would fit the answers best?",
    ],
  },
  area_perimeter: {
    explanation: [
      "A fence and a lawn answer two different questions about the same yard. Perimeter is the distance around the edge — what you would walk, or what a fence must cover. Area is the amount of flat space inside — what grass seed or floor tiles must fill. Because they measure different things, they use different units: perimeter is a plain length, like 22 meters, while area is counted in squares, like 28 square meters, where one square meter is a square one meter on each side.",
      "For a rectangle, both have honest shortcuts. Perimeter: add all four sides, remembering opposite sides match. Area: picture the inside covered by unit squares — they line up in equal rows, so multiplying the number of rows by the squares per row counts them all at once. Do not assume the two numbers travel together. Two shapes can share a perimeter while one encloses far more space, the way a long skinny hallway and a square room can need the same baseboard but very different amounts of carpet.",
    ],
    example: {
      problem: "A rectangular vegetable garden is 7 meters long and 4 meters wide. How many meters of fence does it need all the way around, and how many square meters of soil does it cover?",
      steps: [
        "Fence means perimeter, so walk the edge and add every side. The four sides measure 7, 4, 7, and 4 meters, and 7 + 4 + 7 + 4 = 22 meters of fence.",
        "Soil means area, so imagine covering the garden with 1-meter squares. They form 4 rows with 7 squares in each row.",
        "Count all the squares with one multiplication: 4 × 7 = 28, so the area is 28 square meters.",
        "Keep the units straight at the end: 22 meters of fence is a length around the outside, and 28 square meters of soil is a covering of the inside. Different questions, different units, no reason to match.",
      ],
      answer: "The garden needs 22 meters of fence and covers 28 square meters of soil.",
    },
    selfQuestions: [
      "Why is area measured in little squares while perimeter is measured in plain lengths?",
      "How could two gardens that use the same amount of fence cover different amounts of soil?",
      "How would you find the area of an L-shaped room, where one multiplication is not enough?",
      "Which jobs around your home call for perimeter, and which ones call for area?",
    ],
  },
  volume_intro: {
    explanation: [
      "Flat shapes get covered; solid shapes get filled. Volume measures how much space fits inside a 3D object, and its counting chunk is the unit cube — a little cube 1 centimeter along every edge holds exactly 1 cubic centimeter. Asking for the volume of a box is asking how many of those cubes pack inside with no gaps and no overlaps.",
      "You do not have to count cubes one at a time, because they stack in layers. The bottom layer of a box is just an area problem: cubes lined up in rows. Every layer above it is an identical copy, so multiply the cubes in one layer by the number of layers and the whole count is done. One caution from everyday life: taller does not automatically mean more room inside. A tall skinny vase can hold less water than a short wide bowl, because volume depends on all three directions — length, width, and height — not height alone.",
    ],
    example: {
      problem: "A small gift box is 5 centimeters long, 3 centimeters wide, and 2 centimeters tall. How many 1-centimeter cubes fit inside it exactly?",
      steps: [
        "Build the bottom layer first: it runs 5 cubes long and 3 cubes wide, so one full layer holds 5 × 3 = 15 cubes.",
        "The box stands 2 centimeters tall, and each layer is 1 centimeter tall, so exactly 2 layers stack inside.",
        "Two layers of 15 cubes make 15 × 2 = 30 cubes, so the volume is 30 cubic centimeters.",
        "Check by slicing a different way: the front wall is 5 cubes long and 2 cubes tall, holding 5 × 2 = 10 cubes, and 3 such walls fill the box with 10 × 3 = 30. Same count from a different direction, so the answer stands.",
      ],
      answer: "Exactly 30 unit cubes fit, so the box has a volume of 30 cubic centimeters.",
    },
    selfQuestions: [
      "How is filling a box with cubes different from covering its floor with flat squares?",
      "Why does the layer idea let you multiply instead of counting every single cube by hand?",
      "How could a short, wide container hold more water than a tall, narrow one?",
      "What happens to the number of cubes inside the box if it grows 1 centimeter taller, and why?",
    ],
  },
  shapes_2d_3d: {
    explanation: [
      "Shapes come in two big families. Flat shapes — triangles, squares, rectangles, circles — live on paper and are called 2D, short for two-dimensional, because they only have length and width. Solid shapes — cubes, spheres, cylinders, cones, and boxes called rectangular prisms — take up space in every direction, so they are 3D. Flat shapes are described by their sides and corners; solids are described by their faces (the flat surfaces), edges (where faces meet), and corners.",
      "The skill underneath all the names is sorting by properties instead of by looks. A shape with 4 straight sides is a quadrilateral no matter how lumpy it looks; add 4 square corners and it joins the rectangle family; make all the sides equal too and it is a square. One stubborn myth: tilting a square turns it into a diamond and it stops being a square. Untrue — turning a shape changes nothing about its sides or corners, so a tilted square is still a square. Always check properties, never the pose.",
    ],
    example: {
      problem: "A mystery shape has 4 straight sides. Its opposite sides are the same length, all 4 of its corners are square corners, and its sides are not all equal. Name the shape, and name the solid you get by stacking many paper copies of it into a tall pile.",
      steps: [
        "Start with the broadest clue: 4 straight sides makes the shape a quadrilateral, the family name for all four-sided flat shapes.",
        "The 4 square corners narrow it to the rectangle family, where opposite sides always come out equal — which matches the clue about opposite sides.",
        "Test whether it could be a square: a square needs all 4 sides equal, and the clues say the sides are not all equal. So it is a rectangle that is not a square.",
        "Now stack many paper rectangles straight up like a deck of cards. The pile grows into a solid with 6 flat rectangular faces — a rectangular prism, the shape of a cereal box.",
      ],
      answer: "The flat shape is a rectangle, and stacking copies of it builds a rectangular prism.",
    },
    selfQuestions: [
      "Why is every square a rectangle, while most rectangles are not squares?",
      "What stays the same about a triangle when you spin it or flip it over on the table?",
      "Which properties would you check to tell a cube apart from every other box shape?",
      "Where in your kitchen can you spot cylinders, spheres, and prisms, and what gives each one away?",
    ],
  },
  lines_angles_symmetry: {
    explanation: [
      "Fold a paper heart in half and the two sides match perfectly — that fold line is called a line of symmetry, and finding them is one of three closely related ideas. A line is a perfectly straight path; when two lines or sides meet at a corner, the amount of turn between them is an angle. A square corner, like the corner of a book, is called a right angle; smaller openings are sharp and pointy, wider ones are more open.",
      "Two honest tests keep these ideas trustworthy. For angles: the size of an angle is the size of the opening, not the length of the sides drawn. Two short pencils opened wide make a bigger angle than two long rulers opened barely at all — a very common mix-up. For symmetry: fold the shape, or imagine folding it, and see whether the halves land exactly on each other. Eyes can be fooled by halves that merely look the same size, but the fold test never lies.",
    ],
    example: {
      problem: "Take a paper rectangle that is longer than it is wide, like a postcard. How many lines of symmetry does it have? Test folds across the middle both ways and a fold along a diagonal.",
      steps: [
        "Remember what a line of symmetry is: a fold line where the two halves land exactly on top of each other. Folding is the honest test, so try each fold.",
        "Fold the postcard in half the short way, edge meeting edge: the two halves match perfectly. That middle fold is one line of symmetry.",
        "Fold it in half the long way: the halves match again, so that is a second line of symmetry.",
        "Now fold corner to corner along a diagonal. The two triangle halves are the same size, but they do not land on each other — corners poke out past the edges — so the diagonal fails the fold test.",
        "Count the folds that worked: only the two middle ones. A stretched rectangle has exactly 2 lines of symmetry; only a square earns 4.",
      ],
      answer: "A non-square rectangle has exactly 2 lines of symmetry — the two middle folds, never the diagonals.",
    },
    selfQuestions: [
      "Why does the fold test settle whether a line really is a line of symmetry?",
      "What makes one angle bigger than another — longer sides or a wider opening — and how could you check with two pencils?",
      "Which capital letters of the alphabet have a line of symmetry, and where does each fold go?",
      "Why does a square have more lines of symmetry than a stretched rectangle?",
    ],
  },
  coordinate_plane_intro: {
    explanation: [
      "A treasure map that says walk 3 steps east and 5 steps north is using the same idea as the coordinate plane. The plane is a grid built from two number lines: one running to the right and one running up, meeting at a starting corner where both read 0. Any spot on the grid gets an address made of two numbers in parentheses, like (3, 5): the first number says how many steps to go right from the corner, and the second says how many steps to go up.",
      "The order of the two numbers is a promise that everyone keeps: right first, then up. Break the promise and you land in the wrong place — (2, 6) means 2 right and 6 up, while (6, 2) means 6 right and 2 up, two genuinely different spots. So the most common error is simply swapping the pair. A good habit is to trace the path with a finger every time: start at the corner, slide right along the bottom, then climb straight up, and say the moves out loud as you go.",
    ],
    example: {
      problem: "On a park map, each grid step is 1 meter. The slide stands at the point (2, 1) and the water fountain stands at (2, 6). Describe where each one sits on the grid, then find the length of the straight walk from the slide to the fountain.",
      steps: [
        "Read each address the same way: first number is steps right from the corner of the map, second number is steps up. The slide sits 2 right and 1 up; the fountain sits 2 right and 6 up.",
        "Both points are exactly 2 steps right, so they stand on the same straight up-and-down grid line. Walking between them changes only the up direction.",
        "Count the climb from 1 up to 6 up: 6 − 1 = 5 grid steps, and each step on this map is 1 meter.",
        "So the straight walk is 5 meters. Note that (2, 6) is not the same spot as (6, 2) — swapping the numbers would send you somewhere else entirely.",
      ],
      answer: "The walk from the slide to the fountain is 5 meters, straight up the map.",
    },
    selfQuestions: [
      "Why do the two numbers in a point need a fixed order, like the parts of a street address?",
      "What routes do (3, 5) and (5, 3) each describe, and why do they end at different spots?",
      "How is naming a point on a grid like finding your seat in a movie theater?",
      "When two points share their first number, what does the picture look like, and how would you find the distance between them?",
    ],
  },
  patterns_relationships: {
    explanation: [
      "Mathematicians are pattern hunters. A pattern is a list that follows a rule — 4, 7, 10, 13 grows by 3 each time — and once you catch the rule, you can predict numbers far down the list without writing every step. Some patterns repeat, like the days of the week; others grow, like stacking one more block on a tower each day. Spotting the rule, saying it clearly, and using it to predict is the start of real algebraic thinking.",
      "The reliable hunting method is to compare neighbors: subtract each number from the next and see whether the jumps match. Here is the trap, though — checking only the first jump. The list 2, 4 could be adding 2, or it could be doubling, and the two rules disagree from the third number on. A rule is only trustworthy after it works for every number you were given. Once it survives that test, ride it forward, or use a shortcut: many equal jumps at once is just multiplication.",
    ],
    example: {
      problem: "A number pattern starts 4, 7, 10, 13, and keeps following the same rule. What is the 7th number in the pattern?",
      steps: [
        "Hunt for the rule by comparing neighbors: 7 − 4 = 3, then 10 − 7 = 3, then 13 − 10 = 3. Every jump adds 3, and the rule works for every pair given, not just the first.",
        "Ride the rule forward one step at a time: the 5th number is 13 + 3 = 16, the 6th is 16 + 3 = 19, and the 7th is 19 + 3 = 22.",
        "Confirm with the jump shortcut: getting from the 1st number to the 7th takes 6 jumps of 3, which is 6 × 3 = 18 in total, and 4 + 18 = 22.",
        "Both roads — stepping one jump at a time and jumping all at once — land on 22, so the answer is solid.",
      ],
      answer: "The 7th number in the pattern is 22.",
    },
    selfQuestions: [
      "Why should you test a pattern rule against every number you are given, not just the first two?",
      "How does the jump-counting shortcut save work when you need the 50th number instead of the 7th?",
      "What different rules could begin a pattern with 2 and then 4, and how would seeing more numbers settle which rule is right?",
      "Where do repeating or growing patterns show up in calendars, songs, or buildings around you?",
    ],
  },
};
