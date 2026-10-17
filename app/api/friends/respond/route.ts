import { z } from "zod";
import { displayNameOf, notify, TITLES } from "@/lib/server/notify";
import { authed, body, check, HttpError, route } from "@/lib/server/route";

const schema = z.object({ userId: z.uuid(), accept: z.boolean() });

/** POST /api/friends/respond {userId, accept}: accept or decline their pending request. */
export const POST = route(async (req) => {
  const { supabase, user } = await authed();
  const { userId, accept } = await body(req, schema);
  const table = supabase.from("friendships");
  const rows = check(
    await (accept ? table.update({ status: "accepted" }) : table.delete())
      .eq("requester_id", userId)
      .eq("addressee_id", user.id)
      .eq("status", "pending")
      .select("requester_id"),
    accept ? "accept that request" : "decline that request",
  );
  if (!rows?.length) throw new HttpError(404, "No request from that user.");

  // The bell item for this request is done either way.
  await supabase.from("notifications").delete().eq("kind", "friend_request").eq("payload->>actor_id", userId);
  if (accept) {
    const name = await displayNameOf(user.id);
    await notify(userId, "friend_accepted", { actor_id: user.id }, { title: name, body: TITLES.friend_accepted, url: "/friends" });
  }
  return { ok: true };
});
