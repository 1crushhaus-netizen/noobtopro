import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the repo root so the "@/..." import alias (declared in jsconfig.json
// for the app) also works inside tests.
const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
  },
  resolve: {
    alias: { "@": root },
  },
});
