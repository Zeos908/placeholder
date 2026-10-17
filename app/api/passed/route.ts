import { LISTING_COLUMNS, toListing } from "@/lib/server/rows";
import { authed, check, route } from "@/lib/server/route";
import type { PassedItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/passed: passed items, most recent first. */
export const GET = route(async () => {
  const { supabase, user } = await authed();
  const rows = check(
    await supabase
      .from("user_listings")
      .select(`decided_at, seen_at, listings!inner(${LISTING_COLUMNS})`)
      .eq("user_id", user.id)
      .eq("state", "passed")
      .order("decided_at", { ascending: false }),
    "load your passed items",
  ) as unknown as { decided_at: string | null; seen_at: string; listings: Record<string, unknown> }[];
  const items: PassedItem[] = rows.map((r) => ({ listing: toListing(r.listings), passed_at: r.decided_at ?? r.seen_at }));
  return items;
});
