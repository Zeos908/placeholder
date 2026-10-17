import { z } from "zod";
import { authed, body, check, HttpError, route } from "@/lib/server/route";

const schema = z.object({
  target_type: z.enum(["user", "listing"]),
  target_id: z.uuid(),
  reason: z.enum(["spam", "inappropriate", "wrong_info", "other"]),
  details: z.string().max(500).nullish(),
});

/**
 * POST /api/report {target_type, target_id, reason, details?} (§12). Reporting twice is a no-op;
 * 3 distinct reports hide a listing (reports_autohide trigger).
 */
export const POST = route(async (req) => {
  const { supabase, user } = await authed();
  const b = await body(req, schema);
  if (b.target_type === "user" && b.target_id === user.id) throw new HttpError(400, "You can't report yourself.");
  const details = b.details?.trim();
  check(
    await supabase.from("reports").upsert(
      { reporter_id: user.id, target_type: b.target_type, target_id: b.target_id, reason: details ? `${b.reason}: ${details}` : b.reason },
      { onConflict: "reporter_id,target_type,target_id", ignoreDuplicates: true },
    ),
    "send that report",
  );
  return { ok: true };
});
