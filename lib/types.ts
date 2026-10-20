/**
 * Shapes returned by the API routes (build spec §8 + front-end spec additions).
 * The real route handlers (Phase F8) and the MSW mocks (/mocks) both return exactly these.
 */

export type OppType = "internship" | "volunteer" | "event" | "scholarship";
export const OPP_TYPES: readonly OppType[] = ["internship", "volunteer", "event", "scholarship"];

export type AppStatus = "interested" | "applying" | "applied" | "accepted" | "rejected";
export const APP_STATUSES: readonly AppStatus[] = [
  "interested",
  "applying",
  "applied",
  "accepted",
  "rejected",
];

export type SwipeDirection = "right" | "left";
export type Theme = "system" | "light" | "dark";

export interface PersonSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Listing {
  id: string;
  url: string;
  title: string;
  org_name: string | null;
  org_logo_url: string | null;
  type: OppType;
  description: string | null;
  summary: string | null;
  tags: string[];
  location_text: string | null;
  lat: number | null;
  lng: number | null;
  is_remote: boolean;
  grade_min: number | null;
  grade_max: number | null;
  eligibility_text: string | null;
  deadline: string | null;
  starts_at: string | null;
  ends_at: string | null;
  compensation_text: string | null;
  amount_usd: number | null;
  image_url: string | null;
  image_alt: string | null;
  /** A short portrait clip (≤ 20 s); image_url is then its poster frame. */
  video_url?: string | null;
  /** e.g. "Video by Jane Doe on Pexels", linked to media_credit_url. */
  media_credit?: string | null;
  media_credit_url?: string | null;
  created_at: string;
}

/** Enough to draw a thumbnail, grid tile, or activity row. */
export type ListingSummary = Pick<
  Listing,
  "id" | "title" | "type" | "org_name" | "image_url" | "image_alt" | "deadline"
>;

export interface FriendsSaved {
  count: number;
  /** Up to 3 most recent savers. */
  people: PersonSummary[];
}

export interface FeedPost extends Listing {
  saved: boolean;
  friends_saved: FriendsSaved;
}

export interface FeedPage {
  posts: FeedPost[];
  nextCursor: string | null;
}

export interface SwipeResult {
  undoToken: string;
  state: "saved" | "passed";
}

export interface SavedItem {
  listing: Listing;
  app_status: AppStatus;
  hidden_from_friends: boolean;
  saved_at: string;
}

export interface PassedItem {
  listing: Listing;
  passed_at: string;
}

export interface Reminder {
  id: string;
  listing_id: string;
  remind_at: string;
  title: string;
  note: string | null;
  source: "auto" | "ai" | "user";
  sent_at: string | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  position: number;
}

export interface ListingDetail {
  listing: Listing;
  state: "seen" | "saved" | "passed" | null;
  app_status: AppStatus | null;
  hidden_from_friends: boolean;
  checklist: ChecklistItem[];
  reminders: Reminder[];
  friends_saved: FriendsSaved;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  created_at: string;
}

export interface ChatHistory {
  messages: ChatMessage[];
  remaining: number;
  limit: number;
}

/** Server-sent events from POST /api/chat/[listingId]. Reasoning is never sent. */
export type ChatStreamEvent =
  | { type: "token"; text: string }
  | { type: "tool"; message: ChatMessage }
  | { type: "done"; message: ChatMessage; remaining: number }
  | { type: "error"; code: "busy" | "limit" | "failed"; message: string };

export interface Friend extends PersonSummary {
  school: string | null;
}

export interface FriendsData {
  friends: Friend[];
  incoming: PersonSummary[];
  outgoing: PersonSummary[];
}

export interface ActivityItem {
  id: string;
  actor: PersonSummary;
  verb: "saved" | "applied" | "accepted";
  listing: ListingSummary;
  created_at: string;
}

export interface OverlapItem {
  listing: ListingSummary;
  friend_count: number;
  friends: PersonSummary[];
}

export interface ActivityPage {
  items: ActivityItem[];
  /** Overlap highlight cards; the UI interleaves one every ~6 items. */
  overlaps: OverlapItem[];
  nextCursor: string | null;
}

export interface InboxItem {
  id: string;
  from: PersonSummary;
  listing: ListingSummary;
  message: string | null;
  created_at: string;
  read_at: string | null;
}

export type NotificationKind = "reminder" | "friend_request" | "friend_accepted" | "share";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  actor: PersonSummary | null;
  listing: ListingSummary | null;
  title: string;
  created_at: string;
  read_at: string | null;
}

export type StoryKey = "closing" | "near" | "friends";

export interface Story {
  key: StoryKey;
  count: number;
  unseenCount: number;
  /** Friends story only: avatar URLs of the most recent savers (up to 2). */
  avatars?: (string | null)[];
}

export interface Counts {
  saved: number;
  applied: number;
  friends: number;
}

export interface Me {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  grade_level: number | null;
  school: string | null;
  zip: string | null;
  radius_miles: number;
  interests: string[];
  skills: string[];
  bio: string | null;
  share_saves: boolean;
  theme: Theme;
  timezone: string;
  onboarded: boolean;
  /** A "Continue as guest" (anonymous) account: no friends, sharing or invites. */
  is_guest: boolean;
  counts: Counts;
  /** Badge counts for the shell. */
  badges: { dueSoon: number; unreadInbox: number; unreadNotifications: number };
}

export type Relationship = "self" | "friend" | "requested" | "incoming" | "none";

export interface ProfileGridItem extends ListingSummary {
  /** Only ever true on your own profile. */
  hidden_from_friends: boolean;
}

export interface PublicProfile extends PersonSummary {
  school: string | null;
  grade_level: number | null;
  interests: string[];
  bio: string | null;
  counts: Counts;
  relationship: Relationship;
  saves: ProfileGridItem[];
}

export interface RightPanelData {
  closingSoon: SavedItem[];
  friendsSaved: (ListingSummary & { people: PersonSummary[] })[];
}

export type ReportReason = "spam" | "inappropriate" | "wrong_info" | "other";
