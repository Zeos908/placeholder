import { z } from "zod";
import { authed, body, check, route } from "@/lib/server/route";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  endpoint: z.url().refine((u) => u.startsWith("https://"), "Push endpoints are https."),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/**
 * POST /api/push/subscribe (PushSubscription JSON). Upserted by endpoint with the service role,
 * so a browser that switched accounts moves its subscription to the signed-in user.
 */
export const POST = route(async (req) => {
  const { user } = await authed();
  const { endpoint, keys } = await body(req, schema);
  check(
    await createAdminClient()
      .from("push_subscriptions")
      .upsert({ user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" }),
    "turn on notifications",
  );
  return { ok: true };
});

/** DELETE /api/push/subscribe?endpoint= : this device (or, without endpoint, all of yours). */
export const DELETE = route(async (req) => {
  const { supabase, user } = await authed();
  const endpoint = new URL(req.url).searchParams.get("endpoint");
  let q = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (endpoint) q = q.eq("endpoint", endpoint);
  check(await q, "turn off notifications");
  return { ok: true };
});
