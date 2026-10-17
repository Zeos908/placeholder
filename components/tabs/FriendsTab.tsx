"use client";

import { Inbox, QrCode, Search, UserPlus, Users } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PostSheet } from "@/components/common/PostSheet";
import { InviteSheet } from "@/components/friends/InviteSheet";
import { ActivityRow, ActivitySkeleton, InboxRow, OverlapCard, PersonRow } from "@/components/friends/rows";
import { useTabActive } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInboxSeen } from "@/lib/badges";
import { interleave, useActivity, useFriendActions, useFriends, useInbox, useUserSearch } from "@/lib/friends";
import { useUi } from "@/lib/store";
import { cn } from "@/lib/utils";

type Segment = "activity" | "inbox" | "friends";
const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "activity", label: "Activity" },
  { value: "inbox", label: "Inbox" },
  { value: "friends", label: "Friends" },
];

/**
 * Friends tab (spec §13): Activity · Inbox · Friends. Opening the tab while shares are unread
 * jumps to Inbox, and they're marked read once on screen, which clears the tab's red dot.
 */
export function FriendsTab() {
  const { active } = useTabActive();
  const [segment, setSegment] = useState<Segment>("activity");
  const [postId, setPostId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const inbox = useInbox();
  const unread = inbox.data?.filter((s) => !s.read_at).length ?? 0;
  const topBarVisible = useUi((s) => s.topBarVisible);

  // Arriving at the tab with new shares → show them (adjusting state during render).
  const [wasActive, setWasActive] = useState(false);
  if (active !== wasActive) {
    setWasActive(active);
    if (active && unread > 0) setSegment("inbox");
  }
  const [inboxShownFor, setInboxShownFor] = useState(false);
  if (active && unread > 0 && !inboxShownFor && inbox.isSuccess) {
    setInboxShownFor(true);
    setSegment("inbox");
  }

  useInboxSeen(inbox.data, active && segment === "inbox");

  return (
    <TabsPrimitive.Root value={segment} onValueChange={(v) => setSegment(v as Segment)}>
      <TabsPrimitive.List
        aria-label="Friends"
        className={cn(
          "sticky z-30 grid grid-cols-3 border-b border-border bg-background transition-[top] duration-200 ease-ig md:top-0",
          topBarVisible ? "top-0" : "-top-14",
        )}
      >
        {SEGMENTS.map((s) => (
          <TabsPrimitive.Trigger
            key={s.value}
            value={s.value}
            className={cn(
              "relative flex h-11 items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground",
              "data-[state=active]:text-foreground",
              "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100",
            )}
          >
            {s.label}
            {s.value === "inbox" && unread > 0 && (
              <span
                aria-label={`${unread} unread`}
                className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white"
              >
                {unread}
              </span>
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      <TabsPrimitive.Content value="activity" forceMount className="data-[state=inactive]:hidden">
        <ActivitySegment onOpen={setPostId} onInvite={() => setInviteOpen(true)} />
      </TabsPrimitive.Content>
      <TabsPrimitive.Content value="inbox" forceMount className="data-[state=inactive]:hidden">
        <InboxSegment onOpen={setPostId} />
      </TabsPrimitive.Content>
      <TabsPrimitive.Content value="friends" forceMount className="data-[state=inactive]:hidden">
        <FriendsSegment onInvite={() => setInviteOpen(true)} />
      </TabsPrimitive.Content>

      <PostSheet listingId={postId} onClose={() => setPostId(null)} />
      <InviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />
    </TabsPrimitive.Root>
  );
}

function ActivitySegment({ onOpen, onInvite }: { onOpen: (id: string) => void; onInvite: () => void }) {
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useActivity();
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const overlaps = data?.pages.flatMap((p) => p.overlaps) ?? [];
  const rows = interleave(items, overlaps);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = end.current;
    if (!el || !hasNextPage || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && !isFetchingNextPage && void fetchNextPage());
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows.length]);

  if (isPending) return <ActivitySkeleton />;
  if (isError) return <ErrorState message="Couldn't load activity." onRetry={() => refetch()} />;
  if (!rows.length)
    return (
      <EmptyState
        icon={Users}
        title="No activity yet"
        body="Add friends to see what they're saving."
        action={
          <Button variant="gradient" onClick={onInvite}>
            Invite friends
          </Button>
        }
      />
    );

  return (
    <ul aria-label="Friend activity" className="py-1">
      {rows.map((r) => (
        <li key={r.kind === "item" ? r.item.id : `overlap-${r.overlap.listing.id}`}>
          {r.kind === "item" ? <ActivityRow item={r.item} onOpen={onOpen} /> : <OverlapCard overlap={r.overlap} onOpen={onOpen} />}
        </li>
      ))}
      <div ref={end} />
      {isFetchingNextPage && <ActivitySkeleton />}
    </ul>
  );
}

function InboxSegment({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, isPending, isError, refetch } = useInbox();
  if (isPending) return <ActivitySkeleton />;
  if (isError) return <ErrorState message="Couldn't load your inbox." onRetry={() => refetch()} />;
  if (!data.length)
    return (
      <EmptyState icon={Inbox} title="No shares yet" body="When friends send you opportunities, they'll show up here." />
    );
  return (
    <ul aria-label="Shares" className="divide-y divide-border">
      {data.map((s) => (
        <li key={s.id}>
          <InboxRow item={s} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

function FriendsSegment({ onInvite }: { onInvite: () => void }) {
  const [q, setQ] = useState("");
  const searching = q.trim().replace(/^@/, "").length >= 2;
  const search = useUserSearch(q);
  const { data, isPending, isError, refetch } = useFriends();
  const actions = useFriendActions();
  const friendIds = new Set(data?.friends.map((f) => f.id));
  const outgoing = new Set(data?.outgoing.map((f) => f.id));

  return (
    <div className="pb-6">
      <div className="px-4 pt-3 pb-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search usernames"
            aria-label="Search usernames"
            autoCapitalize="none"
            spellCheck={false}
            className="h-10 bg-surface pl-9"
          />
        </label>
      </div>

      {searching ? (
        <section aria-label="Search results">
          {search.isPending ? (
            <ActivitySkeleton />
          ) : search.data?.length ? (
            <ul>
              {search.data.map((p) => (
                <li key={p.id}>
                  <PersonRow
                    person={p}
                    right={
                      friendIds.has(p.id) ? (
                        <span className="text-xs text-muted-foreground">Friends</span>
                      ) : outgoing.has(p.id) ? (
                        <span className="text-xs text-muted-foreground">Requested</span>
                      ) : (
                        <Button variant="gradient" size="sm" onClick={() => void actions.request(p.username, p.id)}>
                          Add
                        </Button>
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-muted-foreground">No one with that username.</p>
          )}
        </section>
      ) : (
        <>
          <button
            type="button"
            onClick={onInvite}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface"
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-border">
              <QrCode className="size-5" />
            </span>
            <span className="font-semibold">Invite friends</span>
          </button>

          {isPending ? (
            <ActivitySkeleton />
          ) : isError ? (
            <ErrorState message="Couldn't load your friends." onRetry={() => refetch()} />
          ) : (
            <>
              {data.incoming.length > 0 && (
                <section aria-labelledby="requests-heading" className="pt-3">
                  <h2 id="requests-heading" className="px-4 pb-1 text-base font-semibold">
                    Requests
                  </h2>
                  <ul>
                    {data.incoming.map((p) => (
                      <li key={p.id}>
                        <PersonRow
                          person={p}
                          right={
                            <span className="flex gap-2">
                              <Button variant="gradient" size="sm" onClick={() => void actions.accept(p.username, p.id)}>
                                Accept
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => void actions.decline(p.username, p.id)}>
                                Decline
                              </Button>
                            </span>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {data.friends.length === 0 ? (
                <EmptyState
                  icon={UserPlus}
                  title="No friends yet"
                  action={
                    <Button variant="gradient" onClick={onInvite}>
                      Invite friends
                    </Button>
                  }
                />
              ) : (
                <section aria-labelledby="friends-heading" className="pt-3">
                  <h2 id="friends-heading" className="px-4 pb-1 text-base font-semibold">
                    Friends <span className="font-normal text-muted-foreground">{data.friends.length}</span>
                  </h2>
                  <ul aria-label="Your friends">
                    {data.friends.map((f) => (
                      <li key={f.id}>
                        <PersonRow person={f} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
