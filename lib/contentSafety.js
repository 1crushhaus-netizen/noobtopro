// ---------------------------------------------------------------------------
// Lightweight safety gate for concept strings before they become PUBLIC in the
// concept hub. The concept text is user-INFLUENCED (it originates from the
// grader's reasoning over user-supplied work), so a generated guide is only made
// publicly browsable when its concept passes this check; otherwise the guide is
// still produced and returned to the opener, but kept hidden from the public
// directory (and can be re-checked / curated later).
//
// This is intentionally conservative and cheap (no network/LLM). It is a first
// line of defense, not a complete moderation system — see README §17.
// ---------------------------------------------------------------------------

// Obvious spam/abuse markers. Kept deliberately small + high-precision; the goal
// is to keep links, contact details, markup, and a few slurs out of the PUBLIC
// directory, not to be an exhaustive profanity filter.
// ReDoS-hardened forms. The host class still overlaps the trailing \. , but the
// repetition is BOUNDED ({1,255}, the max DNS name length) instead of unbounded `+`,
// so the per-start backtracking is a constant rather than O(n) — turning the old
// O(n²) worst case (seconds on a crafted ".a.a.a…" string) into linear time. Behavior
// is unchanged for any real concept label (well under 255 chars, gated at 120 upstream).
const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9.-]{1,255}\.(com|net|org|io|co|ru|xyz|info|biz|ai|app|dev|me|gg|sh|cc|tv|tech|online|site|link|click|shop|store|live|fyi|to|ly)\b)/i;
const EMAIL_RE = /[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,255}\.[a-z]{2,24}/i;
const MARKUP_RE = /[<>{}[\]\\]|&#|<\/?[a-z]/i;
// A high-confidence blocklist (substring, case-insensitive, also matched against the
// leet/separator-folded form below). HIGH PRECISION is the hard constraint: matching runs
// against a LETTERS-ONLY fold, so adjacent words concatenate ("moles to" → "molesto",
// "minus lutetium" → "minuslutetium", "for gypsum" → "forgypsum") — a short term can collide
// with real STEM prose. So every entry is either an unambiguous slur or an explicit sexual
// term LONG enough that no two STEM words fold into it (verified by the adversarial
// STEM-phrase cases in test/contentSafety.test.js). The list is deliberately NOT an
// exhaustive profanity filter — see README §17.
const BLOCKLIST = [
  // Existing high-confidence terms.
  "fuck", "shit", "bitch", "nigger", "faggot", "cunt", "porn", "viagra",
  // Slurs.
  "nigga",
  // Explicit sexual content (long, collision-free with STEM vocabulary).
  "blowjob", "handjob", "cumshot", "creampie", "deepthroat", "gangbang",
  "dildo", "bukkake", "masturbat", "cunnilingus",
  // Sexual exploitation / non-consensual content.
  "pedophil", "paedophil", "bestiality",
];

/**
 * Free-text safety screen for LONGER generated content (a generated question's text and its
 * concept label) before it is shown to a user — who may be a minor. Unlike isConceptSafe
 * below (a STRICT label gate: ≤120 chars, mostly-letters), this only screens the small,
 * high-confidence unsafe-word blocklist plus zero-width evasion, so it never rejects
 * legitimate STEM prose/notation (digits, operators, long sentences). A conservative first
 * line of defense; it is WIRED on /api/generate's output (audit 06 P1-1/P1-2). Returns true
 * (safe) for non-strings so a missing field never blocks generation.
 * @param {string} text
 * @returns {boolean}
 */
// Fold leetspeak + strip separators so obfuscated evasions ("sh1t", "f u c k",
// "f.a.g.g.o.t", "n​i​g​g​e​r") collapse to the base word before the blocklist runs
// (audit: the plain substring list was trivially bypassable). Letters-only output keeps
// matches high-precision on real STEM prose (digits/operators/punctuation are dropped, so
// the residual is only an English letter run).
function foldForBlocklist(s) {
  return s
    .replace(/[​-‍﻿]/g, "") // zero-width / BOM
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z]+/g, ""); // collapse spacing/punctuation between letters
}

export function isContentSafe(text) {
  if (typeof text !== "string") return true;
  // Check BOTH the lightly-cleaned form (plain words) AND the leet/separator-folded form
  // (obfuscated evasions). Either hit = unsafe.
  const cleaned = text.replace(/[​-‍﻿]/g, "").toLowerCase();
  const folded = foldForBlocklist(text);
  return !BLOCKLIST.some((w) => cleaned.includes(w) || folded.includes(w));
}

/**
 * Screen model-authored OUTPUT before returning it to a user who may be a minor (audit:
 * the grade response was previously unscreened, so an injected slur in the learner's
 * reasoning could be echoed back in the feedback). Returns `text` when safe, else a neutral
 * placeholder. Non-strings pass through unchanged.
 * @param {string} text
 * @param {string} [placeholder]
 * @returns {string}
 */
export function redactUnsafe(text, placeholder = "(removed for safety)") {
  if (typeof text !== "string") return text;
  return isContentSafe(text) ? text : placeholder;
}

/**
 * Is this concept LABEL safe to surface in the PUBLIC concept hub? Strict (short,
 * mostly-letters, no links/markup/slurs). NOTE: this is the intended chokepoint for when a
 * dynamic, user-influenced guide-cache path is (re-)enabled — the public hub currently
 * renders only the curated SEED list, so today nothing user-influenced reaches it. For the
 * generation path that DOES reach users, use isContentSafe above.
 *
 * INTENTIONALLY RESERVED / INERT (audit P2): this export is currently UNCALLED in production
 * — NO live publish path reaches it (the public hub renders only the curated seed list). It is
 * kept (and unit-tested) as the ready chokepoint to wire in the moment a user-influenced public
 * label path is enabled. Do NOT read its presence as an ACTIVE public-label filter today; the
 * live screen on user-facing generated output is isContentSafe/redactUnsafe above.
 * @param {string} concept display concept text (already length-capped upstream)
 * @returns {boolean}
 */
export function isConceptSafe(concept) {
  if (typeof concept !== "string") return false;
  const s = concept.trim();
  if (!s) return false;
  // Public directory entries should be short labels, not sentences/payloads.
  if (s.length > 120) return false;
  // Strip zero-width/BOM chars before pattern checks so a zero-width-split slur
  // or URL (e.g. "f​uck") can't slip past the blocklist / URL_RE.
  const cleaned = s.replace(/[​-‍﻿]/g, "");
  if (URL_RE.test(cleaned) || EMAIL_RE.test(cleaned) || MARKUP_RE.test(cleaned)) return false;
  const lower = cleaned.toLowerCase();
  if (BLOCKLIST.some((w) => lower.includes(w))) return false;
  // Must be mostly letters (allow spaces, digits, and common math/notation
  // punctuation). Count Unicode letters so accented/Greek STEM terms pass, while
  // symbol/emoji-dominated strings are still rejected.
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (letters < Math.max(3, Math.ceil(s.length * 0.5))) return false;
  return true;
}
