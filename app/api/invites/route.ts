import { randomBytes } from "node:crypto";
import { publicOrigin } from "@/lib/public-origin";
import { authed, check, HttpError, route, requireAccount } from "@/lib/server/route";

// No 0/O/1/I/L so codes survive being read aloud or typed.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const newCode = () => Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");

/** POST /api/invites: your invite code (created on first use) and its link. */
export const POST = route(async (req) => {
  const { supabase, user } = await authed();
  requireAccount(user);
  // Not new URL(req.url).origin: behind Render's proxy that is http://localhost:10000.
  const origin = publicOrigin(req);
  const existing = check(await supabase.from("invites").select("code").eq("user_id", user.id).maybeSingle(), "make your invite");
  if (existing) return { code: existing.code, url: `${origin}/invite/${existing.code}` };

  for (let i = 0; i < 3; i++) {
    const code = newCode();
    const { error } = await supabase.from("invites").insert({ code, user_id: user.id });
    if (!error) return { code, url: `${origin}/invite/${code}` };
    if (error.code !== "23505") break;
    // A race with another tab: return the one that won.
    const won = await supabase.from("invites").select("code").eq("user_id", user.id).maybeSingle();
    if (won.data) return { code: won.data.code, url: `${origin}/invite/${won.data.code}` };
  }
  throw new HttpError(500, "Couldn't make your invite. Try again.");
});
