import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Feed · placeholder" };

// Phase 2 landing spot. The real scrolling, swipeable feed replaces this in Phase 3.
export default async function FeedPage() {
  const profile = await requireProfile();
  const name = profile.display_name || `@${profile.username}`;

  return (
    <section className="flex flex-col items-center gap-3 px-6 py-24 text-center">
      <p className="text-4xl" aria-hidden>
        ✨
      </p>
      <h1 className="text-xl font-semibold">You&apos;re in, {name}</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Your feed of opportunities is on its way. In the meantime, you can update your interests and
        location in{" "}
        <Link href="/settings" className="font-medium text-link">
          Settings
        </Link>
        .
      </p>
    </section>
  );
}
