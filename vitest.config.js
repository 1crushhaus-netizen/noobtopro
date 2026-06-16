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
    // Coverage gate (audit 08 P1: "no coverage gate"). Only active under `--coverage`
    // (the CI `test:coverage` step); the default `npm test` stays fast. Thresholds are set
    // conservatively BELOW the current numbers (≈88% lines / 81% branches / 78% functions)
    // so they catch a real regression without flaking on minor changes. Measures the app
    // source only (not tests/scripts/config/generated content data).
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/**", "components/**"],
      exclude: ["lib/guides/**", "lib/diagnosticItems/**", "**/*.test.{js,jsx}"],
      thresholds: { lines: 80, statements: 80, functions: 70, branches: 70 },
    },
  },
  resolve: {
    alias: { "@": root },
  },
});
