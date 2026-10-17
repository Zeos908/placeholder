import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Saved · placeholder" };

// STUB (F1): lets the shell's back navigation be tested. Phase F4/F5 build Details | Chat.
export default async function SavedItemPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  return (
    <div className="mx-auto max-w-[935px]">
      <PageHeader title="Saved item" fallbackHref="/saved" />
      <p className="p-6 text-center text-muted-foreground">
        Details and chat for this item arrive in phases F4–F5. ({listingId.slice(-4)})
      </p>
    </div>
  );
}
