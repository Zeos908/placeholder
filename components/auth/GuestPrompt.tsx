import { Users } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

/** Shown to guests where a feature needs a real account (Friends tab). */
export function GuestPrompt() {
  return (
    <EmptyState
      icon={Users}
      title="Friends need an account"
      body="You're browsing as a guest. Create a free account to add friends, see what they save, and share posts."
      action={
        <div className="flex flex-col items-center gap-2">
          <Button asChild variant="gradient" className="h-9 px-6">
            <Link href="/signup">Create an account</Link>
          </Button>
          <Link href="/login" className="text-sm font-semibold text-link">
            I already have one
          </Link>
        </div>
      }
    />
  );
}
