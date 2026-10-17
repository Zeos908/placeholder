import type { Metadata } from "next";
import { BlockedView } from "@/components/settings/BlockedView";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Blocked users · placeholder" };

export default function BlockedPage() {
  return (
    <div className="mx-auto max-w-[600px]">
      <PageHeader title="Blocked users" fallbackHref="/settings" />
      <BlockedView />
    </div>
  );
}
