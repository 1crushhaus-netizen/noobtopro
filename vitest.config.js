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
  },
  resolve: {
    alias: { "@": root },
  },
});
