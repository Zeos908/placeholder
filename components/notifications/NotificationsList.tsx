"use client";

import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { ActivitySkeleton } from "@/components/friends/rows";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useNotificationsSeen } from "@/lib/badges";
import { relativeTime } from "@/lib/format";
import { useFriendActions } from "@/lib/friends";
import { TYPE_META } from "@/lib/opp";
import { qk } from "@/lib/queries";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";

const SECTIONS = ["Today", "This week", "Earlier"] as const;

function section(n: AppNotification): (typeof SECTIONS)[number] {
  const days = differenceInCalendarDays(new Date(), new Date(n.created_at));
  return days === 0 ? "Today" : days < 7 ? "This week" : "Earlier";
}

function href(n: AppNotification) {
  if (n.kind === "reminder" && n.listing) return `/saved/${n.listing.id}`;
  if (n.kind === "share") return "/friends";
  if (n.actor) return `/u/${n.actor.username}`;
  return "/feed";
}

/**
 * Notifications (spec §17): Today / This week / Earlier; avatar or a type-colored bell for
 * reminders; inline Accept/Decline for friend requests; unread rows tinted. Opening the page
 * marks what's shown as read, which clears the bell dot.
 */
export function NotificationsList() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: qk.notifications,
    queryFn: api.notifications,
    refetchOnWindowFocus: true,
  });
  useNotificationsSeen(data, true);

  if (isPending) return <ActivitySkeleton />;
  if (isError) return <ErrorState message="Couldn't load notifications." onRetry={() => refetch()} />;
  if (!data.length) return <EmptyState icon={Bell} title="No notifications" />;

  return (
    <div className="pb-6">
      {SECTIONS.map((name) => {
        const items = data.filter((n) => section(n) === name);
        if (!items.length) return null;
        return (
          <section key={name} aria-label={name}>
            <h2 className="px-4 pt-5 pb-2 text-base font-bold">{name}</h2>
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationRow n={n} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function NotificationRow({ n }: { n: AppNotification }) {
  const actions = useFriendActions();
  const [answered, setAnswered] = useState<"accepted" | "declined" | null>(null);

  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5", !n.read_at && "bg-surface/60")}>
      <Link href={href(n)} className="flex min-w-0 flex-1 items-center gap-3">
        {n.actor ? (
          <Avatar url={n.actor.avatar_url} name={n.actor.display_name || n.actor.username} size={40} />
        ) : (
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: n.listing ? TYPE_META[n.listing.type].color : "var(--muted-foreground)" }}
          >
            <Bell className="size-5" />
          </span>
        )}
        <p className="min-w-0 flex-1">
          {n.actor && <span className="font-semibold">{n.actor.username} </span>}
          {n.title}
          {n.kind === "share" && n.listing && <span className="italic"> {n.listing.title}</span>}{" "}
          <span className="text-muted-foreground">{relativeTime(n.created_at)}</span>
        </p>
      </Link>
      {n.kind === "friend_request" && n.actor && (
        <span className="flex shrink-0 gap-2">
          {answered ? (
            <span className="text-xs text-muted-foreground">{answered === "accepted" ? "Friends" : "Declined"}</span>
          ) : (
            <>
              <Button
                variant="gradient"
                size="sm"
                onClick={() => {
                  setAnswered("accepted");
                  void actions.accept(n.actor!.username, n.actor!.id);
                }}
              >
                Accept
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAnswered("declined");
                  void actions.decline(n.actor!.username, n.actor!.id);
                }}
              >
                Decline
              </Button>
            </>
          )}
        </span>
      )}
    </div>
  );
}
