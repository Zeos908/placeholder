"use client";

import { Feed } from "@/components/feed/Feed";
import { Skeleton } from "@/components/ui/skeleton";

// Phase F3 adds the stories row above the posts.
export function FeedTab() {
  return <Feed />;
}

/** Generic row skeleton (spec §8: 56 px square + 2 bars), used by the temporary tab lists. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3" aria-hidden>
          <Skeleton className="size-14 shrink-0 rounded-none" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
