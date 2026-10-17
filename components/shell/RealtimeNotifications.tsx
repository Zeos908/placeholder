"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { MOCK_API } from "@/lib/mock";
import { qk } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { NotificationKind } from "@/lib/types";

/** What each kind of notification makes stale, besides the bell list and badges (/api/me). */
const ALSO_STALE: Record<NotificationKind, readonly (readonly string[])[]> = {
  reminder: [],
  friend_request: [qk.friends],
  friend_accepted: [qk.friends, qk.activity],
  share: [qk.inbox],
};

/**
 * Supabase Realtime (build spec §5): listens for notification inserts for this user (RLS
 * applies) and refetches the bell, badges, and whatever list the notification is about.
 * Mock mode has no Realtime; MSW data changes show up on the next refetch instead.
 */
export function RealtimeNotifications({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (MOCK_API || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // The session is read from cookies asynchronously; subscribing before Realtime has the
    // user's token would join as anon, and RLS would then drop every event.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (change) => {
            const kind = (change.new as { kind?: NotificationKind }).kind;
            for (const key of [qk.notifications, qk.me, ...(kind ? (ALSO_STALE[kind] ?? []) : [])]) {
              void queryClient.invalidateQueries({ queryKey: key });
            }
          },
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return null;
}
