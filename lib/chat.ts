"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { ChatHistory, ChatMessage } from "@/lib/types";

/** A message as shown: stored ones plus local-only states (sending, failed, busy notices). */
export interface UiMessage extends ChatMessage {
  /** failed = couldn't send (tap to retry); notice = the "busy"/limit line, shown muted. */
  status?: "sending" | "failed" | "notice";
}

export interface ChatState {
  messages: UiMessage[];
  /** The answer being streamed: null while thinking (before the first token). */
  streaming: { text: string | null } | null;
  remaining: number | null;
  limit: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  send: (content: string) => void;
  retry: (id: string) => void;
}

const BUSY = "The assistant is busy right now — try again in a minute.";
const LIMIT = (limit: number) => `You've used today's ${limit} questions. They reset at midnight.`;
const now = () => new Date().toISOString();
const localId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Saved-item chat (spec §12.2, §19): loads history, streams answers (reasoning is never sent),
 * appends finished exchanges to ['chat', listingId], and keeps failed sends and busy notices
 * locally so they don't pollute the stored history.
 */
export function useChat(listingId: string, opts: { onTool?: () => void } = {}): ChatState {
  const queryClient = useQueryClient();
  const history = useQuery({ queryKey: qk.chat(listingId), queryFn: () => api.chatHistory(listingId) });
  const [local, setLocal] = useState<UiMessage[]>([]);
  const [streaming, setStreaming] = useState<ChatState["streaming"]>(null);
  const busy = useRef(false);

  const limit = history.data?.limit ?? 30;
  const remaining = history.data?.remaining ?? null;

  function setHistory(fn: (h: ChatHistory) => ChatHistory) {
    queryClient.setQueryData<ChatHistory>(qk.chat(listingId), (h) => (h ? fn(h) : h));
  }

  async function run(content: string, existingId?: string) {
    if (busy.current) return;
    busy.current = true;
    const user: UiMessage = { id: existingId ?? localId("user"), role: "user", content, created_at: now(), status: "sending" };
    setLocal((l) => [...l.filter((m) => m.id !== user.id), user]);
    setStreaming({ text: null });

    const tools: ChatMessage[] = [];
    let text = "";
    try {
      for await (const e of api.chatSend(listingId, content)) {
        if (e.type === "token") {
          text += e.text;
          setStreaming({ text });
        } else if (e.type === "tool") {
          tools.push(e.message);
          setLocal((l) => [...l, e.message]);
          opts.onTool?.();
          void queryClient.invalidateQueries({ queryKey: qk.listing(listingId) });
        } else if (e.type === "done") {
          // The exchange is stored server-side; move it from local state into the history cache.
          setHistory((h) => ({
            ...h,
            remaining: e.remaining,
            messages: [...h.messages, { ...user, status: undefined }, ...tools, e.message],
          }));
          setLocal((l) => l.filter((m) => m.id !== user.id && !tools.some((t) => t.id === m.id)));
        } else if (e.type === "error") {
          if (e.code === "limit") {
            setHistory((h) => ({ ...h, remaining: 0 }));
            setLocal((l) => [
              ...l.filter((m) => m.id !== user.id),
              { id: localId("notice"), role: "assistant", content: LIMIT(limit), created_at: now(), status: "notice" },
            ]);
          } else if (e.code === "busy") {
            setLocal((l) => [
              ...l.map((m) => (m.id === user.id ? { ...m, status: "failed" as const } : m)),
              { id: localId("notice"), role: "assistant", content: BUSY, created_at: now(), status: "notice" },
            ]);
          } else {
            setLocal((l) => l.map((m) => (m.id === user.id ? { ...m, status: "failed" as const } : m)));
          }
        }
      }
    } catch {
      setLocal((l) => l.map((m) => (m.id === user.id ? { ...m, status: "failed" as const } : m)));
    } finally {
      setStreaming(null);
      busy.current = false;
    }
  }

  return {
    messages: [...(history.data?.messages ?? []), ...local],
    streaming,
    remaining,
    limit,
    isLoading: history.isPending,
    isError: history.isError,
    refetch: () => void history.refetch(),
    send: (content) => {
      const text = content.trim();
      if (text) void run(text);
    },
    retry: (id) => {
      const m = local.find((x) => x.id === id && x.status === "failed");
      if (!m) return;
      // Drop the busy notice that came with it, then send the same text again.
      setLocal((l) => l.filter((x) => x.status !== "notice"));
      void run(m.content, m.id);
    },
  };
}
