import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// Lands here after Google sign-in and after clicking the email confirmation link (PKCE `code`).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const reason = searchParams.get("error_description") ?? "That sign-in link didn't work. Try again.";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
}
