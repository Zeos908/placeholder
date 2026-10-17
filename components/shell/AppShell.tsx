"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ShellUserContext, type ShellUser } from "@/components/shell/shell-context";
import { RealtimeNotifications } from "@/components/shell/RealtimeNotifications";
import { Sidebar } from "@/components/shell/Sidebar";
import { TAB_BAR_PADDING, TabBar } from "@/components/shell/TabBar";
import { TopBar } from "@/components/shell/TopBar";
import { tabForPath } from "@/lib/tabs";
import { cn } from "@/lib/utils";

/**
 * App shell (spec §5–6). Mobile: top bar on the three tabs + bottom tab bar. Desktop (≥ 768 px):
 * left sidebar instead of both. Tab pages manage their own scroll containers (TabScroll); every
 * other page scrolls the window inside the space the shell leaves.
 */
export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const tab = tabForPath(pathname);
  // The saved-item page pins its chat input to the bottom, so it has no tab bar (spec §12.2).
  const hideTabBar = /^\/saved\/(?!passed$)[^/]+$/.test(pathname);

  return (
    <ShellUserContext.Provider value={user}>
      <RealtimeNotifications userId={user.id} />
      {tab && <TopBar />}
      <Sidebar />
      {tab ? (
        children
      ) : (
        <div className={cn("min-h-dvh md:pl-[72px] wide:pl-[244px]", !hideTabBar && TAB_BAR_PADDING)}>{children}</div>
      )}
      {!hideTabBar && <TabBar />}
    </ShellUserContext.Provider>
  );
}
