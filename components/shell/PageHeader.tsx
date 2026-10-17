"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Page header for detail, profile and settings pages (spec §5): back chevron, centered title,
 * optional action on the right ("…").
 */
export function PageHeader({
  title,
  fallbackHref = "/feed",
  right,
}: {
  title: ReactNode;
  /** Where Back goes when there's no history to return to (e.g. opened from a link). */
  fallbackHref?: string;
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background px-1">
      <button
        type="button"
        aria-label="Back"
        onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
        className="flex size-11 items-center justify-center rounded-full hover:bg-surface"
      >
        <ChevronLeft className="size-7" strokeWidth={1.75} />
      </button>
      <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-base font-semibold">
        {title}
      </h1>
      <div className="ml-auto flex min-w-11 justify-end pr-1">{right}</div>
    </header>
  );
}
