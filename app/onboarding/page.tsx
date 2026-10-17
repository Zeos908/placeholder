import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyProfile, getSessionUser } from "@/lib/profile";
import { OnboardingFlow } from "./OnboardingFlow";

export const metadata: Metadata = { title: "Welcome · placeholder" };

export default async function OnboardingPage() {
  const [user, profile] = await Promise.all([getSessionUser(), getMyProfile()]);
  if (!user || !profile) redirect("/auth/signout");
  if (profile.onboarded_at) redirect("/feed");

  return (
    <OnboardingFlow
      userId={user.id}
      initial={{
        username: profile.username,
        display_name: profile.display_name ?? "",
        avatar_url: profile.avatar_url,
        grade_level: profile.grade_level,
        school: profile.school ?? "",
        interests: profile.interests ?? [],
        zip: profile.zip ?? "",
        radius_miles: profile.radius_miles ?? 25,
        skills: profile.skills ?? [],
        bio: profile.bio ?? "",
      }}
    />
  );
}
