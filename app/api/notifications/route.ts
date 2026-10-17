import { z } from "zod";
import { TITLES, type NotificationPayload } from "@/lib/server/notify";
import { peopleById, summariesById, toPerson } from "@/lib/server/people";
import { authed, body, check, route } from "@/lib/server/route";
import type { AppNotification, NotificationKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS = new Set<NotificationKind>(["reminder", "friend_request", "friend_accepted", "share"]);

/** GET /api/notifications: newest first; anything from a blocked user is left out. */
export const GET = route(async () => {
  const { supabase, user } = await authed();
  const rows = check(
    await supabase
      .from("notifications")
      .select("id, kind, payload, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    "load notifications",
  ) as { id: string; kind: NotificationKind; payload: NotificationPayload | null; read_at: string | null; created_at: string }[];

  const valid = rows.filter((r) => KINDS.has(r.kind));
  const [people, listings] = await Promise.all([
    peopleById(supabase, valid.map((r) => r.payload?.actor_id ?? "")),
    summariesById(supabase, valid.map((r) => r.payload?.listing_id ?? "")),
  ]);
  const items: AppNotification[] = valid.flatMap((r) => {
    const actorId = r.payload?.actor_id;
    const actor = actorId ? people.get(actorId) : null;
    if (actorId && !actor) return []; // blocked, or the account is gone
    const listing = r.payload?.listing_id ? (listings.get(r.payload.listing_id) ?? null) : null;
    return [
      {
        id: r.id,
        kind: r.kind,
        actor: actor ? toPerson(actor) : null,
        listing,
        title: r.kind === "reminder" ? (r.payload?.title ?? TITLES.reminder) : TITLES[r.kind],
        created_at: r.created_at,
        read_at: r.read_at,
      },
    ];
  });
  return items;
});

const schema = z.object({ ids: z.array(z.uuid()).max(500) });

/** PATCH /api/notifications {ids}: mark read (clears the bell dot). */
export const PATCH = route(async (req) => {
  const { supabase, user } = await authed();
  const { ids } = await body(req, schema);
  if (ids.length) {
    check(
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids)
        .eq("user_id", user.id)
        .is("read_at", null),
      "mark notifications read",
    );
  }
  return { ok: true };
});
