import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// End-to-end API checks against a running real-mode dev server + the Supabase project in
// .env.local (npm run test:e2e). Start the server first: npm run dev (E2E_BASE_URL to override).
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/e2e-api.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 90_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
}));
