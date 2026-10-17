import { Skeleton } from "@/components/ui/skeleton";

/** Post skeleton (spec §8): 32 px circle + 2 short bars, a 4:5 block, 3 text bars. */
export function PostSkeleton() {
  return (
    <div className="pb-6" aria-hidden>
      <div className="flex h-14 items-center gap-3 px-3">
        <Skeleton className="size-8 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="space-y-2 px-3 pt-4">
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/** Feed first load (spec §8): stories row (4 circles + labels), then 2 post skeletons. */
export function FeedSkeleton() {
  return (
    <div role="status" aria-label="Loading feed">
      <div className="flex h-[104px] gap-3 overflow-hidden border-b border-border px-4 pt-3" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex w-[74px] shrink-0 flex-col items-center gap-2">
            <Skeleton className="size-[66px] rounded-full" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        ))}
      </div>
      <PostSkeleton />
      <PostSkeleton />
    </div>
  );
}
