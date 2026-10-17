"use client";

import { useDrag } from "@use-gesture/react";
import { animate, type MotionValue } from "framer-motion";
import { useRef } from "react";
import type { SwipeDirection } from "@/lib/types";

export const AXIS_LOCK = 12; // px before deciding horizontal vs vertical
export const COMMIT_FRACTION = 0.3; // of card width
export const COMMIT_VELOCITY = 0.5; // px/ms
export const SPRING = { type: "spring", stiffness: 400, damping: 32 } as const;
export const EASE = [0.2, 0, 0, 1] as const;

/**
 * Horizontal swipe physics shared by feed posts and deck cards (build spec §9.3): lock to an
 * axis after 12 px (vertical → leave it to native scroll), follow the pointer, and on release
 * commit at 30% width or 0.5 px/ms, otherwise spring back. Bind to an element with
 * `touch-action: pan-y` so vertical scrolling is never hijacked.
 */
export function useSwipeGesture({
  x,
  width,
  disabled,
  onCommit,
}: {
  x: MotionValue<number>;
  /** Current card width (read at drag start). */
  width: () => number;
  disabled?: () => boolean;
  onCommit: (direction: SwipeDirection) => void;
}) {
  const lock = useRef<"x" | "y" | null>(null);
  const w = useRef(375);
  const draggedAt = useRef(0);

  const bind = useDrag(
    ({ first, last, canceled, movement: [mx, my], velocity: [vx], direction: [dx], cancel }) => {
      if (disabled?.()) return;
      if (first) {
        lock.current = null;
        w.current = width();
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
      const far = Math.abs(mx) > w.current * COMMIT_FRACTION;
      const flick = vx > COMMIT_VELOCITY && Math.sign(dx) === Math.sign(mx) && mx !== 0;
      if (!canceled && (far || flick)) onCommit(mx > 0 ? "right" : "left");
      else animate(x, 0, SPRING);
    },
    { filterTaps: true, pointer: { capture: false } },
  );

  return {
    bind,
    /** True right after a horizontal drag, so the release doesn't count as a tap. */
    dragged: () => Date.now() - draggedAt.current < 250,
  };
}
