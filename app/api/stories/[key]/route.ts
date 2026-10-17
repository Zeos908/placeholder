import { NextResponse } from "next/server";
import { z } from "zod";
import { toFeedPost, type FeedRow } from "@/lib/server/feed-rows";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const keySchema = z.enum(["closing", "near", "friends"]);

/** GET /api/stories/[key]: the cards for one story's swipe deck. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const parsed = keySchema.safeParse((await params).key);
  if (!parsed.success) return NextResponse.json({ error: "Unknown story." }, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("story_deck", { p_key: parsed.data, p_limit: 50 });
  if (error) return NextResponse.json({ error: "Couldn't load this story." }, { status: 500 });
  return NextResponse.json((data as FeedRow[]).map(toFeedPost));
}
