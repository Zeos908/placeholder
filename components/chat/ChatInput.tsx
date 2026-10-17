"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const MAX_LINES = 5;
const LINE = 20;

/**
 * Chat input (spec §12.2): pill textarea that grows to 5 lines, the word "Send" in gradient
 * text once there's something to send. Enter sends on desktop; Shift+Enter is a new line.
 * On touch devices Enter is a new line and you tap Send.
 */
export function ChatInput({
  onSend,
  disabled,
  hint,
  hintTone = "muted",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  hint: string;
  hintTone?: "muted" | "limit";
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_LINES * LINE + 20)}px`;
  }

  function send() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => {
      resize();
      ref.current?.focus();
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (touch) return; // newline on phones
    e.preventDefault();
    send();
  }

  return (
    <div className="shrink-0 border-t border-border bg-background px-3 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))]">
      <p
        aria-live="polite"
        className={cn("px-2 pb-1.5 text-xs", hintTone === "limit" ? "text-foreground" : "text-muted-foreground")}
      >
        {hint}
      </p>
      <div className="flex items-end gap-2 rounded-[22px] bg-surface py-1.5 pr-4 pl-4">
        <textarea
          ref={ref}
          value={value}
          rows={1}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="Ask about this opportunity…"
          aria-label="Message"
          maxLength={2000}
          className="max-h-[120px] min-h-[28px] flex-1 resize-none bg-transparent py-1 text-[15px] leading-5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        {value.trim() && !disabled && (
          <button type="button" onClick={send} className="text-accent-gradient py-1 text-[15px] font-semibold">
            Send
          </button>
        )}
      </div>
    </div>
  );
}
