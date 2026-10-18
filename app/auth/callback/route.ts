import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/public-origin";
import { safeNext } from "@/lib/safe-next";

// Lands here after Google sign-in (PKCE `code`) and from email links (`code` or `token_hash`).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Not request.nextUrl.origin: behind Render's proxy that is http://localhost:10000.
  const origin = publicOrigin(request);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    // Email links in the token_hash form (magic link, confirm signup), which also work when the
    // link is opened in a different browser than the one that asked for it.
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const reason = searchParams.get("error_description") ?? "That sign-in link didn't work. Try again.";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
}
