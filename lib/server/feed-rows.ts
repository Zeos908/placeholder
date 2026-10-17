import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedPost, PersonSummary } from "@/lib/types";

/** A row from get_feed / story_deck (SQL) → the FeedPost shape the client expects. */
export interface FeedRow extends Omit<FeedPost, "saved" | "friends_saved"> {
  friends_saved_count: number;
  friends_saved: PersonSummary[];
}

export function toFeedPost(row: FeedRow): FeedPost {
  const { friends_saved_count, friends_saved, ...listing } = row;
  return {
    ...listing,
    amount_usd: listing.amount_usd === null ? null : Number(listing.amount_usd),
    saved: false,
    friends_saved: { count: friends_saved_count, people: friends_saved ?? [] },
  };
}

/**
 * get_feed / story_deck predate the media columns, so their rows carry image_url but not the
 * clip or credit; this fills those in with one extra query per page.
 */
export async function withMedia(supabase: SupabaseClient, posts: FeedPost[]): Promise<FeedPost[]> {
  if (!posts.length) return posts;
  const { data, error } = await supabase
    .from("listings")
    .select("id, video_url, media_credit, media_credit_url")
    .in("id", posts.map((p) => p.id));
  if (error) console.error("[api] load media:", error.message);
  const byId = new Map((data ?? []).map((m) => [m.id as string, m]));
  return posts.map((p) => {
    const m = byId.get(p.id);
    return m ? { ...p, video_url: m.video_url, media_credit: m.media_credit, media_credit_url: m.media_credit_url } : p;
  });
}
