import { cn } from "cn"

// Shimmer colors come from --skeleton-from/--skeleton-to (front-end spec §8).
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
