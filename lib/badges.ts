"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Me } from "@/lib/types";

type BadgeKey = keyof Me["badges"];
type Readable = { id: string; read_at: string | null };

/** How long new items must be on screen before they count as seen. */
const SEEN_AFTER_MS = 1200;

function useMarkRead(badge: BadgeKey, listKey: readonly unknown[], mark: (ids: string[]) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mark,
    // Optimistic: the dot disappears as soon as the new items have been seen.
    onMutate: (ids: string[]) => {
      const now = new Date().toISOString();
      const items = queryClient.setQueryData<Readable[]>(listKey, (list) =>
        list?.map((it) => (ids.includes(it.id) && !it.read_at ? { ...it, read_at: now } : it)),
      );
      if (items) {
        const unread = items.filter((it) => !it.read_at).length;
        queryClient.setQueryData<Me>(qk.me, (me) => (me ? { ...me, badges: { ...me.badges, [badge]: unread } } : me));
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.me }),
  });
}

/**
 * Once unread items have been visible for a moment (and the screen is the active one),
 * mark them read so the matching red dot clears.
 */
function useMarkSeenWhenShown(
  items: Readable[] | undefined,
  visible: boolean,
  mutate: (ids: string[]) => void,
) {
  const unreadIds = (items ?? []).filter((it) => !it.read_at).map((it) => it.id);
  const key = unreadIds.join(",");
  useEffect(() => {
    if (!visible || !key) return;
    const t = setTimeout(() => mutate(key.split(",")), SEEN_AFTER_MS);
    return () => clearTimeout(t);
    // `key` captures the unread set; mutate is stable from useMutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, key]);
}

/** Shares shown on screen → read → the Friends tab dot clears. */
export function useInboxSeen(items: Readable[] | undefined, visible: boolean) {
  const { mutate } = useMarkRead("unreadInbox", qk.inbox, api.markInboxRead);
  useMarkSeenWhenShown(items, visible, mutate);
}

/** Notifications shown on screen → read → the bell dot clears. */
export function useNotificationsSeen(items: Readable[] | undefined, visible: boolean) {
  const { mutate } = useMarkRead("unreadNotifications", qk.notifications, api.markNotificationsRead);
  useMarkSeenWhenShown(items, visible, mutate);
}
