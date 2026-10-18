/**
 * The origin people actually visit, for building absolute redirects.
 *
 * Behind a proxy (Render, most hosts) `request.url` is the internal address the app listens on,
 * e.g. http://localhost:10000, so redirects built from it send people to localhost. Prefer the
 * forwarded host the proxy passes along, then APP_URL when the request looks internal, then the
 * request's own origin (local dev, or a phone on the same Wi-Fi).
 */
export function publicOrigin(request: Request): string {
  const h = request.headers;
  const forwardedHost = h.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${forwardedHost}`;
  }
  const url = new URL(request.url);
  const internal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\])$/.test(url.hostname);
  if (internal && process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  return url.origin;
}
