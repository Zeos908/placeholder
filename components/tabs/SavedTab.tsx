"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { MiniTile } from "@/components/common/MiniTile";
import { ListSkeleton } from "@/components/tabs/FeedTab";
import { api } from "@/lib/api";
import { deadlineInfo } from "@/lib/format";
import { TYPE_META } from "@/lib/opp";
import { qk, staleTimes } from "@/lib/queries";
import { cn } from "@/lib/utils";

// TEMPORARY (F1): plain saved list for shell testing. Phase F4 builds the real Saved tab.
export function SavedTab() {
  const { data, isPending } = useQuery({
    queryKey: qk.saved("all"),
    queryFn: () => api.saved(),
    staleTime: staleTimes.saved,
  });
  if (isPending) return <ListSkeleton />;
  return (
    <ul className="py-2">
      {data?.map(({ listing }) => {
        const due = deadlineInfo(listing.deadline);
        return (
          <li key={listing.id}>
            <Link href={`/saved/${listing.id}`} className="flex h-[72px] items-center gap-3 px-4 hover:bg-surface">
              <MiniTile type={listing.type} size={56} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{listing.title}</span>
                <span className="block truncate text-muted-foreground">
                  {listing.org_name} · {TYPE_META[listing.type].label}
                </span>
              </span>
              <span className={cn("text-xs", due.urgent ? "text-danger" : "text-muted-foreground")}>{due.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
