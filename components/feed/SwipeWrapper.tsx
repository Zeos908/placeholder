"use client";

import { useDrag } from "@use-gesture/react";
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
import { onSwipeUndone } from "@/lib/swipe-events";
import type { SwipeDirection } from "@/lib/types";

const AXIS_LOCK = 12; // px before deciding horizontal vs vertical
const COMMIT_FRACTION = 0.3; // of card width
const COMMIT_VELOCITY = 0.5; // px/ms
const MAX_ROTATE = 6; // degrees
const SPRING = { type: "spring", stiffness: 400, damping: 32 } as const;
const EASE = [0.2, 0, 0, 1] as const;

export interface SwipeHandle {
  /** Same as a committed swipe: bookmark button (right) and "…" → Pass (left). */
  fling: (direction: SwipeDirection) => void;
}

interface SwipeCtx {
  x: MotionValue<number>;
  width: () => number;
  /** True right after a horizontal drag, so the release doesn't count as a tap. */
  dragged: () => boolean;
}

const SwipeContext = createContext<SwipeCtx | null>(null);
export const useSwipeContext = () => useContext(SwipeContext);

/**
 * Horizontal swipe on a post (build spec §9.3). The card has `touch-action: pan-y`, so vertical
 * movement is always the browser's native scroll; after 12 px a horizontal lock takes over.
 * Commit at 30% width or 0.5 px/ms: fly off (200 ms), collapse the slot (200 ms), then onExited.
 */
export const SwipeWrapper = forwardRef<
  SwipeHandle,
  {
    children: ReactNode;
    /** Listing id: an Undo for it cancels a fly-off that's still running. */
    id: string;
    onCommit: (direction: SwipeDirection) => void;
    onExited: () => void;
    disabled?: boolean;
  }
>(function SwipeWrapper({ id, children, onCommit, onExited, disabled }, ref) {
  const outer = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const widthRef = useRef(375);
  const lock = useRef<"x" | "y" | null>(null);
  const draggedAt = useRef(0);
  const flying = useRef(false);
  const run = useRef(0); // bumps on undo so an in-flight fling knows it was cancelled
  const running = useRef<{ stop: () => void }[]>([]);

  const rotate = useTransform(x, (v) => Math.max(-1, Math.min(1, v / widthRef.current)) * MAX_ROTATE);

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

  const bind = useDrag(
    ({ first, last, canceled, movement: [mx, my], velocity: [vx], direction: [dx], cancel }) => {
      if (disabled || flying.current) return;
      if (first) {
        lock.current = null;
        widthRef.current = outer.current?.offsetWidth ?? widthRef.current;
      }
      if (!lock.current) {
        if (Math.hypot(mx, my) < AXIS_LOCK) return;
        lock.current = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        if (lock.current === "y") {
          cancel(); // let the page scroll
          return;
        }
      }
      if (lock.current !== "x") return;
      draggedAt.current = Date.now();

      if (!last && !canceled) {
        x.set(mx);
        return;
      }
      const w = widthRef.current;
      const far = Math.abs(mx) > w * COMMIT_FRACTION;
      const flick = vx > COMMIT_VELOCITY && Math.sign(dx) === Math.sign(mx) && mx !== 0;
      if (!canceled && (far || flick)) void fling(mx > 0 ? "right" : "left");
      else animate(x, 0, SPRING);
    },
    { filterTaps: true, pointer: { capture: false } },
  );

  const ctx: SwipeCtx = {
    x,
    width: () => widthRef.current,
    dragged: () => Date.now() - draggedAt.current < 250,
  };

  return (
    <SwipeContext.Provider value={ctx}>
      <div ref={outer}>
        <motion.div style={{ x, rotate }} className="relative will-change-transform select-none">
          {/* Gesture handlers on a plain div: their DOM types clash with motion's own drag props. */}
          <div {...bind()} style={{ touchAction: "pan-y" }}>
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
