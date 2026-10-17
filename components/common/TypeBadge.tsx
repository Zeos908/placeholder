import { TYPE_META } from "@/lib/opp";
import type { OppType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Type pill (spec §9.1): 11 px text in the type color on a 15% tint of it. */
export function TypeBadge({ type, className }: { type: OppType; className?: string }) {
  const { label, color } = TYPE_META[type];
  return (
    <span
      className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold", className)}
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      {label}
    </span>
  );
}

/** Org logo, or initials on the type color (spec §9.1). */
export function OrgAvatar({
  name,
  logoUrl,
  type,
  size = 32,
}: {
  name: string | null;
  logoUrl: string | null;
  type: OppType;
  size?: number;
}) {
  const initials =
    (name ?? "?")
      .split(/\s+/)
      .filter((w) => /^[A-Za-z0-9]/.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), backgroundColor: TYPE_META[type].color }}
    >
      {initials}
    </span>
  );
}
