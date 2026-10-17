/**
 * AI client for NVIDIA NIM (build.nvidia.com), which is OpenAI-compatible: chat (streaming +
 * non-streaming), JSON helpers, and the startup model check.
 *
 * Switched from OpenRouter to NIM on 2026-10-16 at the user's request; same model
 * (NIM id `nvidia/nemotron-3-ultra-550b-a55b`, without OpenRouter's `:free` suffix).
 * JSON output (enrichment, §6.2) is requested in the prompt and validated with zod via
 * `chatJson`, which works whether or not the endpoint honors `response_format`.
 *
 * Images (§6.3): not generated yet. NIM serves image models on separate per-model endpoints;
 * picking one is Phase 6. Until IMAGE_MODEL is set, posts use the gradient placeholder (§9.4).
 */
import "server-only";
import type { z } from "zod";
import { env, requireEnv } from "@/lib/env";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDef[];
  /**
   * Nemotron 3 "thinks" before answering, and the thinking counts against max_tokens. Pass false
   * to skip it (NIM `chat_template_kwargs.enable_thinking`) for fast, structured answers.
   */
  reasoning?: boolean;
  signal?: AbortSignal;
}

/**
 * Thrown when the provider is overloaded (429 rate limit, 503, or 504 gateway timeout) so callers
 * can back off (jobs) or show "The assistant is busy right now" (chat), §6.1.
 */
export class AiBusyError extends Error {
  constructor(
    public status: number,
    public retryAfterSeconds?: number,
  ) {
    super(`AI provider busy (HTTP ${status})`);
  }
}

export class AiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`AI provider ${status}: ${body.slice(0, 300)}`);
  }
}

const BUSY_STATUSES = new Set([429, 503, 504]);

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(`${env().NIM_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("NVIDIA_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (BUSY_STATUSES.has(res.status)) {
    const ra = Number(res.headers.get("retry-after"));
    throw new AiBusyError(res.status, Number.isFinite(ra) && ra > 0 ? ra : undefined);
  }
  if (!res.ok) throw new AiError(res.status, await res.text());
  return res;
}

function chatBody(messages: ChatMessage[], opts: ChatOptions, stream: boolean) {
  return {
    model: opts.model ?? env().CHAT_MODEL,
    messages,
    stream,
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(opts.maxTokens !== undefined && { max_tokens: opts.maxTokens }),
    ...(opts.tools?.length && { tools: opts.tools, tool_choice: "auto" }),
    ...(opts.reasoning === false && { chat_template_kwargs: { enable_thinking: false } }),
  };
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
}

/** Non-streaming chat completion. */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  const res = await post("/chat/completions", chatBody(messages, opts, false), opts.signal);
  const data = await res.json();
  const msg = data?.choices?.[0]?.message ?? {};
  return { content: msg.content ?? "", toolCalls: msg.tool_calls ?? [] };
}

export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "tool_calls"; calls: ToolCall[] }
  | { type: "done" };

/**
 * Streaming chat completion. Yields text tokens as they arrive; tool-call deltas are
 * accumulated and yielded once at the end of the stream. Reasoning deltas are not yielded.
 */
export async function* chatStream(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): AsyncGenerator<StreamEvent> {
  const res = await post("/chat/completions", chatBody(messages, opts, true), opts.signal);
  if (!res.body) throw new AiError(500, "empty stream body");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const calls = new Map<number, ToolCall>();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;

      let chunk;
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
      if (chunk.error) throw new AiError(chunk.error.code ?? 500, chunk.error.message ?? "");

      const delta = chunk.choices?.[0]?.delta ?? {};
      if (delta.content) yield { type: "token", text: delta.content };
      for (const tc of delta.tool_calls ?? []) {
        const existing = calls.get(tc.index) ?? {
          id: "",
          type: "function" as const,
          function: { name: "", arguments: "" },
        };
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.function.name += tc.function.name;
        if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
        calls.set(tc.index, existing);
      }
    }
  }

  if (calls.size) yield { type: "tool_calls", calls: [...calls.values()] };
  yield { type: "done" };
}

/** Pulls the first JSON object out of model text (handles ```json fences and stray prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * JSON-mode helper: asks for JSON in the prompt, validates with zod, and retries once with the
 * validation error if the output doesn't fit. Reasoning is off by default: with it on, the
 * thinking can use up max_tokens and leave the answer empty (seen on NIM, 2026-10-16).
 */
export async function chatJson<T>(
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  opts: ChatOptions = {},
): Promise<T> {
  opts = { reasoning: false, ...opts };
  const first = await chat(messages, { temperature: 0.2, ...opts });
  const parsed = safeParse(first.content, schema);
  if (parsed.ok) return parsed.value;

  const retry = await chat(
    [
      ...messages,
      { role: "assistant", content: first.content },
      {
        role: "user",
        content: `That output was invalid: ${parsed.error}. Reply with only the corrected JSON object.`,
      },
    ],
    { temperature: 0, ...opts },
  );
  const second = safeParse(retry.content, schema);
  if (second.ok) return second.value;
  throw new Error(`Model returned invalid JSON twice: ${second.error}`);
}

function safeParse<T>(
  text: string,
  schema: z.ZodType<T>,
): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const result = schema.safeParse(extractJson(text));
    return result.success
      ? { ok: true, value: result.data }
      : { ok: false, error: result.error.message.slice(0, 500) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface ModelCheck {
  chatModel: { id: string; found: boolean };
  imageModel: { id: string; configured: boolean };
}

/** Startup check (§3): confirms the configured chat model is still listed on NIM. */
export async function checkModels(): Promise<ModelCheck> {
  const { NIM_BASE_URL, CHAT_MODEL, IMAGE_MODEL } = env();
  const res = await fetch(`${NIM_BASE_URL}/models`);
  if (!res.ok) throw new AiError(res.status, await res.text());
  const ids = new Set<string>(((await res.json()).data ?? []).map((m: { id: string }) => m.id));

  const result: ModelCheck = {
    chatModel: { id: CHAT_MODEL, found: ids.has(CHAT_MODEL) },
    imageModel: { id: IMAGE_MODEL, configured: IMAGE_MODEL !== "" },
  };

  if (result.chatModel.found) console.log(`[ai] CHAT_MODEL found on NIM: ${CHAT_MODEL}`);
  else console.error(`[ai] CHAT_MODEL "${CHAT_MODEL}" is NOT available on NVIDIA NIM.`);
  if (!IMAGE_MODEL) console.warn("[ai] IMAGE_MODEL is empty; listing images will use the placeholder.");
  return result;
}
