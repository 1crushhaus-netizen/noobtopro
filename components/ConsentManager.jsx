"use client";

import { useEffect, useRef, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { readConsentChoice, writeConsent } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// ConsentManager — EU/ePrivacy prior-consent gate for the NON-essential analytics.
//
// noobtopro is EU-established, so ePrivacy Art. 5(3) requires PRIOR consent before any
// non-essential storage/processing on the device. The three analytics tools — Vercel Web
// Analytics, Vercel Speed Insights, and Ahrefs Web Analytics — therefore load ONLY after
// the visitor opts in. Until then nothing analytics-related runs.
//
// Design:
//   * Opt-in (deny by default). The choice persists in localStorage ("noobtopro:consent" =
//     "granted" | "denied"). With no stored choice, the banner is shown.
//   * Global Privacy Control: navigator.globalPrivacyControl === true (or DNT) is treated as
//     a standing opt-OUT — we record "denied" and skip the banner (the visitor already
//     signaled). An explicit later "Accept" still overrides it.
//   * Withdrawable as easily as given: a "Cookie preferences" control anywhere can dispatch
//     the `noobtopro:open-consent` window event to reopen the banner and switch the choice.
//   * Essential cookies (sign-in, security, the consent flag itself) are exempt and always on.
//
// Replaces the unconditional <Analytics/> / <SpeedInsights/> / Ahrefs <script> that used to
// load in the root layout for everyone.
// ---------------------------------------------------------------------------

export const OPEN_CONSENT_EVENT = "noobtopro:open-consent";

function readStoredChoice() {
  return readConsentChoice();
}

// A standing browser opt-out signal (Global Privacy Control / legacy Do-Not-Track).
function hasOptOutSignal() {
  if (typeof navigator === "undefined") return false;
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1";
}

export default function ConsentManager({ ahrefsKey }) {
  // choice: null (undecided) | "granted" | "denied". showBanner is independent so the
  // banner can be reopened later to CHANGE an existing choice.
  const [choice, setChoice] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ahrefsInjected = useRef(false);

  // Resolve the initial state on the client only (localStorage / GPC aren't available on the
  // server, and the banner must never appear in SSR HTML).
  useEffect(() => {
    setMounted(true);
    const stored = readStoredChoice();
    if (stored) {
      setChoice(stored);
      return;
    }
    if (hasOptOutSignal()) {
      // Respect the standing signal without nagging: deny, no banner. We do NOT persist it,
      // so if the visitor later clears the signal the banner returns.
      setChoice("denied");
      return;
    }
    setShowBanner(true);
  }, []);

  // Reopen the banner to change a prior choice (from a "Cookie preferences" control).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOpen = () => setShowBanner(true);
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onOpen);
  }, []);

  // Ahrefs Web Analytics: inject ONCE, only after consent. analytics.ahrefs.com is allow-listed
  // in the CSP script-src (host-source), so the dynamically-added tag needs no nonce. We can't
  // un-load an already-loaded script if consent is later withdrawn, so we only ever inject after
  // an explicit grant (and never on the server).
  useEffect(() => {
    if (choice !== "granted" || !ahrefsKey || ahrefsInjected.current) return;
    if (typeof document === "undefined") return;
    if (document.querySelector('script[data-noobtopro-ahrefs]')) {
      ahrefsInjected.current = true;
      return;
    }
    const s = document.createElement("script");
    s.src = "https://analytics.ahrefs.com/analytics.js";
    s.dataset.key = ahrefsKey;
    s.setAttribute("data-noobtopro-ahrefs", "1");
    s.async = true;
    document.head.appendChild(s);
    ahrefsInjected.current = true;
  }, [choice, ahrefsKey]);

  function decide(value) {
    setChoice(value);
    setShowBanner(false);
    writeConsent(value); // persist an auditable {choice, ts, version} record (storage-safe)
  }

  if (!mounted) return null;

  return (
    <>
      {/* The trackers mount only on an explicit grant. Vercel's components self-inject their
          scripts; conditional mounting is the gate. */}
      {choice === "granted" && (
        <>
          <SpeedInsights />
          <Analytics />
        </>
      )}

      {showBanner && (
        <div
          className="np-consent"
          role="dialog"
          aria-modal="false"
          aria-labelledby="np-consent-title"
          aria-describedby="np-consent-desc"
        >
          <div className="np-consent-body">
            <h2 id="np-consent-title" className="np-consent-title">Cookies &amp; analytics</h2>
            <p id="np-consent-desc" className="np-consent-text">
              We&rsquo;d like to use privacy-friendly analytics (Vercel and Ahrefs) to see how the site
              is used and improve it. These load <strong>only if you accept</strong>. Essential cookies for
              sign-in and security are always on. See our{" "}
              <a href="/privacy">Privacy Policy</a>.
            </p>
          </div>
          <div className="np-consent-actions">
            <button className="np-btn np-secondary np-consent-btn" onClick={() => decide("denied")}>
              Reject
            </button>
            <button className="np-btn np-primary np-consent-btn" onClick={() => decide("granted")}>
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
