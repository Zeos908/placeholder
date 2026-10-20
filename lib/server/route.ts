import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** A failure with a status and a student-facing message (never raw database text). */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export interface Ctx {
  supabase: SupabaseClient;
  user: User;
}

/** The signed-in user's Supabase client, or 401. */
export async function authed(): Promise<Ctx> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new HttpError(401, "Sign in required");
  return { supabase, user: data.user };
}

/**
 * 403 for guests (anonymous accounts) on social features. The database blocks these too (RLS);
 * this just gives a readable message first.
 */
export function requireAccount(user: User, what = "add friends and share") {
  if (user.is_anonymous) throw new HttpError(403, `Create an account to ${what}.`, "guest");
}

export async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  return parsed.data;
}

/** Throws a 500 (logged server-side) when a Supabase call failed. */
export function check<T>(res: { data: T; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[api] ${what}:`, res.error.message);
    throw new HttpError(500, `Couldn't ${what}. Try again.`);
  }
  return res.data;
}

type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response | unknown>;

/** Wraps a route: HttpError → its status; anything else → generic 500. Plain values → JSON. */
export function route<P = Record<string, string>>(fn: Handler<P>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      console.error("[api] unexpected:", e);
      return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}
