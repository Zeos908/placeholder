import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { check, HttpError } from "@/lib/server/route";
import type { ChecklistItem, Reminder } from "@/lib/types";

export const REMINDER_COLUMNS = "id, listing_id, remind_at, title, note, source, sent_at";
export const MAX_STEPS = 10;
const DAY = 86_400_000;

/**
 * Inserts a reminder after the same checks for every source: in the future, and (for the AI
 * tool, §6.6) no later than the deadline + 1 day.
 */
export async function addReminder(
  supabase: SupabaseClient,
  userId: string,
  r: { listingId: string; remind_at: string; title: string; note?: string | null; source: "ai" | "user" },
  deadline?: string | null,
): Promise<Reminder> {
  const at = new Date(r.remind_at).getTime();
  if (!Number.isFinite(at)) throw new HttpError(400, "That isn't a valid time.");
  if (at <= Date.now()) throw new HttpError(400, "Pick a time in the future.");
  if (deadline && at > new Date(deadline).getTime() + DAY) {
    throw new HttpError(400, "That's after the deadline.");
  }
  const title = r.title.trim();
  if (!title) throw new HttpError(400, "Give the reminder a title.");
  return check(
    await supabase
      .from("reminders")
      .insert({
        user_id: userId,
        listing_id: r.listingId,
        remind_at: new Date(at).toISOString(),
        title: title.slice(0, 200),
        note: r.note?.trim() ? r.note.trim().slice(0, 1000) : null,
        source: r.source,
      })
      .select(REMINDER_COLUMNS)
      .single(),
    "save the reminder",
  ) as Reminder;
}

export const stepSchema = z.object({
  id: z.string().max(64).optional(),
  text: z.string().trim().min(1, "A step can't be empty.").max(300),
  done: z.boolean().default(false),
});

/** Replaces the listing's checklist (max 10 steps), keeping ids that are already uuids. */
export async function replaceChecklist(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  steps: z.infer<typeof stepSchema>[],
): Promise<ChecklistItem[]> {
  const rows = steps.slice(0, MAX_STEPS).map((s, position) => ({
    ...(s.id && z.uuid().safeParse(s.id).success && { id: s.id }),
    user_id: userId,
    listing_id: listingId,
    text: s.text,
    done: s.done,
    position,
  }));
  check(
    await supabase.from("checklist_items").delete().eq("user_id", userId).eq("listing_id", listingId),
    "save the checklist",
  );
  if (!rows.length) return [];
  return check(
    await supabase.from("checklist_items").insert(rows).select("id, text, done, position").order("position"),
    "save the checklist",
  ) as ChecklistItem[];
}

/** 404 unless the listing exists and is visible to this user (RLS). Returns its deadline. */
export async function visibleListing(supabase: SupabaseClient, listingId: string) {
  if (!z.uuid().safeParse(listingId).success) throw new HttpError(404, "Listing not found.");
  const row = check(
    await supabase.from("listings").select("id, deadline").eq("id", listingId).maybeSingle(),
    "load that listing",
  );
  if (!row) throw new HttpError(404, "Listing not found.");
  return row as { id: string; deadline: string | null };
}
