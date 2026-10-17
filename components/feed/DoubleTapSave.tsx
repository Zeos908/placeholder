"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSwipeContext } from "@/components/feed/SwipeWrapper";

const DOUBLE_TAP_MS = 300;

/**
 * Double-tap media → save (spec §9.2) with the bookmark "pop". A single tap fires only after the
 * 300 ms double-tap window, so a double-tap never also toggles video sound.
 */
export function DoubleTapSave({
  children,
  onDoubleTap,
  onSingleTap,
  label,
}: {
  children: ReactNode;
  onDoubleTap: () => void;
  onSingleTap?: () => void;
  label: string;
}) {
  const swipe = useSwipeContext();
  const lastTap = useRef(0);
  const singleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pop, setPop] = useState(0);

  useEffect(() => () => void (singleTimer.current && clearTimeout(singleTimer.current)), []);

  const lastDouble = useRef(0);

  function fireDouble() {
    if (singleTimer.current) clearTimeout(singleTimer.current);
    singleTimer.current = null;
    lastTap.current = 0;
    // A mouse double-click can deliver two clicks *and* a dblclick; count it once.
    if (Date.now() - lastDouble.current < DOUBLE_TAP_MS + 100) return;
    lastDouble.current = Date.now();
    setPop((n) => n + 1);
    onDoubleTap();
  }

  function onClick() {
    if (swipe?.dragged()) return; // the release of a swipe isn't a tap
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) return fireDouble();
    lastTap.current = now;
    if (onSingleTap) {
      singleTimer.current = setTimeout(() => {
        singleTimer.current = null;
        onSingleTap();
      }, DOUBLE_TAP_MS);
    }
  }

  return (
    <div
      onClick={onClick}
      onDoubleClick={() => !swipe?.dragged() && fireDouble()}
      data-testid="post-media"
      aria-label={label}
      className="relative"
    >
      {children}
      <AnimatePresence>
        {pop > 0 && (
          <motion.span
            key={pop}
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0, opacity: 1 }}
            // 0 → 1.2 → 1 over 250 ms, hold 300 ms, fade out 200 ms.
            animate={{ scale: [0, 1.2, 1, 1, 1], opacity: [1, 1, 1, 1, 0] }}
            transition={{ duration: 0.75, times: [0, 0.16, 0.333, 0.733, 1], ease: "easeOut" }}
            onAnimationComplete={() => setPop(0)}
          >
            <Bookmark className="size-24 fill-white text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]" />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
