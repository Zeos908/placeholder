"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { FilterChips } from "@/components/saved/FilterChips";
import { ListingRow, RowsSkeleton } from "@/components/saved/SavedRow";
import { StatusPill, StatusSheet } from "@/components/saved/StatusSheet";
import { SwipeToUnsave } from "@/components/saved/SwipeToUnsave";
import { TYPE_META } from "@/lib/opp";
import { useSaved, useUnsave, type SavedFilter } from "@/lib/saved";
import { useUi } from "@/lib/store";
import type { SavedItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Saved tab (spec §9.6, §11): deadline-sorted list, type filters, status, swipe to unsave. */
export function SavedTab() {
  const [filter, setFilter] = useState<SavedFilter>("all");
  const { data, isPending, isError, refetch } = useSaved(filter);
  const unsave = useUnsave();
  const [statusFor, setStatusFor] = useState<SavedItem | null>(null);
  const topBarVisible = useUi((s) => s.topBarVisible);

  return (
    <>
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-xl leading-[26px] font-bold">Saved</h1>
        <Link href="/saved/passed" className="font-semibold text-link">
          Passed
        </Link>
      </div>

      {/* Sticky under the mobile top bar while it's showing; at the very top otherwise. Sticky offsets
          count from inside the tab container's 56 px top padding, hence 0 / -56 px. */}
      <div
        className={cn(
          "sticky z-30 border-b border-border bg-background transition-[top] duration-200 ease-ig md:top-0",
          topBarVisible ? "top-0" : "-top-14",
        )}
      >
        <FilterChips value={filter} onChange={setFilter} />
      </div>

      {isPending ? (
        <RowsSkeleton />
      ) : isError ? (
        <ErrorState message="Couldn't load your saved items." onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={filter === "all" ? "Nothing saved yet" : `No ${TYPE_META[filter].label.toLowerCase()}s saved`}
          body="Swipe right or double-tap a post to save it."
        />
      ) : (
        <ul className="py-1" aria-label="Saved items">
          {data.map((item) => (
            <li key={item.listing.id}>
              <SwipeToUnsave label={item.listing.title} onUnsave={() => void unsave(item)}>
                <ListingRow
                  listing={item.listing}
                  href={`/saved/${item.listing.id}`}
                  right={<StatusPill status={item.app_status} onClick={() => setStatusFor(item)} />}
                />
              </SwipeToUnsave>
            </li>
          ))}
        </ul>
      )}

      <StatusSheet
        listingId={statusFor?.listing.id ?? null}
        current={statusFor?.app_status ?? null}
        open={!!statusFor}
        onOpenChange={(o) => !o && setStatusFor(null)}
      />
    </>
  );
}
