/**
 * TanStack Query keys and stale times (front-end spec §19). Feature hooks live next to their
 * components and build on these keys so cache updates (optimistic swipes etc.) stay consistent.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OppType, StoryKey } from "@/lib/types";

export const qk = {
  feed: ["feed"] as const,
  stories: ["stories"] as const,
  storyDeck: (key: StoryKey) => ["stories", key] as const,
  savedAll: ["saved"] as const,
  saved: (type: OppType | "all") => ["saved", type] as const,
  passed: ["passed"] as const,
  listing: (id: string) => ["listing", id] as const,
  chat: (listingId: string) => ["chat", listingId] as const,
  friends: ["friends"] as const,
  activity: ["activity"] as const,
  inbox: ["inbox"] as const,
  profile: (username: string) => ["profile", username] as const,
  notifications: ["notifications"] as const,
  me: ["me"] as const,
  rightPanel: ["right-panel"] as const,
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;

export const staleTimes = {
  feed: 60 * SECOND,
  stories: 60 * SECOND,
  saved: 30 * SECOND,
  profile: 5 * MINUTE,
  me: 5 * MINUTE,
} as const;

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: api.me, staleTime: staleTimes.me });
}
