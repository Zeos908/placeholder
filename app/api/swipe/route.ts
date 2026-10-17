import { z } from "zod";
import { authed, body, check, route } from "@/lib/server/route";
import { issueUndoToken } from "@/lib/server/undo-token";
import type { SwipeResult } from "@/lib/types";

const schema = z.object({ listingId: z.uuid(), direction: z.enum(["right", "left"]) });

export interface SwipeRpc {
  listing_id: string;
  state: "saved" | "passed";
  prev: unknown;
  deltas: Record<string, number>;
  reminders: string[];
}

/**
 * POST /api/swipe {listingId, direction} (build spec §8): saved (interested) or passed, tag
 * weights learn, auto reminders on save. Returns a signed undo token good for 10 seconds.
 */
export const POST = route(async (req) => {
  const { supabase, user } = await authed();
  const { listingId, direction } = await body(req, schema);
  const r = check(
    await supabase.rpc("swipe_listing", { p_listing: listingId, p_direction: direction, p_learn: true }),
    "save that",
  ) as SwipeRpc;
  const result: SwipeResult = {
    state: r.state,
    undoToken: issueUndoToken({ u: user.id, l: listingId, prev: r.prev, d: r.deltas, r: r.reminders }),
  };
  return result;
});
