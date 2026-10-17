import "server-only";
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
