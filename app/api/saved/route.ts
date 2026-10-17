import { z } from "zod";
import { loadSaved } from "@/lib/server/saved";
import { authed, HttpError, route } from "@/lib/server/route";

export const dynamic = "force-dynamic";

const typeSchema = z.enum(["internship", "volunteer", "event", "scholarship"]).nullable();

/** GET /api/saved?type= : saved items sorted by deadline (nulls last). */
export const GET = route(async (req) => {
  const { supabase, user } = await authed();
  const parsed = typeSchema.safeParse(new URL(req.url).searchParams.get("type"));
  if (!parsed.success) throw new HttpError(400, "Unknown type.");
  return loadSaved(supabase, user.id, { type: parsed.data });
});
