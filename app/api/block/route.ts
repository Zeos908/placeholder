import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/block: people you've blocked (public card fields only). */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_blocked_users");
  if (error) return NextResponse.json({ error: "Couldn't load blocked accounts." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

const bodySchema = z.object({ userId: z.uuid() });

/** POST /api/block {userId}: block someone (a trigger removes any friendship). */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown user." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (data.user.id === parsed.data.userId) return NextResponse.json({ error: "You can't block yourself." }, { status: 400 });

  const { error } = await supabase
    .from("blocks")
    .upsert({ blocker_id: data.user.id, blocked_id: parsed.data.userId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Couldn't block. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
