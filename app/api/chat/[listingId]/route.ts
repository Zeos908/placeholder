import { z } from "zod";
import { AiBusyError, chatStream, type ChatMessage as AiMessage, type StreamEvent } from "@/lib/ai";
import { env } from "@/lib/env";
import { buildContext, runTool, TOOLS } from "@/lib/server/chat";
import { visibleListing } from "@/lib/server/planning";
import { authed, body, check, HttpError, route } from "@/lib/server/route";
import type { ChatHistory, ChatMessage, ChatStreamEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUSY = "The assistant is busy right now — try again in a minute.";
const MESSAGE_COLUMNS = "id, role, content, created_at";

/** GET /api/chat/[listingId]: stored history + today's remaining questions. */
export const GET = route<{ listingId: string }>(async (_req, { params }) => {
  const { supabase, user } = await authed();
  const { listingId } = await params;
  await visibleListing(supabase, listingId);
  const limit = env().CHAT_DAILY_LIMIT;
  const [thread, used] = await Promise.all([
    supabase.from("chat_threads").select("id").eq("user_id", user.id).eq("listing_id", listingId).maybeSingle(),
    supabase.rpc("chat_used_today"),
  ]);
  const t = check(thread, "load the chat");
  const messages = t
    ? (check(
        await supabase.from("chat_messages").select(MESSAGE_COLUMNS).eq("thread_id", t.id).order("created_at"),
        "load the chat",
      ) as ChatMessage[])
    : [];
  const history: ChatHistory = { messages, remaining: Math.max(0, limit - (check(used, "load the chat") ?? 0)), limit };
  return history;
});

const schema = z.object({ content: z.string().trim().min(1, "Type a question first.").max(2000, "That's a bit long.") });

/**
 * POST /api/chat/[listingId] {content} → SSE (build spec §6.6). Counts against the daily cap,
 * refunded if the model is busy or fails before answering. Tool calls run once, then the model
 * gets one more round (without tools) to say what it did.
 */
export const POST = route<{ listingId: string }>(async (req, { params }) => {
  const { supabase, user } = await authed();
  const { listingId } = await params;
  const { content } = await body(req, schema);
  await visibleListing(supabase, listingId);

  const limit = env().CHAT_DAILY_LIMIT;
  const remaining = check(await supabase.rpc("consume_chat_message", { p_limit: limit }), "send that") as number;
  if (remaining < 0) {
    throw new HttpError(429, `You've used today's ${limit} questions. They reset at midnight.`, "limit");
  }

  let userMessageId: string | null = null;
  const undo = async () => {
    await supabase.rpc("refund_chat_message");
    if (userMessageId) await supabase.from("chat_messages").delete().eq("id", userMessageId);
  };

  let ctx, threadId: string;
  let first: IteratorResult<StreamEvent>;
  let stream: AsyncGenerator<StreamEvent>;
  try {
    const thread = check(
      await supabase
        .from("chat_threads")
        .upsert({ user_id: user.id, listing_id: listingId }, { onConflict: "user_id,listing_id" })
        .select("id")
        .single(),
      "start the chat",
    ) as { id: string };
    threadId = thread.id;
    ctx = await buildContext(supabase, user.id, listingId, threadId);
    const saved = check(
      await supabase.from("chat_messages").insert({ thread_id: threadId, role: "user", content }).select("id").single(),
      "send that",
    ) as { id: string };
    userMessageId = saved.id;

    ctx.messages.push({ role: "user", content });
    stream = chatStream(ctx.messages, { tools: TOOLS, reasoning: false, maxTokens: 500, signal: req.signal });
    // Wait for the first event so "busy" can still be a plain 429 the client understands.
    first = await stream.next();
  } catch (e) {
    await undo();
    if (e instanceof AiBusyError) throw new HttpError(429, BUSY, "busy");
    if (e instanceof HttpError) throw e;
    console.error("[chat] model call failed:", e);
    throw new HttpError(502, "The assistant couldn't answer. Try again.");
  }

  const encoder = new TextEncoder();
  const body$ = new ReadableStream({
    async start(ctrl) {
      const send = (e: ChatStreamEvent) => ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      const store = async (role: ChatMessage["role"], text: string) =>
        check(
          await supabase.from("chat_messages").insert({ thread_id: threadId, role, content: text }).select(MESSAGE_COLUMNS).single(),
          "save the chat",
        ) as ChatMessage;

      let text = "";
      let answered = false;
      try {
        const consume = async (events: AsyncGenerator<StreamEvent>, head?: IteratorResult<StreamEvent>) => {
          const calls: Extract<StreamEvent, { type: "tool_calls" }>["calls"] = [];
          let roundText = "";
          for (let r = head ?? (await events.next()); !r.done; r = await events.next()) {
            const ev = r.value;
            if (ev.type === "token") {
              roundText += ev.text;
              text += ev.text;
              send({ type: "token", text: ev.text });
            } else if (ev.type === "tool_calls") calls.push(...ev.calls);
          }
          return { calls, roundText };
        };

        const round1 = await consume(stream, first);
        if (round1.calls.length) {
          const followUp: AiMessage[] = [
            ...ctx.messages,
            { role: "assistant", content: round1.roundText || null, tool_calls: round1.calls },
          ];
          for (const call of round1.calls.slice(0, 3)) {
            const out = await runTool(supabase, user.id, ctx, call);
            if (out.chip) send({ type: "tool", message: await store("tool", out.chip) });
            followUp.push({ role: "tool", tool_call_id: call.id, content: out.result });
          }
          if (text && !/\s$/.test(text)) {
            text += "\n\n";
            send({ type: "token", text: "\n\n" });
          }
          await consume(chatStream(followUp, { reasoning: false, maxTokens: 250, signal: req.signal }));
        }

        const answer = text.trim() || "Sorry, I couldn't come up with an answer. Try asking another way.";
        const message = await store("assistant", answer);
        answered = true;
        send({ type: "done", message, remaining });
      } catch (e) {
        if (!answered) {
          if (text.trim()) {
            // Keep what was already shown so history matches the screen.
            const message = await store("assistant", text.trim()).catch(() => null);
            if (message) send({ type: "done", message, remaining });
          } else {
            await undo();
            const busy = e instanceof AiBusyError;
            if (!busy) console.error("[chat] stream failed:", e);
            send({ type: "error", code: busy ? "busy" : "failed", message: busy ? BUSY : "The assistant couldn't answer. Try again." });
          }
        }
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(body$, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
});
