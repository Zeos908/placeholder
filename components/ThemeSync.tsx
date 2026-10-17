"use client";

import { useEffect } from "react";
import { applyTheme, storedTheme, type Theme } from "@/lib/theme-client";

/** Brings this device in line with the theme saved on the profile (e.g. set on another device). */
export function ThemeSync({ theme }: { theme: Theme }) {
  useEffect(() => {
    if (storedTheme() !== theme) applyTheme(theme);
    if (theme !== "system") return;
    // Follow OS changes live while on "system".
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
  return null;
}
