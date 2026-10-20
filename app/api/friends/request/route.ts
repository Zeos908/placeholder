import { z } from "zod";
import { friendshipWith, visiblePerson } from "@/lib/server/friends";
import { displayNameOf, notify, TITLES } from "@/lib/server/notify";
import { authed, body, check, HttpError, route, requireAccount } from "@/lib/server/route";

const schema = z.object({ userId: z.string() });

/**
 * POST /api/friends/request {userId}. If they already asked you, this accepts instead.
 * Returns {status: 'requested' | 'accepted'}.
 */
export const POST = route(async (req) => {
  const { supabase, user } = await authed();
  requireAccount(user);
  const { userId } = await body(req, schema);
  if (userId === user.id) throw new HttpError(400, "That's you!");
  await visiblePerson(supabase, userId);

  const existing = await friendshipWith(supabase, user.id, userId);
  if (existing?.status === "accepted") return { status: "accepted" };
  if (existing && existing.requester_id === user.id) return { status: "requested" };

  if (existing) {
    // They asked first: accept.
    check(
      await supabase.from("friendships").update({ status: "accepted" }).eq("requester_id", userId).eq("addressee_id", user.id),
      "accept that request",
    );
    await supabase.from("notifications").delete().eq("kind", "friend_request").eq("payload->>actor_id", userId);
    const name = await displayNameOf(user.id);
    await notify(userId, "friend_accepted", { actor_id: user.id }, { title: name, body: TITLES.friend_accepted, url: "/friends" });
    return { status: "accepted" };
  }

  check(await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: userId }), "send that request");
  const name = await displayNameOf(user.id);
  await notify(userId, "friend_request", { actor_id: user.id }, { title: name, body: TITLES.friend_request, url: "/friends" });
  return { status: "requested" };
});
