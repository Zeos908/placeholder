import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendPush } from "@/lib/server/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 200;

function authorized(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * GET/POST /api/cron/reminders (build spec §10), every 5 minutes: due reminders whose item is
 * still saved become a bell notification + web push. Each reminder is claimed (sent_at set)
 * before sending, so overlapping runs never double-send.
 */
async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: claimed, error } = await admin
    .from("reminders")
    .update({ sent_at: now })
    .lte("remind_at", now)
    .is("sent_at", null)
    .select("id, user_id, listing_id, title, listings(title)")
    .limit(BATCH);
  if (error) {
    console.error("[cron/reminders] claim failed:", error.message);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }
  const due = (claimed ?? []) as unknown as {
    id: string;
    user_id: string;
    listing_id: string;
    title: string;
    listings: { title: string } | null;
  }[];
  if (!due.length) return NextResponse.json({ sent: 0, skipped: 0, pushed: 0 });

  // Only items that are still saved (§10).
  const { data: savedRows } = await admin
    .from("user_listings")
    .select("user_id, listing_id")
    .eq("state", "saved")
    .in("listing_id", [...new Set(due.map((r) => r.listing_id))])
    .in("user_id", [...new Set(due.map((r) => r.user_id))]);
  const saved = new Set((savedRows ?? []).map((r) => `${r.user_id}:${r.listing_id}`));
  const live = due.filter((r) => saved.has(`${r.user_id}:${r.listing_id}`));

  if (live.length) {
    const { error: insertError } = await admin.from("notifications").insert(
      live.map((r) => ({ user_id: r.user_id, kind: "reminder", payload: { listing_id: r.listing_id, title: r.title } })),
    );
    if (insertError) console.error("[cron/reminders] notifications insert failed:", insertError.message);
  }
  const pushed = (
    await Promise.all(
      live.map((r) =>
        sendPush(r.user_id, {
          title: r.title,
          body: r.listings?.title && !r.title.includes(r.listings.title) ? r.listings.title : "Tap to open it in placeholder.",
          url: `/saved/${r.listing_id}`,
        }).catch(() => 0),
      ),
    )
  ).reduce((a, b) => a + b, 0);

  return NextResponse.json({ sent: live.length, skipped: due.length - live.length, pushed });
}

export const GET = run;
export const POST = run;
