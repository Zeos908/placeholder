"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { zipToLatLng } from "@/lib/geo";
import { getMyProfile, getSessionUser } from "@/lib/profile";
import { profileUpdateSchema, USERNAME_RE, type ProfileUpdate } from "@/lib/profile-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string; field?: string };

const NOT_SIGNED_IN: ActionResult = { ok: false, error: "Your session expired. Log in again." };

/** Partial profile update shared by onboarding and Settings. */
export async function updateProfile(input: ProfileUpdate): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return NOT_SIGNED_IN;

  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? "") };
  }
  const data = parsed.data;
  const row: Record<string, unknown> = { ...data };

  // Avatars must be this user's own upload in the avatars bucket, or the photo already on the
  // profile (e.g. the one Google provided at sign-up), so it can't point at arbitrary URLs.
  if (data.avatar_url) {
    const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
    const current = (await getMyProfile())?.avatar_url;
    if (!data.avatar_url.startsWith(prefix) && data.avatar_url !== current) {
      return { ok: false, error: "That photo couldn't be used. Upload it again.", field: "avatar_url" };
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
    const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "That username is taken.", field: "username" };
      return { ok: false, error: "Couldn't save your changes. Try again." };
    }
  }

  // §7: each chosen interest starts with weight 1.0 (keeps higher learned weights).
  if (data.interests?.length) {
    await supabase.rpc("seed_interest_weights", { p_tags: data.interests });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export type UsernameStatus = "available" | "taken" | "invalid" | "yours";

export async function checkUsername(name: string): Promise<UsernameStatus> {
  const value = name.trim();
  if (!USERNAME_RE.test(value)) return "invalid";
  const profile = await getMyProfile();
  if (profile && profile.username.toLowerCase() === value.toLowerCase()) return "yours";
  const supabase = await createClient();
  const { data } = await supabase.rpc("username_available", { p_username: value });
  return data ? "available" : "taken";
}

/** Marks onboarding done (whether the user filled things in or skipped) and opens the Feed. */
export async function completeOnboarding(timezone?: string) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const row: Record<string, unknown> = { onboarded_at: new Date().toISOString() };
  if (timezone && profileUpdateSchema.shape.timezone.safeParse(timezone).success) {
    row.timezone = timezone;
  }
  await supabase.from("profiles").update(row).eq("id", user.id).is("onboarded_at", null);
  revalidatePath("/", "layout");
  redirect("/feed");
}

export async function unblockUser(userId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return NOT_SIGNED_IN;
  if (!z.uuid().safeParse(userId).success) return { ok: false, error: "Unknown user." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", userId);
  if (error) return { ok: false, error: "Couldn't unblock. Try again." };
  revalidatePath("/settings");
  return { ok: true };
}

export interface DeleteState {
  error?: string;
}

/** Permanently deletes the account. The user must type their username to confirm. */
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const typed = String(formData.get("confirm") ?? "").trim().replace(/^@/, "");
  if (typed.toLowerCase() !== profile.username.toLowerCase()) {
    return { error: `Type your username (${profile.username}) to confirm.` };
  }

  const admin = createAdminClient();
  // Remove uploaded avatars; every table row cascades from auth.users.
  const { data: files } = await admin.storage.from("avatars").list(profile.id, { limit: 100 });
  if (files?.length) {
    await admin.storage.from("avatars").remove(files.map((f) => `${profile.id}/${f.name}`));
  }
  const { error } = await admin.auth.admin.deleteUser(profile.id);
  if (error) return { error: "Couldn't delete your account. Try again in a minute." };

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?deleted=1");
}
