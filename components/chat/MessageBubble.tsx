"use client";

import { AlertCircle, Sparkles } from "lucide-react";
import { Markdown } from "@/components/chat/Markdown";
import type { UiMessage } from "@/lib/chat";
import { cn } from "@/lib/utils";

/** White sparkles on the accent gradient: the assistant's avatar. */
export function AssistantAvatar({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="bg-accent-gradient flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ width: size, height: size }}
    >
      <Sparkles style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}

/**
 * DM-style bubble (spec §12.2): yours on the right in the accent gradient, the assistant's on
 * the left on --surface. 22 px radius, with a 4 px corner on the last bubble of a group; the
 * assistant's avatar shows only next to its last bubble in a group.
 */
export function MessageBubble({
  message,
  lastInGroup,
  onRetry,
}: {
  message: UiMessage;
  lastInGroup: boolean;
  onRetry?: () => void;
}) {
  const mine = message.role === "user";
  const failed = message.status === "failed";
  const notice = message.status === "notice";

  if (mine) {
    return (
      <div className="flex flex-col items-end">
        <div className="flex max-w-[75%] items-end gap-1.5">
          {failed && <AlertCircle aria-hidden className="mb-2 size-5 shrink-0 text-danger" />}
          <div
            className={cn(
              "bg-accent-gradient rounded-[22px] px-3.5 py-2 text-[15px] leading-5 whitespace-pre-wrap text-white [overflow-wrap:anywhere]",
              lastInGroup && "rounded-br-[4px]",
              message.status === "sending" && "opacity-80",
            )}
          >
            {message.content}
          </div>
        </div>
        {failed && (
          <button type="button" onClick={onRetry} className="mt-1 text-xs font-semibold text-danger">
            Not sent. Tap to retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <span className="w-6 shrink-0">{lastInGroup && <AssistantAvatar />}</span>
      <div
        className={cn(
          "max-w-[75%] rounded-[22px] bg-surface px-3.5 py-2 text-[15px] leading-5 [overflow-wrap:anywhere]",
          lastInGroup && "rounded-bl-[4px]",
          notice && "text-muted-foreground",
        )}
      >
        {notice ? message.content : <Markdown>{message.content}</Markdown>}
      </div>
    </div>
  );
}

/** Shown until the first answer token arrives (reasoning is never displayed). */
export function ThinkingBubble() {
  return (
    <div role="status" aria-label="Thinking" className="flex items-end gap-2">
      <AssistantAvatar />
      <div className="flex items-center gap-2 rounded-[22px] rounded-bl-[4px] bg-surface px-3.5 py-2.5">
        <span className="flex gap-1" aria-hidden>
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span className="text-[13px] text-muted-foreground">Thinking…</span>
      </div>
    </div>
  );
}

/** Centered confirmation pill for tool results, e.g. "⏰ Reminder set · Tue, Oct 20, 9:00 AM". */
export function ToolChip({ text, onClick }: { text: string; onClick?: () => void }) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium hover:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_8%)]"
      >
        {text}
      </button>
    </div>
  );
}
