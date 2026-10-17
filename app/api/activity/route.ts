import { summariesById } from "@/lib/server/people";
import { authed, check, HttpError, route } from "@/lib/server/route";
import type { ActivityItem, ActivityPage, OverlapItem, PersonSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE = 20;

interface ActivityRow {
  id: string;
  actor_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verb: ActivityItem["verb"];
  listing_id: string;
  created_at: string;
}

/**
 * GET /api/activity?cursor= (build spec §9.8): friends' saves/applications (only what they
 * share, via friend_activity) + overlap cards on the first page. Cursor = last created_at.
 */
export const GET = route(async (req) => {
  const { supabase } = await authed();
  const cursor = new URL(req.url).searchParams.get("cursor");
  if (cursor && Number.isNaN(Date.parse(cursor))) throw new HttpError(400, "Bad cursor.");

  const [events, overlaps] = await Promise.all([
    supabase.rpc("friend_activity", { p_limit: PAGE + 1, p_before: cursor }),
    cursor ? Promise.resolve({ data: [], error: null }) : supabase.rpc("saved_overlaps", { p_limit: 20 }),
  ]);
  const rows = check(events, "load activity") as ActivityRow[];
  const overlapRows = check(overlaps, "load activity") as { listing_id: string; friend_count: number; friends: PersonSummary[] }[];
  const page = rows.slice(0, PAGE);
  const summaries = await summariesById(supabase, [...page.map((r) => r.listing_id), ...overlapRows.map((o) => o.listing_id)]);

  const data: ActivityPage = {
    items: page.flatMap((r) => {
      const listing = summaries.get(r.listing_id);
      if (!listing) return [];
      const actor = { id: r.actor_id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url };
      return [{ id: r.id, actor, verb: r.verb, listing, created_at: r.created_at }];
    }),
    overlaps: overlapRows.flatMap<OverlapItem>((o) => {
      const listing = summaries.get(o.listing_id);
      return listing ? [{ listing, friend_count: o.friend_count, friends: o.friends ?? [] }] : [];
    }),
    nextCursor: rows.length > PAGE ? page[page.length - 1].created_at : null,
  };
  return data;
});
