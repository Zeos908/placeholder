import type { Metadata } from "next";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Notifications · placeholder" };

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-[600px]">
      <PageHeader title="Notifications" />
      <NotificationsList />
    </div>
  );
}
