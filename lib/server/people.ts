import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUMMARY_COLUMNS, toSummary } from "@/lib/server/rows";
import type { ListingSummary, PersonSummary } from "@/lib/types";

const PERSON_COLUMNS = "id, username, display_name, avatar_url";

/**
 * Public cards by id, via public_profiles (which already hides anyone blocked either way).
 * Missing ids are people you can't see.
 */
export async function peopleById(supabase: SupabaseClient, ids: string[]): Promise<Map<string, PersonSummary & { school: string | null }>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.from("public_profiles").select(`${PERSON_COLUMNS}, school`).in("id", unique);
  if (error) console.error("[api] load people:", error.message);
  return new Map((data ?? []).map((p) => [p.id as string, p as PersonSummary & { school: string | null }]));
}

export const toPerson = (p: PersonSummary): PersonSummary => ({
  id: p.id,
  username: p.username,
  display_name: p.display_name,
  avatar_url: p.avatar_url,
});

/** Listing summaries by id (RLS: active, or expired ones you saved). */
export async function summariesById(supabase: SupabaseClient, ids: string[]): Promise<Map<string, ListingSummary>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.from("listings").select(SUMMARY_COLUMNS).in("id", unique);
  if (error) console.error("[api] load listings:", error.message);
  return new Map((data ?? []).map((l) => [l.id as string, toSummary(l as Record<string, unknown>)]));
}
