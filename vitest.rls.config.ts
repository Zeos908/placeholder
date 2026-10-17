import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// RLS tests run against the real Supabase project in .env.local (npm run test:rls).
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/rls.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
}));
