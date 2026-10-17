"use client";

import { BookmarkMinus, EyeOff, Eye, Flag, MoreHorizontal, Share } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { useParams, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useKeyboardViewport } from "@/lib/use-visual-viewport";
import { ErrorState } from "@/components/common/EmptyState";
import { ReportDialog } from "@/components/common/ReportDialog";
import { ShareSheet } from "@/components/common/ShareSheet";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { ItemDetails } from "@/components/saved/ItemDetails";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHideFromFriends, useListing, useUnsave } from "@/lib/saved";
import { cn } from "@/lib/utils";

type TabValue = "details" | "chat";

/**
 * Saved item page (spec §12): page header with "…", then Details | Chat tabs. Both tabs stay
 * mounted and scroll on their own, so switching is instant and keeps each one's position.
 */
export function SavedItemView() {
  const { listingId } = useParams<{ listingId: string }>();
  const router = useRouter();
  const { data, isPending, isError, refetch } = useListing(listingId);
  const [tab, setTab] = useState<TabValue>("details");
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const hide = useHideFromFriends();
  const unsave = useUnsave();
  const keyboard = useKeyboardViewport();
  const details = useRef<HTMLDivElement>(null);
  const detailsTop = useRef(0);

  const saved = data?.state === "saved";

  const jumpToReminders = useRef(false);

  // A hidden tab loses its scroll position; put Details back where it was, or jump to
  // Reminders when we got here from a "Reminder set" chip.
  useLayoutEffect(() => {
    if (tab !== "details" || !details.current) return;
    if (jumpToReminders.current) {
      jumpToReminders.current = false;
      document.getElementById("reminders")?.scrollIntoView({ block: "start" });
    } else {
      details.current.scrollTop = detailsTop.current;
    }
  }, [tab]);

  // Tapping a "Reminder set" chip in the chat switches to Details at the Reminders section.
  function showReminders() {
    jumpToReminders.current = true;
    setTab("details");
  }

  const menu = data && (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More options"
        className="flex size-10 items-center justify-center rounded-full hover:bg-surface"
      >
        <MoreHorizontal className="size-6" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => setShareOpen(true)}>
          <Share /> Share
        </DropdownMenuItem>
        {saved && (
          <DropdownMenuItem
            onSelect={() => hide.mutate({ listingId, hidden: !data.hidden_from_friends })}
          >
            {data.hidden_from_friends ? <Eye /> : <EyeOff />}
            {data.hidden_from_friends ? "Show to friends" : "Hide from friends"}
          </DropdownMenuItem>
        )}
        {saved && (
          <DropdownMenuItem
            onSelect={() => {
              void unsave(data);
              router.push("/saved");
            }}
          >
            <BookmarkMinus /> Unsave
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setReportOpen(true)}>
          <Flag /> Report listing
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className="mx-auto flex h-dvh max-w-[935px] flex-col"
      // With the phone keyboard open, pin the page to the visible area so the chat input sits
      // right above the keyboard (spec §12.2).
      style={keyboard ? { position: "fixed", insetInline: 0, top: keyboard.offsetTop, height: keyboard.height } : undefined}
    >
      <PageHeader title={data?.listing.title ?? "Saved"} fallbackHref="/saved" right={menu} />

      {isPending ? (
        <PostSkeleton />
      ) : isError || !data ? (
        <ErrorState message="This item isn't available." onRetry={() => refetch()} />
      ) : (
        <TabsPrimitive.Root
          value={tab}
          onValueChange={(v) => setTab(v as TabValue)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsPrimitive.List aria-label="Saved item" className="grid shrink-0 grid-cols-2 border-b border-border">
            {(["details", "chat"] as const).map((v) => (
              <TabsPrimitive.Trigger
                key={v}
                value={v}
                className={cn(
                  "relative h-11 text-sm font-semibold text-muted-foreground transition-colors",
                  "data-[state=active]:text-foreground",
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100",
                )}
              >
                {v === "details" ? "Details" : "Chat"}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>

          <TabsPrimitive.Content
            ref={details}
            value="details"
            forceMount
            onScroll={(e) => (detailsTop.current = e.currentTarget.scrollTop)}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain data-[state=inactive]:hidden"
          >
            <ItemDetails detail={data} />
          </TabsPrimitive.Content>
          <TabsPrimitive.Content
            value="chat"
            forceMount
            className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <ChatPanel
              listingId={listingId}
              title={data.listing.title}
              active={tab === "chat"}
              onShowReminders={showReminders}
            />
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      )}

      {data && (
        <ShareSheet listing={data.listing} open={shareOpen} onOpenChange={setShareOpen} />
      )}
      {data && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="listing"
          targetId={listingId}
          targetName={data.listing.title}
        />
      )}
    </div>
  );
}
