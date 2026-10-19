/**
 * MSW handlers for every API route (build spec §8 + /api/stories etc.), backed by mocks/db.ts.
 * Response shapes are the ones in lib/types.ts, the same contract the real routes implement.
 */
import { format } from "date-fns";
import { delay, http, HttpResponse } from "msw";
import type {
  ActivityPage,
  AppStatus,
  ChatHistory,
  ChatMessage,
  ChatStreamEvent,
  ChecklistItem,
  FeedPage,
  FriendsData,
  OppType,
  PassedItem,
  ProfileGridItem,
  PublicProfile,
  Relationship,
  Reminder,
  RightPanelData,
  SavedItem,
  Story,
  StoryKey,
} from "@/lib/types";
import {
  activityItem,
  CHAT_LIMIT,
  counts,
  daysUntil,
  db,
  fullPerson,
  hoursAgo,
  inboxItem,
  isNearMe,
  isOpen,
  isUnswiped,
  listing,
  meResponse,
  notification,
  person,
  summary,
  toFeedPost,
  uid,
  visibleFriendSaves,
  type MyRow,
} from "./db";
import { ME_ID } from "./fixtures/people";

const PAGE_SIZE = 15;
// Realistic latency in the browser; none under Vitest.
const isTest = Boolean((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.VITEST);
const wait = (ms: number) => (isTest ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
const latency = () => (isTest ? Promise.resolve() : delay());

const fail = (status: number, error: string, code?: string) => HttpResponse.json({ error, code }, { status });
const nowIso = () => new Date().toISOString();

// ---------- helpers ----------

function feedCandidates() {
  const { me, mine } = db();
  return db()
    .listings.filter((l) => isOpen(l) && isUnswiped(l))
    .filter((l) => me.grade_level == null || ((l.grade_min ?? 9) <= me.grade_level && (l.grade_max ?? 17) >= me.grade_level))
    // Unlike the real get_feed, the mock doesn't drop far-away listings (it ranks nearby ones
    // higher instead), so the fixture feed stays long enough to exercise infinite scroll.
    .map((l) => {
      const interest = Math.min(3, l.tags.filter((t) => me.interests.includes(t)).length);
      const days = l.deadline ? daysUntil(l.deadline) : Infinity;
      const urgency = days <= 3 ? 1 : days <= 7 ? 0.7 : days <= 30 ? 0.3 : 0;
      const friends = Math.min(1, toFeedPost(l).friends_saved.count / 3);
      const seen = mine.get(l.id)?.state === "seen" ? 1 : 0;
      const near = isNearMe(l) ? 0.3 : 0;
      const jitter = (parseInt(l.id.slice(-4), 16) % 15) / 100;
      return { l, score: interest + 0.8 * urgency + 0.4 * friends - 0.6 * seen + near + jitter };
    })
    .sort((a, b) => b.score - a.score || b.l.id.localeCompare(a.l.id))
    .map((x) => x.l);
}

function storyItems(key: StoryKey) {
  const open = db().listings.filter((l) => isOpen(l) && isUnswiped(l));
  if (key === "closing") {
    return open
      .filter((l) => l.deadline && daysUntil(l.deadline) <= 7)
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  }
  if (key === "near") return open.filter(isNearMe);
  const savedByFriends = new Map<string, string>();
  for (const s of visibleFriendSaves()) {
    const prev = savedByFriends.get(s.listingId);
    if (!prev || s.saved_at > prev) savedByFriends.set(s.listingId, s.saved_at);
  }
  return open
    .filter((l) => savedByFriends.has(l.id))
    .sort((a, b) => savedByFriends.get(b.id)!.localeCompare(savedByFriends.get(a.id)!));
}

function savedItems(type?: OppType | null): SavedItem[] {
  const { mine } = db();
  return db()
    .listings.filter((l) => mine.get(l.id)?.state === "saved" && (!type || l.type === type))
    .sort((a, b) => {
      if (!a.deadline) return b.deadline ? 1 : 0;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    })
    .map((l) => {
      const row = mine.get(l.id)!;
      return {
        listing: l,
        app_status: row.app_status ?? "interested",
        hidden_from_friends: row.hidden_from_friends,
        saved_at: row.decided_at ?? row.seen_at,
      };
    });
}

function setMine(listingId: string, next: MyRow | undefined) {
  const prev = db().mine.get(listingId);
  if (next) db().mine.set(listingId, next);
  else db().mine.delete(listingId);
  const token = uid();
  db().undo.set(token, { listingId, prev });
  return token;
}

function decide(listingId: string, state: "saved" | "passed") {
  const prev = db().mine.get(listingId);
  return setMine(listingId, {
    state,
    app_status: state === "saved" ? "interested" : null,
    hidden_from_friends: prev?.hidden_from_friends ?? false,
    seen_at: prev?.seen_at ?? nowIso(),
    decided_at: nowIso(),
  });
}

function relationshipWith(id: string): Relationship {
  const d = db();
  if (id === ME_ID) return "self";
  if (d.friendIds.has(id)) return "friend";
  if (d.outgoing.has(id)) return "requested";
  if (d.incoming.has(id)) return "incoming";
  return "none";
}

function reminderLabel(iso: string) {
  return `⏰ Reminder set · ${format(new Date(iso), "EEE, MMM d, h:mm a")}`;
}

function cannedAnswer(listingId: string, question: string) {
  const l = listing(listingId)!;
  const deadline = l.deadline ? format(new Date(l.deadline), "EEEE, MMMM d") : "rolling (no fixed deadline)";
  if (/remind/i.test(question)) {
    return `Done! I set a reminder so you don't miss **${l.title}**. The deadline is **${deadline}**.\n\nWant me to make a checklist of what to prepare too?`;
  }
  return [
    `Here's what the listing says about **${l.title}**:`,
    "",
    `- **Deadline:** ${deadline}`,
    `- **Where:** ${l.is_remote ? "Remote" : (l.location_text ?? "Not listed")}`,
    `- **Who can apply:** ${l.eligibility_text ?? "Not listed"}`,
    l.compensation_text ? `- **Pay / award:** ${l.compensation_text}` : null,
    "",
    "Anything not listed here (like exact requirements) is worth checking on the [original listing](" + l.url + ").",
    "",
    "I can also set a reminder before the deadline if you'd like.",
  ]
    .filter((x) => x !== null)
    .join("\n");
}

// ---------- handlers ----------

export const handlers = [
  // "Simulate errors" (MOCK menu): fail everything so error states and rollbacks can be seen.
  // Returning nothing lets the request fall through to the real handlers below.
  http.all("*/api/*", () => {
    if (db().failRequests) return fail(503, "Simulated outage (mock mode).", "busy");
  }),

  // ---- me / profiles
  http.get("*/api/me", async () => {
    await latency();
    return HttpResponse.json(meResponse());
  }),

  http.patch("*/api/me", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const d = db();
    if (typeof body.username === "string") {
      const taken = [...d.people.values()].some((p) => p.username.toLowerCase() === (body.username as string).toLowerCase());
      if (taken) return fail(409, "That username is taken.", "username_taken");
    }
    Object.assign(d.me, body);
    return HttpResponse.json(meResponse());
  }),

  http.get("*/api/users/:username", async ({ params }) => {
    await latency();
    const d = db();
    const username = String(params.username).toLowerCase();
    const isMe = d.me.username.toLowerCase() === username;
    const p = isMe ? null : [...d.people.values()].find((x) => x.username.toLowerCase() === username);
    if (!isMe && (!p || d.blocked.has(p.id))) return fail(404, "User not found.");

    if (isMe) {
      const saves: ProfileGridItem[] = savedItems().map((s) => ({ ...summary(s.listing), hidden_from_friends: s.hidden_from_friends }));
      const profile: PublicProfile = {
        ...person(ME_ID),
        school: d.me.school,
        grade_level: d.me.grade_level,
        interests: d.me.interests,
        bio: d.me.bio,
        counts: counts(),
        relationship: "self",
        saves,
      };
      return HttpResponse.json(profile);
    }

    const rel = relationshipWith(p!.id);
    const theirSaves = d.friendSaves.filter((s) => s.userId === p!.id);
    const profile: PublicProfile = {
      ...person(p!.id),
      school: p!.school,
      grade_level: p!.grade_level,
      interests: p!.interests,
      bio: p!.bio,
      counts: {
        saved: theirSaves.length,
        applied: theirSaves.filter((s) => ["applied", "accepted", "rejected"].includes(s.app_status)).length,
        friends: rel === "friend" ? 4 : 2,
      },
      relationship: rel,
      // Only friends see someone's saves.
      saves:
        rel === "friend"
          ? theirSaves
              .sort((a, b) => b.saved_at.localeCompare(a.saved_at))
              .map((s) => ({ ...summary(listing(s.listingId)!), hidden_from_friends: false }))
          : [],
    };
    return HttpResponse.json(profile);
  }),

  http.get("*/api/right-panel", async () => {
    await latency();
    const data: RightPanelData = {
      closingSoon: savedItems()
        .filter((s) => s.listing.deadline && isOpen(s.listing))
        .slice(0, 5),
      friendsSaved: storyItems("friends")
        .slice(0, 5)
        .map((l) => ({ ...summary(l), people: toFeedPost(l).friends_saved.people })),
    };
    return HttpResponse.json(data);
  }),

  // ---- feed
  http.get("*/api/feed", async ({ request }) => {
    await latency();
    const cursor = Number(new URL(request.url).searchParams.get("cursor") ?? 0) || 0;
    const all = feedCandidates();
    const posts = all.slice(cursor, cursor + PAGE_SIZE).map(toFeedPost);
    const next = cursor + PAGE_SIZE < all.length ? String(cursor + PAGE_SIZE) : null;
    return HttpResponse.json<FeedPage>({ posts, nextCursor: next });
  }),

  http.post("*/api/seen", async ({ request }) => {
    const { listingIds } = (await request.json()) as { listingIds: string[] };
    for (const id of listingIds ?? []) {
      if (!db().mine.has(id) && listing(id)) {
        db().mine.set(id, { state: "seen", app_status: null, hidden_from_friends: false, seen_at: nowIso(), decided_at: null });
      }
    }
    return HttpResponse.json({ ok: true });
  }),

  http.post("*/api/swipe", async ({ request }) => {
    const { listingId, direction } = (await request.json()) as { listingId: string; direction: "right" | "left" };
    if (!listing(listingId)) return fail(404, "Listing not found.");
    const state = direction === "right" ? "saved" : "passed";
    const undoToken = decide(listingId, state);
    return HttpResponse.json({ undoToken, state });
  }),

  http.post("*/api/swipe/undo", async ({ request }) => {
    const { undoToken } = (await request.json()) as { undoToken: string };
    const entry = db().undo.get(undoToken);
    if (!entry) return fail(410, "Too late to undo.");
    db().undo.delete(undoToken);
    if (entry.prev) db().mine.set(entry.listingId, entry.prev);
    else db().mine.delete(entry.listingId);
    return HttpResponse.json({ ok: true });
  }),

  http.get("*/api/stories", async () => {
    await latency();
    const stories: Story[] = (["closing", "near", "friends"] as const)
      .filter((key) => key !== "near" || db().me.zip)
      .map((key) => {
        const items = storyItems(key);
        const story: Story = {
          key,
          count: items.length,
          unseenCount: items.filter((l) => db().mine.get(l.id)?.state !== "seen").length,
        };
        if (key === "friends") {
          const savers: (string | null)[] = [];
          for (const s of visibleFriendSaves().sort((a, b) => b.saved_at.localeCompare(a.saved_at))) {
            if (!items.some((l) => l.id === s.listingId)) continue;
            const url = person(s.userId).avatar_url;
            if (!savers.includes(url)) savers.push(url);
            if (savers.length === 2) break;
          }
          story.avatars = savers;
        }
        return story;
      })
      .filter((s) => s.count > 0);
    return HttpResponse.json(stories);
  }),

  http.get("*/api/stories/:key", async ({ params }) => {
    await latency();
    const key = params.key as StoryKey;
    if (!["closing", "near", "friends"].includes(key)) return fail(404, "Unknown story.");
    return HttpResponse.json(storyItems(key).map(toFeedPost));
  }),

  // ---- saved / passed / listing
  http.get("*/api/saved", async ({ request }) => {
    await latency();
    const type = new URL(request.url).searchParams.get("type") as OppType | null;
    return HttpResponse.json(savedItems(type));
  }),

  http.patch("*/api/saved/:id", async ({ params, request }) => {
    const id = String(params.id);
    const row = db().mine.get(id);
    if (row?.state !== "saved") return fail(404, "Not in your saved list.");
    const body = (await request.json()) as { app_status?: AppStatus; hidden_from_friends?: boolean };
    if (body.app_status) row.app_status = body.app_status;
    if (typeof body.hidden_from_friends === "boolean") row.hidden_from_friends = body.hidden_from_friends;
    return HttpResponse.json(savedItems().find((s) => s.listing.id === id));
  }),

  http.post("*/api/saved/:id/unsave", async ({ params }) => {
    const id = String(params.id);
    if (db().mine.get(id)?.state !== "saved") return fail(404, "Not in your saved list.");
    return HttpResponse.json({ undoToken: decide(id, "passed"), state: "passed" });
  }),

  http.get("*/api/passed", async () => {
    await latency();
    const { mine } = db();
    const items: PassedItem[] = db()
      .listings.filter((l) => mine.get(l.id)?.state === "passed")
      .map((l) => ({ listing: l, passed_at: mine.get(l.id)!.decided_at ?? nowIso() }))
      .sort((a, b) => b.passed_at.localeCompare(a.passed_at));
    return HttpResponse.json(items);
  }),

  http.post("*/api/passed/:id/restore", async ({ params }) => {
    const id = String(params.id);
    if (db().mine.get(id)?.state !== "passed") return fail(404, "Not in your passed list.");
    db().mine.delete(id);
    return HttpResponse.json({ ok: true });
  }),

  http.get("*/api/listings/:id", async ({ params }) => {
    await latency();
    const l = listing(String(params.id));
    if (!l) return fail(404, "Listing not found.");
    const row = db().mine.get(l.id);
    return HttpResponse.json({
      listing: l,
      state: row?.state ?? null,
      app_status: row?.state === "saved" ? (row.app_status ?? "interested") : null,
      hidden_from_friends: row?.hidden_from_friends ?? false,
      checklist: db().checklists.get(l.id) ?? [],
      reminders: db().reminders.filter((r) => r.listing_id === l.id && !r.sent_at).sort((a, b) => a.remind_at.localeCompare(b.remind_at)),
      friends_saved: toFeedPost(l).friends_saved,
    });
  }),

  // ---- search (same matching as the real route: every word, in text fields or tags)
  http.get("*/api/search", async ({ request }) => {
    await latency();
    const params = new URL(request.url).searchParams;
    const type = params.get("type") as OppType | null;
    const words = (params.get("q") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 5);
    if (!words.length) return HttpResponse.json([]);
    const now = Date.now();
    const closed = (deadline: string | null) => !!deadline && new Date(deadline).getTime() < now;
    const hits = db()
      .listings.filter((l) => !type || l.type === type)
      .filter((l) => {
        const text = [l.title, l.org_name, l.summary, l.description, l.location_text].join(" ").toLowerCase();
        return words.every((w) => text.includes(w) || l.tags.includes(w));
      })
      .sort(
        (a, b) =>
          Number(closed(a.deadline)) - Number(closed(b.deadline)) ||
          (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"),
      )
      .slice(0, 40);
    return HttpResponse.json(hits);
  }),

  // ---- chat
  http.get("*/api/chat/:id", async ({ params }) => {
    await latency();
    const history: ChatHistory = {
      messages: db().chats.get(String(params.id)) ?? [],
      remaining: CHAT_LIMIT - db().chatUsed,
      limit: CHAT_LIMIT,
    };
    return HttpResponse.json(history);
  }),

  http.post("*/api/chat/:id", async ({ params, request }) => {
    const id = String(params.id);
    const l = listing(id);
    if (!l) return fail(404, "Listing not found.");
    const { content } = (await request.json()) as { content: string };
    if (!content?.trim()) return fail(400, "Type a question first.");
    if (db().chatUsed >= CHAT_LIMIT) {
      return fail(429, "You've used today's 30 questions. They reset at midnight.", "limit");
    }
    db().chatUsed += 1;
    const thread = db().chats.get(id) ?? [];
    db().chats.set(id, thread);
    thread.push({ id: uid(), role: "user", content, created_at: nowIso() });

    const encoder = new TextEncoder();
    const send = (ctrl: ReadableStreamDefaultController, e: ChatStreamEvent) =>
      ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

    const stream = new ReadableStream({
      async start(ctrl) {
        // "thinking" before the first token
        await new Promise((r) => setTimeout(r, isTest ? db().chatThinkMs : 800));
        if (/remind/i.test(content)) {
          // 9 AM two days before the deadline; if that's already past, 9 AM tomorrow.
          const at = new Date(l.deadline ? new Date(l.deadline).getTime() - 2 * 86_400_000 : Date.now());
          at.setHours(9, 0, 0, 0);
          if (at.getTime() <= Date.now()) {
            at.setTime(Date.now() + 86_400_000);
            at.setHours(9, 0, 0, 0);
          }
          const reminder: Reminder = {
            id: uid(),
            listing_id: id,
            remind_at: at.toISOString(),
            title: `Apply: ${l.title}`,
            note: null,
            source: "ai",
            sent_at: null,
          };
          db().reminders.push(reminder);
          const tool: ChatMessage = { id: uid(), role: "tool", content: reminderLabel(reminder.remind_at), created_at: nowIso() };
          thread.push(tool);
          send(ctrl, { type: "tool", message: tool });
        }
        const answer = cannedAnswer(id, content);
        const words = answer.split(/(\s+)/);
        for (const w of words) {
          send(ctrl, { type: "token", text: w });
          if (w.trim()) await wait(30);
        }
        const message: ChatMessage = { id: uid(), role: "assistant", content: answer, created_at: nowIso() };
        thread.push(message);
        send(ctrl, { type: "done", message, remaining: CHAT_LIMIT - db().chatUsed });
        ctrl.close();
      },
    });
    return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }),

  // ---- reminders / checklist
  http.get("*/api/reminders", async ({ request }) => {
    const listingId = new URL(request.url).searchParams.get("listingId");
    return HttpResponse.json(db().reminders.filter((r) => !listingId || r.listing_id === listingId));
  }),

  http.post("*/api/reminders", async ({ request }) => {
    const body = (await request.json()) as { listingId: string; remind_at: string; title: string; note?: string };
    if (!body.title?.trim()) return fail(400, "Give the reminder a title.");
    if (new Date(body.remind_at).getTime() < Date.now()) return fail(400, "Pick a time in the future.");
    const r: Reminder = {
      id: uid(),
      listing_id: body.listingId,
      remind_at: body.remind_at,
      title: body.title.trim(),
      note: body.note ?? null,
      source: "user",
      sent_at: null,
    };
    db().reminders.push(r);
    return HttpResponse.json(r, { status: 201 });
  }),

  http.patch("*/api/reminders", async ({ request }) => {
    const id = new URL(request.url).searchParams.get("id");
    const r = db().reminders.find((x) => x.id === id);
    if (!r) return fail(404, "Reminder not found.");
    Object.assign(r, await request.json());
    return HttpResponse.json(r);
  }),

  http.delete("*/api/reminders", async ({ request }) => {
    const id = new URL(request.url).searchParams.get("id");
    db().reminders = db().reminders.filter((r) => r.id !== id);
    return HttpResponse.json({ ok: true });
  }),

  http.get("*/api/checklist/:id", async ({ params }) => HttpResponse.json(db().checklists.get(String(params.id)) ?? [])),

  http.patch("*/api/checklist/:id", async ({ params, request }) => {
    const { items } = (await request.json()) as { items: Pick<ChecklistItem, "id" | "text" | "done">[] };
    const next = items.slice(0, 10).map((it, position) => ({ ...it, position }));
    db().checklists.set(String(params.id), next);
    return HttpResponse.json(next);
  }),

  // ---- friends
  http.get("*/api/friends", async () => {
    await latency();
    const d = db();
    const data: FriendsData = {
      friends: [...d.friendIds]
        .filter((id) => !d.blocked.has(id))
        .map((id) => ({ ...person(id), school: fullPerson(id)?.school ?? null }))
        .sort((a, b) => a.username.localeCompare(b.username)),
      incoming: [...d.incoming].filter((id) => !d.blocked.has(id)).map(person),
      outgoing: [...d.outgoing].map(person),
    };
    return HttpResponse.json(data);
  }),

  http.get("*/api/friends/search", async ({ request }) => {
    await latency();
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase().replace(/^@/, "");
    if (q.length < 2) return HttpResponse.json([]);
    const d = db();
    const results = [...d.people.values()]
      .filter((p) => !d.blocked.has(p.id) && p.username.toLowerCase().startsWith(q))
      .slice(0, 20)
      .map((p) => person(p.id));
    return HttpResponse.json(results);
  }),

  http.post("*/api/friends/request", async ({ request }) => {
    const { userId } = (await request.json()) as { userId: string };
    const d = db();
    if (!d.people.has(userId) || d.blocked.has(userId)) return fail(404, "User not found.");
    if (d.incoming.has(userId)) {
      d.incoming.delete(userId);
      d.friendIds.add(userId);
      return HttpResponse.json({ status: "accepted" });
    }
    d.outgoing.add(userId);
    return HttpResponse.json({ status: "requested" });
  }),

  http.post("*/api/friends/respond", async ({ request }) => {
    const { userId, accept } = (await request.json()) as { userId: string; accept: boolean };
    const d = db();
    if (!d.incoming.delete(userId)) return fail(404, "No request from that user.");
    if (accept) d.friendIds.add(userId);
    d.notifications = d.notifications.filter((n) => !(n.kind === "friend_request" && n.actorId === userId));
    return HttpResponse.json({ ok: true });
  }),

  http.delete("*/api/friends/:id", async ({ params }) => {
    const id = String(params.id);
    db().friendIds.delete(id);
    db().outgoing.delete(id);
    return HttpResponse.json({ ok: true });
  }),

  http.post("*/api/invites", async ({ request }) => {
    const code = db().inviteCode;
    return HttpResponse.json({ code, url: `${new URL(request.url).origin}/invite/${code}` });
  }),

  http.get("*/api/activity", async ({ request }) => {
    await latency();
    const d = db();
    const cursor = Number(new URL(request.url).searchParams.get("cursor") ?? 0) || 0;
    const visible = d.activity.filter((a) => d.friendIds.has(a.actorId) && !d.blocked.has(a.actorId));
    const mySaved = new Set([...d.mine].filter(([, r]) => r.state === "saved").map(([id]) => id));
    const overlapMap = new Map<string, string[]>();
    for (const s of visibleFriendSaves()) {
      if (!mySaved.has(s.listingId)) continue;
      overlapMap.set(s.listingId, [...(overlapMap.get(s.listingId) ?? []), s.userId]);
    }
    const page: ActivityPage = {
      items: visible.slice(cursor, cursor + 20).map(activityItem),
      overlaps:
        cursor === 0
          ? [...overlapMap].map(([lid, ids]) => ({
              listing: summary(listing(lid)!),
              friend_count: ids.length,
              friends: ids.slice(0, 3).map(person),
            }))
          : [],
      nextCursor: cursor + 20 < visible.length ? String(cursor + 20) : null,
    };
    return HttpResponse.json(page);
  }),

  http.post("*/api/share", async ({ request }) => {
    const { toUserIds, listingId, message } = (await request.json()) as {
      toUserIds: string[];
      listingId: string;
      message?: string;
    };
    const d = db();
    const recipients = (toUserIds ?? []).filter((id) => d.friendIds.has(id) && !d.blocked.has(id));
    if (!recipients.length) return fail(400, "Pick at least one friend.");
    for (const toId of recipients) {
      d.outbox.push({ id: uid(), fromId: ME_ID, toId, listingId, message: message?.trim() || null, created_at: nowIso(), read_at: null });
    }
    // Mock only: the first recipient "shares back" a moment later so the Inbox flow can be seen
    // from a single account (there is no second user to log in as in mock mode).
    const echoFrom = recipients[0];
    setTimeout(
      () => {
        d.inbox.unshift({
          id: uid(),
          fromId: echoFrom,
          toId: ME_ID,
          listingId,
          message: "ooh yes, let's both apply!",
          created_at: nowIso(),
          read_at: null,
        });
        d.notifications.unshift({
          id: uid(),
          kind: "share",
          actorId: echoFrom,
          listingId,
          title: "sent you a post",
          created_at: nowIso(),
          read_at: null,
        });
      },
      isTest ? 0 : 2500,
    );
    return HttpResponse.json({ ok: true });
  }),

  http.get("*/api/inbox", async () => {
    await latency();
    const d = db();
    const items = d.inbox
      .filter((s) => !d.blocked.has(s.fromId))
      .sort((a, b) => Number(!!a.read_at) - Number(!!b.read_at) || b.created_at.localeCompare(a.created_at))
      .map(inboxItem);
    return HttpResponse.json(items);
  }),

  http.patch("*/api/inbox", async ({ request }) => {
    const { ids } = (await request.json()) as { ids: string[] };
    for (const s of db().inbox) if (ids.includes(s.id) && !s.read_at) s.read_at = nowIso();
    return HttpResponse.json({ ok: true });
  }),

  // ---- notifications / push
  http.get("*/api/notifications", async () => {
    await latency();
    const d = db();
    return HttpResponse.json(
      d.notifications
        .filter((n) => !n.actorId || !d.blocked.has(n.actorId))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(notification),
    );
  }),

  http.patch("*/api/notifications", async ({ request }) => {
    const { ids } = (await request.json()) as { ids: string[] };
    for (const n of db().notifications) if ((ids ?? []).includes(n.id) && !n.read_at) n.read_at = nowIso();
    return HttpResponse.json({ ok: true });
  }),

  http.post("*/api/push/subscribe", () => HttpResponse.json({ ok: true })),
  http.delete("*/api/push/subscribe", () => HttpResponse.json({ ok: true })),

  // ---- safety
  http.post("*/api/report", () => HttpResponse.json({ ok: true })),

  http.get("*/api/block", () => HttpResponse.json([...db().blocked].map(person))),

  http.post("*/api/block", async ({ request }) => {
    const { userId } = (await request.json()) as { userId: string };
    const d = db();
    d.blocked.add(userId);
    d.friendIds.delete(userId);
    d.incoming.delete(userId);
    d.outgoing.delete(userId);
    return HttpResponse.json({ ok: true });
  }),

  http.delete("*/api/block/:id", async ({ params }) => {
    db().blocked.delete(String(params.id));
    return HttpResponse.json({ ok: true });
  }),
];

// Exposed for tests that need to fast-forward state.
export { hoursAgo };
