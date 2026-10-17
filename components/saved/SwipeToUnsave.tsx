"use client";

import { useDrag } from "@use-gesture/react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import { AXIS_LOCK, EASE, SPRING } from "@/components/feed/useSwipeGesture";

const ACTION_WIDTH = 80;
const OPEN_AT = 40;
const COMMIT_FRACTION = 0.5;

/**
 * Saved row swipe-to-unsave (spec §11): drag left to reveal a red 80 px "Unsave" action;
 * releasing past 50% of the row commits, past 40 px leaves it open, otherwise it closes.
 * While open, tapping the row closes it instead of opening the item.
 */
export function SwipeToUnsave({ children, onUnsave, label }: { children: ReactNode; onUnsave: () => void; label: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const actionOpacity = useTransform(x, (v) => (v < -0.5 ? 1 : 0));
  const lock = useRef<"x" | "y" | null>(null);
  const draggedAt = useRef(0);
  const [open, setOpen] = useState(false);
  const busy = useRef(false);

  function snap(to: number) {
    setOpen(to !== 0);
    animate(x, to, SPRING);
  }

  async function commit() {
    if (busy.current) return;
    busy.current = true;
    const el = outer.current;
    const w = el?.offsetWidth ?? 390;
    await animate(x, -w, { duration: 0.2, ease: EASE });
    if (el) {
      el.style.height = `${el.offsetHeight}px`;
      el.style.overflow = "hidden";
      await animate(el, { height: 0 }, { duration: 0.2, ease: EASE });
    }
    onUnsave();
  }

  const bind = useDrag(
    ({ first, last, canceled, movement: [mx, my], cancel }) => {
      if (busy.current) return;
      if (first) lock.current = null;
      if (!lock.current) {
        if (Math.hypot(mx, my) < AXIS_LOCK) return;
        lock.current = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        if (lock.current === "y") return cancel();
      }
      if (lock.current !== "x") return;
      draggedAt.current = Date.now();
      const w = outer.current?.offsetWidth ?? 390;
      const next = Math.min(0, (open ? -ACTION_WIDTH : 0) + mx);
      if (!last && !canceled) return void x.set(next);
      if (!canceled && -next > w * COMMIT_FRACTION) void commit();
      else snap(-next > OPEN_AT ? -ACTION_WIDTH : 0);
    },
    { filterTaps: true, pointer: { capture: false } },
  );

  return (
    <div ref={outer} className="relative overflow-hidden">
      {/* The action sits behind the row and is revealed as the row slides left (invisible at
          rest, so no red hairline shows at row edges). */}
      <motion.div style={{ opacity: actionOpacity }} className="absolute inset-0 flex justify-end bg-danger">
        <button
          type="button"
          onClick={() => void commit()}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          aria-label={`Unsave ${label}`}
          className="flex h-full w-20 items-center justify-center font-semibold text-white"
        >
          Unsave
        </button>
      </motion.div>
      <motion.div
        {...(bind() as object)}
        style={{ x, touchAction: "pan-y" }}
        onClickCapture={(e) => {
          // A swipe's release, or a tap while the action is showing, isn't "open the item".
          if (Date.now() - draggedAt.current < 250 || open) {
            e.preventDefault();
            e.stopPropagation();
            if (open) snap(0);
          }
        }}
        className="relative bg-background select-none"
      >
        {children}
      </motion.div>
    </div>
  );
}
