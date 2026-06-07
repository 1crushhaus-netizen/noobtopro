// ---------------------------------------------------------------------------
// DETERMINISTIC PRE-GRADER DOCKING GATE (anti-"idk" lever, no LLM call).
//
// Before the grading routes spend a Groq call on a learner's reasoning, this gate
// catches answers with NOTHING to grade — empty, "I don't know"/"pass", a too-short
// off-topic fragment, or keyboard-mash gibberish — and FORCES a low outcome + an
// all-zero rubric. This DOCKS the attempt (drives the rating DOWN via the Elo
// outcome), it doesn't merely withhold points: gaming the score by spamming blank /
// "idk" submissions now costs rating instead of being a no-op. It is fully
// deterministic (same input → same verdict) so it's unit-testable in CI with no key,
// and it saves the (most expensive) grade call on exactly the inputs least worth it.
//
// Conservative by design: it only fires when an answer is CLEARLY non-substantive.
// Anything with digits, math operators, or a couple of real multi-letter words is
// passed through to the LLM grader (which applies the anchored rubric + penalties).
// ---------------------------------------------------------------------------

import { normalizeRubric } from "@/lib/scoring";

// The forced reasoning score for a docked answer (single digits — matches the
// "blank / I don't know scores in the single digits" rule in the grader prompts).
export const DOCK_SCORE = 3;

// Whole-answer "no answer" phrases. If, after normalization, the entire response is
// (essentially) one of these, there is nothing to grade.
const NO_ANSWER_PHRASES = new Set([
  "idk", "i dont know", "i do not know", "dont know", "do not know", "dunno", "no idea",
  "noidea", "no clue", "not sure", "unsure", "pass", "skip", "next", "na", "n a",
  "none", "nothing", "no", "nope", "blank", "?", "??", "???", "help", "idr",
  "i dont remember", "cant remember", "cannot remember", "no answer", "i give up", "give up",
]);

// Math / science reasoning markers — presence of any of these means the answer has
// at least some substantive content and should reach the real grader.
const HAS_DIGIT = /[0-9]/;
const HAS_MATH_OP = /[=+\-*/^√∫∑∂πΔ<>%]|\\frac|\\int|\\sum|sqrt|\bmol\b|\bmole?s?\b/i;

// Strip to a comparable form: lowercase, drop apostrophes (so "don't" → "dont", "i
// don't know" matches the phrase set), turn other punctuation into spaces, collapse.
function normalize(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Vowel ratio over alphabetic characters — real prose sits well above ~0.2; keyboard
// mash ("asdfghjkl", "qwerty") and consonant runs fall far below it.
function vowelRatio(letters) {
  if (!letters.length) return 1; // no letters => don't flag on this signal alone
  let v = 0;
  for (const c of letters) if ("aeiouy".includes(c)) v++;
  return v / letters.length;
}

// Detect obvious gibberish / keyboard mash: a long token with almost no vowels, or a
// single very long unbroken token, or overall alpha text with an implausibly low
// vowel ratio. Tuned conservatively so legitimate notation ("e^x", "H2O", "ΔG") and
// normal prose are never flagged.
function looksLikeGibberish(raw, norm) {
  // A digit or math operator anywhere means there's substantive content to grade — never
  // flag such an answer as gibberish (mirrors the "too short / off-topic" rule's escape).
  // Without this, a genuine numeric result ("100000000", "x = 1111111") trips the
  // distinct-character heuristic below, contradicting the gate's own "anything with
  // digits or math operators is passed through" rule.
  if (HAS_DIGIT.test(raw) || HAS_MATH_OP.test(raw)) return false;
  const tokens = norm.split(" ").filter(Boolean);
  if (tokens.length === 0) return false;
  // A single unbroken run longer than any real word (no spaces) — e.g. "asdkfjaslkdfjqwe".
  const longest = tokens.reduce((m, t) => Math.max(m, t.length), 0);
  if (tokens.length <= 2 && longest >= 18) {
    const lettersOnly = norm.replace(/[^a-z]/g, "");
    if (lettersOnly.length >= 12 && vowelRatio(lettersOnly) < 0.18) return true;
  }
  // Mostly-alphabetic text of reasonable length with a vowel ratio far below prose.
  const lettersOnly = norm.replace(/[^a-z]/g, "");
  if (lettersOnly.length >= 16 && vowelRatio(lettersOnly) < 0.12) return true;
  // A single character (or two) repeated to fill the box ("aaaaaaaa", "kkkk kkkk").
  const distinct = new Set(norm.replace(/\s/g, "")).size;
  if (norm.replace(/\s/g, "").length >= 8 && distinct <= 2) return true;
  return false;
}

/**
 * Decide whether an answer should be docked WITHOUT calling the LLM.
 *
 * @param {string} reasoning  The learner's free-text reasoning (already length-capped
 *                            by the route is fine; this is robust to any string).
 * @returns {null | {docked:true, reason:string, reasoningScore:number, rubric:object,
 *                   weakConcepts:string[], correctnessNote:string, socraticHint:string,
 *                   microLesson:string, comment:string}}
 *   null  → not docked; send to the grader.
 *   object → a complete, grader-shaped verdict the route can return directly (low
 *            score + all-zero rubric + generic, answer-free coaching).
 */
export function preGradeDock(reasoning) {
  const raw = typeof reasoning === "string" ? reasoning : "";
  const trimmed = raw.trim();
  const norm = normalize(trimmed);

  let reason = null;
  if (trimmed === "" || norm === "") {
    reason = "empty";
  } else if (NO_ANSWER_PHRASES.has(norm)) {
    reason = "no-answer phrase";
  } else if (
    // Too short AND off-topic: a tiny fragment with no digits, no math operators, and
    // at most one real word — nothing a grader could assess. ("blue", "yes", "ok lol")
    norm.replace(/\s/g, "").length <= 12 &&
    !HAS_DIGIT.test(trimmed) &&
    !HAS_MATH_OP.test(trimmed) &&
    norm.split(" ").filter((w) => w.length >= 2).length <= 1
  ) {
    reason = "too short / off-topic";
  } else if (looksLikeGibberish(raw, norm)) {
    reason = "gibberish";
  }

  if (!reason) return null;

  return {
    docked: true,
    reason,
    reasoningScore: DOCK_SCORE,
    rubric: normalizeRubric(null), // all zeros
    weakConcepts: [],
    correctnessNote: "",
    socraticHint:
      "Start by writing down what the question is actually asking, then your very first step — even a rough guess you can refine.",
    microLesson: "",
    // Post-grade feedback shape. A docked answer gets a constructive nudge — and
    // CRUCIALLY no worked solution: the solution is revealed only after a SUBSTANTIVE
    // attempt, so a learner can't extract the answer by submitting "idk"/blank.
    strengths: [],
    improvements: [
      "Write out your actual reasoning — even a rough first step — then submit. The full worked solution is shown once you make a genuine attempt.",
    ],
    workedSolution: "", // never revealed for a non-attempt
    comment:
      "There was no substantive reasoning to grade. Give the problem a genuine attempt — explain your thinking step by step — and you'll get specific feedback.",
  };
}
