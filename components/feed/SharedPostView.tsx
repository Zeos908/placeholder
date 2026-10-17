"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ErrorState } from "@/components/common/EmptyState";
import { PostCard } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { PageHeader } from "@/components/shell/PageHeader";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { FeedPost } from "@/lib/types";

/** Shared post link (/l/[listingId], build spec §9.5): opens the post for signed-in users. */
export function SharedPostView() {
  const { listingId } = useParams<{ listingId: string }>();
  const router = useRouter();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: qk.listing(listingId),
    queryFn: () => api.listing(listingId),
  });

  const post: FeedPost | null = data
    ? { ...data.listing, saved: data.state === "saved", friends_saved: data.friends_saved }
    : null;

  return (
    <div className="mx-auto max-w-[470px]">
      <PageHeader title="Post" />
      {isPending ? (
        <PostSkeleton />
      ) : isError || !post ? (
        <ErrorState message="This post isn't available." onRetry={() => refetch()} />
      ) : (
        // After a swipe the post is gone from here too, so head back to the feed.
        <PostCard post={post} index={0} onExit={() => router.replace("/feed")} />
      )}
    </div>
  );
}
