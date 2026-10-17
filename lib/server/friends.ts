import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { check, HttpError } from "@/lib/server/route";

export interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
}

/** The one friendship row between me and `other`, in either direction (RLS: parties only). */
export async function friendshipWith(supabase: SupabaseClient, me: string, other: string): Promise<FriendshipRow | null> {
  return check(
    await supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .or(`and(requester_id.eq.${me},addressee_id.eq.${other}),and(requester_id.eq.${other},addressee_id.eq.${me})`)
      .maybeSingle(),
    "load that friendship",
  ) as FriendshipRow | null;
}

/** All my friendship rows. */
export async function myFriendships(supabase: SupabaseClient, me: string): Promise<FriendshipRow[]> {
  return check(
    await supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${me},addressee_id.eq.${me}`),
    "load your friends",
  ) as FriendshipRow[];
}

/** Ids of accepted friends. */
export async function friendIds(supabase: SupabaseClient, me: string): Promise<Set<string>> {
  const rows = await myFriendships(supabase, me);
  return new Set(rows.filter((r) => r.status === "accepted").map((r) => (r.requester_id === me ? r.addressee_id : r.requester_id)));
}

/** 404 unless `id` is a uuid of someone I can see (not blocked either way). */
export async function visiblePerson(supabase: SupabaseClient, id: string) {
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, "User not found.");
  const row = check(await supabase.from("public_profiles").select("id").eq("id", id).maybeSingle(), "find that user");
  if (!row) throw new HttpError(404, "User not found.");
}
