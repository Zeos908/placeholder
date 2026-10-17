import { Bookmark, House, Users, type LucideIcon } from "lucide-react";
import type { QueryKey } from "@tanstack/react-query";
import { qk } from "@/lib/queries";
import type { TabKey } from "@/lib/store";

export interface TabDef {
  key: TabKey;
  href: `/${TabKey}`;
  label: string;
  icon: LucideIcon;
  /** Queries a re-tap at the top of the tab refreshes (spec §7). */
  refresh: QueryKey[];
}

export const TABS: readonly TabDef[] = [
  { key: "feed", href: "/feed", label: "Home", icon: House, refresh: [qk.feed, qk.stories] },
  { key: "friends", href: "/friends", label: "Friends", icon: Users, refresh: [qk.activity, qk.inbox, qk.friends] },
  { key: "saved", href: "/saved", label: "Saved", icon: Bookmark, refresh: [qk.savedAll] },
];

/** The tab a path belongs to, only for the tab roots themselves (/saved/123 is a detail page). */
export function tabForPath(pathname: string): TabKey | null {
  const t = TABS.find((tab) => pathname === tab.href);
  return t?.key ?? null;
}

// Each tab scrolls its own container; the shell finds them here for re-tap scroll-to-top.
const containers = new Map<TabKey, HTMLElement>();

export function registerTabContainer(tab: TabKey, el: HTMLElement | null) {
  if (el) containers.set(tab, el);
  else containers.delete(tab);
}

export function tabContainer(tab: TabKey) {
  return containers.get(tab) ?? null;
}
