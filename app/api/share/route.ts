import { z } from "zod";
import { friendIds } from "@/lib/server/friends";
import { displayNameOf, notify, TITLES } from "@/lib/server/notify";
import { visibleListing } from "@/lib/server/planning";
import { authed, body, check, HttpError, route, requireAccount } from "@/lib/server/route";

const schema = z.object({
  toUserIds: z.array(z.string()).min(1, "Pick at least one friend.").max(50),
  listingId: z.uuid(),
  message: z.string().max(500, "Keep the message under 500 characters.").nullish(),
});

/** POST /api/share {toUserIds[], listingId, message?} → a share + notification per friend. */
export const POST = route(async (req) => {
  const { supabase, user } = await authed();
  requireAccount(user);
  const { toUserIds, listingId, message } = await body(req, schema);
  await visibleListing(supabase, listingId);

  // Accepted friends only; RLS enforces the same (and blocks) on insert.
  const friends = await friendIds(supabase, user.id);
  const to = [...new Set(toUserIds)].filter((id) => friends.has(id));
  if (!to.length) throw new HttpError(400, "Pick at least one friend.");

  const text = message?.trim() || null;
  check(
    await supabase.from("shares").insert(to.map((to_user) => ({ from_user: user.id, to_user, listing_id: listingId, message: text }))),
    "send that",
  );
  const name = await displayNameOf(user.id);
  await Promise.all(
    to.map((id) =>
      notify(id, "share", { actor_id: user.id, listing_id: listingId }, { title: name, body: text ?? TITLES.share, url: "/friends" }),
    ),
  );
  return { ok: true };
});
