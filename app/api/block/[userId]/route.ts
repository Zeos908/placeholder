import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** DELETE /api/block/[userId]: unblock. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const parsed = z.uuid().safeParse((await params).userId);
  if (!parsed.success) return NextResponse.json({ error: "Unknown user." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { error } = await supabase.from("blocks").delete().eq("blocker_id", data.user.id).eq("blocked_id", parsed.data);
  if (error) return NextResponse.json({ error: "Couldn't unblock. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
