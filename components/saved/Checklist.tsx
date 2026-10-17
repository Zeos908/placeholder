"use client";

import { Check } from "lucide-react";
import { useToggleChecklist } from "@/lib/saved";
import type { ChecklistItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Checklist (spec §12.1): checkboxes, done items struck through. Shown only when it has steps. */
export function Checklist({ listingId, items }: { listingId: string; items: ChecklistItem[] }) {
  const toggle = useToggleChecklist(listingId);
  if (!items.length) return null;
  const done = items.filter((i) => i.done).length;

  return (
    <section aria-labelledby="checklist-heading" className="space-y-2">
      <h3 id="checklist-heading" className="flex items-baseline justify-between text-base font-semibold">
        Checklist
        <span className="text-xs font-normal text-muted-foreground">
          {done} of {items.length} done
        </span>
      </h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              onClick={() =>
                toggle.mutate(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
              }
              className="flex w-full items-start gap-3 rounded-lg px-1 py-2 text-left hover:bg-surface"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-px flex size-5 shrink-0 items-center justify-center rounded-md border-2",
                  item.done ? "border-transparent bg-accent-gradient text-white" : "border-muted-foreground",
                )}
              >
                {item.done && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className={cn(item.done && "text-muted-foreground line-through")}>{item.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
