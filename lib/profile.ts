import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { MOCK_API } from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import { MOCK_ME } from "@/mocks/fixtures/people";

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

// Mock API mode (spec §20): a fake signed-in, onboarded user; Supabase is never called.
const MOCK_PROFILE: Profile = {
  ...MOCK_ME,
  onboarded_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
};

/** The signed-in user's id and email, or null. Deduped per request. */
export const getSessionUser = cache(async () => {
  if (MOCK_API) return { id: MOCK_ME.id, email: MOCK_ME.email };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
});

/** The signed-in user's full profile row (owner-only columns included). Deduped per request. */
export const getMyProfile = cache(async (): Promise<Profile | null> => {
  if (MOCK_API) return MOCK_PROFILE;
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
