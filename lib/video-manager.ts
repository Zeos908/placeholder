/**
 * Coordinates feed videos (spec §9.5): only the single most-visible video (≥ 60% in view, in
 * the active tab) plays; the next 2 below it preload fully. One shared IntersectionObserver.
 */

interface Entry {
  el: HTMLVideoElement;
  group: string;
  index: number;
  enabled: boolean;
  ratio: number;
  setPreload: (p: "auto" | "metadata") => void;
}

const PLAY_AT = 0.6;
const entries = new Map<HTMLVideoElement, Entry>();
let current: Entry | null = null;
let observer: IntersectionObserver | null = null;
let scheduled = false;

function io() {
  if (!observer && typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          const e = entries.get(r.target as HTMLVideoElement);
          if (e) e.ratio = r.isIntersecting ? r.intersectionRatio : 0;
        }
        schedule();
      },
      { threshold: [0, PLAY_AT, 1] },
    );
  }
  return observer;
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    evaluate();
  });
}

function evaluate() {
  let best: Entry | null = null;
  for (const e of entries.values()) {
    if (!e.enabled || e.ratio < PLAY_AT) continue;
    if (!best || e.ratio > best.ratio || (e.ratio === best.ratio && e.index < best.index)) best = e;
  }
  for (const e of entries.values()) if (e !== best && !e.el.paused) e.el.pause();
  current = best;
  if (best && best.el.paused) best.el.play().catch(() => {});

  // Preload the next two in the same list fully; everything else just its metadata.
  for (const e of entries.values()) {
    const ahead = best && e.group === best.group ? e.index - best.index : -1;
    e.setPreload(ahead === 1 || ahead === 2 ? "auto" : "metadata");
  }
}

export const videoManager = {
  register(el: HTMLVideoElement, opts: Omit<Entry, "el" | "ratio">) {
    entries.set(el, { el, ratio: 0, ...opts });
    io()?.observe(el);
    schedule();
  },
  update(el: HTMLVideoElement, patch: Partial<Pick<Entry, "enabled" | "index">>) {
    const e = entries.get(el);
    if (!e) return;
    Object.assign(e, patch);
    schedule();
  },
  unregister(el: HTMLVideoElement) {
    observer?.unobserve(el);
    if (current?.el === el) current = null;
    entries.delete(el);
    schedule();
  },
};
