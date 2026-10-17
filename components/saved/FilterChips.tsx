"use client";

import { TYPE_META } from "@/lib/opp";
import type { SavedFilter } from "@/lib/saved";
import { OPP_TYPES } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: { value: SavedFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...OPP_TYPES.map((t) => ({ value: t, label: TYPE_META[t].label })),
];

/** Saved filter chips (spec §11): All · Internship · Volunteer · Event · Scholarship. */
export function FilterChips({ value, onChange }: { value: SavedFilter; onChange: (f: SavedFilter) => void }) {
  return (
    <div role="radiogroup" aria-label="Filter by type" className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-2.5">
      {FILTERS.map((f) => {
        const selected = f.value === value;
        return (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(f.value)}
            className={cn(
              "h-8 shrink-0 rounded-full px-3.5 text-sm transition",
              selected ? "border-accent-gradient font-semibold" : "border border-border bg-surface",
            )}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
