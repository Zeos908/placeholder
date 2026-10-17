"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PostCard } from "@/components/feed/PostCard";
import { FeedSkeleton, PostSkeleton } from "@/components/feed/PostSkeleton";
import { Button } from "@/components/ui/button";
import { feedPosts, useFeed } from "@/lib/feed";
import { qk } from "@/lib/queries";

const LOAD_MORE_FROM_END = 5; // fetch the next page when the 5th-from-last post shows (spec §19)
const PULL_TRIGGER = 64;

/** The Feed tab body (spec §9): posts, infinite scroll, pull-to-refresh, empty/error states. */
export function Feed() {
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed();
  const posts = feedPosts(data);
  const root = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const pull = usePullToRefresh(root);

  // Infinite scroll.
  const sentinelIndex = Math.max(0, posts.length - LOAD_MORE_FROM_END);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      // Also when it's already above the screen: a fast fling can skip past it between frames.
      const passed = entry.rootBounds !== null && entry.boundingClientRect.bottom < entry.rootBounds.top;
      if ((entry.isIntersecting || passed) && !isFetchingNextPage) void fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelIndex, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={root}>
      <PullIndicator distance={pull.distance} refreshing={pull.refreshing} />
      {isPending ? (
        <FeedSkeleton />
      ) : isError && !posts.length ? (
        <ErrorState message="Couldn't load your feed." onRetry={() => refetch()} />
      ) : posts.length === 0 ? (
        <CaughtUp />
      ) : (
        <>
          {posts.map((post, i) => (
            <div
              key={post.id}
              ref={i === sentinelIndex ? sentinel : undefined}
              data-testid={i === sentinelIndex ? "feed-sentinel" : undefined}
            >
              <PostCard post={post} index={i} />
            </div>
          ))}
          {isFetchingNextPage && <PostSkeleton />}
          {!hasNextPage && <CaughtUp compact />}
        </>
      )}
    </div>
  );
}

function CaughtUp({ compact }: { compact?: boolean }) {
  return (
    <EmptyState
      icon={CheckCheck}
      title={compact ? "You're all caught up ✨" : "You're all caught up"}
      body="Check back later or add interests."
      action={
        <Button asChild variant="surface">
          <Link href="/settings">Edit interests</Link>
        </Button>
      }
    />
  );
}

function PullIndicator({ distance, refreshing }: { distance: number; refreshing: boolean }) {
  if (!distance && !refreshing) return null;
  return (
    <div
      role="status"
      aria-label={refreshing ? "Refreshing" : "Pull to refresh"}
      className="flex items-end justify-center overflow-hidden"
      style={{ height: refreshing ? 48 : distance }}
    >
      <Loader2
        className={refreshing ? "mb-3 size-5 animate-spin text-muted-foreground" : "mb-3 size-5 text-muted-foreground"}
        style={refreshing ? undefined : { transform: `rotate(${distance * 4}deg)`, opacity: distance / PULL_TRIGGER }}
      />
    </div>
  );
}

/** Touch pull-down at the top of the Feed's scroll container → reload page 1 (build spec §9.3). */
function usePullToRefresh(root: React.RefObject<HTMLDivElement | null>) {
  const queryClient = useQueryClient();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const distanceRef = useRef(0);

  useEffect(() => {
    const container = root.current?.closest<HTMLElement>("[data-tab]");
    if (!container) return;
    let startY: number | null = null;

    const set = (d: number) => {
      distanceRef.current = d;
      setDistance(d);
    };
    const onStart = (e: TouchEvent) => {
      startY = container.scrollTop <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || container.scrollTop > 0) return set(0);
      set(Math.min(96, dy * 0.5)); // resistance
    };
    const onEnd = async () => {
      const pulled = distanceRef.current >= PULL_TRIGGER;
      startY = null;
      set(0);
      if (!pulled) return;
      setRefreshing(true);
      await Promise.all([
        queryClient.resetQueries({ queryKey: qk.feed }),
        queryClient.invalidateQueries({ queryKey: qk.stories }),
      ]);
      setRefreshing(false);
    };

    container.addEventListener("touchstart", onStart, { passive: true });
    container.addEventListener("touchmove", onMove, { passive: true });
    container.addEventListener("touchend", onEnd);
    container.addEventListener("touchcancel", onEnd);
    return () => {
      container.removeEventListener("touchstart", onStart);
      container.removeEventListener("touchmove", onMove);
      container.removeEventListener("touchend", onEnd);
      container.removeEventListener("touchcancel", onEnd);
    };
  }, [root, queryClient]);

  return { distance, refreshing };
}
