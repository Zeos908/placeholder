import { z } from "zod";
import { authed, check, HttpError, route } from "@/lib/server/route";
import { issueUndoToken } from "@/lib/server/undo-token";
import type { SwipeRpc } from "@/app/api/swipe/route";

/** POST /api/saved/[listingId]/unsave: moves it to Passed (no weight learning); undoable. */
export const POST = route<{ listingId: string }>(async (_req, { params }) => {
  const { supabase, user } = await authed();
  const { listingId } = await params;
  if (!z.uuid().safeParse(listingId).success) throw new HttpError(404, "Not in your saved list.");

  const { data: row } = await supabase
    .from("user_listings")
    .select("state")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (row?.state !== "saved") throw new HttpError(404, "Not in your saved list.");

  const r = check(
    await supabase.rpc("swipe_listing", { p_listing: listingId, p_direction: "left", p_learn: false }),
    "unsave that",
  ) as SwipeRpc;
  return {
    state: "passed",
    undoToken: issueUndoToken({ u: user.id, l: listingId, prev: r.prev, d: r.deltas, r: r.reminders }),
  };
});
