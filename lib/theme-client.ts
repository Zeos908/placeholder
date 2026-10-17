export type Theme = "system" | "light" | "dark";

/** Applies a theme to <html> and remembers it for the pre-paint script in app/layout.tsx. */
export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Storage blocked (private mode): the class below still applies for this page view.
  }
  const dark =
    theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" || t === "system" ? t : null;
  } catch {
    return null;
  }
}
