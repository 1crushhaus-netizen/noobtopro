// Global test setup. Reset the jsdom URL between tests so a view that synced a
// hash (e.g. Noobtopro writing #dashboard when you open the Dashboard) can't leak
// into the next test's mount — where the new view-from-hash deep-link would
// otherwise pick it up and start on the wrong view. Mirrors a real page load,
// which always begins from the URL the visitor actually requested. No-op in the
// node environment (API/lib tests), which has no window.
import { beforeEach } from "vitest";
import { configure } from "@testing-library/dom";

// Give findBy*/waitFor more headroom than the 1000ms default. The component suite renders a
// large async shell (generate → grade → persist round-trips); on a loaded CI runner the
// default occasionally times out a legitimately-pending assertion (flake, not a real
// failure). 5s is still a fast ceiling that only the slow cases ever approach.
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => {
  if (typeof window !== "undefined" && window.history && window.location) {
    try {
      window.history.replaceState(null, "", "/");
    } catch {
      /* locked-down history (rare) — ignore */
    }
  }
});
