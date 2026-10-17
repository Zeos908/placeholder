"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyProfileUpdate } from "@/lib/server/profile-update";
import { MOCK_API } from "@/lib/mock";
import { getMyProfile, getSessionUser } from "@/lib/profile";
import { profileUpdateSchema, USERNAME_RE, type ProfileUpdate } from "@/lib/profile-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string; field?: string };

const NOT_SIGNED_IN: ActionResult = { ok: false, error: "Your session expired. Log in again." };

/** Partial profile update shared by onboarding and Settings. */
// In mock API mode these server actions don't touch Supabase (onboarding and Delete account
// still use them; everything else talks to /api, which MSW mocks).
export async function updateProfile(input: ProfileUpdate): Promise<ActionResult> {
  if (MOCK_API) return { ok: true };
  const user = await getSessionUser();
  if (!user) return NOT_SIGNED_IN;
  const result = await applyProfileUpdate(user.id, (await getMyProfile())?.avatar_url ?? null, input);
  if (!result.ok) return { ok: false, error: result.error, field: result.field };
  revalidatePath("/", "layout");
  return { ok: true };
}

export type UsernameStatus = "available" | "taken" | "invalid" | "yours";

export async function checkUsername(name: string): Promise<UsernameStatus> {
  const value = name.trim();
  if (!USERNAME_RE.test(value)) return "invalid";
  if (MOCK_API) return "available";
  const profile = await getMyProfile();
  if (profile && profile.username.toLowerCase() === value.toLowerCase()) return "yours";
  const supabase = await createClient();
  const { data } = await supabase.rpc("username_available", { p_username: value });
  return data ? "available" : "taken";
}

/** Marks onboarding done (whether the user filled things in or skipped) and opens the Feed. */
export async function completeOnboarding(timezone?: string) {
  if (MOCK_API) redirect("/feed");
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

export interface DeleteState {
  error?: string;
}

/** Permanently deletes the account. The user must type their username to confirm. */
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  if (MOCK_API) return { error: "Deleting the account isn't available in mock mode." };
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
