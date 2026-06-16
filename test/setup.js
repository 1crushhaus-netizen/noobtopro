// Global test setup. Reset the jsdom URL between tests so a view that synced a
// hash (e.g. Noobtopro writing #dashboard when you open the Dashboard) can't leak
// into the next test's mount — where the new view-from-hash deep-link would
// otherwise pick it up and start on the wrong view. Mirrors a real page load,
// which always begins from the URL the visitor actually requested. No-op in the
// node environment (API/lib tests), which has no window.
import { beforeEach } from "vitest";

beforeEach(() => {
  if (typeof window !== "undefined" && window.history && window.location) {
    try {
      window.history.replaceState(null, "", "/");
    } catch {
      /* locked-down history (rare) — ignore */
    }
  }
});
