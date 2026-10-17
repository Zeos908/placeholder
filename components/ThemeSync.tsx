"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export type Theme = "system" | "light" | "dark";

/** Brings this device in line with the theme saved on the profile (e.g. set on another device). */
export function ThemeSync({ theme }: { theme: Theme }) {
  const { theme: current, setTheme } = useTheme();
  useEffect(() => {
    if (current && current !== theme) setTheme(theme);
    // Only re-sync when the profile's value changes, not on every local toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  return null;
}
