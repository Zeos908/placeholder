import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Profile · placeholder" };

// STUB (F1): the nav target exists; Phase F6 builds the profile header and grid.
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return (
    <div className="mx-auto max-w-[935px]">
      <PageHeader title={decodeURIComponent(username)} />
      <div className="space-y-3 p-6 text-center text-muted-foreground">
        <p>Profiles arrive in phase F6.</p>
        <Link href="/settings" className="font-semibold text-link">
          Settings
        </Link>
      </div>
    </div>
  );
}
