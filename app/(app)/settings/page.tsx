import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/SettingsView";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Settings · placeholder" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[600px]">
      <PageHeader title="Settings" />
      <SettingsView />
    </div>
  );
}
