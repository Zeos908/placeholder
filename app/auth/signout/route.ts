import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/public-origin";
import { createClient } from "@/lib/supabase/server";

// Clears a session whose account no longer exists (e.g. deleted on another device), which would
// otherwise bounce between /login and /feed until its token expired.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login", publicOrigin(request)));
}
