"use client";

import { Undo2 } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { ListingRow, RowsSkeleton } from "@/components/saved/SavedRow";
import { PageHeader } from "@/components/shell/PageHeader";
import { usePassed, useRestore } from "@/lib/saved";

/** Passed list (spec §11): same rows as Saved, each with a blue Restore. */
export function PassedView() {
  const { data, isPending, isError, refetch } = usePassed();
  const restore = useRestore();

  return (
    <div className="mx-auto max-w-[600px]">
      <PageHeader title="Passed" fallbackHref="/saved" />
      {isPending ? (
        <RowsSkeleton />
      ) : isError ? (
        <ErrorState message="Couldn't load your passed items." onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState icon={Undo2} title="No passed items" />
      ) : (
        <ul className="py-1" aria-label="Passed items">
          {data.map(({ listing }) => (
            <li key={listing.id}>
              <ListingRow
                listing={listing}
                href={`/l/${listing.id}`}
                right={
                  <button
                    type="button"
                    onClick={() => restore.mutate(listing.id)}
                    aria-label={`Restore ${listing.title}`}
                    className="shrink-0 px-1 font-semibold text-link"
                  >
                    Restore
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
