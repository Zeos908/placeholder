"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { MiniTile } from "@/components/common/MiniTile";
import { useTabActive } from "@/components/shell/shell-context";
import { ListSkeleton } from "@/components/tabs/FeedTab";
import { api } from "@/lib/api";
import { useInboxSeen } from "@/lib/badges";
import { relativeTime } from "@/lib/format";
import { qk } from "@/lib/queries";
import { cn } from "@/lib/utils";

// TEMPORARY (F1/F2): shares on top + plain activity list. Phase F6 builds the real Friends tab
// (Activity · Inbox · Friends); the "seen → clear the dot" rule moves to its Inbox segment.
export function FriendsTab() {
  const { active } = useTabActive();
  const activity = useQuery({ queryKey: qk.activity, queryFn: () => api.activity() });
  const inbox = useQuery({ queryKey: qk.inbox, queryFn: api.inbox, refetchOnWindowFocus: true });
  useInboxSeen(inbox.data, active);

  if (activity.isPending) return <ListSkeleton />;
  return (
    <>
      {!!inbox.data?.length && (
        <section aria-label="Shares" className="border-b border-border py-2">
          <h2 className="px-4 py-2 font-semibold">Sent to you</h2>
          <ul>
            {inbox.data.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                <Avatar url={s.from.avatar_url} name={s.from.display_name || s.from.username} size={40} />
                <p className={cn("min-w-0 flex-1", !s.read_at && "font-semibold")}>
                  <span className="font-semibold">{s.from.username}</span> sent you{" "}
                  <span className="italic">{s.listing.title}</span>
                  {s.message && <span className="block truncate text-muted-foreground">“{s.message}”</span>}
                </p>
                {!s.read_at && <span aria-label="New" className="size-2 shrink-0 rounded-full bg-link" />}
                <MiniTile type={s.listing.type} size={44} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul className="py-2">
        {activity.data?.items.map((a) => (
          <li key={a.id} className="flex h-16 items-center gap-3 px-4">
            <Avatar url={a.actor.avatar_url} name={a.actor.display_name || a.actor.username} size={40} />
            <p className="min-w-0 flex-1">
              <span className="font-semibold">{a.actor.username}</span> {a.verb}{" "}
              <span className="italic">{a.listing.title}</span>{" "}
              <span className="text-muted-foreground">{relativeTime(a.created_at)}</span>
            </p>
            <MiniTile type={a.listing.type} size={44} />
          </li>
        ))}
      </ul>
    </>
  );
}
