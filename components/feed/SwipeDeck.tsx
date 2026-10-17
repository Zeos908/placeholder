"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDrag } from "@use-gesture/react";
import { animate, motion, useMotionValue } from "framer-motion";
import { DollarSign, MapPin, RotateCcw, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { PostMedia } from "@/components/feed/PostMedia";
import { SwipeContext, SwipeLabels, useSwipeRotate } from "@/components/feed/SwipeWrapper";
import { SPRING, useSwipeGesture } from "@/components/feed/useSwipeGesture";
import { TabActiveContext } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { flushSeen, reportSeen, useSwipeActions, type SwipeOutcome } from "@/lib/feed";
import { deadlineInfo } from "@/lib/format";
import { qk } from "@/lib/queries";
import type { FeedPost, StoryKey, SwipeDirection } from "@/lib/types";
import { videoManager } from "@/lib/video-manager";
import { cn } from "@/lib/utils";

const STACK = [
  { scale: 1, y: 0, brightness: 1 },
  { scale: 0.95, y: 10, brightness: 0.8 },
  { scale: 0.9, y: 20, brightness: 0.65 },
];
const FLY_MS = 250;

interface Swiped {
  post: FeedPost;
  direction: SwipeDirection;
  outcome: SwipeOutcome;
}

/**
 * Story swipe deck (spec §10.1): full-screen on phones, a 420 × 760 modal on desktop.
 * Same swipe physics as feed posts; committed cards fly fully off-screen and the next card
 * springs up. A card counts as viewed once it's been on top. Closing refreshes the rings.
 */
export function SwipeDeck({ storyKey, label, onClose }: { storyKey: StoryKey; label: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const actions = useSwipeActions();
  // A fresh, frozen list for each opening: swipes elsewhere shouldn't reshuffle an open deck.
  const [session] = useState(() => Date.now());
  const { data: cards, isPending, isError, refetch } = useQuery({
    queryKey: ["story-deck", storyKey, session],
    queryFn: () => api.storyDeck(storyKey),
    staleTime: Infinity,
    gcTime: 0,
  });
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Swiped[]>([]);
  const [enter, setEnter] = useState<{ id: string; from: SwipeDirection } | null>(null);
  const [flying, setFlying] = useState(false); // a card is mid fly-off
  const topRef = useRef<DeckCardHandle>(null);
  const total = cards?.length ?? 0;
  const top = cards?.[index];

  // Only deck videos may play while it's open.
  useEffect(() => {
    videoManager.setExclusiveGroup("deck");
    return () => videoManager.setExclusiveGroup(null);
  }, []);

  // "Viewed" = shown on top of the deck (spec §10).
  useEffect(() => {
    if (top) reportSeen(top.id);
  }, [top]);

  async function close() {
    // The card on top right now has been viewed, even if its "seen" effect hasn't run yet.
    if (top) reportSeen(top.id);
    onClose();
    await flushSeen();
    await queryClient.invalidateQueries({ queryKey: qk.stories });
  }

  function onCommit(post: FeedPost, direction: SwipeDirection) {
    setFlying(true);
    const outcome = actions.swipe(post, direction, { removeNow: true, showToast: false });
    setHistory((h) => [...h, { post, direction, outcome }]);
  }

  function undo() {
    const last = history.at(-1);
    if (!last || flying) return;
    setHistory((h) => h.slice(0, -1));
    setEnter({ id: last.post.id, from: last.direction });
    setIndex((i) => Math.max(0, i - 1));
    void last.outcome.undo();
  }

  // Swipe down on the header closes the deck.
  const headerDrag = useDrag(
    ({ last, movement: [mx, my] }) => {
      if (last && my > 80 && Math.abs(mx) < my) void close();
    },
    { axis: "y", filterTaps: true },
  );

  const done = !!cards && index >= total;

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && void close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black md:bg-black/75" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-0 z-[70] flex flex-col bg-black text-white outline-none",
            "md:inset-auto md:top-1/2 md:left-1/2 md:h-[760px] md:max-h-[calc(100dvh-32px)] md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-2xl",
          )}
        >
          {/* Header: label, counter, progress; swipe down here to close. */}
          <div {...headerDrag()} className="shrink-0 touch-none px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
            <div className="flex items-center gap-3">
              <DialogPrimitive.Title className="text-base font-semibold">{label}</DialogPrimitive.Title>
              {total > 0 && (
                <span data-testid="deck-counter" className="text-sm text-white/70">
                  {Math.min(index + 1, total)} / {total}
                </span>
              )}
              <DialogPrimitive.Close
                aria-label="Close"
                className="ml-auto flex size-9 items-center justify-center rounded-full hover:bg-white/10"
              >
                <X className="size-6" />
              </DialogPrimitive.Close>
            </div>
            <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="bg-accent-gradient h-full transition-[width] duration-300 ease-ig"
                style={{ width: total ? `${(Math.min(index, total) / total) * 100}%` : 0 }}
              />
            </div>
          </div>

          {/* Card stack */}
          <div className="relative min-h-0 flex-1 px-4">
            {isPending ? (
              <div className="skeleton-shimmer h-full max-h-[600px] rounded-2xl" aria-label="Loading" />
            ) : isError ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="text-white/80">Couldn&apos;t load this story.</p>
                <Button variant="secondary" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            ) : done ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
                <p className="text-xl font-semibold">That&apos;s everything in {label} ✨</p>
                <Button variant="gradient" className="h-11 px-6" onClick={() => void close()}>
                  Back to feed
                </Button>
              </div>
            ) : (
              cards!
                .slice(index, index + 3)
                .map((post, depth) => ({ post, depth }))
                .reverse() // top card last so it paints on top
                .map(({ post, depth }) => (
                  <DeckCard
                    key={post.id}
                    ref={depth === 0 ? topRef : undefined}
                    post={post}
                    depth={depth}
                    enterFrom={enter?.id === post.id ? enter.from : undefined}
                    onCommit={(dir) => onCommit(post, dir)}
                    onGone={() => {
                      setEnter(null);
                      setFlying(false);
                      setIndex((i) => i + 1);
                    }}
                  />
                ))
            )}
          </div>

          {/* Buttons */}
          <div className="flex shrink-0 items-center justify-center gap-6 pt-4 pb-[max(20px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              aria-label="Undo"
              onClick={undo}
              disabled={!history.length || flying}
              className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition disabled:opacity-30"
            >
              <RotateCcw className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Pass"
              onClick={() => topRef.current?.fling("left")}
              disabled={!top || done}
              className="flex size-[60px] items-center justify-center rounded-full bg-white shadow-lg transition active:scale-95 disabled:opacity-30"
            >
              <X className="size-7 text-danger" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Save"
              onClick={() => topRef.current?.fling("right")}
              disabled={!top || done}
              className="flex size-[60px] items-center justify-center rounded-full bg-white shadow-lg transition active:scale-95 disabled:opacity-30"
            >
              <GradientBookmark />
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface DeckCardHandle {
  fling: (direction: SwipeDirection) => void;
}

const DeckCard = forwardRef<
  DeckCardHandle,
  {
    post: FeedPost;
    depth: number;
    enterFrom?: SwipeDirection;
    onCommit: (direction: SwipeDirection) => void;
    onGone: () => void;
  }
>(function DeckCard({ post, depth, enterFrom, onCommit, onGone }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const widthRef = useRef(360);
  const flying = useRef(false);
  const width = () => widthRef.current;
  const rotate = useSwipeRotate(x, width);
  const isTop = depth === 0;

  // An undone card comes back in from the side it left.
  useEffect(() => {
    if (!enterFrom) return;
    x.set((enterFrom === "right" ? 1 : -1) * window.innerWidth);
    animate(x, 0, SPRING);
  }, [enterFrom, x]);

  async function fling(direction: SwipeDirection) {
    if (flying.current || !isTop) return;
    flying.current = true;
    onCommit(direction);
    const sign = direction === "right" ? 1 : -1;
    await animate(x, sign * (window.innerWidth + widthRef.current), { duration: FLY_MS / 1000, ease: [0.2, 0, 0, 1] });
    onGone();
  }

  useImperativeHandle(ref, () => ({ fling }));

  const gesture = useSwipeGesture({
    x,
    width: () => (widthRef.current = el.current?.offsetWidth ?? widthRef.current),
    disabled: () => !isTop || flying.current,
    onCommit: (dir) => void fling(dir),
  });

  const due = deadlineInfo(post.deadline);
  const s = STACK[depth] ?? STACK[2];

  return (
    <SwipeContext.Provider value={{ x, width, dragged: gesture.dragged }}>
      <motion.div
        ref={el}
        data-testid={isTop ? "deck-top" : undefined}
        data-title={post.title}
        aria-hidden={!isTop}
        initial={false}
        animate={{ scale: s.scale, y: s.y, filter: `brightness(${s.brightness})` }}
        transition={SPRING}
        style={{ x: isTop ? x : 0, rotate: isTop ? rotate : 0 }}
        className="absolute inset-x-4 top-0 mx-auto max-w-[400px] origin-top will-change-transform select-none"
      >
        <div
          {...(isTop ? gesture.bind() : {})}
          style={{ touchAction: "pan-y" }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 text-white"
        >
          <div className="relative">
            <TabActiveContext.Provider value={{ tab: null, active: isTop }}>
              <PostMedia listing={post} group="deck" index={depth} compact />
            </TabActiveContext.Provider>
            {isTop && <SwipeLabels />}
          </div>
          <div className="space-y-1 px-4 pt-3 pb-4">
            <p className="line-clamp-2 text-lg leading-6 font-semibold">{post.title}</p>
            <p className="truncate text-sm text-white/70">{post.org_name}</p>
            <p className="flex items-center gap-1 text-xs text-white/70">
              <span className={cn("font-semibold", due.urgent ? "text-danger" : "text-white")}>{due.label}</span>
              <span aria-hidden>·</span>
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{post.is_remote ? "Remote" : (post.location_text ?? "—")}</span>
              {post.compensation_text && (
                <>
                  <span aria-hidden>·</span>
                  <DollarSign className="size-3.5 shrink-0" />
                  <span className="truncate">{post.compensation_text}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </motion.div>
    </SwipeContext.Provider>
  );
});

function GradientBookmark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
      <defs>
        <linearGradient id="deck-save-gradient" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#F58529" />
          <stop offset="0.5" stopColor="#DD2A7B" />
          <stop offset="1" stopColor="#8134AF" />
        </linearGradient>
      </defs>
      <path
        d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
        fill="none"
        stroke="url(#deck-save-gradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

