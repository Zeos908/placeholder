import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit and component tests (front-end spec §21): jsdom + MSW, no back end. `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "tests/rls.test.ts"],
    css: false,
  },
});
