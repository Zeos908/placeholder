import { toFeedPost, type FeedRow } from "@/lib/server/feed-rows";
import { toSummary } from "@/lib/server/rows";
import { loadSaved } from "@/lib/server/saved";
import { authed, check, route } from "@/lib/server/route";
import type { RightPanelData } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/right-panel (front-end spec §6): closing soon (your saves) + friends saved. */
export const GET = route(async () => {
  const { supabase, user } = await authed();
  const [saved, friends] = await Promise.all([
    loadSaved(supabase, user.id),
    supabase.rpc("story_deck", { p_key: "friends", p_limit: 5 }),
  ]);
  const now = Date.now();
  const data: RightPanelData = {
    closingSoon: saved.filter((s) => s.listing.deadline && new Date(s.listing.deadline).getTime() > now).slice(0, 5),
    friendsSaved: (check(friends, "load friends' saves") as FeedRow[]).map((r) => {
      const post = toFeedPost(r);
      return { ...toSummary(post as unknown as Record<string, unknown>), people: post.friends_saved.people };
    }),
  };
  return data;
});
