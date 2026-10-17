import { deadlineInfo } from "@/lib/format";
import { TYPE_META } from "@/lib/opp";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Text post (spec §9.3), shown when a listing has no media or its video fails: type-color
 * gradient, type emoji, big centered title, org name, and a frosted deadline pill when ≤ 14 days.
 */
export function TextPost({
  listing,
  className,
  compact = false,
}: {
  listing: Pick<Listing, "type" | "title" | "org_name" | "deadline">;
  className?: string;
  /** Smaller type for deck cards. */
  compact?: boolean;
}) {
  const meta = TYPE_META[listing.type];
  const due = deadlineInfo(listing.deadline);
  const showDue = due.days !== null && due.days >= 0 && due.days <= 14;

  return (
    <div
      className={cn(
        "relative flex aspect-[4/5] w-full flex-col items-center justify-center bg-gradient-to-br text-center text-white select-none",
        meta.gradient,
        className,
      )}
    >
      <span aria-hidden className="absolute top-4 left-4 text-2xl leading-none">
        {meta.emoji}
      </span>
      <p
        className={cn(
          "line-clamp-5 px-8 font-bold [overflow-wrap:anywhere]",
          compact ? "text-2xl leading-[30px]" : "text-[28px] leading-[34px]",
        )}
      >
        {listing.title}
      </p>
      {listing.org_name && (
        <p className="mt-3 px-8 text-[15px] font-semibold text-white/80">{listing.org_name}</p>
      )}
      {showDue && (
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/20 px-3 py-1 text-[13px] font-semibold whitespace-nowrap backdrop-blur-md">
          {due.label}
        </span>
      )}
    </div>
  );
}
