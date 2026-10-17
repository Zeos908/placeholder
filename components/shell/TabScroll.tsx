"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { RightPanel } from "@/components/shell/RightPanel";
import { TabActiveContext } from "@/components/shell/shell-context";
import { useUi, type TabKey } from "@/lib/store";
import { registerTabContainer } from "@/lib/tabs";

const TOP_BAR = 56;
const HIDE_AFTER = 8;

/**
 * One tab's own scroll container (spec §7). Hidden tabs stay mounted with `hidden`, and their
 * scroll position is saved to the UI store and restored when the tab (or the whole tabs
 * layout, after visiting a detail page) comes back. Also drives the hide-on-scroll top bar.
 */
export function TabScroll({ tab, active, children }: { tab: TabKey; active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastY = useRef(0);
  const run = useRef(0); // distance scrolled in the current direction
  const refreshing = useUi((s) => s.refreshing === tab);

  useEffect(() => {
    registerTabContainer(tab, ref.current);
    return () => registerTabContainer(tab, null);
  }, [tab]);

  // Restore before paint so there's no jump.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    el.scrollTop = useUi.getState().scrollTops[tab];
    lastY.current = el.scrollTop;
    run.current = 0;
    useUi.getState().setTopBarVisible(true);
  }, [active, tab]);

  function onScroll() {
    const el = ref.current;
    if (!el || !active) return;
    const y = el.scrollTop;
    const dy = y - lastY.current;
    lastY.current = y;
    const ui = useUi.getState();
    ui.setScrollTop(tab, y);

    if (y <= TOP_BAR) {
      run.current = 0;
      if (!ui.topBarVisible) ui.setTopBarVisible(true);
      return;
    }
    if (dy === 0) return;
    if (Math.sign(dy) !== Math.sign(run.current)) run.current = 0;
    run.current += dy;
    if (run.current >= HIDE_AFTER && ui.topBarVisible) ui.setTopBarVisible(false);
    else if (run.current <= -HIDE_AFTER && !ui.topBarVisible) ui.setTopBarVisible(true);
  }

  return (
    <TabActiveContext.Provider value={{ tab, active }}>
      <div
        ref={ref}
        hidden={!active}
        data-tab={tab}
        onScroll={onScroll}
        className="fixed inset-0 overflow-y-auto overscroll-contain pt-14 pb-[calc(56px+env(safe-area-inset-bottom))] md:left-[72px] md:pt-0 md:pb-0 wide:left-[244px]"
      >
        <div className="flex justify-center gap-16 md:px-8">
          <div className="w-full max-w-[470px] md:pt-6">
            {refreshing && (
              <div role="status" aria-label="Refreshing" className="flex justify-center py-3">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {children}
          </div>
          <RightPanel />
        </div>
      </div>
    </TabActiveContext.Provider>
  );
}
