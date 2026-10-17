import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { getSessionUser, requireProfile } from "@/lib/profile";
import { MOCK_API } from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm, type BlockedUser } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings · placeholder" };

export default async function SettingsPage() {
  const [profile, user] = await Promise.all([requireProfile(), getSessionUser()]);
  const blocked = MOCK_API ? [] : (await (await createClient()).rpc("my_blocked_users")).data;

  return (
    <div className="mx-auto max-w-[470px]">
      <PageHeader title="Settings" />
      <SettingsForm
        profile={profile}
        email={user?.email ?? null}
        blocked={(blocked as BlockedUser[] | null) ?? []}
      />
    </div>
  );
}
