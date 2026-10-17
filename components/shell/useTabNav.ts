"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { useUi } from "@/lib/store";
import { tabContainer, type TabDef } from "@/lib/tabs";

/**
 * Re-tapping the active tab (spec §7): scrolled down → smooth-scroll to top;
 * already at the top → refresh that tab's queries (spinner under the top bar until done).
 */
export function useTabNav() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  return (tab: TabDef, e: MouseEvent) => {
    if (pathname !== tab.href) {
      useUi.getState().setTopBarVisible(true);
      return; // normal navigation
    }
    e.preventDefault();
    const el = tabContainer(tab.key);
    if (el && el.scrollTop > 0) {
      el.scrollTo({ top: 0, behavior: "smooth" });
      useUi.getState().setTopBarVisible(true);
      return;
    }
    const ui = useUi.getState();
    if (ui.refreshing) return;
    ui.setRefreshing(tab.key);
    Promise.all(tab.refresh.map((queryKey) => queryClient.invalidateQueries({ queryKey }))).finally(() =>
      useUi.getState().setRefreshing(null),
    );
  };
}
