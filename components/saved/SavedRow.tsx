"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { Thumb } from "@/components/common/Thumb";
import { Skeleton } from "@/components/ui/skeleton";
import { deadlineInfo } from "@/lib/format";
import { TYPE_META } from "@/lib/opp";
import { prefetchListing } from "@/lib/saved";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 72 px row (spec §9.6, §11): 56 px thumbnail, title, org · type, deadline countdown, and a
 * slot on the right (status pill on Saved, Restore on Passed).
 */
export function ListingRow({ listing, href, right }: { listing: Listing; href?: string; right?: ReactNode }) {
  const queryClient = useQueryClient();
  const due = deadlineInfo(listing.deadline);
  const body = (
    <>
      <Thumb listing={listing} size={56} className="rounded-sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{listing.title}</span>
        <span className="block truncate text-muted-foreground">
          {listing.org_name} · {TYPE_META[listing.type].label}
        </span>
        <span className={cn("block text-xs", due.urgent ? "font-semibold text-danger" : "text-muted-foreground")}>
          {due.label}
        </span>
      </span>
    </>
  );

  return (
    <div className="flex h-[72px] items-center gap-3 px-4">
      {href ? (
        <Link
          href={href}
          onPointerDown={() => prefetchListing(queryClient, listing.id)}
          className="flex min-w-0 flex-1 items-center gap-3"
          draggable={false}
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {right}
    </div>
  );
}

/** Spec §8: 6 row skeletons (56 px square + 2 bars). */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-[72px] items-center gap-3 px-4" aria-hidden>
          <Skeleton className="size-14 shrink-0 rounded-sm" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
