"use client";

import { differenceInCalendarDays, differenceInMinutes, format, isToday } from "date-fns";
import { ArrowDown } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { AssistantAvatar, MessageBubble, ThinkingBubble, ToolChip } from "@/components/chat/MessageBubble";
import { ErrorState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useChat, type UiMessage } from "@/lib/chat";
import { cn } from "@/lib/utils";

const GROUP_MINUTES = 2;
const TIMESTAMP_GAP_MINUTES = 15;
const NEAR_BOTTOM = 48;

type Side = "user" | "ai" | "tool";
const sideOf = (m: UiMessage): Side => (m.role === "user" ? "user" : m.role === "tool" ? "tool" : "ai");

interface Row {
  message: UiMessage;
  side: Side;
  /** Centered timestamp before this message (15+ minute gap, or the first message). */
  timestamp: string | null;
  /** Same side within 2 minutes as the previous message: 4 px gap instead of 16 px. */
  grouped: boolean;
  lastInGroup: boolean;
}

function stamp(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `Today ${format(d, "h:mm a")}`;
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEE h:mm a");
  return format(d, "MMM d, h:mm a");
}

/** Grouping and timestamps (spec §12.2). */
function layout(messages: UiMessage[]): Row[] {
  const rows: Row[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const gap = prev ? differenceInMinutes(new Date(m.created_at), new Date(prev.created_at)) : Infinity;
    const timestamp = gap >= TIMESTAMP_GAP_MINUTES ? stamp(m.created_at) : null;
    const side = sideOf(m);
    const grouped = !!prev && !timestamp && side !== "tool" && sideOf(prev) === side && gap < GROUP_MINUTES;
    rows.push({ message: m, side, timestamp, grouped, lastInGroup: true });
    if (grouped) rows[rows.length - 2].lastInGroup = false;
  });
  return rows;
}

/**
 * Chat tab (spec §12.2): Instagram-DM layout, streaming answers with a Thinking bubble until the
 * first token, tool confirmation chips, daily question count, follow-the-bottom auto-scroll with
 * a "New message" pill when you've scrolled up.
 */
export function ChatPanel({
  listingId,
  title,
  active,
  onShowReminders,
}: {
  listingId: string;
  title: string;
  /** False while the Details tab is showing (the panel stays mounted). */
  active: boolean;
  onShowReminders: () => void;
}) {
  const chat = useChat(listingId);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const savedTop = useRef<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const rows = layout(chat.messages);
  const contentKey = `${chat.messages.length}:${chat.streaming ? (chat.streaming.text?.length ?? -1) : "idle"}`;

  function toBottom(smooth = false) {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
  }

  // Follow new content while at the bottom; otherwise offer the pill.
  useLayoutEffect(() => {
    if (!active) return;
    if (atBottom.current) toBottom();
    // Re-check when it runs: you may have tapped the pill (or scrolled down) in between.
    else requestAnimationFrame(() => !atBottom.current && setShowNew(true));
  }, [contentKey, active]);

  // Coming back to the tab: restore where you were (or stay pinned to the bottom).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!active || !el) return;
    if (atBottom.current || savedTop.current === null) toBottom();
    else el.scrollTop = savedTop.current;
  }, [active]);

  // Keyboard opening/closing on phones resizes the panel; keep the latest message visible.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => atBottom.current && toBottom();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  function onScroll() {
    const el = scroller.current;
    if (!el || !active) return;
    savedTop.current = el.scrollTop;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    if (atBottom.current && showNew) setShowNew(false);
  }

  function send(text: string) {
    atBottom.current = true; // always follow your own message
    setShowNew(false);
    chat.send(text);
  }

  const remaining = chat.remaining;
  const outOfQuestions = remaining === 0;
  const hint =
    remaining === null
      ? " "
      : outOfQuestions
        ? `You've used today's ${chat.limit} questions. They reset at midnight.`
        : `${remaining} ${remaining === 1 ? "question" : "questions"} left today`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          data-testid="chat-scroller"
          className="h-full overflow-y-auto overscroll-contain px-3 py-4"
          aria-live="polite"
          aria-busy={!!chat.streaming}
        >
          {chat.isLoading ? (
            <HistorySkeleton />
          ) : chat.isError ? (
            <ErrorState message="Couldn't load this chat." onRetry={chat.refetch} />
          ) : rows.length === 0 && !chat.streaming ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <AssistantAvatar size={48} />
              <p className="text-muted-foreground">
                Ask anything about <span className="italic">{title}</span>
              </p>
            </div>
          ) : (
            <>
              {rows.map((r, i) => (
                <Fragment key={r.message.id}>
                  {r.timestamp && (
                    <p className={cn("text-center text-xs text-muted-foreground", i > 0 ? "mt-5 mb-3" : "mb-3")}>
                      {r.timestamp}
                    </p>
                  )}
                  <div className={cn(i > 0 && !r.timestamp && (r.grouped ? "mt-1" : "mt-4"))}>
                    {r.side === "tool" ? (
                      <ToolChip text={r.message.content} onClick={onShowReminders} />
                    ) : (
                      <MessageBubble
                        message={r.message}
                        lastInGroup={r.lastInGroup}
                        onRetry={() => chat.retry(r.message.id)}
                      />
                    )}
                  </div>
                </Fragment>
              ))}
              {chat.streaming && (
                <div className="mt-4">
                  {chat.streaming.text === null ? (
                    <ThinkingBubble />
                  ) : (
                    <MessageBubble
                      message={{ id: "streaming", role: "assistant", content: chat.streaming.text, created_at: "" }}
                      lastInGroup
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {showNew && (
          <button
            type="button"
            onClick={() => {
              toBottom(true);
              setShowNew(false);
            }}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-sheet"
          >
            <ArrowDown className="size-3.5" /> New message
          </button>
        )}
      </div>

      <ChatInput
        onSend={send}
        disabled={outOfQuestions || chat.isLoading}
        hint={hint}
        hintTone={outOfQuestions ? "limit" : "muted"}
      />
    </div>
  );
}

/** Spec §8: 3 alternating bubble shapes. */
function HistorySkeleton() {
  return (
    <div role="status" aria-label="Loading chat" className="space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-1/2 rounded-[22px]" />
      </div>
      <div className="flex items-end gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-16 w-2/3 rounded-[22px]" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-2/5 rounded-[22px]" />
      </div>
    </div>
  );
}
