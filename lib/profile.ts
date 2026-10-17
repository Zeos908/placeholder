import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  grade_level: number | null;
  school: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  radius_miles: number;
  interests: string[];
  skills: string[];
  bio: string | null;
  share_saves: boolean;
  theme: "system" | "light" | "dark";
  timezone: string;
  onboarded_at: string | null;
  created_at: string;
}

/** The signed-in user's id and email, or null. Deduped per request. */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
});

/** The signed-in user's full profile row (owner-only columns included). Deduped per request. */
export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile | null) ?? null;
});

/** For pages that need a signed-in, onboarded user. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getMyProfile();
  // No profile behind the session cookie: clear it rather than loop between /login and /feed.
  if (!profile) redirect("/auth/signout");
  if (!profile.onboarded_at) redirect("/onboarding");
  return profile;
}
