import { z } from "zod";
import { authed, check, HttpError, route } from "@/lib/server/route";

/** POST /api/passed/[listingId]/restore: back into the feed pool (deletes the row). */
export const POST = route<{ listingId: string }>(async (_req, { params }) => {
  const { supabase, user } = await authed();
  const { listingId } = await params;
  if (!z.uuid().safeParse(listingId).success) throw new HttpError(404, "Not in your passed list.");
  const rows = check(
    await supabase
      .from("user_listings")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .eq("state", "passed")
      .select("listing_id"),
    "restore that",
  );
  if (!rows?.length) throw new HttpError(404, "Not in your passed list.");
  return { ok: true };
});
