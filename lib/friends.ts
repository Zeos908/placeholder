"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MOCK_API } from "@/lib/mock";
import { qk, staleTimes } from "@/lib/queries";
import type { ActivityItem, OverlapItem } from "@/lib/types";

export function useFriends() {
  return useQuery({ queryKey: qk.friends, queryFn: api.friends });
}

export function useInbox() {
  return useQuery({ queryKey: qk.inbox, queryFn: api.inbox, refetchOnWindowFocus: true });
}

export function useActivity() {
  return useInfiniteQuery({
    queryKey: qk.activity,
    queryFn: ({ pageParam }) => api.activity(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export type ActivityRow = { kind: "item"; item: ActivityItem } | { kind: "overlap"; overlap: OverlapItem };

/** Interleaves overlap highlight cards every ~6 activity items (spec §13). */
export function interleave(items: ActivityItem[], overlaps: OverlapItem[], every = 6): ActivityRow[] {
  const rows: ActivityRow[] = [];
  let o = 0;
  items.forEach((item, i) => {
    rows.push({ kind: "item", item });
    if ((i + 1) % every === 0 && o < overlaps.length) rows.push({ kind: "overlap", overlap: overlaps[o++] });
  });
  // A short feed still gets its first highlight.
  if (o === 0 && overlaps.length) rows.push({ kind: "overlap", overlap: overlaps[0] });
  return rows;
}

export function useProfile(username: string) {
  return useQuery({
    queryKey: qk.profile(username),
    queryFn: () => api.profile(username),
    staleTime: staleTimes.profile,
  });
}

/** Username search, debounced 300 ms, from 2 characters (build spec §8). */
export function useUserSearch(q: string) {
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim().replace(/^@/, "")), 300);
    return () => clearTimeout(t);
  }, [q]);
  return useQuery({
    queryKey: ["user-search", debounced],
    queryFn: () => api.searchUsers(debounced),
    enabled: debounced.length >= 2,
  });
}

/** Everything a friendship change can affect. */
function useRefreshSocial() {
  const queryClient = useQueryClient();
  return (username?: string) =>
    Promise.all(
      [qk.friends, qk.activity, qk.inbox, qk.me, qk.notifications, qk.stories, qk.rightPanel, ...(username ? [qk.profile(username)] : [])].map(
        (queryKey) => queryClient.invalidateQueries({ queryKey }),
      ),
    );
}

const FAILED = "Couldn't save. Try again.";

export function useFriendActions() {
  const refresh = useRefreshSocial();
  const run =
    <A extends unknown[]>(fn: (...args: A) => Promise<unknown>, done?: string) =>
    async (username: string | undefined, ...args: A) => {
      try {
        await fn(...args);
        if (done) toast(done);
      } catch {
        toast(FAILED);
      }
      await refresh(username);
    };

  return {
    request: run((userId: string) => api.requestFriend(userId), "Request sent"),
    accept: run((userId: string) => api.respondFriend(userId, true), "You're now friends"),
    decline: run((userId: string) => api.respondFriend(userId, false)),
    unfriend: run((userId: string) => api.unfriend(userId), "Unfriended"),
    block: run((userId: string) => api.block(userId), "Blocked"),
  };
}

/** Share a listing with friends (spec §13). */
export function useShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ toUserIds, listingId, message }: { toUserIds: string[]; listingId: string; message?: string }) =>
      api.share(toUserIds, listingId, message),
    onSuccess: (_d, { toUserIds }) => {
      toast(toUserIds.length === 1 ? "Sent" : `Sent to ${toUserIds.length} friends`);
      const refresh = () =>
        Promise.all([qk.inbox, qk.me, qk.notifications].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      void refresh();
      // Mock only: a friend "shares back" a moment later (mocks/handlers.ts) so the Inbox can be
      // tried with one account; real shares to you arrive via Realtime (phase F8).
      if (MOCK_API) setTimeout(() => void refresh(), 3000);
    },
    onError: () => toast("Couldn't send. Try again."),
  });
}
