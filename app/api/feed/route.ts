import { toFeedPost, type FeedRow } from "@/lib/server/feed-rows";
import { authed, check, HttpError, route } from "@/lib/server/route";
import type { FeedPage } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE = 15;

type Cursor = { score: number; id: string; asof: string };
const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decode(s: string | null): Cursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, "base64url").toString());
    if (typeof c.score === "number" && typeof c.id === "string" && typeof c.asof === "string") return c;
  } catch {
    // fall through
  }
  throw new HttpError(400, "Bad cursor.");
}

/** GET /api/feed?cursor= (build spec §7–8): ranked, keyset-paginated posts. */
export const GET = route(async (req) => {
  const { supabase, user } = await authed();
  const cursor = decode(new URL(req.url).searchParams.get("cursor"));
  const rows = check(
    await supabase.rpc("get_feed", { p_user: user.id, p_limit: PAGE, p_cursor: cursor }),
    "load your feed",
  ) as (FeedRow & { score: number; asof: string })[];

  const last = rows.at(-1);
  const page: FeedPage = {
    posts: rows.map(toFeedPost),
    nextCursor: rows.length === PAGE && last ? encode({ score: last.score, id: last.id, asof: last.asof }) : null,
  };
  return page;
});
