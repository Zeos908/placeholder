"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { qk, useMe } from "@/lib/queries";
import { usePrefs } from "@/lib/store";
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

/**
 * The number on the Saved tab: saves that became "due soon" since Saved was last opened.
 * Opening Saved (or any saved item) clears it; it comes back only when more are due soon.
 */
export function useSavedBadge(): number {
  const { data: me } = useMe();
  const pathname = usePathname();
  const dueSoon = me?.badges.dueSoon ?? 0;
  const seen = usePrefs((s) => (me ? (s.dueSoonSeen[me.id] ?? 0) : 0));
  const setSeen = usePrefs((s) => s.setDueSoonSeen);
  const onSaved = pathname === "/saved" || pathname.startsWith("/saved/");

  useEffect(() => {
    if (!me) return;
    // On Saved: everything shown counts as seen. Elsewhere: if some dropped off (deadline
    // passed, unsaved), lower the mark so a newly due item shows up again.
    if ((onSaved && seen !== dueSoon) || dueSoon < seen) setSeen(me.id, dueSoon);
  }, [me, onSaved, dueSoon, seen, setSeen]);

  return onSaved ? 0 : Math.max(0, dueSoon - seen);
}
