"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, SearchX, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { TextInput } from "@/components/common/Field";
import { FilterChips } from "@/components/saved/FilterChips";
import { ListingRow, RowsSkeleton } from "@/components/saved/SavedRow";
import { api } from "@/lib/api";
import type { SavedFilter } from "@/lib/saved";

const MIN_CHARS = 2;
const SUGGESTIONS = ["coding", "remote", "environment", "healthcare", "music", "scholarship"];

/** Waits until typing pauses before searching. */
function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Search opportunities by keyword (title, organization, description, location, tags), with the
 * same type chips as Saved. The query is kept in ?q= so a search can be shared or reloaded.
 */
export function SearchView() {
  const params = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<SavedFilter>("all");
  const q = useDebounced(text.trim());
  const type = filter === "all" ? null : filter;
  const ready = q.length >= MIN_CHARS;

  // Keep the URL in step without a navigation (no re-render of the page).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, [q]);

  const results = useQuery({
    queryKey: ["search", q, type],
    queryFn: () => api.search(q, type),
    enabled: ready,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  return (
    <div>
      <div className="px-4 pt-3">
        <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <TextInput
            type="search"
            aria-label="Search opportunities"
            placeholder="Search internships, events, scholarships…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            enterKeyHint="search"
            autoFocus
            autoComplete="off"
            className="pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setText("")}
              className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-background"
            >
              <X className="size-4" />
            </button>
          )}
        </form>
      </div>
      <FilterChips value={filter} onChange={setFilter} />

      {!ready ? (
        <div className="px-4 pt-4">
          <p className="text-sm text-muted-foreground">Try searching for</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setText(s)}
                className="h-8 rounded-full border border-border px-3.5 text-sm hover:bg-surface"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : results.isError ? (
        <ErrorState message="Couldn't search right now." onRetry={() => results.refetch()} />
      ) : !results.data ? (
        <RowsSkeleton />
      ) : results.data.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matches"
          body={type ? "Try another word, or switch the filter back to All." : "Try another word or a broader topic."}
        />
      ) : (
        <>
          <p aria-live="polite" className="px-4 pt-1 pb-1 text-xs text-muted-foreground">
            {results.data.length === 40 ? "40+ results" : `${results.data.length} ${results.data.length === 1 ? "result" : "results"}`}
          </p>
          <ul aria-label="Search results" className={results.isFetching ? "opacity-60 transition-opacity" : undefined}>
            {results.data.map((l) => (
              <li key={l.id}>
                <ListingRow listing={l} href={`/l/${l.id}`} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
