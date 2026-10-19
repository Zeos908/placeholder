/**
 * F8: the F2–F7 checks against the real back end. Drives a running real-mode dev server
 * (E2E_BASE_URL, default http://localhost:3000) as two throwaway users created with the service
 * role and deleted afterwards. Run with: npm run test:e2e
 *
 * Covers: auth gate, feed paging, swipe/undo (state, tag weights, auto reminders), saved/passed,
 * listing detail, reminders, checklist, chat on NIM (stream, tool, history, daily cap), invite →
 * request → accept, activity privacy, profiles, share → inbox + notification, Realtime,
 * search/block, report, push subscribe, and the reminders cron.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  ActivityPage,
  AppNotification,
  ChatHistory,
  ChatStreamEvent,
  FeedPage,
  FriendsData,
  InboxItem,
  ListingDetail,
  Me,
  PassedItem,
  PublicProfile,
  Reminder,
  SavedItem,
  SwipeResult,
} from "@/lib/types";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const run = Math.random().toString(36).slice(2, 8);
const password = `E2e-${crypto.randomUUID()}`;

interface User {
  id: string;
  username: string;
  cookie: string;
  client: SupabaseClient;
  call: <T = unknown>(path: string, init?: RequestInit & { json?: unknown }) => Promise<{ status: number; body: T }>;
}

async function makeUser(label: string): Promise<User> {
  const email = `e2e-${label}-${run}@example.test`;
  const username = `e2e_${label}_${run}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw error;
  await admin.from("profiles").update({ username, onboarded_at: new Date().toISOString(), timezone: "America/New_York" }).eq("id", data.user.id);

  // Sign in the way the app does (@supabase/ssr) so the cookies are in the exact format it reads.
  const jar = new Map<string, string>();
  const ssr = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error: signInError } = await ssr.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password });

  const call: User["call"] = async (path, init = {}) => {
    const { json, ...rest } = init;
    const res = await fetch(`${BASE}${path}`, {
      ...rest,
      redirect: "manual",
      headers: { cookie, ...(json !== undefined && { "content-type": "application/json" }), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // SSE / HTML
    }
    return { status: res.status, body: body as never };
  };
  return { id: data.user.id, username, cookie, client, call };
}

async function weights(userId: string) {
  const { data } = await admin.from("user_tag_weights").select("tag, weight").eq("user_id", userId);
  // A weight of 0 ranks the same as no row (undo may leave zeros behind for new tags).
  return Object.fromEntries((data ?? []).filter((w) => Number(w.weight) !== 0).map((w) => [w.tag, Number(w.weight)]));
}

function parseSse(text: string): ChatStreamEvent[] {
  return text
    .split("\n\n")
    .map((c) => c.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join(""))
    .filter(Boolean)
    .map((d) => JSON.parse(d));
}

let a: User, b: User;
let feed: FeedPage;
let savedId: string; // A saves this one
let passedId: string;

beforeAll(async () => {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`No dev server at ${BASE}. Start it in real mode (npm run dev).`);
  [a, b] = await Promise.all([makeUser("a"), makeUser("b")]);
  await admin.from("user_tag_weights").insert([
    { user_id: a.id, tag: "stem", weight: 1 },
    { user_id: a.id, tag: "arts", weight: 1 },
  ]);
});

afterAll(async () => {
  await Promise.all([a, b].filter(Boolean).map((u) => admin.auth.admin.deleteUser(u.id)));
});

describe("auth gate", () => {
  it("API routes 401 without a session", async () => {
    const res = await fetch(`${BASE}/api/feed`);
    expect(res.status).toBe(401);
  });
  it("/api/me returns the signed-in user", async () => {
    const { status, body } = await a.call<Me>("/api/me");
    expect(status).toBe(200);
    expect(body.username).toBe(a.username);
    expect(body.counts).toEqual({ saved: 0, applied: 0, friends: 0 });
  });
});

describe("feed + swipe (F2/F3)", () => {
  it("returns a ranked page with a cursor, and the next page doesn't repeat", async () => {
    const first = await a.call<FeedPage>("/api/feed");
    expect(first.status).toBe(200);
    feed = first.body;
    expect(feed.posts.length).toBeGreaterThan(5);
    expect(feed.posts[0]).toHaveProperty("friends_saved");
    if (feed.nextCursor) {
      const next = await a.call<FeedPage>(`/api/feed?cursor=${feed.nextCursor}`);
      expect(next.status).toBe(200);
      const ids = new Set(feed.posts.map((p) => p.id));
      expect(next.body.posts.some((p) => ids.has(p.id))).toBe(false);
    }
    expect((await a.call("/api/feed?cursor=garbage")).status).toBe(400);
  });

  it("swipe right saves, learns weights and adds auto reminders; undo restores all of it", async () => {
    const post = feed.posts.find((p) => p.deadline && new Date(p.deadline).getTime() > Date.now() + 8 * 86_400_000) ?? feed.posts[0];
    savedId = post.id;
    const before = await weights(a.id);

    const swipe = await a.call<SwipeResult>("/api/swipe", { method: "POST", json: { listingId: post.id, direction: "right" } });
    expect(swipe.status).toBe(200);
    expect(swipe.body.state).toBe("saved");
    const saved = await a.call<SavedItem[]>("/api/saved");
    expect(saved.body.map((s) => s.listing.id)).toContain(post.id);
    const after = await weights(a.id);
    for (const t of post.tags) expect(after[t]).toBeCloseTo(Math.min(3, (before[t] ?? 0) + 0.5));
    const auto = await a.call<Reminder[]>(`/api/reminders?listingId=${post.id}`);
    if (post.deadline) expect(auto.body.filter((r) => r.source === "auto").length).toBeGreaterThan(0);

    const undo = await a.call("/api/swipe/undo", { method: "POST", json: { undoToken: swipe.body.undoToken } });
    expect(undo.status).toBe(200);
    expect((await a.call<SavedItem[]>("/api/saved")).body.map((s) => s.listing.id)).not.toContain(post.id);
    expect(await weights(a.id)).toEqual(before);
    expect((await a.call<Reminder[]>(`/api/reminders?listingId=${post.id}`)).body).toHaveLength(0);

    // A token can't be replayed by someone else.
    expect((await b.call("/api/swipe/undo", { method: "POST", json: { undoToken: swipe.body.undoToken } })).status).toBe(400);

    // Save it for real for the rest of the suite.
    expect((await a.call("/api/swipe", { method: "POST", json: { listingId: post.id, direction: "right" } })).status).toBe(200);
  });

  it("swipe left goes to Passed; restore puts it back in the feed pool", async () => {
    passedId = feed.posts.find((p) => p.id !== savedId)!.id;
    expect((await a.call("/api/swipe", { method: "POST", json: { listingId: passedId, direction: "left" } })).status).toBe(200);
    const passed = await a.call<PassedItem[]>("/api/passed");
    expect(passed.body.map((p) => p.listing.id)).toContain(passedId);
    expect((await a.call(`/api/passed/${passedId}/restore`, { method: "POST" })).status).toBe(200);
    expect((await a.call<PassedItem[]>("/api/passed")).body.map((p) => p.listing.id)).not.toContain(passedId);
    expect((await a.call(`/api/passed/${passedId}/restore`, { method: "POST" })).status).toBe(404);
  });

  it("stories and the right panel load", async () => {
    expect((await a.call("/api/stories")).status).toBe(200);
    expect((await a.call("/api/stories/closing")).status).toBe(200);
    expect((await a.call("/api/right-panel")).status).toBe(200);
  });
});

describe("saved + detail (F4)", () => {
  it("status and hide-from-friends persist; detail shows them", async () => {
    const patch = await a.call<SavedItem>(`/api/saved/${savedId}`, { method: "PATCH", json: { app_status: "applying" } });
    expect(patch.status).toBe(200);
    expect(patch.body.app_status).toBe("applying");
    const detail = await a.call<ListingDetail>(`/api/listings/${savedId}`);
    expect(detail.body.state).toBe("saved");
    expect(detail.body.app_status).toBe("applying");
    expect((await a.call(`/api/saved/${passedId}`, { method: "PATCH", json: { app_status: "applied" } })).status).toBe(404);
    expect((await a.call(`/api/listings/00000000-0000-4000-8000-000000000000`)).status).toBe(404);
  });

  it("unsave moves it to Passed and is undoable", async () => {
    const r = await a.call<SwipeResult>(`/api/saved/${savedId}/unsave`, { method: "POST" });
    expect(r.body.state).toBe("passed");
    expect((await a.call<PassedItem[]>("/api/passed")).body.map((p) => p.listing.id)).toContain(savedId);
    await a.call("/api/swipe/undo", { method: "POST", json: { undoToken: r.body.undoToken } });
    const detail = await a.call<ListingDetail>(`/api/listings/${savedId}`);
    expect(detail.body.state).toBe("saved");
    expect(detail.body.app_status).toBe("applying");
  });

  it("manual reminders: create, reject the past, edit, delete", async () => {
    const at = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const created = await a.call<Reminder>("/api/reminders", { method: "POST", json: { listingId: savedId, remind_at: at, title: "Write essay" } });
    expect(created.status).toBe(201);
    expect(created.body.source).toBe("user");
    const past = await a.call("/api/reminders", { method: "POST", json: { listingId: savedId, remind_at: new Date(Date.now() - 60_000).toISOString(), title: "x" } });
    expect(past.status).toBe(400);
    const edited = await a.call<Reminder>(`/api/reminders?id=${created.body.id}`, { method: "PATCH", json: { title: "Finish essay" } });
    expect(edited.body.title).toBe("Finish essay");
    expect((await b.call(`/api/reminders?id=${created.body.id}`, { method: "PATCH", json: { title: "hijack" } })).status).toBe(404);
    expect((await a.call(`/api/reminders?id=${created.body.id}`, { method: "DELETE" })).status).toBe(200);
  });

  it("checklist: replace, toggle, keep order", async () => {
    const put = await a.call<{ id: string; text: string; done: boolean }[]>(`/api/checklist/${savedId}`, {
      method: "PATCH",
      json: { items: [{ text: "Resume" }, { text: "Essay" }, { text: "Submit" }] },
    });
    expect(put.body.map((i) => i.text)).toEqual(["Resume", "Essay", "Submit"]);
    const toggled = await a.call<{ id: string; done: boolean }[]>(`/api/checklist/${savedId}`, {
      method: "PATCH",
      json: { items: put.body.map((i, n) => ({ ...i, done: n === 0 })) },
    });
    expect(toggled.body[0].id).toBe(put.body[0].id);
    expect(toggled.body.map((i) => i.done)).toEqual([true, false, false]);
    expect((await a.call<unknown[]>(`/api/checklist/${savedId}`)).body).toHaveLength(3);
  });
});

describe("chat on NIM (F5)", () => {
  it("streams an answer from the listing, can set a reminder, and history survives", async () => {
    const before = await a.call<ChatHistory>(`/api/chat/${savedId}`);
    expect(before.body.remaining).toBe(before.body.limit);

    const res = await a.call<string>(`/api/chat/${savedId}`, {
      method: "POST",
      json: { content: "When is this due and can you remind me two days before?" },
    });
    if (res.status === 429) {
      console.warn("[e2e] NIM busy; chat answer not checked:", res.body);
      return;
    }
    expect(res.status).toBe(200);
    const events = parseSse(res.body);
    const done = events.find((e) => e.type === "done");
    expect(done, JSON.stringify(events.filter((e) => e.type !== "token"))).toBeTruthy();
    expect(events.some((e) => e.type === "token")).toBe(true);
    if (done?.type === "done") {
      expect(done.remaining).toBe(before.body.limit - 1);
      expect(done.message.content.length).toBeGreaterThan(10);
    }
    const tool = events.find((e) => e.type === "tool");
    const reminders = await a.call<Reminder[]>(`/api/reminders?listingId=${savedId}`);
    console.log(
      `[e2e] chat: ${done?.type === "done" ? done.message.content.split(/\s+/).length : 0} words, tool=${tool?.type === "tool" ? tool.message.content : "none"}, ai reminders=${reminders.body.filter((r) => r.source === "ai").length}`,
    );
    if (tool) expect(reminders.body.some((r) => r.source === "ai")).toBe(true);

    const after = await a.call<ChatHistory>(`/api/chat/${savedId}`);
    expect(after.body.messages.map((m) => m.role)).toEqual(tool ? ["user", "tool", "assistant"] : ["user", "assistant"]);
    expect(after.body.remaining).toBe(before.body.limit - 1);
  });

  it("refuses the 31st question of the day politely", async () => {
    const { data: usage } = await admin.from("ai_usage").select("day").eq("user_id", a.id).maybeSingle();
    const day = usage?.day ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    await admin.from("ai_usage").upsert({ user_id: a.id, day, messages: 30 });
    const res = await a.call<{ error: string; code: string }>(`/api/chat/${savedId}`, { method: "POST", json: { content: "one more?" } });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("limit");
    expect(res.body.error).toMatch(/30 questions/);
    expect((await a.call<ChatHistory>(`/api/chat/${savedId}`)).body.remaining).toBe(0);
  });
});

describe("friends (F6)", () => {
  it("invite link → request → accept, with notifications both ways", async () => {
    const inv = await a.call<{ code: string; url: string }>("/api/invites", { method: "POST" });
    expect(inv.body.url).toContain(`/invite/${inv.body.code}`);
    expect((await a.call<{ code: string }>("/api/invites", { method: "POST" })).body.code).toBe(inv.body.code);
    // Behind a proxy (Render) the link must use the public host, not the internal localhost one.
    const proxied = await a.call<{ url: string }>("/api/invites", {
      method: "POST",
      headers: { "x-forwarded-host": "placeholder-e2e.onrender.com", "x-forwarded-proto": "https" },
    });
    expect(proxied.body.url).toBe(`https://placeholder-e2e.onrender.com/invite/${inv.body.code}`);

    const page = await b.call<string>(`/invite/${inv.body.code}`);
    expect(page.status).toBe(200);
    expect(page.body).toContain("Friend request sent");

    const aFriends = await a.call<FriendsData>("/api/friends");
    expect(aFriends.body.incoming.map((p) => p.id)).toContain(b.id);
    const aNotes = await a.call<AppNotification[]>("/api/notifications");
    expect(aNotes.body.find((n) => n.kind === "friend_request")?.actor?.id).toBe(b.id);

    expect((await a.call("/api/friends/respond", { method: "POST", json: { userId: b.id, accept: true } })).status).toBe(200);
    expect((await b.call<FriendsData>("/api/friends")).body.friends.map((f) => f.id)).toContain(a.id);
    expect((await b.call<AppNotification[]>("/api/notifications")).body.some((n) => n.kind === "friend_accepted")).toBe(true);
    // The request notification is cleared once handled.
    expect((await a.call<AppNotification[]>("/api/notifications")).body.some((n) => n.kind === "friend_request")).toBe(false);
  });

  it("A's save shows in B's Activity unless hidden or sharing is off", async () => {
    const has = async () => (await b.call<ActivityPage>("/api/activity")).body.items.some((i) => i.listing.id === savedId && i.actor.id === a.id);
    expect(await has()).toBe(true);
    await a.call(`/api/saved/${savedId}`, { method: "PATCH", json: { hidden_from_friends: true } });
    expect(await has()).toBe(false);
    await a.call(`/api/saved/${savedId}`, { method: "PATCH", json: { hidden_from_friends: false } });
    expect(await has()).toBe(true);
    await a.call("/api/me", { method: "PATCH", json: { share_saves: false } });
    expect(await has()).toBe(false);
    await a.call("/api/me", { method: "PATCH", json: { share_saves: true } });
    expect(await has()).toBe(true);
  });

  it("profiles: friends see saves; you see your own", async () => {
    const theirs = await b.call<PublicProfile>(`/api/users/${a.username}`);
    expect(theirs.body.relationship).toBe("friend");
    expect(theirs.body.saves.map((s) => s.id)).toContain(savedId);
    const mine = await a.call<PublicProfile>(`/api/users/${a.username}`);
    expect(mine.body.relationship).toBe("self");
    expect(mine.body).not.toHaveProperty("zip");
    expect((await a.call("/api/users/nobody_here_zz")).status).toBe(404);
  });

  it("share lands in B's Inbox with a notification, delivered over Realtime", async () => {
    const got = new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("no Realtime event within 15 s")), 15_000);
      const ch = b.client
        .channel(`e2e-${run}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${b.id}` }, (p) => {
          clearTimeout(t);
          void b.client.removeChannel(ch);
          resolve((p.new as { kind: string }).kind);
        })
        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED") return;
          const r = await a.call("/api/share", { method: "POST", json: { toUserIds: [b.id], listingId: savedId, message: "let's both apply" } });
          if (r.status !== 200) reject(new Error(`share failed: ${r.status}`));
        });
    });
    expect(await got).toBe("share");

    const inbox = await b.call<InboxItem[]>("/api/inbox");
    const item = inbox.body.find((i) => i.listing.id === savedId)!;
    expect(item.from.id).toBe(a.id);
    expect(item.message).toBe("let's both apply");
    expect(item.read_at).toBeNull();
    expect((await b.call<Me>("/api/me")).body.badges.unreadInbox).toBe(1);
    await b.call("/api/inbox", { method: "PATCH", json: { ids: [item.id] } });
    expect((await b.call<InboxItem[]>("/api/inbox")).body.find((i) => i.id === item.id)?.read_at).not.toBeNull();

    const notes = await b.call<AppNotification[]>("/api/notifications");
    const share = notes.body.find((n) => n.kind === "share")!;
    expect(share.listing?.id).toBe(savedId);
    await b.call("/api/notifications", { method: "PATCH", json: { ids: notes.body.map((n) => n.id) } });
    expect((await b.call<Me>("/api/me")).body.badges.unreadNotifications).toBe(0);

    // Not friends → can't share.
    expect((await b.call("/api/share", { method: "POST", json: { toUserIds: ["00000000-0000-4000-8000-000000000000"], listingId: savedId } })).status).toBe(400);
  });

  it("search finds people by prefix; blocking hides them and ends the friendship", async () => {
    const found = await b.call<{ id: string }[]>(`/api/friends/search?q=${a.username.slice(0, 8)}`);
    expect(found.body.map((p) => p.id)).toContain(a.id);
    expect((await b.call<unknown[]>("/api/friends/search?q=e")).body).toEqual([]);

    expect((await b.call("/api/block", { method: "POST", json: { userId: a.id } })).status).toBe(200);
    expect((await b.call<{ id: string }[]>(`/api/friends/search?q=${a.username}`)).body).toEqual([]);
    expect((await a.call(`/api/users/${b.username}`)).status).toBe(404);
    expect((await a.call<FriendsData>("/api/friends")).body.friends).toEqual([]);
    expect((await a.call("/api/friends/request", { method: "POST", json: { userId: b.id } })).status).toBe(404);
    expect((await b.call<InboxItem[]>("/api/inbox")).body).toEqual([]);
    expect((await b.call(`/api/block/${a.id}`, { method: "DELETE" })).status).toBe(200);

    // Re-friend directly: request, then the other side's request auto-accepts.
    expect((await a.call<{ status: string }>("/api/friends/request", { method: "POST", json: { userId: b.id } })).body.status).toBe("requested");
    expect((await b.call<{ status: string }>("/api/friends/request", { method: "POST", json: { userId: a.id } })).body.status).toBe("accepted");
    expect((await b.call(`/api/friends/${a.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await a.call<FriendsData>("/api/friends")).body.friends).toEqual([]);
  });
});

describe("safety, push, reminders cron (F7)", () => {
  it("report is accepted (and repeat reports are a no-op)", async () => {
    const body = { target_type: "listing", target_id: passedId, reason: "wrong_info", details: "deadline looks off" };
    expect((await a.call("/api/report", { method: "POST", json: body })).status).toBe(200);
    expect((await a.call("/api/report", { method: "POST", json: body })).status).toBe(200);
    const { count } = await admin.from("reports").select("*", { count: "exact", head: true }).eq("reporter_id", a.id);
    expect(count).toBe(1);
  });

  it("push subscribe/unsubscribe stores and removes this device", async () => {
    const endpoint = `https://push.example.test/${run}`;
    const sub = { endpoint, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };
    expect((await a.call("/api/push/subscribe", { method: "POST", json: sub })).status).toBe(200);
    expect((await admin.from("push_subscriptions").select("user_id").eq("endpoint", endpoint).single()).data?.user_id).toBe(a.id);
    expect((await a.call(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, { method: "DELETE" })).status).toBe(200);
    expect((await admin.from("push_subscriptions").select("id").eq("endpoint", endpoint)).data).toEqual([]);
  });

  it("the cron turns a due reminder into a bell item (and skips unsaved items)", async () => {
    expect((await fetch(`${BASE}/api/cron/reminders`)).status).toBe(401);
    const secret = process.env.CRON_SECRET;
    if (!secret) return console.warn("[e2e] CRON_SECRET not set; cron not checked");

    const past = new Date(Date.now() - 60_000).toISOString();
    const { data: due } = await admin
      .from("reminders")
      .insert([
        { user_id: a.id, listing_id: savedId, remind_at: past, title: `Due soon e2e ${run}`, source: "user" },
        { user_id: a.id, listing_id: passedId, remind_at: past, title: "not saved", source: "user" },
      ])
      .select("id");
    const res = await fetch(`${BASE}/api/cron/reminders`, { headers: { authorization: `Bearer ${secret}` } });
    expect(res.status).toBe(200);
    const notes = await a.call<AppNotification[]>("/api/notifications");
    expect(notes.body.some((n) => n.kind === "reminder" && n.title === `Due soon e2e ${run}` && n.listing?.id === savedId)).toBe(true);
    expect(notes.body.some((n) => n.title === "not saved")).toBe(false);
    const { data: rows } = await admin.from("reminders").select("sent_at").in("id", (due ?? []).map((r) => r.id));
    expect(rows?.every((r) => r.sent_at)).toBe(true);
  });
});
