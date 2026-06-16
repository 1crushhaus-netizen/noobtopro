// Global test setup. Reset the jsdom URL between tests so a view that synced a
// hash (e.g. Noobtopro writing #dashboard when you open the Dashboard) can't leak
// into the next test's mount — where the new view-from-hash deep-link would
// otherwise pick it up and start on the wrong view. Mirrors a real page load,
// which always begins from the URL the visitor actually requested. No-op in the
// node environment (API/lib tests), which has no window.
import { beforeEach } from "vitest";
import { configure } from "@testing-library/dom";

// Give findBy*/waitFor more headroom than the 1000ms default. The component suite renders a
// large async shell (generate → grade → persist round-trips); on a loaded CI runner a
// legitimately-pending assertion can lag past a short ceiling (flake, not a real failure).
// This single global ceiling is shared by 100+ async queries across the suite, and the slow
// one is non-deterministic across runs (a per-call override would just relocate the flake to
// the next unlucky query), so the fix is to raise the ceiling here. 15s stays comfortably
// below the 20s per-test `testTimeout` (vitest.config.js) so a genuinely hung test still
// fails fast with a real testing-library error rather than a confusing test-level timeout.
configure({ asyncUtilTimeout: 15000 });

beforeEach(() => {
  if (typeof window !== "undefined" && window.history && window.location) {
    try {
      window.history.replaceState(null, "", "/");
    } catch {
      /* locked-down history (rare) — ignore */
    }
  }
});
