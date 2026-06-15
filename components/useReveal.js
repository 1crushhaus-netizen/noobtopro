"use client";

import { useEffect, useRef, useState } from "react";

/* =============================================================================
   Shared motion primitives — extracted from the landing so the signed-in app
   reuses the SAME scroll-reveal + nav-condense behavior (one source of truth).
   Both are transform/opacity only and inherit the global prefers-reduced-motion
   kill-switch in globals.css (the .is-armed gate keeps content visible with JS
   off / for crawlers; the reduce media query un-hides anything left hidden).
   ========================================================================== */

// Arms a scroll-reveal observer over a subtree. Returns a ref to put on the
// subtree root and an `armed` flag (add `is-armed` to the root only once armed,
// so the page renders fully visible first, then the hidden-until-revealed state
// switches on). Elements opt in with [data-reveal] / [data-revealbar]; the
// observer sets a `data-inview` ATTRIBUTE (survives React re-renders) once each
// scrolls into view.
export function useScrollReveal() {
  const ref = useRef(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setArmed(true);
    const root = ref.current;
    if (!root) return undefined;
    const targets = root.querySelectorAll("[data-reveal],[data-revealbar]");
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.setAttribute("data-inview", ""));
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-inview", "");
            obs.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.01 }
    );
    targets.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return { ref, armed };
}

// True once the window has scrolled past the top — drives the sticky nav's
// condense-and-firm-up state (`is-scrolled`).
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}
