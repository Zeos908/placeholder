"use client";

import { ErrorState } from "@/components/common/EmptyState";
import { PostCard } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useListing } from "@/lib/saved";
import type { FeedPost } from "@/lib/types";

/**
 * A full, swipeable post in a bottom sheet (spec §13–14): opened from activity items,
 * overlap cards, inbox shares and profile grid tiles. A swipe closes the sheet.
 */
export function PostSheet({ listingId, onClose }: { listingId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!listingId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] max-w-[470px] gap-0 overflow-y-auto rounded-t-2xl p-0 pt-2"
      >
        <SheetTitle className="sr-only">Post</SheetTitle>
        <SheetDescription className="sr-only">Swipe right to save or left to pass.</SheetDescription>
        <span aria-hidden className="mx-auto mb-1 block h-1 w-10 shrink-0 rounded-full bg-border" />
        {listingId && <PostSheetBody listingId={listingId} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function PostSheetBody({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const { data, isPending, isError, refetch } = useListing(listingId);
  if (isPending) return <PostSkeleton />;
  if (isError || !data) return <ErrorState message="This post isn't available." onRetry={() => refetch()} />;
  const post: FeedPost = { ...data.listing, saved: data.state === "saved", friends_saved: data.friends_saved };
  return <PostCard post={post} index={0} onExit={onClose} />;
}
