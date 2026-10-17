import { authed, check, HttpError, route } from "@/lib/server/route";
import type { PublicProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/[username]: profile header + saves grid. profile_card() applies the privacy
 * rules (saves only for yourself, or friends when they share; never zip or coordinates).
 */
export const GET = route<{ username: string }>(async (_req, { params }) => {
  const { supabase } = await authed();
  const { username } = await params;
  const name = decodeURIComponent(username).replace(/^@/, "");
  if (!/^[A-Za-z0-9_.]{1,40}$/.test(name)) throw new HttpError(404, "User not found.");
  const card = check(await supabase.rpc("profile_card", { p_username: name }), "load that profile") as PublicProfile | null;
  if (!card) throw new HttpError(404, "User not found.");
  return { ...card, counts: { saved: Number(card.counts.saved), applied: Number(card.counts.applied), friends: Number(card.counts.friends) } };
});
