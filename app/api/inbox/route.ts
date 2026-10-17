import { z } from "zod";
import { peopleById, summariesById, toPerson } from "@/lib/server/people";
import { authed, body, check, route } from "@/lib/server/route";
import type { InboxItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/inbox: shares you received, unread first, then newest. Blocked senders drop out. */
export const GET = route(async () => {
  const { supabase, user } = await authed();
  const rows = check(
    await supabase
      .from("shares")
      .select("id, from_user, listing_id, message, created_at, read_at")
      .eq("to_user", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    "load your inbox",
  ) as { id: string; from_user: string; listing_id: string; message: string | null; created_at: string; read_at: string | null }[];
  const [people, listings] = await Promise.all([
    peopleById(supabase, rows.map((r) => r.from_user)),
    summariesById(supabase, rows.map((r) => r.listing_id)),
  ]);
  const items: InboxItem[] = rows.flatMap((r) => {
    const from = people.get(r.from_user);
    const listing = listings.get(r.listing_id);
    return from && listing ? [{ id: r.id, from: toPerson(from), listing, message: r.message, created_at: r.created_at, read_at: r.read_at }] : [];
  });
  return items.sort((a, b) => Number(!!a.read_at) - Number(!!b.read_at) || b.created_at.localeCompare(a.created_at));
});

const schema = z.object({ ids: z.array(z.uuid()).max(500) });

/** PATCH /api/inbox {ids}: mark read. */
export const PATCH = route(async (req) => {
  const { supabase, user } = await authed();
  const { ids } = await body(req, schema);
  if (ids.length) {
    check(
      await supabase.from("shares").update({ read_at: new Date().toISOString() }).in("id", ids).eq("to_user", user.id).is("read_at", null),
      "mark that read",
    );
  }
  return { ok: true };
});
