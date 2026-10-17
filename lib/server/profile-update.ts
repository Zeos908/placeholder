import "server-only";
import { zipToLatLng } from "@/lib/geo";
import { profileUpdateSchema, type ProfileUpdate } from "@/lib/profile-schema";
import { createClient } from "@/lib/supabase/server";

export type UpdateResult = { ok: true } | { ok: false; error: string; field?: string; status: number };

/**
 * Validates and applies a partial profile update for `userId` (shared by the updateProfile
 * server action and PATCH /api/me): avatar must be the user's own upload or their current
 * photo; zip is geocoded; skills de-duplicated; new interests get starting weights (§7).
 */
export async function applyProfileUpdate(
  userId: string,
  currentAvatar: string | null,
  input: ProfileUpdate,
): Promise<UpdateResult> {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? ""), status: 400 };
  }
  const data = parsed.data;
  const row: Record<string, unknown> = { ...data };

  if (data.avatar_url) {
    const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${userId}/`;
    if (!data.avatar_url.startsWith(prefix) && data.avatar_url !== currentAvatar) {
      return { ok: false, error: "That photo couldn't be used. Upload it again.", field: "avatar_url", status: 400 };
    }
  }

  if (data.zip !== undefined) {
    const coords = data.zip ? await zipToLatLng(data.zip) : null;
    row.lat = coords?.lat ?? null;
    row.lng = coords?.lng ?? null;
  }

  if (data.skills) {
    const seen = new Set<string>();
    row.skills = data.skills.filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const supabase = await createClient();
  if (Object.keys(row).length) {
    const { error } = await supabase.from("profiles").update(row).eq("id", userId);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "That username is taken.", field: "username", status: 409 };
      return { ok: false, error: "Couldn't save your changes. Try again.", status: 500 };
    }
  }

  if (data.interests?.length) {
    await supabase.rpc("seed_interest_weights", { p_tags: data.interests });
  }
  return { ok: true };
}
