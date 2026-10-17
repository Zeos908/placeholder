import { z } from "zod";
import { loadSaved } from "@/lib/server/saved";
import { authed, body, check, HttpError, route } from "@/lib/server/route";

const schema = z
  .object({
    app_status: z.enum(["interested", "applying", "applied", "accepted", "rejected"]).optional(),
    hidden_from_friends: z.boolean().optional(),
  })
  .refine((b) => b.app_status !== undefined || b.hidden_from_friends !== undefined, "Nothing to change.");

/** PATCH /api/saved/[listingId] {app_status?, hidden_from_friends?} */
export const PATCH = route<{ listingId: string }>(async (req, { params }) => {
  const { supabase, user } = await authed();
  const { listingId } = await params;
  if (!z.uuid().safeParse(listingId).success) throw new HttpError(404, "Not in your saved list.");
  const patch = await body(req, schema);

  const rows = check(
    await supabase
      .from("user_listings")
      .update(patch)
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .eq("state", "saved")
      .select("listing_id"),
    "save that",
  );
  if (!rows?.length) throw new HttpError(404, "Not in your saved list.");
  const [item] = await loadSaved(supabase, user.id, { listingId });
  return item;
});
