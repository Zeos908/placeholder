"use client";

import { animate, motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import { COMMIT_FRACTION, EASE, SPRING, useSwipeGesture } from "@/components/feed/useSwipeGesture";
import { onSwipeUndone } from "@/lib/swipe-events";
import type { SwipeDirection } from "@/lib/types";

const MAX_ROTATE = 6; // degrees

export interface SwipeHandle {
  /** Same as a committed swipe: bookmark button (right) and "…" → Pass (left). */
  fling: (direction: SwipeDirection) => void;
}

export interface SwipeCtx {
  x: MotionValue<number>;
  width: () => number;
  /** True right after a horizontal drag, so the release doesn't count as a tap. */
  dragged: () => boolean;
}

export const SwipeContext = createContext<SwipeCtx | null>(null);
export const useSwipeContext = () => useContext(SwipeContext);

/** Rotation for a dragged card: up to ±6° at a full card width. */
export function useSwipeRotate(x: MotionValue<number>, width: () => number) {
  return useTransform(x, (v) => Math.max(-1, Math.min(1, v / width())) * MAX_ROTATE);
}

/**
 * Horizontal swipe on a feed post (build spec §9.3). Commit at 30% width or 0.5 px/ms: fly off
 * (200 ms), collapse the slot (200 ms), then onExited. Undo during the fly-off cancels it.
 */
export const SwipeWrapper = forwardRef<
  SwipeHandle,
  {
    /** Listing id: an Undo for it cancels a fly-off that's still running. */
    id: string;
    children: ReactNode;
    onCommit: (direction: SwipeDirection) => void;
    onExited: () => void;
    disabled?: boolean;
  }
>(function SwipeWrapper({ id, children, onCommit, onExited, disabled }, ref) {
  const outer = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const widthRef = useRef(375);
  const flying = useRef(false);
  const run = useRef(0); // bumps on undo so an in-flight fling knows it was cancelled
  const running = useRef<{ stop: () => void }[]>([]);
  const width = () => widthRef.current;
  const rotate = useSwipeRotate(x, width);

  async function fling(direction: SwipeDirection) {
    if (flying.current) return;
    flying.current = true;
    const myRun = ++run.current;
    widthRef.current = outer.current?.offsetWidth ?? widthRef.current;
    onCommit(direction);
    const sign = direction === "right" ? 1 : -1;
    const fly = animate(x, sign * widthRef.current * 1.3, { duration: 0.2, ease: EASE });
    running.current = [fly];
    await fly;
    if (run.current !== myRun) return;
    const el = outer.current;
    if (el) {
      el.style.height = `${el.offsetHeight}px`;
      el.style.overflow = "hidden";
      const collapse = animate(el, { height: 0, opacity: 0 }, { duration: 0.2, ease: EASE });
      running.current = [collapse];
      await collapse;
    }
    if (run.current !== myRun) return;
    onExited();
  }

  // Undo while the card is still leaving: stop, restore its slot, spring back into place.
  useEffect(
    () =>
      onSwipeUndone(id, () => {
        if (!flying.current) return;
        run.current++;
        running.current.forEach((a) => a.stop());
        running.current = [];
        const el = outer.current;
        if (el) {
          el.style.height = "";
          el.style.overflow = "";
          el.style.opacity = "";
        }
        flying.current = false;
        animate(x, 0, SPRING);
      }),
    [id, x],
  );

  useImperativeHandle(ref, () => ({ fling }));

  const gesture = useSwipeGesture({
    x,
    width: () => (widthRef.current = outer.current?.offsetWidth ?? widthRef.current),
    disabled: () => Boolean(disabled) || flying.current,
    onCommit: (dir) => void fling(dir),
  });

  return (
    <SwipeContext.Provider value={{ x, width, dragged: gesture.dragged }}>
      <div ref={outer}>
        <motion.div style={{ x, rotate }} className="relative will-change-transform select-none">
          {/* Gesture handlers on a plain div: their DOM types clash with motion's own drag props. */}
          <div {...gesture.bind()} style={{ touchAction: "pan-y" }}>
            {children}
          </div>
        </motion.div>
      </div>
    </SwipeContext.Provider>
  );
});

/** SAVE / PASS labels that fade in over the media in proportion to the drag (spec §9.3). */
export function SwipeLabels() {
  const ctx = useSwipeContext();
  const fallback = useMotionValue(0);
  const x = ctx?.x ?? fallback;
  const width = ctx?.width ?? (() => 375);
  const save = useTransform(x, (v) => Math.max(0, Math.min(1, v / (width() * COMMIT_FRACTION))));
  const pass = useTransform(x, (v) => Math.max(0, Math.min(1, -v / (width() * COMMIT_FRACTION))));
  if (!ctx) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <motion.span
        style={{ opacity: save }}
        className="absolute top-6 left-5 -rotate-12 rounded-lg border-4 border-green-500 px-3 py-1 text-3xl font-extrabold tracking-wider text-green-500"
      >
        SAVE
      </motion.span>
      <motion.span
        style={{ opacity: pass }}
        className="absolute top-6 right-5 rotate-12 rounded-lg border-4 border-red-500 px-3 py-1 text-3xl font-extrabold tracking-wider text-red-500"
      >
        PASS
      </motion.span>
    </div>
  );
}
