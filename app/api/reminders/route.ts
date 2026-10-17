import { z } from "zod";
import { addReminder, REMINDER_COLUMNS, visibleListing } from "@/lib/server/planning";
import { authed, body, check, HttpError, route } from "@/lib/server/route";
import type { Reminder } from "@/lib/types";

export const dynamic = "force-dynamic";

const idParam = (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !z.uuid().safeParse(id).success) throw new HttpError(404, "Reminder not found.");
  return id;
};

/** GET /api/reminders?listingId= : upcoming (unsent) reminders, soonest first. */
export const GET = route(async (req) => {
  const { supabase, user } = await authed();
  const listingId = new URL(req.url).searchParams.get("listingId");
  let q = supabase.from("reminders").select(REMINDER_COLUMNS).eq("user_id", user.id).is("sent_at", null);
  if (listingId) {
    if (!z.uuid().safeParse(listingId).success) return [];
    q = q.eq("listing_id", listingId);
  }
  return check(await q.order("remind_at"), "load reminders") as Reminder[];
});

const createSchema = z.object({
  listingId: z.uuid(),
  remind_at: z.string().min(1),
  title: z.string().max(200),
  note: z.string().max(1000).nullish(),
});

/** POST /api/reminders {listingId, remind_at, title, note?}: a manual reminder. */
export const POST = route(async (req) => {
  const { supabase, user } = await authed();
  const b = await body(req, createSchema);
  await visibleListing(supabase, b.listingId);
  const r = await addReminder(supabase, user.id, { ...b, source: "user" });
  return Response.json(r, { status: 201 });
});

const patchSchema = z
  .object({
    remind_at: z.string().min(1).optional(),
    title: z.string().trim().min(1, "Give the reminder a title.").max(200).optional(),
    note: z.string().max(1000).nullish(),
  })
  .refine((b) => Object.keys(b).length > 0, "Nothing to change.");

/** PATCH /api/reminders?id= {remind_at?, title?, note?} */
export const PATCH = route(async (req) => {
  const { supabase, user } = await authed();
  const id = idParam(req);
  const b = await body(req, patchSchema);
  const patch: Record<string, unknown> = {};
  if (b.title !== undefined) patch.title = b.title;
  if (b.note !== undefined) patch.note = b.note?.trim() || null;
  if (b.remind_at !== undefined) {
    const at = new Date(b.remind_at).getTime();
    if (!Number.isFinite(at)) throw new HttpError(400, "That isn't a valid time.");
    if (at <= Date.now()) throw new HttpError(400, "Pick a time in the future.");
    patch.remind_at = new Date(at).toISOString();
    patch.sent_at = null; // moved: fire again at the new time
  }
  const row = check(
    await supabase.from("reminders").update(patch).eq("id", id).eq("user_id", user.id).select(REMINDER_COLUMNS).maybeSingle(),
    "update the reminder",
  );
  if (!row) throw new HttpError(404, "Reminder not found.");
  return row as Reminder;
});

/** DELETE /api/reminders?id= */
export const DELETE = route(async (req) => {
  const { supabase, user } = await authed();
  const id = idParam(req);
  check(await supabase.from("reminders").delete().eq("id", id).eq("user_id", user.id), "delete the reminder");
  return { ok: true };
});
