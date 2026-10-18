import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/public-origin";

// Paths reachable without signing in. Everything else requires a session.
const PUBLIC_PREFIXES = ["/login", "/signup", "/auth/", "/invite/", "/api/health", "/api/cron/"];
// Signed-in users get sent from these to the app.
const AUTH_PAGES = ["/login", "/signup"];

function isPublic(path: string) {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and gates protected routes.
 * Unauthenticated page requests go to /login?next=…; unauthenticated API calls get a 401.
 */
export async function updateSession(request: NextRequest) {
  // Mock API mode: a fake user is always signed in, and there's no Supabase to talk to.
  if (process.env.NEXT_PUBLIC_MOCK_API === "1") {
    const path = request.nextUrl.pathname;
    if (AUTH_PAGES.includes(path)) return NextResponse.redirect(new URL("/feed", publicOrigin(request)));
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Don't run code between createServerClient and getClaims: it validates and refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!signedIn && !isPublic(path)) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return redirectWithCookies(request, url, response);
  }

  if (signedIn && AUTH_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    url.search = "";
    return redirectWithCookies(request, url, response);
  }

  return response;
}

// Carries refreshed session cookies over to a redirect response.
function redirectWithCookies(request: NextRequest, url: URL, from: NextResponse) {
  // Same path and query, but on the public origin (see lib/public-origin.ts).
  const redirect = NextResponse.redirect(new URL(url.pathname + url.search, publicOrigin(request)));
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
