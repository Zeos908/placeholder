"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Thumb } from "@/components/common/Thumb";
import { useShellUser } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSwipeActions } from "@/lib/feed";
import { relativeTime } from "@/lib/format";
import type { ActivityItem, FeedPost, InboxItem, ListingSummary, OverlapItem, PersonSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const VERB: Record<ActivityItem["verb"], string> = {
  saved: "saved",
  applied: "applied to",
  accepted: "got accepted to",
};

/** Activity row (spec §13): "maya saved NASA Summer Internship · 2h" with a thumbnail. */
export function ActivityRow({ item, onOpen }: { item: ActivityItem; onOpen: (listingId: string) => void }) {
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-2">
      <Link href={`/u/${item.actor.username}`} className="shrink-0 rounded-full" aria-label={`@${item.actor.username}`}>
        <Avatar url={item.actor.avatar_url} name={item.actor.display_name || item.actor.username} size={40} />
      </Link>
      <button type="button" onClick={() => onOpen(item.listing.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{item.actor.username}</span> {VERB[item.verb]}{" "}
          <span className="italic">{item.listing.title}</span>{" "}
          <span className="text-muted-foreground">{relativeTime(item.created_at)}</span>
        </p>
        <Thumb listing={item.listing} size={44} className="rounded-sm" />
      </button>
    </div>
  );
}

/** Stacked avatars, first one on top. */
export function AvatarStack({ people, size = 28 }: { people: Pick<PersonSummary, "id" | "username" | "display_name" | "avatar_url">[]; size?: number }) {
  return (
    <span className="flex shrink-0 -space-x-2">
      {people.map((p) => (
        <Avatar key={p.id} url={p.avatar_url} name={p.display_name || p.username} size={size} className="ring-2 ring-background" />
      ))}
    </span>
  );
}

/** Overlap highlight (spec §13): "You and 3 friends saved Riverside Cleanup" + View. */
export function OverlapCard({ overlap, onOpen }: { overlap: OverlapItem; onOpen: (listingId: string) => void }) {
  const me = useShellUser();
  const n = overlap.friend_count;
  return (
    <div className="mx-4 my-2 flex items-center gap-3 rounded-lg border border-border p-3">
      <AvatarStack people={[{ id: "me", ...me }, ...overlap.friends.slice(0, 2)]} />
      <p className="min-w-0 flex-1 text-[13px] leading-[18px]">
        You and{" "}
        <span className="font-semibold">
          {n} {n === 1 ? "friend" : "friends"}
        </span>{" "}
        saved <span className="italic">{overlap.listing.title}</span>
      </p>
      <Thumb listing={overlap.listing} size={44} className="rounded-sm" />
      <Button variant="surface" size="sm" onClick={() => onOpen(overlap.listing.id)}>
        View
      </Button>
    </div>
  );
}

// Inbox Save/Pass only need the id for the swipe; the rest is for type-compat with feed posts.
function asPost(l: ListingSummary): FeedPost {
  return { ...(l as unknown as FeedPost), saved: false, friends_saved: { count: 0, people: [] } };
}

/** Inbox row (spec §13): who sent what, their message, and inline Save / Pass. */
export function InboxRow({ item, onOpen }: { item: InboxItem; onOpen: (listingId: string) => void }) {
  const actions = useSwipeActions();
  const [done, setDone] = useState<"saved" | "passed" | null>(null);
  const unread = !item.read_at;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Link href={`/u/${item.from.username}`} className="relative shrink-0 rounded-full" aria-label={`@${item.from.username}`}>
        <Avatar url={item.from.avatar_url} name={item.from.display_name || item.from.username} size={40} />
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <button type="button" onClick={() => onOpen(item.listing.id)} className={cn("block text-left", unread && "font-semibold")}>
          <span className="font-semibold">{item.from.username}</span> sent you{" "}
          <span className="italic">{item.listing.title}</span>{" "}
          <span className="font-normal text-muted-foreground">{relativeTime(item.created_at)}</span>
        </button>
        {item.message && (
          <p className="w-fit max-w-full rounded-2xl bg-surface px-3 py-1.5 text-[13px] [overflow-wrap:anywhere]">“{item.message}”</p>
        )}
        <div className="flex gap-2 pt-0.5">
          {done ? (
            <span className="text-xs font-semibold text-muted-foreground">{done === "saved" ? "Saved" : "Passed"}</span>
          ) : (
            <>
              <Button
                variant="gradient"
                size="sm"
                onClick={() => {
                  setDone("saved");
                  actions.swipe(asPost(item.listing), "right", { removeNow: true });
                }}
              >
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDone("passed");
                  actions.swipe(asPost(item.listing), "left", { removeNow: true });
                }}
              >
                Pass
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {unread && <span aria-label="Unread" className="size-2 rounded-full bg-link" />}
        <button type="button" onClick={() => onOpen(item.listing.id)} aria-label={`Open ${item.listing.title}`}>
          <Thumb listing={item.listing} size={44} className="rounded-sm" />
        </button>
      </div>
    </div>
  );
}

/** Friend / search / request row: avatar, name, @username, and an optional action slot. */
export function PersonRow({ person, right }: { person: PersonSummary; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar url={person.avatar_url} name={person.display_name || person.username} size={40} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{person.display_name || person.username}</span>
          <span className="block truncate text-muted-foreground">@{person.username}</span>
        </span>
      </Link>
      {right}
    </div>
  );
}

/** Spec §8: 6 activity skeletons (40 px circle + 2 bars + 44 px square). */
export function ActivitySkeleton() {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-16 items-center gap-3 px-4" aria-hidden>
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="size-11 shrink-0 rounded-sm" />
        </div>
      ))}
    </div>
  );
}
