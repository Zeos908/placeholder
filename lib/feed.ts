"use client";

import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk, staleTimes } from "@/lib/queries";
import { sound } from "@/lib/sound";
import { emitSwipeUndone } from "@/lib/swipe-events";
import type { FeedPage, FeedPost, SwipeDirection, SwipeResult } from "@/lib/types";

type FeedData = InfiniteData<FeedPage, string | null>;

export function useFeed() {
  return useInfiniteQuery({
    queryKey: qk.feed,
    queryFn: ({ pageParam }) => api.feed(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: staleTimes.feed,
  });
}

/** All loaded posts in order, de-duplicated (scores can shift slightly between pages). */
export function feedPosts(data: InfiniteData<FeedPage, unknown> | undefined): FeedPost[] {
  const seen = new Set<string>();
  const out: FeedPost[] = [];
  for (const page of data?.pages ?? []) {
    for (const p of page.posts) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

/**
 * Save / pass with optimistic cache updates (spec §19): the item leaves the feed after its
 * fly-off animation, a toast offers Undo (restores the cache snapshot + /api/swipe/undo), and a
 * failure rolls back with "Couldn't save. Try again."
 */
export function useSwipeActions() {
  const queryClient = useQueryClient();

  const mapPosts = (fn: (posts: FeedPost[]) => FeedPost[]) =>
    queryClient.setQueryData<FeedData>(qk.feed, (d) =>
      d ? { ...d, pages: d.pages.map((p) => ({ ...p, posts: fn(p.posts) })) } : d,
    );

  const refreshRelated = () =>
    Promise.all(
      [qk.savedAll, qk.passed, qk.me, qk.stories, qk.rightPanel].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );

  const removeFromFeed = (id: string) => mapPosts((posts) => posts.filter((p) => p.id !== id));
  const setSaved = (id: string, saved: boolean) =>
    mapPosts((posts) => posts.map((p) => (p.id === id ? { ...p, saved } : p)));

  /** Records the swipe. `keepInFeed` (double-tap save) marks it saved instead of removing it. */
  function swipe(post: FeedPost, direction: SwipeDirection, { keepInFeed = false } = {}): Promise<SwipeResult> {
    if (direction === "right") sound.save();
    else sound.pass();
    navigator.vibrate?.(10);

    const snapshot = queryClient.getQueryData<FeedData>(qk.feed);
    if (keepInFeed) setSaved(post.id, true);

    const request = api.swipe(post.id, direction);
    request.then(refreshRelated, () => {
      queryClient.setQueryData(qk.feed, snapshot);
      toast("Couldn't save. Try again.", { id: "swipe" });
    });

    toast(direction === "right" ? "Saved" : "Passed", {
      id: "swipe",
      action: {
        label: "Undo",
        onClick: async () => {
          emitSwipeUndone(post.id);
          queryClient.setQueryData(qk.feed, snapshot);
          try {
            const { undoToken } = await request;
            await api.undoSwipe(undoToken);
          } catch {
            toast("Couldn't undo. Try again.", { id: "swipe" });
          }
          refreshRelated();
        },
      },
    });
    return request;
  }

  /** Bookmark tapped on a post that's already saved (it stayed in the feed): put it back to unswiped. */
  async function unsaveInPlace(post: FeedPost) {
    sound.pass();
    setSaved(post.id, false);
    try {
      await api.unsave(post.id);
      await api.restore(post.id);
      refreshRelated();
    } catch {
      setSaved(post.id, true);
      toast("Couldn't save. Try again.", { id: "swipe" });
    }
  }

  return { swipe, unsaveInPlace, removeFromFeed };
}

// ---- seen tracking: posts on screen ≥ 2 s are reported in small batches (build spec §7)

const pendingSeen = new Set<string>();
const reportedSeen = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function reportSeen(id: string) {
  if (reportedSeen.has(id)) return;
  reportedSeen.add(id);
  pendingSeen.add(id);
  flushTimer ??= setTimeout(() => {
    flushTimer = null;
    const ids = [...pendingSeen];
    pendingSeen.clear();
    api.seen(ids).catch(() => ids.forEach((i) => reportedSeen.delete(i)));
  }, 1500);
}
