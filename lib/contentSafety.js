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
const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9.-]+\.(com|net|org|io|co|ru|xyz|info|biz)\b)/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const MARKUP_RE = /[<>{}[\]\\]|&#|<\/?[a-z]/i;
// A tiny, high-confidence blocklist (substring, case-insensitive). Intentionally
// short — broad profanity lists cause false positives on legitimate STEM terms.
const BLOCKLIST = ["fuck", "shit", "bitch", "nigger", "faggot", "cunt", "porn", "viagra"];

/**
 * Is this concept string safe to surface in the PUBLIC hub?
 * @param {string} concept display concept text (already length-capped upstream)
 * @returns {boolean}
 */
export function isConceptSafe(concept) {
  if (typeof concept !== "string") return false;
  const s = concept.trim();
  if (!s) return false;
  // Public directory entries should be short labels, not sentences/payloads.
  if (s.length > 120) return false;
  if (URL_RE.test(s) || EMAIL_RE.test(s) || MARKUP_RE.test(s)) return false;
  const lower = s.toLowerCase();
  if (BLOCKLIST.some((w) => lower.includes(w))) return false;
  // Must be mostly letters (allow spaces, digits, and common math/notation
  // punctuation). Reject strings dominated by symbols/emoji.
  const letters = (s.match(/[a-z]/gi) || []).length;
  if (letters < Math.max(3, Math.ceil(s.length * 0.5))) return false;
  return true;
}
