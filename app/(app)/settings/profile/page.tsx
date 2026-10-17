import type { Metadata } from "next";
import { EditProfileView } from "@/components/settings/EditProfileView";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Edit profile · placeholder" };

export default function EditProfilePage() {
  return (
    <div className="mx-auto max-w-[600px]">
      <PageHeader title="Edit profile" fallbackHref="/settings" />
      <EditProfileView />
    </div>
  );
}
