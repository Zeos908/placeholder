import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Notifications · placeholder" };

// STUB (F1): the nav target exists; Phase F7 builds the notifications list.
export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-[600px]">
      <PageHeader title="Notifications" />
      <p className="p-6 text-center text-muted-foreground">Notifications arrive in phase F7.</p>
    </div>
  );
}
