"use client";

import { createContext, useContext } from "react";
import type { TabKey } from "@/lib/store";

/** Basic signed-in user info the shell needs before /api/me has loaded. */
export interface ShellUser {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export const ShellUserContext = createContext<ShellUser | null>(null);

export function useShellUser() {
  const u = useContext(ShellUserContext);
  if (!u) throw new Error("useShellUser must be used inside AppShell");
  return u;
}

/** True while the surrounding tab is the visible one (videos in hidden tabs pause, spec §7). */
export const TabActiveContext = createContext<{ tab: TabKey | null; active: boolean }>({
  tab: null,
  active: true,
});

export const useTabActive = () => useContext(TabActiveContext);
