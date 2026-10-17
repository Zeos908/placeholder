import { NextResponse } from "next/server";
import { loadMe } from "@/lib/server/me";
import { applyProfileUpdate } from "@/lib/server/profile-update";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function sessionUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ? { id: data.user.id, email: data.user.email ?? null } : null };
}

/** GET /api/me: your profile, counts and shell badges. */
export async function GET() {
  const { supabase, user } = await sessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const me = await loadMe(supabase, user);
  return me ? NextResponse.json(me) : NextResponse.json({ error: "Profile not found." }, { status: 404 });
}

/** PATCH /api/me: partial profile update (Settings, Edit profile). */
export async function PATCH(req: Request) {
  const { supabase, user } = await sessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });

  const { data: current } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
  const result = await applyProfileUpdate(user.id, current?.avatar_url ?? null, body);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.field }, { status: result.status });
  return NextResponse.json(await loadMe(supabase, user));
}
