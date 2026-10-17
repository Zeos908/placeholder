"use client";

import { useQuery } from "@tanstack/react-query";
import { MiniTile } from "@/components/common/MiniTile";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { deadlineInfo } from "@/lib/format";
import { qk, staleTimes } from "@/lib/queries";
import { cn } from "@/lib/utils";

// TEMPORARY (F1): a plain list so the shell can be tested with real scrolling.
// Phase F2 replaces this with the stories row, PostCard, swipes and infinite scroll.
export function FeedTab() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: qk.feed,
    queryFn: () => api.feed(),
    staleTime: staleTimes.feed,
  });

  if (isPending) return <ListSkeleton />;
  if (isError)
    return (
      <p className="p-6 text-center text-muted-foreground">
        Couldn&apos;t load the feed.{" "}
        <button className="font-semibold text-link" onClick={() => refetch()}>
          Try again
        </button>
      </p>
    );

  return (
    <ul>
      {data.posts.map((p) => {
        const due = deadlineInfo(p.deadline);
        return (
          <li key={p.id} className="border-b border-border px-4 py-4">
            <div className="flex items-center gap-3">
              <MiniTile type={p.type} size={32} className="rounded-full" />
              <span className="font-semibold">{p.org_name}</span>
            </div>
            <MiniTile type={p.type} size={438} className="mt-3 aspect-[4/5] !h-auto w-full text-6xl" />
            <p className="mt-3">
              <span className="font-semibold">{p.title}</span> {p.summary}
            </p>
            <p className={cn("mt-1 text-xs", due.urgent ? "text-danger" : "text-muted-foreground")}>{due.label}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4 p-4" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
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
