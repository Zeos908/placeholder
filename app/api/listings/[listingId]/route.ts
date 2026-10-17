import { z } from "zod";
import { LISTING_COLUMNS, toListing } from "@/lib/server/rows";
import { authed, check, HttpError, route } from "@/lib/server/route";
import type { ChecklistItem, FriendsSaved, ListingDetail, Reminder } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/listings/[listingId]: the listing plus your state, checklist, reminders, friends. */
export const GET = route<{ listingId: string }>(async (_req, { params }) => {
  const { supabase, user } = await authed();
  const { listingId } = await params;
  if (!z.uuid().safeParse(listingId).success) throw new HttpError(404, "Listing not found.");

  const [listing, mine, checklist, reminders, friends] = await Promise.all([
    supabase.from("listings").select(LISTING_COLUMNS).eq("id", listingId).maybeSingle(),
    supabase
      .from("user_listings")
      .select("state, app_status, hidden_from_friends")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .maybeSingle(),
    supabase
      .from("checklist_items")
      .select("id, text, done, position")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .order("position"),
    supabase
      .from("reminders")
      .select("id, listing_id, remind_at, title, note, source, sent_at")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .is("sent_at", null)
      .order("remind_at"),
    supabase.rpc("listing_friends_saved", { p_listing: listingId }),
  ]);
  const row = check(listing, "load that listing");
  if (!row) throw new HttpError(404, "Listing not found.");
  const m = check(mine, "load that listing");

  const detail: ListingDetail = {
    listing: toListing(row as Record<string, unknown>),
    state: m?.state ?? null,
    app_status: m?.state === "saved" ? (m.app_status ?? "interested") : null,
    hidden_from_friends: m?.hidden_from_friends ?? false,
    checklist: (check(checklist, "load the checklist") ?? []) as ChecklistItem[],
    reminders: (check(reminders, "load reminders") ?? []) as Reminder[],
    friends_saved: (check(friends, "load friends") ?? { count: 0, people: [] }) as FriendsSaved,
  };
  return detail;
});
