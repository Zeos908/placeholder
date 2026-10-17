import { cn } from "@/lib/utils";

/** "placeholder" in Grand Hotel, solid foreground color (spec §4). Sizes: 30 top bar, 32 sidebar, 52 login. */
export function Wordmark({
  size = 30,
  short = false,
  className,
}: {
  size?: number;
  /** Collapsed sidebar shows just "p". */
  short?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("font-wordmark leading-none text-foreground select-none", className)}
      style={{ fontSize: size }}
    >
      {short ? "p" : "placeholder"}
    </span>
  );
}
