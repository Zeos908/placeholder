"use client";

import { useEffect, useState } from "react";

export interface KeyboardViewport {
  height: number;
  offsetTop: number;
}

/**
 * The visible area while a phone's on-screen keyboard is open (spec §12.2), or null when it's
 * closed. Pin a full-height layout to this so the chat input sits right above the keyboard.
 */
export function useKeyboardViewport(): KeyboardViewport | null {
  const [vp, setVp] = useState<KeyboardViewport | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const open = window.innerHeight - vv.height > 120; // keyboard (not just browser chrome)
      setVp(open ? { height: Math.round(vv.height), offsetTop: Math.round(vv.offsetTop) } : null);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return vp;
}
