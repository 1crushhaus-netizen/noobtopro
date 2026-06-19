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

// Matches the value ConsentManager persists: "granted" | "denied" (absent = undecided).
export const CONSENT_STORAGE_KEY = "noobtopro:consent";

// Has the visitor given prior opt-in consent for non-essential analytics? Deny-by-default:
// undecided / denied / unreadable storage all return false (no tracking).
export function hasAnalyticsConsent() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY) === "granted";
  } catch {
    return false;
  }
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
