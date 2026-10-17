"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { MiniTile } from "@/components/common/MiniTile";
import { ListSkeleton } from "@/components/tabs/FeedTab";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { qk } from "@/lib/queries";

// TEMPORARY (F1): plain activity list for shell testing. Phase F6 builds the real Friends tab.
export function FriendsTab() {
  const { data, isPending } = useQuery({ queryKey: qk.activity, queryFn: () => api.activity() });
  if (isPending) return <ListSkeleton />;
  return (
    <ul className="py-2">
      {data?.items.map((a) => (
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
  );
}
