import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Me } from "@/lib/types";

const DAY = 86_400_000;

/** Builds the /api/me payload: profile, counts, and shell badges. Coordinates are never sent. */
export async function loadMe(supabase: SupabaseClient, user: { id: string; email: string | null }): Promise<Me | null> {
  const [{ data: p }, saved, friends, inbox, notifications] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("user_listings")
      .select("app_status, listings!inner(deadline)")
      .eq("user_id", user.id)
      .eq("state", "saved"),
    supabase
      .from("friendships")
      .select("requester_id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    supabase.from("shares").select("id", { count: "exact", head: true }).eq("to_user", user.id).is("read_at", null),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
  ]);
  if (!p) return null;

  const rows = (saved.data ?? []) as unknown as { app_status: string | null; listings: { deadline: string | null } }[];
  const now = Date.now();
  const dueSoon = rows.filter((r) => {
    const d = r.listings?.deadline ? new Date(r.listings.deadline).getTime() : null;
    return d !== null && d > now && d - now <= 3 * DAY;
  }).length;

  return {
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    email: user.email,
    grade_level: p.grade_level,
    school: p.school,
    zip: p.zip,
    radius_miles: p.radius_miles ?? 25,
    interests: p.interests ?? [],
    skills: p.skills ?? [],
    bio: p.bio,
    share_saves: p.share_saves ?? true,
    theme: p.theme ?? "system",
    timezone: p.timezone,
    onboarded: Boolean(p.onboarded_at),
    counts: {
      saved: rows.length,
      applied: rows.filter((r) => ["applied", "accepted", "rejected"].includes(r.app_status ?? "")).length,
      friends: friends.count ?? 0,
    },
    badges: { dueSoon, unreadInbox: inbox.count ?? 0, unreadNotifications: notifications.count ?? 0 },
  };
}
