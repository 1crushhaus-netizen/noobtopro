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
const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9.-]+\.(com|net|org|io|co|ru|xyz|info|biz|ai|app|dev|me|gg|sh|cc|tv|tech|online|site|link|click|shop|store|live|fyi|to|ly)\b)/i;
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
