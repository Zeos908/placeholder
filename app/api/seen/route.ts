import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ listingIds: z.array(z.uuid()).min(1).max(100) });

/**
 * POST /api/seen (build spec §8): listings shown ≥ 2 s in the feed, or on top of a story deck.
 * Marks them 'seen' without ever overwriting a save or pass.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send 1–100 listing ids." }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_seen", { p_ids: parsed.data.listingIds });
  if (error) return NextResponse.json({ error: "Couldn't record that." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
