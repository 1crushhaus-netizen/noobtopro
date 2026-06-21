// ---------------------------------------------------------------------------
// Consent-gated analytics. ePrivacy Art. 5(3) requires PRIOR opt-in consent before any
// non-essential tracking. ConsentManager mounts <Analytics/> / <SpeedInsights/> / Ahrefs
// only after an explicit grant — but Vercel's track() buffers events to an in-memory queue
// when the script isn't loaded yet, which would be FLUSHED (and sent) the moment the script
// loads on a later grant. So a raw track() call before consent could be transmitted
// retroactively. This wrapper suppresses track() entirely until consent is "granted", so no
// pre-consent event is ever captured or queued.
//
// Single source of truth for the consent key (ConsentManager imports it from here).
// ---------------------------------------------------------------------------

import { track as vercelTrack } from "@vercel/analytics";

// The consent decision is persisted as a JSON record so it is an auditable proof of consent
// (GDPR Art 7(1)) carrying WHAT was decided, WHEN, and against WHICH policy version — not a bare
// string. Bump CONSENT_VERSION whenever the cookie/consent disclosure materially changes (a newer
// version than the stored one lets the banner re-ask). A legacy bare "granted"/"denied" string is
// still read for back-compat.
export const CONSENT_STORAGE_KEY = "noobtopro:consent";
export const CONSENT_VERSION = "2026-06-19";

// Parse the stored record → { choice, ts?, version? } | null. Tolerates the legacy bare string.
function readConsentRecord() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    if (raw === "granted" || raw === "denied") return { choice: raw }; // legacy format
    const o = JSON.parse(raw);
    return o && (o.choice === "granted" || o.choice === "denied") ? o : null;
  } catch {
    return null;
  }
}

// Is a stored record's policy version at least the CURRENT disclosure version? A decision
// recorded against an OLDER disclosure — or a legacy/unversioned record (no `version`, written
// before consent records were versioned) — is treated as STALE. CONSENT_VERSION is an ISO date,
// which sorts lexicographically = chronologically, so a plain string compare is a correct
// "same-or-newer" test.
function isCurrentConsentVersion(version) {
  return typeof version === "string" && version >= CONSENT_VERSION;
}

// The stored choice ("granted" | "denied"), or null when undecided/unreadable — OR when the
// stored decision is STALE (recorded against an older disclosure version, or legacy/unversioned).
// A stale decision is reported as "undecided" so ConsentManager re-asks and non-essential
// analytics stay off until a fresh opt-in, per the policy in this file's header (ePrivacy: a
// materially-changed disclosure needs fresh consent). Bumping CONSENT_VERSION is therefore the
// single lever to re-prompt every returning visitor.
export function readConsentChoice() {
  const rec = readConsentRecord();
  if (!rec || !isCurrentConsentVersion(rec.version)) return null;
  return rec.choice;
}

// Persist the decision as an auditable record (choice + timestamp + policy version). Returns the
// record (or null on a storage failure — the caller still has the in-memory choice for the session).
export function writeConsent(choice) {
  if (typeof window === "undefined" || (choice !== "granted" && choice !== "denied")) return null;
  const rec = { choice, ts: new Date().toISOString(), version: CONSENT_VERSION };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* storage blocked — the in-memory choice still gates this session */
  }
  return rec;
}

// Has the visitor given prior opt-in consent for non-essential analytics? Deny-by-default:
// undecided / denied / unreadable storage all return false (no tracking).
export function hasAnalyticsConsent() {
  return readConsentChoice() === "granted";
}

// Drop-in replacement for @vercel/analytics' track(): a no-op unless analytics consent is
// granted. Never throws — analytics must not break a user flow.
export function track(name, props) {
  if (!hasAnalyticsConsent()) return;
  try {
    return props === undefined ? vercelTrack(name) : vercelTrack(name, props);
  } catch {
    /* analytics is best-effort; ignore */
  }
}
