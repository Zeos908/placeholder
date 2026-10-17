import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Wordmark } from "@/components/common/Wordmark";
import { Button } from "@/components/ui/button";
import { displayNameOf, notify, TITLES } from "@/lib/server/notify";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invite · placeholder" };
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  requested: "Friend request sent. You'll be friends once they accept.",
  already_pending: "There's already a friend request between you two.",
  already_friends: "You're already friends.",
  self: "This is your own invite link. Share it with friends!",
  blocked: "This invite can't be used.",
};

/**
 * Public invite landing page (build spec §8): shows who invited you. Signed in, it sends them
 * a friend request automatically; they still have to accept.
 */
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const [{ data: inviter }, { data: auth }] = await Promise.all([
    supabase.rpc("invite_lookup", { p_code: code }).maybeSingle<{
      user_id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    }>(),
    supabase.auth.getUser(),
  ]);

  let result: string | null = null;
  if (inviter && auth.user) {
    const { data, error } = await supabase.rpc("redeem_invite", { p_code: code });
    result = error ? null : (data as string);
    if (result === "requested") {
      const name = await displayNameOf(auth.user.id);
      await notify(inviter.user_id, "friend_request", { actor_id: auth.user.id }, { title: name, body: TITLES.friend_request, url: "/friends" });
    }
  }

  const name = inviter?.display_name || (inviter ? `@${inviter.username}` : "");
  return (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-10">
      <section className="mx-auto w-full max-w-[350px] space-y-5 rounded-sm border border-border px-8 pt-10 pb-8 text-center">
        <h1 className="flex justify-center pb-2">
          <Wordmark size={44} />
        </h1>
        {!inviter ? (
          <>
            <p className="text-sm text-muted-foreground">This invite link isn&apos;t valid anymore.</p>
            <Button asChild variant="gradient" className="h-9 w-full">
              <Link href={auth.user ? "/feed" : "/signup"}>{auth.user ? "Go to placeholder" : "Sign up"}</Link>
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <Avatar url={inviter.avatar_url} name={name} size={88} />
              <p className="font-semibold">{name}</p>
              <p className="text-sm text-muted-foreground">@{inviter.username} invited you to placeholder</p>
            </div>
            {auth.user ? (
              <>
                <p role="status" className="text-sm">
                  {result ? (MESSAGES[result] ?? "Done.") : "Couldn't send a friend request. Try again."}
                </p>
                <Button asChild variant="gradient" className="h-9 w-full">
                  <Link href="/friends">Go to Friends</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Find internships, volunteering, events and scholarships, and see what your friends are saving.
                </p>
                <Button asChild variant="gradient" className="h-9 w-full">
                  <Link href={`/signup?next=/invite/${encodeURIComponent(code)}`}>Sign up to add {name}</Link>
                </Button>
                <p className="text-sm">
                  Have an account?{" "}
                  <Link href={`/login?next=/invite/${encodeURIComponent(code)}`} className="font-semibold text-link">
                    Log in
                  </Link>
                </p>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
