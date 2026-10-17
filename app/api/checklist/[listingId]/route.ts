import { z } from "zod";
import { MAX_STEPS, replaceChecklist, stepSchema, visibleListing } from "@/lib/server/planning";
import { authed, body, check, route } from "@/lib/server/route";
import type { ChecklistItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/checklist/[listingId] */
export const GET = route<{ listingId: string }>(async (_req, { params }) => {
  const { supabase, user } = await authed();
  const { listingId } = await params;
  await visibleListing(supabase, listingId);
  return check(
    await supabase
      .from("checklist_items")
      .select("id, text, done, position")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .order("position"),
    "load the checklist",
  ) as ChecklistItem[];
});

const schema = z.object({ items: z.array(stepSchema).max(MAX_STEPS, `Up to ${MAX_STEPS} steps.`) });

/** PATCH /api/checklist/[listingId] {items}: toggle, edit, reorder, add or remove steps. */
export const PATCH = route<{ listingId: string }>(async (req, { params }) => {
  const { supabase, user } = await authed();
  const { listingId } = await params;
  const { items } = await body(req, schema);
  await visibleListing(supabase, listingId);
  return replaceChecklist(supabase, user.id, listingId, items);
});
