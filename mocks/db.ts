/**
 * In-memory state for mock mode (front-end spec §20). Everything resets on reload (browser) or
 * via resetDb() (tests), and handlers mutate it so swipes, undo, statuses, shares and friend
 * requests behave realistically within a session.
 */
import type {
  ActivityItem,
  AppNotification,
  AppStatus,
  ChatMessage,
  ChecklistItem,
  FeedPost,
  FriendsSaved,
  InboxItem,
  Listing,
  ListingSummary,
  Me,
  PersonSummary,
  Reminder,
} from "@/lib/types";
import { buildListings, listingId } from "./fixtures/listings";
import { FRIENDS, ME_ID, MOCK_ME, REQUESTER, STRANGERS } from "./fixtures/people";

export interface MyRow {
  state: "seen" | "saved" | "passed";
  app_status: AppStatus | null;
  hidden_from_friends: boolean;
  seen_at: string;
  decided_at: string | null;
}

type PersonFull = PersonSummary & { school: string | null; grade_level: number | null; bio: string | null; interests: string[] };

interface FriendSave {
  userId: string;
  listingId: string;
  saved_at: string;
  app_status: AppStatus;
}

interface RawActivity {
  id: string;
  actorId: string;
  verb: "saved" | "applied" | "accepted";
  listingId: string;
  created_at: string;
}

interface RawShare {
  id: string;
  fromId: string;
  toId: string;
  listingId: string;
  message: string | null;
  created_at: string;
  read_at: string | null;
}

interface RawNotification {
  id: string;
  kind: AppNotification["kind"];
  actorId: string | null;
  listingId: string | null;
  title: string;
  created_at: string;
  read_at: string | null;
}

export const CHAT_LIMIT = 30;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`);

function createDb() {
  const listings = buildListings();
  const people = new Map<string, PersonFull>();
  for (const p of [...FRIENDS, REQUESTER, ...STRANGERS]) people.set(p.id, p);

  const mine = new Map<string, MyRow>();
  const mark = (n: number, state: MyRow["state"], app_status: AppStatus | null, h: number, hidden = false) =>
    mine.set(listingId(n), {
      state,
      app_status,
      hidden_from_friends: hidden,
      seen_at: hoursAgo(h + 1),
      decided_at: hoursAgo(h),
    });
  mark(4, "saved", "applying", 30);
  mark(11, "saved", "interested", 20);
  mark(21, "saved", "applied", 50, true); // hidden from friends → EyeOff on own grid
  mark(31, "saved", "interested", 5);
  mark(7, "passed", null, 40);
  mark(26, "passed", null, 60);

  const [maya, leo, priya, sam, jess, noah] = FRIENDS.map((f) => f.id);
  const savesBy: Record<string, number[]> = {
    [maya]: [1, 21, 23, 28, 14],
    [leo]: [3, 16, 26, 35, 11],
    [priya]: [2, 21, 29, 36, 38],
    [sam]: [8, 11, 19, 37, 13],
    [jess]: [17, 30, 39, 27],
    [noah]: [6, 22, 32, 10],
  };
  const friendSaves: FriendSave[] = [];
  let h = 1;
  for (const [userId, nums] of Object.entries(savesBy)) {
    for (const n of nums) {
      friendSaves.push({ userId, listingId: listingId(n), saved_at: hoursAgo(h), app_status: "interested" });
      h += 3;
    }
  }
  // A couple of friends got further along.
  friendSaves.find((s) => s.userId === priya && s.listingId === listingId(21))!.app_status = "applied";
  friendSaves.find((s) => s.userId === leo && s.listingId === listingId(35))!.app_status = "accepted";

  // 15 activity events, newest first.
  const activity: RawActivity[] = friendSaves
    .slice()
    .sort((a, b) => b.saved_at.localeCompare(a.saved_at))
    .slice(0, 13)
    .map((s) => ({ id: uid(), actorId: s.userId, verb: "saved" as const, listingId: s.listingId, created_at: s.saved_at }));
  activity.push(
    { id: uid(), actorId: priya, verb: "applied", listingId: listingId(21), created_at: hoursAgo(2) },
    { id: uid(), actorId: leo, verb: "accepted", listingId: listingId(35), created_at: hoursAgo(26) },
  );
  activity.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const inbox: RawShare[] = [
    { id: uid(), fromId: maya, toId: ME_ID, listingId: listingId(28), message: "we should do this", created_at: hoursAgo(3), read_at: null },
    { id: uid(), fromId: priya, toId: ME_ID, listingId: listingId(36), message: "you'd crush this", created_at: hoursAgo(9), read_at: null },
    { id: uid(), fromId: leo, toId: ME_ID, listingId: listingId(35), message: null, created_at: hoursAgo(50), read_at: hoursAgo(40) },
  ];

  const notifications: RawNotification[] = [
    { id: uid(), kind: "friend_request", actorId: REQUESTER.id, listingId: null, title: "sent you a friend request", created_at: hoursAgo(1), read_at: null },
    { id: uid(), kind: "share", actorId: maya, listingId: listingId(28), title: "sent you a post", created_at: hoursAgo(3), read_at: null },
    { id: uid(), kind: "reminder", actorId: null, listingId: listingId(31), title: "Due tomorrow: Future STEM Leaders Scholarship", created_at: hoursAgo(20), read_at: null },
    { id: uid(), kind: "share", actorId: priya, listingId: listingId(36), title: "sent you a post", created_at: hoursAgo(9), read_at: hoursAgo(8) },
    { id: uid(), kind: "friend_accepted", actorId: noah, listingId: null, title: "accepted your friend request", created_at: hoursAgo(80), read_at: hoursAgo(70) },
  ];

  const chats = new Map<string, ChatMessage[]>();
  chats.set(listingId(4), [
    { id: uid(), role: "user", content: "Do I need to know Python for this?", created_at: hoursAgo(28) },
    {
      id: uid(),
      role: "assistant",
      content:
        "The listing says **Python or spreadsheets experience** is expected, so either works. If you've used Python in a class, mention it in your application.",
      created_at: hoursAgo(28),
    },
    { id: uid(), role: "user", content: "Cool, thanks!", created_at: hoursAgo(27.9) },
  ]);
  chats.set(listingId(21), [
    { id: uid(), role: "user", content: "Can beginners join?", created_at: hoursAgo(49) },
    {
      id: uid(),
      role: "assistant",
      content: "Yes. It's open to **grades 9 through college**, and there are mentors and workshops for people who are new to coding.",
      created_at: hoursAgo(49),
    },
  ]);

  const deadlineOf = (n: number) => listings[n - 1].deadline!;
  const reminders: Reminder[] = [
    {
      id: uid(),
      listing_id: listingId(31),
      remind_at: new Date(new Date(deadlineOf(31)).setHours(9, 0, 0, 0)).toISOString(),
      title: "Due today: Future STEM Leaders Scholarship",
      note: null,
      source: "auto",
      sent_at: null,
    },
    {
      id: uid(),
      listing_id: listingId(4),
      remind_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      title: "Finish the research statement",
      note: null,
      source: "user",
      sent_at: null,
    },
  ];

  const checklists = new Map<string, ChecklistItem[]>();
  checklists.set(listingId(4), [
    { id: uid(), text: "Update resume with the data project", done: true, position: 0 },
    { id: uid(), text: "Write a 250-word research statement", done: false, position: 1 },
    { id: uid(), text: "Ask Ms. Patel for a reference", done: false, position: 2 },
  ]);

  return {
    me: {
      ...MOCK_ME,
      zip: MOCK_ME.zip as string | null,
      lat: MOCK_ME.lat as number | null,
      lng: MOCK_ME.lng as number | null,
      theme: MOCK_ME.theme as Me["theme"],
      onboarded: true,
    },
    listings,
    people,
    mine,
    friendIds: new Set(FRIENDS.map((f) => f.id)),
    incoming: new Set([REQUESTER.id]),
    outgoing: new Set<string>(),
    blocked: new Set<string>(),
    friendSaves,
    activity,
    inbox,
    outbox: [] as RawShare[],
    notifications,
    chats,
    chatUsed: 6,
    /** Test hook: how long the mock "thinks" under Vitest (the browser always waits 800 ms). */
    chatThinkMs: 0,
    reminders,
    checklists,
    undo: new Map<string, { listingId: string; prev: MyRow | undefined }>(),
    inviteCode: "alex-7k2p",
  };
}

export type Db = ReturnType<typeof createDb>;
let state: Db = createDb();

export const db = () => state;
export function resetDb() {
  state = createDb();
}
export { uid, hoursAgo };

// ---------- derived views ----------

export function listing(id: string): Listing | undefined {
  return state.listings.find((l) => l.id === id);
}

export function summary(l: Listing): ListingSummary {
  return {
    id: l.id,
    title: l.title,
    type: l.type,
    org_name: l.org_name,
    image_url: l.image_url,
    image_alt: l.image_alt,
    deadline: l.deadline,
  };
}

export function person(id: string): PersonSummary {
  if (id === ME_ID) {
    const { username, display_name, avatar_url } = state.me;
    return { id, username, display_name, avatar_url };
  }
  const p = state.people.get(id)!;
  return { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url };
}

export function fullPerson(id: string) {
  return state.people.get(id);
}

/** Saves a viewer may see: friend, not blocked. (Friends' own hide/off switches are applied at fixture time.) */
export function visibleFriendSaves() {
  return state.friendSaves.filter((s) => state.friendIds.has(s.userId) && !state.blocked.has(s.userId));
}

export function friendsSavedFor(id: string): FriendsSaved {
  const saves = visibleFriendSaves()
    .filter((s) => s.listingId === id)
    .sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  return { count: saves.length, people: saves.slice(0, 3).map((s) => person(s.userId)) };
}

export function toFeedPost(l: Listing): FeedPost {
  return { ...l, saved: state.mine.get(l.id)?.state === "saved", friends_saved: friendsSavedFor(l.id) };
}

export const isOpen = (l: Listing) => !l.deadline || new Date(l.deadline).getTime() > Date.now();
export const isUnswiped = (l: Listing) => {
  const s = state.mine.get(l.id)?.state;
  return s !== "saved" && s !== "passed";
};

function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

export function isNearMe(l: Listing) {
  const { lat, lng, radius_miles, zip } = state.me;
  if (!zip || lat == null || lng == null || l.is_remote || l.lat == null || l.lng == null) return false;
  return milesBetween(lat, lng, l.lat, l.lng) <= radius_miles;
}

export const daysUntil = (iso: string) => (new Date(iso).getTime() - Date.now()) / 86_400_000;

export function counts() {
  const rows = [...state.mine.values()];
  return {
    saved: rows.filter((r) => r.state === "saved").length,
    applied: rows.filter((r) => r.state === "saved" && ["applied", "accepted", "rejected"].includes(r.app_status ?? "")).length,
    friends: state.friendIds.size,
  };
}

export function meResponse(): Me {
  const dueSoon = state.listings.filter((l) => {
    const row = state.mine.get(l.id);
    return row?.state === "saved" && l.deadline && daysUntil(l.deadline) <= 3 && isOpen(l);
  }).length;
  // The user's own coordinates never leave the server (build spec §12).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lat, lng, ...me } = state.me;
  return {
    ...me,
    counts: counts(),
    badges: {
      dueSoon,
      unreadInbox: state.inbox.filter((s) => !s.read_at && !state.blocked.has(s.fromId)).length,
      unreadNotifications: state.notifications.filter((n) => !n.read_at).length,
    },
  };
}

export function activityItem(a: RawActivity): ActivityItem {
  return { id: a.id, actor: person(a.actorId), verb: a.verb, listing: summary(listing(a.listingId)!), created_at: a.created_at };
}

export function inboxItem(s: RawShare): InboxItem {
  return {
    id: s.id,
    from: person(s.fromId),
    listing: summary(listing(s.listingId)!),
    message: s.message,
    created_at: s.created_at,
    read_at: s.read_at,
  };
}

export function notification(n: RawNotification): AppNotification {
  return {
    id: n.id,
    kind: n.kind,
    actor: n.actorId ? person(n.actorId) : null,
    listing: n.listingId ? summary(listing(n.listingId)!) : null,
    title: n.title,
    created_at: n.created_at,
    read_at: n.read_at,
  };
}
