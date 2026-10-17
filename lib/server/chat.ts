import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ChatMessage as AiMessage, ToolCall, ToolDef } from "@/lib/ai";
import { gradeLabel } from "@/lib/grades";
import { addReminder, MAX_STEPS, replaceChecklist } from "@/lib/server/planning";
import { check, HttpError } from "@/lib/server/route";
import type { ChatMessage, Listing } from "@/lib/types";
import { LISTING_COLUMNS, toListing } from "@/lib/server/rows";

/** Build spec §6.6, verbatim. */
export const SYSTEM_PROMPT =
  'You are the assistant inside "placeholder", an app that helps high school and college students find internships, volunteering, events and scholarships. You are helping the student with one opportunity they saved; its details, their profile, and their other saved opportunities are in CONTEXT. Answer from CONTEXT first. If something isn\'t in CONTEXT (e.g. exact requirements not listed), say so plainly and suggest checking the original listing — never invent requirements, deadlines, or contact details. Be concise and friendly. When the student asks about timing, deadlines, or what to do next, offer to set reminders or a checklist using your tools. Compare with their other saved items only when they ask or when deadlines conflict.';

/** House style on top of the spec prompt: students read this on a phone. */
export const STYLE_PROMPT =
  "Keep every answer short: 1–3 sentences, or up to 4 brief bullets when listing things. Aim for under 60 words. No headings, no preamble, no restating the question, and no closing offers unless they're one short line. Go longer only if the student asks for detail.";

export const TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "create_reminder",
      description:
        "Set a reminder for this opportunity. remind_at is an ISO 8601 date-time in the student's timezone (see CONTEXT), in the future and no later than one day after the deadline. Unless the student names a time, use 9:00 AM local on the chosen day.",
      parameters: {
        type: "object",
        properties: {
          remind_at: { type: "string", description: "ISO 8601, e.g. 2026-10-20T09:00:00" },
          title: { type: "string", description: "Short title, e.g. 'Submit application'" },
          note: { type: "string" },
        },
        required: ["remind_at", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_checklist",
      description: `Replace the checklist for this opportunity with up to ${MAX_STEPS} short steps.`,
      parameters: {
        type: "object",
        properties: { steps: { type: "array", items: { type: "string" }, maxItems: MAX_STEPS } },
        required: ["steps"],
      },
    },
  },
];

export interface ChatContext {
  listing: Listing;
  timezone: string;
  messages: AiMessage[];
}

const HISTORY = 20;
const OTHER_SAVED = 20;

/** Assembles the model input: system prompt, CONTEXT block, and the last 20 messages (§6.6). */
export async function buildContext(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  threadId: string | null,
): Promise<ChatContext> {
  const [listingRes, profileRes, savedRes, historyRes] = await Promise.all([
    supabase.from("listings").select(LISTING_COLUMNS).eq("id", listingId).maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, grade_level, school, interests, skills, bio, timezone")
      .eq("id", userId)
      .single(),
    supabase
      .from("user_listings")
      .select("app_status, listings!inner(id, title, type, deadline)")
      .eq("user_id", userId)
      .eq("state", "saved")
      .neq("listing_id", listingId)
      .limit(OTHER_SAVED),
    threadId
      ? supabase
          .from("chat_messages")
          .select("role, content")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: false })
          .limit(HISTORY)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const row = check(listingRes, "load that listing");
  if (!row) throw new HttpError(404, "Listing not found.");
  const listing = toListing(row as Record<string, unknown>);
  const p = check(profileRes, "load your profile") as {
    display_name: string | null;
    grade_level: number | null;
    school: string | null;
    interests: string[] | null;
    skills: string[] | null;
    bio: string | null;
    timezone: string | null;
  };
  const timezone = validTz(p.timezone) ?? "America/New_York";
  const others = (check(savedRes, "load your saved items") as unknown as {
    app_status: string | null;
    listings: { title: string; type: string; deadline: string | null };
  }[]).map((s) => ({
    title: s.listings.title,
    type: s.listings.type,
    deadline: s.listings.deadline,
    app_status: s.app_status ?? "interested",
  }));

  // Only fields the student filled in. Zip and coordinates are never sent (§12).
  const profile = Object.fromEntries(
    Object.entries({
      name: p.display_name,
      grade: gradeLabel(p.grade_level),
      school: p.school,
      interests: p.interests?.length ? p.interests : null,
      skills: p.skills?.length ? p.skills : null,
      bio: p.bio,
    }).filter(([, v]) => v !== null && v !== ""),
  );

  const context = {
    now: `${new Date().toISOString()} (student's timezone: ${timezone}, local time ${localTime(new Date(), timezone)})`,
    opportunity: {
      title: listing.title,
      organization: listing.org_name,
      type: listing.type,
      description: listing.description,
      eligibility: listing.eligibility_text,
      grades: listing.grade_min || listing.grade_max ? [gradeLabel(listing.grade_min), gradeLabel(listing.grade_max)] : null,
      deadline: listing.deadline,
      starts: listing.starts_at,
      ends: listing.ends_at,
      location: listing.is_remote ? "Remote" : listing.location_text,
      compensation: listing.compensation_text,
      amount_usd: listing.amount_usd,
      url: listing.url,
    },
    student: profile,
    other_saved: others,
  };

  const history = ((check(historyRes, "load the chat") ?? []) as { role: ChatMessage["role"]; content: string }[])
    .reverse()
    .map<AiMessage>((m) =>
      // Stored tool rows are chip text with no tool_call_id; replay them as a note.
      m.role === "tool" ? { role: "assistant", content: `(Done: ${m.content})` } : { role: m.role, content: m.content },
    );

  return {
    listing,
    timezone,
    messages: [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${STYLE_PROMPT}` },
      { role: "system", content: `CONTEXT\n${JSON.stringify(context, null, 1)}` },
      ...history,
    ],
  };
}

const reminderArgs = z.object({
  remind_at: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  note: z.string().max(1000).nullish(),
});
const checklistArgs = z.object({ steps: z.array(z.string().trim().min(1).max(300)).min(1).max(MAX_STEPS) });

export interface ToolOutcome {
  /** Chip text shown in the chat and stored as a role='tool' message; null when it failed. */
  chip: string | null;
  /** What the model is told. */
  result: string;
}

/** Validates and runs one tool call against this listing. Never throws. */
export async function runTool(
  supabase: SupabaseClient,
  userId: string,
  ctx: ChatContext,
  call: ToolCall,
): Promise<ToolOutcome> {
  let args: unknown;
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    return { chip: null, result: "Error: arguments were not valid JSON." };
  }
  try {
    if (call.function.name === "create_reminder") {
      const a = reminderArgs.parse(args);
      const at = parseZoned(a.remind_at, ctx.timezone);
      if (!at) return { chip: null, result: "Error: remind_at is not a valid ISO 8601 date-time." };
      const r = await addReminder(
        supabase,
        userId,
        { listingId: ctx.listing.id, remind_at: at.toISOString(), title: a.title, note: a.note, source: "ai" },
        ctx.listing.deadline,
      );
      return {
        chip: `⏰ Reminder set · ${localTime(new Date(r.remind_at), ctx.timezone)}`,
        result: `Reminder saved for ${localTime(new Date(r.remind_at), ctx.timezone)} (${ctx.timezone}).`,
      };
    }
    if (call.function.name === "create_checklist") {
      const { steps } = checklistArgs.parse(args);
      const items = await replaceChecklist(
        supabase,
        userId,
        ctx.listing.id,
        steps.map((text) => ({ text, done: false })),
      );
      return {
        chip: `✅ Checklist added · ${items.length} ${items.length === 1 ? "step" : "steps"}`,
        result: `Checklist saved with ${items.length} steps.`,
      };
    }
    return { chip: null, result: `Error: unknown tool ${call.function.name}.` };
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : e instanceof z.ZodError ? "invalid arguments" : "it couldn't be saved";
    return { chip: null, result: `Error: ${msg}` };
  }
}

function validTz(tz: string | null): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** "Tue, Oct 20, 9:00 AM" in the given timezone. */
export function localTime(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** ISO 8601; a time without Z/offset is read as wall-clock time in `timeZone`. */
export function parseZoned(iso: string, timeZone: string): Date | null {
  const s = iso.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "9", mi = "0", sec = "0"] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec);
  // The zone's offset at that moment: format the UTC guess in the zone and compare.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const asZone = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess - (asZone - guess));
}
