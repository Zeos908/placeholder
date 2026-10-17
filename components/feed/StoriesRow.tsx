"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState } from "react";
import { SwipeDeck } from "@/components/feed/SwipeDeck";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { qk, staleTimes } from "@/lib/queries";
import type { Story, StoryKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STORY_LABELS: Record<StoryKey, string> = {
  closing: "Closing soon",
  near: "Near you",
  friends: "Friends saved",
};

/**
 * Stories row at the top of the Feed (spec §10). Circles with no items are hidden ("Near you"
 * also needs a zip, which the API handles). Tapping one opens its swipe deck.
 */
export function StoriesRow() {
  const { data, isPending } = useQuery({ queryKey: qk.stories, queryFn: api.stories, staleTime: staleTimes.stories });
  const [open, setOpen] = useState<StoryKey | null>(null);

  if (isPending) return <StoriesSkeleton />;
  const stories = (data ?? []).filter((s) => s.count > 0);
  if (!stories.length) return null;

  return (
    <>
      <nav
        aria-label="Stories"
        className="scrollbar-none flex h-[104px] items-start gap-3 overflow-x-auto overflow-y-hidden border-b border-border px-4 pt-2"
      >
        {stories.map((s) => (
          <StoryCircle key={s.key} story={s} onOpen={() => setOpen(s.key)} />
        ))}
      </nav>
      {open && <SwipeDeck storyKey={open} label={STORY_LABELS[open]} onClose={() => setOpen(null)} />}
    </>
  );
}

export function StoryCircle({ story, onOpen }: { story: Story; onOpen: () => void }) {
  const unseen = story.unseenCount > 0;
  const label = STORY_LABELS[story.key];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}, ${story.count} ${story.count === 1 ? "item" : "items"}${unseen ? `, ${story.unseenCount} new` : ""}`}
      className="flex w-[74px] shrink-0 flex-col items-center gap-1"
    >
      {/* 2.5 px ring (gradient while there's something unviewed), 3 px gap, 64 px circle. */}
      <span
        data-testid={`story-ring-${story.key}`}
        data-unseen={unseen || undefined}
        className={cn("rounded-full p-[2.5px]", unseen ? "bg-accent-gradient" : "bg-border")}
      >
        <span className="block rounded-full bg-background p-[3px]">
          <span className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-surface">
            <StoryInner story={story} />
          </span>
        </span>
      </span>
      <span className="w-full truncate text-center text-xs leading-4">{label}</span>
    </button>
  );
}

function StoryInner({ story }: { story: Story }) {
  if (story.key === "closing") return <span aria-hidden className="text-[28px] leading-none">⏰</span>;
  if (story.key === "near") return <span aria-hidden className="text-[28px] leading-none">📍</span>;
  const avatars = (story.avatars ?? []).slice(0, 2);
  if (!avatars.length) return <Users aria-hidden className="size-7 text-muted-foreground" />;
  return (
    <span aria-hidden className="relative block size-16">
      {avatars.map((url, i) =>
        url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={url}
            alt=""
            referrerPolicy="no-referrer"
            className={cn(
              "absolute size-10 rounded-full border-2 border-surface object-cover",
              avatars.length === 1 ? "inset-0 m-auto size-12" : i === 0 ? "top-1.5 left-1.5" : "right-1.5 bottom-1.5",
            )}
          />
        ) : (
          <span
            key={i}
            className={cn(
              "bg-accent-gradient absolute size-10 rounded-full border-2 border-surface",
              i === 0 ? "top-1.5 left-1.5" : "right-1.5 bottom-1.5",
            )}
          />
        ),
      )}
    </span>
  );
}

/** Spec §8: 4 gray circles + label bars. */
export function StoriesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading stories"
      className="flex h-[104px] gap-3 overflow-hidden border-b border-border px-4 pt-2"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex w-[74px] shrink-0 flex-col items-center gap-1.5" aria-hidden>
          <Skeleton className="size-[75px] rounded-full" />
          <Skeleton className="h-2.5 w-12" />
        </div>
      ))}
    </div>
  );
}
