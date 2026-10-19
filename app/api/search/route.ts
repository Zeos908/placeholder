import { z } from "zod";
import { LISTING_COLUMNS, toListing } from "@/lib/server/rows";
import { authed, check, HttpError, route } from "@/lib/server/route";
import type { Listing } from "@/lib/types";

export const dynamic = "force-dynamic";

const LIMIT = 40;
const typeSchema = z.enum(["internship", "volunteer", "event", "scholarship"]).nullable();

/**
 * GET /api/search?q=&type= : opportunities whose title, organization, summary, description,
 * location or tags match every word of q (min 2 characters). Open deadlines first, soonest
 * first; RLS limits it to active listings (plus expired ones you saved).
 */
export const GET = route(async (req) => {
  const { supabase } = await authed();
  const params = new URL(req.url).searchParams;
  const type = typeSchema.safeParse(params.get("type"));
  if (!type.success) throw new HttpError(400, "Unknown type.");

  // Letters, digits, spaces and a few joiners only: keeps PostgREST's or() syntax and LIKE
  // wildcards out of the query.
  const words = (params.get("q") ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'&-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 5);
  if (!words.length) return [];

  let q = supabase.from("listings").select(LISTING_COLUMNS).eq("status", "active");
  for (const w of words) {
    const like = `*${w.replace(/'/g, "''")}*`;
    q = q.or(
      [
        `title.ilike.${like}`,
        `org_name.ilike.${like}`,
        `summary.ilike.${like}`,
        `description.ilike.${like}`,
        `location_text.ilike.${like}`,
        `tags.cs.{${w.replace(/[{}"]/g, "")}}`,
      ].join(","),
    );
  }
  if (type.data) q = q.eq("type", type.data);
  const rows = check(
    await q.order("deadline", { ascending: true, nullsFirst: false }).limit(LIMIT),
    "search",
  ) as Record<string, unknown>[];

  const now = Date.now();
  const listings: Listing[] = rows.map(toListing);
  // Still-open first; closed (deadline passed) ones last.
  return listings.sort((a, b) => Number(isClosed(a, now)) - Number(isClosed(b, now)));
});

const isClosed = (l: Listing, now: number) => !!l.deadline && new Date(l.deadline).getTime() < now;
