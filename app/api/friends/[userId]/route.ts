import { z } from "zod";
import { authed, check, HttpError, route } from "@/lib/server/route";

/** DELETE /api/friends/[userId]: unfriend, or cancel a request you sent. */
export const DELETE = route<{ userId: string }>(async (_req, { params }) => {
  const { supabase, user } = await authed();
  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) throw new HttpError(404, "User not found.");
  check(
    await supabase
      .from("friendships")
      .delete()
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`),
    "remove that friend",
  );
  return { ok: true };
});
