import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { Wordmark } from "@/components/common/Wordmark";
import { isGoogleEnabled } from "@/lib/auth-providers";
import { safeNext } from "@/lib/safe-next";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Sign up · placeholder" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  // New accounts always go through onboarding first; `next` is kept for the login link.
  const next = safeNext(rawNext);
  const google = await isGoogleEnabled();

  return (
    <>
      <section className="space-y-4 rounded-sm border border-border px-8 pt-10 pb-6">
        <div className="space-y-3 pb-2 text-center">
          <h1 className="flex justify-center">
            <Wordmark size={52} />
          </h1>
          <p className="text-[15px] leading-5 font-semibold text-muted-foreground">
            Sign up to find opportunities and see what your friends are saving.
          </p>
        </div>
        {google && (
          <>
            <GoogleButton next="/onboarding" label="Sign up with Google" />
            <OrDivider />
          </>
        )}
        <SignUpForm />
        <p className="text-center text-xs leading-4 text-muted-foreground">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="font-semibold text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-foreground">
            Privacy Policy
          </Link>
          . You must be 13 or older.
        </p>
      </section>
      <p className="rounded-sm border border-border px-6 py-5 text-center text-sm">
        Have an account?{" "}
        <Link
          href={next === "/feed" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-link"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
