import { myFriendships } from "@/lib/server/friends";
import { peopleById, toPerson } from "@/lib/server/people";
import { authed, route } from "@/lib/server/route";
import type { FriendsData } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/friends: accepted friends (A–Z) + pending requests in and out. Blocked users drop out. */
export const GET = route(async () => {
  const { supabase, user } = await authed();
  const rows = await myFriendships(supabase, user.id);
  const other = (r: (typeof rows)[number]) => (r.requester_id === user.id ? r.addressee_id : r.requester_id);
  const people = await peopleById(supabase, rows.map(other));
  const pick = (pred: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pred).flatMap((r) => {
      const p = people.get(other(r));
      return p ? [p] : [];
    });

  const data: FriendsData = {
    friends: pick((r) => r.status === "accepted")
      .map((p) => ({ ...toPerson(p), school: p.school }))
      .sort((a, b) => a.username.localeCompare(b.username)),
    incoming: pick((r) => r.status === "pending" && r.addressee_id === user.id).map(toPerson),
    outgoing: pick((r) => r.status === "pending" && r.requester_id === user.id).map(toPerson),
  };
  return data;
});
