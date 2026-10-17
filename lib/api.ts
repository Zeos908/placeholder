/**
 * Typed fetch wrappers for every API route (build spec §8 + front-end spec additions).
 * In mock mode MSW answers these; otherwise the Next.js route handlers do.
 */
import type {
  ActivityPage,
  AppNotification,
  AppStatus,
  ChatHistory,
  ChatStreamEvent,
  ChecklistItem,
  FeedPage,
  FeedPost,
  FriendsData,
  InboxItem,
  ListingDetail,
  Me,
  OppType,
  PassedItem,
  PersonSummary,
  PublicProfile,
  Reminder,
  ReportReason,
  RightPanelData,
  SavedItem,
  Story,
  StoryKey,
  SwipeDirection,
  SwipeResult,
  Theme,
} from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

// Relative URLs need a base outside the browser (Vitest + msw/node).
function url(path: string) {
  const origin = typeof location !== "undefined" ? location.origin : "http://localhost";
  return new URL(path, origin).toString();
}

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url(path), {
    ...rest,
    headers: { ...(json !== undefined && { "Content-Type": "application/json" }), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let message = "Something went wrong.";
    let code: string | undefined;
    try {
      const body = await res.json();
      message = body.error ?? message;
      code = body.code;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message, code);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, json?: unknown) => request<T>(path, { method: "POST", json: json ?? {} });
const patch = <T>(path: string, json: unknown) => request<T>(path, { method: "PATCH", json });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
};

export interface MeUpdate {
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  grade_level?: number | null;
  school?: string | null;
  zip?: string | null;
  radius_miles?: number;
  interests?: string[];
  skills?: string[];
  bio?: string | null;
  share_saves?: boolean;
  theme?: Theme;
}

export const api = {
  // ---- me / profiles
  me: () => get<Me>("/api/me"),
  updateMe: (patchBody: MeUpdate) => patch<Me>("/api/me", patchBody),
  profile: (username: string) => get<PublicProfile>(`/api/users/${encodeURIComponent(username)}`),
  rightPanel: () => get<RightPanelData>("/api/right-panel"),

  // ---- feed
  feed: (cursor?: string | null) => get<FeedPage>(`/api/feed${qs({ cursor })}`),
  seen: (listingIds: string[]) => post<{ ok: true }>("/api/seen", { listingIds }),
  swipe: (listingId: string, direction: SwipeDirection) =>
    post<SwipeResult>("/api/swipe", { listingId, direction }),
  undoSwipe: (undoToken: string) => post<{ ok: true }>("/api/swipe/undo", { undoToken }),
  stories: () => get<Story[]>("/api/stories"),
  storyDeck: (key: StoryKey) => get<FeedPost[]>(`/api/stories/${key}`),

  // ---- saved / passed
  saved: (type?: OppType | null) => get<SavedItem[]>(`/api/saved${qs({ type })}`),
  updateSaved: (listingId: string, body: { app_status?: AppStatus; hidden_from_friends?: boolean }) =>
    patch<SavedItem>(`/api/saved/${listingId}`, body),
  unsave: (listingId: string) => post<SwipeResult>(`/api/saved/${listingId}/unsave`),
  passed: () => get<PassedItem[]>("/api/passed"),
  restore: (listingId: string) => post<{ ok: true }>(`/api/passed/${listingId}/restore`),
  listing: (listingId: string) => get<ListingDetail>(`/api/listings/${listingId}`),

  // ---- chat
  chatHistory: (listingId: string) => get<ChatHistory>(`/api/chat/${listingId}`),
  /** Streams the assistant's reply. Yields events until "done" or "error". */
  async *chatSend(listingId: string, content: string, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
    const res = await fetch(url(`/api/chat/${listingId}`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ content }),
      signal,
    });
    if (!res.ok || !res.body) {
      let body: { error?: string; code?: string } = {};
      try {
        body = await res.json();
      } catch {
        // ignore
      }
      const code = res.status === 429 ? ((body.code as "busy" | "limit") ?? "busy") : "failed";
      yield { type: "error", code, message: body.error ?? "Something went wrong." };
      return;
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const data = chunk
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("");
        if (data) yield JSON.parse(data) as ChatStreamEvent;
      }
    }
  },

  // ---- reminders / checklist
  reminders: (listingId?: string) => get<Reminder[]>(`/api/reminders${qs({ listingId })}`),
  createReminder: (body: { listingId: string; remind_at: string; title: string; note?: string }) =>
    post<Reminder>("/api/reminders", body),
  updateReminder: (id: string, body: { remind_at?: string; title?: string; note?: string | null }) =>
    patch<Reminder>(`/api/reminders?id=${id}`, body),
  deleteReminder: (id: string) => del<{ ok: true }>(`/api/reminders?id=${id}`),
  checklist: (listingId: string) => get<ChecklistItem[]>(`/api/checklist/${listingId}`),
  updateChecklist: (listingId: string, items: Pick<ChecklistItem, "id" | "text" | "done">[]) =>
    patch<ChecklistItem[]>(`/api/checklist/${listingId}`, { items }),

  // ---- friends
  friends: () => get<FriendsData>("/api/friends"),
  searchUsers: (q: string) => get<PersonSummary[]>(`/api/friends/search${qs({ q })}`),
  requestFriend: (userId: string) => post<{ status: "requested" | "accepted" }>("/api/friends/request", { userId }),
  respondFriend: (userId: string, accept: boolean) =>
    post<{ ok: true }>("/api/friends/respond", { userId, accept }),
  unfriend: (userId: string) => del<{ ok: true }>(`/api/friends/${userId}`),
  invite: () => post<{ code: string; url: string }>("/api/invites"),
  activity: (cursor?: string | null) => get<ActivityPage>(`/api/activity${qs({ cursor })}`),
  share: (toUserIds: string[], listingId: string, message?: string) =>
    post<{ ok: true }>("/api/share", { toUserIds, listingId, message }),
  inbox: () => get<InboxItem[]>("/api/inbox"),
  markInboxRead: (ids: string[]) => patch<{ ok: true }>("/api/inbox", { ids }),

  // ---- notifications / push
  notifications: () => get<AppNotification[]>("/api/notifications"),
  markNotificationsRead: (ids: string[]) => patch<{ ok: true }>("/api/notifications", { ids }),
  pushSubscribe: (sub: PushSubscriptionJSON) => post<{ ok: true }>("/api/push/subscribe", sub),
  pushUnsubscribe: () => del<{ ok: true }>("/api/push/subscribe"),

  // ---- safety
  report: (target_type: "user" | "listing", target_id: string, reason: ReportReason, details?: string) =>
    post<{ ok: true }>("/api/report", { target_type, target_id, reason, details }),
  block: (userId: string) => post<{ ok: true }>("/api/block", { userId }),
  unblock: (userId: string) => del<{ ok: true }>(`/api/block/${userId}`),
  blocked: () => get<PersonSummary[]>("/api/block"),
};
