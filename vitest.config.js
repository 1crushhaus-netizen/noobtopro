import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the repo root so the "@/..." import alias (declared in jsconfig.json
// for the app) also works inside tests.
const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");

export default defineConfig({
  // Use the automatic JSX runtime so test files don't need to import React.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["test/**/*.test.{js,jsx}"],
    // Resets the jsdom URL between tests (see test/setup.js); harmless in node.
    setupFiles: ["./test/setup.js"],
    // A whole test gets more headroom than a SINGLE async query (asyncUtilTimeout=5s in
    // test/setup.js). Under vitest 4, next/dynamic's lazy components resolve more slowly, so a
    // test that chains several findBy waits across a dynamic-loaded view could otherwise blow
    // the default 5s TEST timeout even though each query is fine. 20s leaves ample room.
    testTimeout: 20000,
    // Coverage gate (audit 08 P1: "no coverage gate"). Only active under `--coverage`
    // (the CI `test:coverage` step); the default `npm test` stays fast. Thresholds are set
    // conservatively just BELOW the current numbers (lines ≈82.9% / statements ≈80.7% /
    // functions ≈79.6% / branches ≈75.4%) so they catch a real regression without flaking on
    // minor changes. NOTE: these are GLOBAL (not perFile) thresholds — perFile was evaluated
    // but rejected because several existing, intentionally-thin modules (email.js, ogImage.jsx,
    // polar.js, supabase.js, store.js) sit far below the global average and would fail it. The
    // global numbers were ratcheted up toward the actuals instead, so adding a sizeable new
    // untested file now drags the aggregate under the gate and fails CI. Measures the app
    // source only (not tests/scripts/config/generated content data).
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/**", "components/**"],
      exclude: ["lib/guides/**", "lib/diagnosticItems/**", "**/*.test.{js,jsx}"],
      thresholds: { lines: 82, statements: 80, functions: 78, branches: 74 },
    },
  },
  resolve: {
    alias: { "@": root },
  },
});
