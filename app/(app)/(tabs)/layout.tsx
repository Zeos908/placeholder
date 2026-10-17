"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { TabScroll } from "@/components/shell/TabScroll";
import { FeedTab } from "@/components/tabs/FeedTab";
import { FriendsTab } from "@/components/tabs/FriendsTab";
import { SavedTab } from "@/components/tabs/SavedTab";
import type { TabKey } from "@/lib/store";
import { tabForPath } from "@/lib/tabs";

const TAB_BODIES: Record<TabKey, () => ReactNode> = {
  feed: () => <FeedTab />,
  friends: () => <FriendsTab />,
  saved: () => <SavedTab />,
};

/**
 * Keeps Feed, Friends and Saved mounted (spec §7): switching tabs is instant and keeps each
 * tab's scroll position, loaded pages and video state. A tab mounts on its first visit and
 * then stays mounted. The page files under this layout render nothing; they only define routes.
 */
export default function TabsLayout({ children }: { children: ReactNode }) {
  const current = tabForPath(usePathname()) ?? "feed";
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set([current]));
  if (!visited.has(current)) setVisited(new Set(visited).add(current));

  return (
    <>
      {children}
      {(Object.keys(TAB_BODIES) as TabKey[])
        .filter((key) => visited.has(key))
        .map((key) => (
          <TabScroll key={key} tab={key} active={key === current}>
            {TAB_BODIES[key]()}
          </TabScroll>
        ))}
    </>
  );
}
