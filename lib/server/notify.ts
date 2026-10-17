import "server-only";
import webpush from "web-push";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationKind } from "@/lib/types";

export interface NotificationPayload {
  actor_id?: string | null;
  listing_id?: string | null;
  /** Reminders carry their own title; other kinds get one from the kind (see TITLES). */
  title?: string;
}

/** What the bell shows after the actor's name (or alone, for reminders). */
export const TITLES: Record<NotificationKind, string> = {
  reminder: "Reminder",
  friend_request: "sent you a friend request",
  friend_accepted: "accepted your friend request",
  share: "sent you a post",
};

export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

/**
 * Inserts a notification (service role: users can't write them, §5) and, when VAPID keys are
 * set, pushes it to the recipient's devices. Best-effort: a failure here never fails the action.
 */
export async function notify(userId: string, kind: NotificationKind, payload: NotificationPayload, push?: PushMessage) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert({ user_id: userId, kind, payload });
    if (error) console.error("[notify] insert failed:", error.message);
    if (push) await sendPush(userId, push);
  } catch (e) {
    console.error("[notify] failed:", e);
  }
}

let vapidReady: boolean | undefined;
function vapid() {
  if (vapidReady !== undefined) return vapidReady;
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT } = env();
  vapidReady = Boolean(pub && priv);
  if (vapidReady) webpush.setVapidDetails(VAPID_SUBJECT, pub!, priv!);
  return vapidReady;
}

/**
 * Sends a push to every subscription the user has; drops subscriptions the push service says
 * are gone (404/410), §10. Returns how many were delivered.
 */
export async function sendPush(userId: string, msg: PushMessage): Promise<number> {
  if (!vapid()) return 0;
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(msg),
          { TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("[push] send failed:", status ?? e);
      }
    }),
  );
  return sent;
}

/** "@maya" or the display name, for push text. */
export async function displayNameOf(userId: string): Promise<string> {
  const { data } = await createAdminClient().from("profiles").select("username, display_name").eq("id", userId).maybeSingle();
  return data?.display_name || (data?.username ? `@${data.username}` : "Someone");
}
