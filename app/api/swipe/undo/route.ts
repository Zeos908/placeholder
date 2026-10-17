import { z } from "zod";
import { authed, body, check, HttpError, route } from "@/lib/server/route";
import { readUndoToken } from "@/lib/server/undo-token";

const schema = z.object({ undoToken: z.string().min(10).max(20_000) });

/** POST /api/swipe/undo {undoToken}: restores the previous state and weights (within 10 s). */
export const POST = route(async (req) => {
  const { supabase, user } = await authed();
  const { undoToken } = await body(req, schema);
  const p = readUndoToken(undoToken, user.id);
  if (p === "expired") throw new HttpError(410, "Too late to undo.");
  if (!p) throw new HttpError(400, "That can't be undone.");
  check(
    await supabase.rpc("undo_swipe", { p_listing: p.l, p_prev: p.prev, p_deltas: p.d, p_reminders: p.r }),
    "undo that",
  );
  return { ok: true };
});
