"use client";

import { format } from "date-fns";
import { Bookmark, DollarSign, Link2, MapPin, MoreHorizontal, Send, Flag, X, Share } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { ReportDialog } from "@/components/common/ReportDialog";
import { ShareSheet } from "@/components/common/ShareSheet";
import { OrgAvatar, TypeBadge } from "@/components/common/TypeBadge";
import { DoubleTapSave } from "@/components/feed/DoubleTapSave";
import { PostMedia } from "@/components/feed/PostMedia";
import { SwipeLabels, SwipeWrapper, type SwipeHandle } from "@/components/feed/SwipeWrapper";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { reportSeen, useSwipeActions } from "@/lib/feed";
import { deadlineInfo, gradeRangeLabel } from "@/lib/format";
import { getListingMedia } from "@/lib/media";
import { useUi } from "@/lib/store";
import { onSwipeUndone } from "@/lib/swipe-events";
import type { FeedPost } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEEN_AFTER_MS = 2000;

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    toast("Couldn't copy the link.");
  }
}

function money(post: FeedPost) {
  if (post.compensation_text) return post.compensation_text;
  if (post.amount_usd) return `$${post.amount_usd.toLocaleString()}`;
  return null;
}

/**
 * Feed post (spec §9.1–9.2). Swipe right/left (or bookmark / "…" → Pass) commits with a fly-off;
 * double-tapping the media saves in place. `onExit` runs after the fly-off + collapse.
 */
export function PostCard({ post, index, onExit }: { post: FeedPost; index: number; onExit?: (id: string) => void }) {
  const actions = useSwipeActions();
  const swipeRef = useRef<SwipeHandle>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [savedNow, setSavedNow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const toggleMuted = () => {
    const ui = useUi.getState();
    ui.setVideoMuted(!ui.videoMuted);
  };

  const saved = post.saved || savedNow;
  const due = deadlineInfo(post.deadline);
  const isVideo = getListingMedia(post).kind === "video";
  const compensation = money(post);

  // An Undo that lands while this card is still on screen also un-fills its bookmark.
  useEffect(() => onSwipeUndone(post.id, () => setSavedNow(false)), [post.id]);

  // Seen ≥ 2 s without a swipe → reported (affects ranking only, the post stays put).
  useEffect(() => {
    const el = articleRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) timer ??= setTimeout(() => reportSeen(post.id), SEEN_AFTER_MS);
        else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [post.id]);

  function onBookmark() {
    if (saved) {
      setSavedNow(false);
      void actions.unsaveInPlace(post);
      return;
    }
    setSavedNow(true);
    swipeRef.current?.fling("right");
  }

  function onDoubleTap() {
    if (saved) return; // animation only
    // The cache marks it saved (so Undo un-fills the bookmark); the card stays in place.
    void actions.swipe(post, "right", { keepInFeed: true });
  }

  const people = post.friends_saved.people;
  const others = post.friends_saved.count - 1;

  return (
    <SwipeWrapper
      ref={swipeRef}
      id={post.id}
      onCommit={(dir) => void actions.swipe(post, dir)}
      onExited={() => (onExit ?? actions.removeFromFeed)(post.id)}
    >
      <article
        ref={articleRef}
        aria-label={post.title}
        data-post-id={post.id}
        className="bg-background pb-4 md:border-b md:border-border"
      >
        {/* 1. header */}
        <header className="flex h-14 items-center gap-2.5 px-3">
          <OrgAvatar name={post.org_name} logoUrl={post.org_logo_url} type={post.type} />
          <span className="min-w-0 truncate font-semibold">{post.org_name}</span>
          <TypeBadge type={post.type} />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More options"
              className="-mr-1 ml-auto flex size-9 items-center justify-center rounded-full hover:bg-surface"
            >
              <MoreHorizontal className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => swipeRef.current?.fling("left")}>
                <X /> Pass
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                <Share /> Share
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyLink(`${location.origin}/l/${post.id}`)}>
                <Link2 /> Copy link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setReportOpen(true)}>
                <Flag /> Report listing
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* 2. media */}
        <div className="relative">
          <DoubleTapSave
            label={`${post.title}, double-tap to save`}
            onDoubleTap={onDoubleTap}
            onSingleTap={isVideo ? toggleMuted : undefined}
          >
            <PostMedia listing={post} index={index} />
          </DoubleTapSave>
          <SwipeLabels />
        </div>

        {/* 3. actions */}
        <div className="flex h-12 items-center gap-1 px-1.5">
          <button
            type="button"
            onClick={onBookmark}
            aria-label={saved ? "Saved" : "Save"}
            aria-pressed={saved}
            className="flex size-10 items-center justify-center rounded-full transition-transform active:scale-90"
          >
            <Bookmark className="size-6" strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Share"
            className="flex size-10 items-center justify-center rounded-full transition-transform active:scale-90"
          >
            <Send className="size-6" strokeWidth={1.75} />
          </button>
          <span className={cn("ml-auto pr-1.5 text-[13px] font-semibold", due.urgent && "text-danger")}>
            {due.label}
          </span>
        </div>

        {/* 4. caption */}
        <div className="px-3">
          <p className={cn(!expanded && "line-clamp-2")}>
            <span className="font-semibold">{post.title}</span> {post.summary}
          </p>
          {expanded ? (
            <div className="mt-2 space-y-2">
              {post.description && <p className="whitespace-pre-line">{post.description}</p>}
              {post.eligibility_text && (
                <p>
                  <span className="font-semibold">Who can apply:</span> {post.eligibility_text}
                  {gradeRangeLabel(post.grade_min, post.grade_max) && ` (${gradeRangeLabel(post.grade_min, post.grade_max)})`}
                </p>
              )}
              {(post.starts_at || post.deadline) && (
                <p>
                  <span className="font-semibold">Dates:</span>{" "}
                  {post.starts_at && `Starts ${format(new Date(post.starts_at), "MMM d, yyyy")}. `}
                  {post.deadline && `Apply by ${format(new Date(post.deadline), "MMM d, yyyy")}.`}
                </p>
              )}
              {compensation && (
                <p>
                  <span className="font-semibold">Pay / award:</span> {compensation}
                </p>
              )}
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-link">
                Open original listing
              </a>
            </div>
          ) : (
            <button type="button" onClick={() => setExpanded(true)} className="text-muted-foreground">
              more
            </button>
          )}
        </div>

        {/* 5. meta */}
        <p className="mt-1.5 flex items-center gap-1 px-3 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{post.is_remote ? "Remote" : (post.location_text ?? "Location not listed")}</span>
          {compensation && (
            <>
              <span aria-hidden>·</span>
              <DollarSign className="size-3.5 shrink-0" />
              <span className="truncate">{compensation}</span>
            </>
          )}
        </p>

        {/* 6. friends */}
        {post.friends_saved.count > 0 && people[0] && (
          <button
            type="button"
            onClick={() => setFriendsOpen(true)}
            className="mt-2 flex items-center gap-2 px-3 text-left text-[13px]"
          >
            <span className="flex -space-x-1.5">
              {people.slice(0, 3).map((p) => (
                <Avatar key={p.id} url={p.avatar_url} name={p.display_name || p.username} size={20} className="ring-2 ring-background" />
              ))}
            </span>
            <span>
              Saved by <span className="font-semibold">{people[0].username}</span>
              {others > 0 && ` and ${others} ${others === 1 ? "other" : "others"}`}
            </span>
          </button>
        )}
      </article>

      <ShareSheet listing={post} open={shareOpen} onOpenChange={setShareOpen} />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="listing"
        targetId={post.id}
        targetName={post.title}
      />
      <Sheet open={friendsOpen} onOpenChange={setFriendsOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-[470px] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Saved by friends</SheetTitle>
          </SheetHeader>
          <ul className="space-y-1 px-4 pb-6">
            {people.map((p) => (
              <li key={p.id}>
                <Link href={`/u/${p.username}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface">
                  <Avatar url={p.avatar_url} name={p.display_name || p.username} size={40} />
                  <span>
                    <span className="block font-semibold">{p.username}</span>
                    {p.display_name && <span className="block text-muted-foreground">{p.display_name}</span>}
                  </span>
                </Link>
              </li>
            ))}
            {post.friends_saved.count > people.length && (
              <li className="px-2 pt-2 text-muted-foreground">
                and {post.friends_saved.count - people.length} more
              </li>
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </SwipeWrapper>
  );
}
