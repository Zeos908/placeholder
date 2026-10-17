/** Only allow same-site relative paths as post-login destinations (no `//evil.com`, no `https:`). */
export function safeNext(value: unknown, fallback = "/feed"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.startsWith("/\\")) return fallback;
  return value;
}
