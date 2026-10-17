import { TYPE_META } from "@/lib/opp";
import type { OppType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Small square text tile (type gradient + emoji) used when a listing has no media to thumbnail. */
export function MiniTile({ type, size = 44, className }: { type: OppType; size?: number; className?: string }) {
  const meta = TYPE_META[type];
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center bg-gradient-to-br", meta.gradient, className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {meta.emoji}
    </span>
  );
}
