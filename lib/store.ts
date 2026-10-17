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
  setVideoMuted: (muted: boolean) => void;
  setTopBarVisible: (visible: boolean) => void;
  openSheet: (sheet: string) => void;
  closeSheet: () => void;
  setScrollTop: (tab: TabKey, top: number) => void;
}

export const useUi = create<UiState>()((set) => ({
  videoMuted: true,
  topBarVisible: true,
  activeSheet: null,
  scrollTops: { feed: 0, friends: 0, saved: 0 },
  setVideoMuted: (videoMuted) => set({ videoMuted }),
  setTopBarVisible: (topBarVisible) => set({ topBarVisible }),
  openSheet: (activeSheet) => set({ activeSheet }),
  closeSheet: () => set({ activeSheet: null }),
  setScrollTop: (tab, top) => set((s) => ({ scrollTops: { ...s.scrollTops, [tab]: top } })),
}));

/** User preferences kept on this device (localStorage). */
interface PrefsState {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
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
