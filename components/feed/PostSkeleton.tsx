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

/** Feed first load (spec §8): 2 post skeletons (the stories row draws its own circles). */
export function FeedSkeleton() {
  return (
    <div role="status" aria-label="Loading feed">
      <PostSkeleton />
      <PostSkeleton />
    </div>
  );
}
