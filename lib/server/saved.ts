import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { byDeadline, LISTING_COLUMNS, toListing } from "@/lib/server/rows";
import { check } from "@/lib/server/route";
import type { AppStatus, OppType, SavedItem } from "@/lib/types";

interface Row {
  app_status: AppStatus | null;
  hidden_from_friends: boolean;
  decided_at: string | null;
  seen_at: string;
  listings: Record<string, unknown>;
}

const toSaved = (r: Row): SavedItem => ({
  listing: toListing(r.listings),
  app_status: r.app_status ?? "interested",
  hidden_from_friends: r.hidden_from_friends,
  saved_at: r.decided_at ?? r.seen_at,
});

/** The user's saved items, soonest deadline first (spec §9.6). */
export async function loadSaved(
  supabase: SupabaseClient,
  userId: string,
  opts: { type?: OppType | null; listingId?: string } = {},
): Promise<SavedItem[]> {
  let q = supabase
    .from("user_listings")
    .select(`app_status, hidden_from_friends, decided_at, seen_at, listings!inner(${LISTING_COLUMNS})`)
    .eq("user_id", userId)
    .eq("state", "saved");
  if (opts.type) q = q.eq("listings.type", opts.type);
  if (opts.listingId) q = q.eq("listing_id", opts.listingId);
  const rows = check(await q, "load your saved items") as unknown as Row[];
  return rows.map(toSaved).sort(byDeadline);
}
