import "server-only";
import { z } from "zod";

// Server-side env. Model IDs always come from here, never hard-coded in components (§3).
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  NVIDIA_API_KEY: z.string().min(1).optional(),
  NIM_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),
  CHAT_MODEL: z.string().min(1).default("nvidia/nemotron-3-ultra-550b-a55b"),
  IMAGE_MODEL: z.string().default(""),
  APP_URL: z.string().default("http://localhost:3000"),

  CHAT_DAILY_LIMIT: z.coerce.number().int().positive().default(30),
  PREFETCH_AHEAD: z.coerce.number().int().positive().default(10),
  IMAGE_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:you@example.com"),

  // Shared secret for /api/cron/* (Vercel Cron sends it as a Bearer token; pg_net can too).
  CRON_SECRET: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  cached ??= schema.parse(process.env);
  return cached;
}

/** Throws a readable error when a required key is missing, instead of failing deep inside a fetch. */
export function requireEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = env()[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing env var ${key}. Add it to .env.local (see .env.example).`);
  }
  return value as NonNullable<ServerEnv[K]>;
}
