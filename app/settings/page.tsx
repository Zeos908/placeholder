import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { ThemeSync } from "@/components/ThemeSync";
import { getSessionUser, requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm, type BlockedUser } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings · placeholder" };

export default async function SettingsPage() {
  const [profile, user] = await Promise.all([requireProfile(), getSessionUser()]);
  const supabase = await createClient();
  const { data: blocked } = await supabase.rpc("my_blocked_users");

  return (
    <>
      <ThemeSync theme={profile.theme} />
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-bg px-2">
        <Link
          href="/feed"
          className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-900"
          aria-label="Back to feed"
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <h1 className="text-base font-semibold">Settings</h1>
      </header>
      <SettingsForm
        profile={profile}
        email={user?.email ?? null}
        blocked={(blocked as BlockedUser[] | null) ?? []}
      />
    </>
  );
}
