import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Story, StoryKey } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/stories (front-end spec §10): the stories row; empty stories are left out. */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_stories");
  if (error) return NextResponse.json({ error: "Couldn't load stories." }, { status: 500 });

  const stories: Story[] = (
    data as { key: StoryKey; count: number; unseen_count: number; avatars: string[] | null }[]
  ).map((s) => ({
    key: s.key,
    count: s.count,
    unseenCount: s.unseen_count,
    ...(s.key === "friends" && { avatars: s.avatars ?? [] }),
  }));
  return NextResponse.json(stories);
}
