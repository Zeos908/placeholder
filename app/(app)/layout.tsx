import { AppShell } from "@/components/shell/AppShell";
import { ThemeSync } from "@/components/ThemeSync";
import { requireProfile } from "@/lib/profile";

// Signed-in, onboarded users only: requireProfile sends everyone else to /login or /onboarding.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <>
      <ThemeSync theme={profile.theme} />
      <AppShell
        user={{ username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url }}
      >
        {children}
      </AppShell>
    </>
  );
}
