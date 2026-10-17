import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Undo is allowed for 10 seconds after a swipe (build spec §8). */
const UNDO_MS = 10_000;

export interface UndoPayload {
  u: string; // user id
  l: string; // listing id
  prev: unknown; // previous user_listings row, or null
  d: Record<string, number>; // tag-weight deltas applied
  r: string[]; // reminder ids created
  t: number; // issued at (ms)
}

function secret() {
  const s = process.env.UNDO_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("UNDO_TOKEN_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is not set");
  return s;
}

const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

/** Signed so a client can't hand back made-up weight deltas or rows. */
export function issueUndoToken(p: Omit<UndoPayload, "t">): string {
  const data = Buffer.from(JSON.stringify({ ...p, t: Date.now() })).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function readUndoToken(token: string, userId: string): UndoPayload | "expired" | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const p = JSON.parse(Buffer.from(data, "base64url").toString()) as UndoPayload;
  if (p.u !== userId) return null;
  if (Date.now() - p.t > UNDO_MS) return "expired";
  return p;
}
