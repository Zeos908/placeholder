"use client";

import { Check, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { STATUS_META } from "@/lib/opp";
import { useSetStatus } from "@/lib/saved";
import { APP_STATUSES, type AppStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Status pill (spec §9.6 / §11): status color text on a light tint; tapping opens the sheet. */
export function StatusPill({
  status,
  onClick,
  className,
}: {
  status: AppStatus;
  onClick?: () => void;
  className?: string;
}) {
  const { label, color } = STATUS_META[status];
  return (
    <button
      type="button"
      onClick={(e) => {
        // Rows are links; the pill opens the sheet instead of the item.
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      aria-label={`Status: ${label}. Change status`}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold",
        className,
      )}
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      {label}
      <ChevronDown className="size-3.5" />
    </button>
  );
}

/**
 * Status sheet (spec §12.3): five rows with a colored dot and a check on the current one.
 * Selecting updates optimistically and closes; Accepted fires confetti + the chime.
 */
export function StatusSheet({
  listingId,
  current,
  open,
  onOpenChange,
}: {
  listingId: string | null;
  current: AppStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setStatus = useSetStatus();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-[470px] rounded-t-2xl bg-surface-2 pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="items-center border-b border-border pb-3">
          <span aria-hidden className="mb-1 h-1 w-10 rounded-full bg-border" />
          <SheetTitle>Status</SheetTitle>
          <SheetDescription className="sr-only">Where you are with this opportunity</SheetDescription>
        </SheetHeader>
        <ul role="radiogroup" aria-label="Status" className="py-2">
          {APP_STATUSES.map((s) => {
            const { label, color } = STATUS_META[s];
            const selected = s === current;
            return (
              <li key={s}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    if (listingId && !selected) setStatus.mutate({ listingId, status: s });
                    onOpenChange(false);
                  }}
                  className="flex h-12 w-full items-center gap-3 px-5 text-left text-[15px] hover:bg-surface"
                >
                  <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className={cn("flex-1", selected && "font-semibold")}>{label}</span>
                  {selected && <Check className="size-5" />}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
