import { authed, check, route } from "@/lib/server/route";
import type { PersonSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/friends/search?q= : username prefix (min 2 chars, 20 results, never blocked users or you). */
export const GET = route(async (req) => {
  const { supabase, user } = await authed();
  // Usernames are [a-z0-9_.]; dropping everything else also keeps LIKE wildcards out.
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_.]/g, "");
  if (q.length < 2) return [];
  const rows = check(
    await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url")
      .ilike("username", `${q.replace(/_/g, "\\_")}%`)
      .neq("id", user.id)
      .order("username")
      .limit(20),
    "search",
  );
  return rows as PersonSummary[];
});
