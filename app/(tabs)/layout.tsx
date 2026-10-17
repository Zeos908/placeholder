import { ThemeSync } from "@/components/ThemeSync";
import { TopBar } from "@/components/TopBar";
import { requireProfile } from "@/lib/profile";

// Signed-in, onboarded users only: requireProfile sends everyone else to /login or /onboarding.
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <>
      <ThemeSync theme={profile.theme} />
      <TopBar
        username={profile.username}
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
      />
      <main>{children}</main>
    </>
  );
}
