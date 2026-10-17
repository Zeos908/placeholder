import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type TabKey = "feed" | "friends" | "saved";

/** Ephemeral UI state (spec §19). Nothing here survives a reload. */
interface UiState {
  /** Global video mute, like Instagram: unmuting one video unmutes all. Always starts muted. */
  videoMuted: boolean;
  topBarVisible: boolean;
  activeSheet: string | null;
  scrollTops: Record<TabKey, number>;
  /** Tab whose queries are refreshing after a re-tap (spinner under the top bar). */
  refreshing: TabKey | null;
  setVideoMuted: (muted: boolean) => void;
  setTopBarVisible: (visible: boolean) => void;
  openSheet: (sheet: string) => void;
  closeSheet: () => void;
  setScrollTop: (tab: TabKey, top: number) => void;
  setRefreshing: (tab: TabKey | null) => void;
}

export const useUi = create<UiState>()((set) => ({
  videoMuted: true,
  topBarVisible: true,
  activeSheet: null,
  scrollTops: { feed: 0, friends: 0, saved: 0 },
  refreshing: null,
  setRefreshing: (refreshing) => set({ refreshing }),
  setVideoMuted: (videoMuted) => set({ videoMuted }),
  setTopBarVisible: (topBarVisible) => set({ topBarVisible }),
  openSheet: (activeSheet) => set({ activeSheet }),
  closeSheet: () => set({ activeSheet: null }),
  setScrollTop: (tab, top) => set((s) => ({ scrollTops: { ...s.scrollTops, [tab]: top } })),
}));

/** User preferences kept on this device (localStorage). */
interface PrefsState {
  soundEnabled: boolean;
  /** Per account: how many "due soon" saves there were when Saved was last opened. */
  dueSoonSeen: Record<string, number>;
  setSoundEnabled: (enabled: boolean) => void;
  setDueSoonSeen: (userId: string, count: number) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      dueSoonSeen: {},
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setDueSoonSeen: (userId, count) => set((s) => ({ dueSoonSeen: { ...s.dueSoonSeen, [userId]: count } })),
    }),
    {
      name: "placeholder-prefs",
      // Storage can throw in private mode; fall back to memory so the app still works.
      storage: createJSONStorage(() => {
        try {
          localStorage.setItem("__probe", "1");
          localStorage.removeItem("__probe");
          return localStorage;
        } catch {
          const mem = new Map<string, string>();
          return {
            getItem: (k) => mem.get(k) ?? null,
            setItem: (k, v) => void mem.set(k, v),
            removeItem: (k) => void mem.delete(k),
          };
        }
      }),
    },
  ),
);
