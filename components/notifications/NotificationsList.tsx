"use client";

import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ListSkeleton } from "@/components/tabs/FeedTab";
import { api } from "@/lib/api";
import { useNotificationsSeen } from "@/lib/badges";
import { relativeTime } from "@/lib/format";
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
 * Notifications list (spec §17). Opening it marks everything shown as read, which clears the
 * bell dot. Phase F7 adds inline Accept/Decline and the full empty/error states.
 */
export function NotificationsList() {
  const { data, isPending } = useQuery({
    queryKey: qk.notifications,
    queryFn: api.notifications,
    refetchOnWindowFocus: true,
  });
  useNotificationsSeen(data, true);

  if (isPending) return <ListSkeleton />;
  if (!data?.length) return <p className="p-10 text-center text-muted-foreground">No notifications</p>;

  return (
    <div className="pb-6">
      {SECTIONS.map((name) => {
        const items = data.filter((n) => section(n) === name);
        if (!items.length) return null;
        return (
          <section key={name}>
            <h2 className="px-4 pt-5 pb-2 text-base font-bold">{name}</h2>
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={href(n)}
                    className={cn("flex items-center gap-3 px-4 py-2.5 hover:bg-surface", !n.read_at && "bg-surface/60")}
                  >
                    {n.actor ? (
                      <Avatar url={n.actor.avatar_url} name={n.actor.display_name || n.actor.username} size={40} />
                    ) : (
                      <span
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
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
