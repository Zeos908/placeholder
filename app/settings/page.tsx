import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { ThemeSync } from "@/components/ThemeSync";
import { getSessionUser, requireProfile } from "@/lib/profile";
import { MOCK_API } from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm, type BlockedUser } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings · placeholder" };

export default async function SettingsPage() {
  const [profile, user] = await Promise.all([requireProfile(), getSessionUser()]);
  const blocked = MOCK_API
    ? []
    : (await (await createClient()).rpc("my_blocked_users")).data;

  return (
    <>
      <ThemeSync theme={profile.theme} />
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background px-2">
        <Link
          href="/feed"
          className="rounded-full p-2 hover:bg-surface"
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
