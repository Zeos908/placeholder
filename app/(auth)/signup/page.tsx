import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
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
      <section className="space-y-5 rounded-xl border border-line px-6 py-8 sm:px-8">
        <div className="space-y-2 text-center">
          <h1 className="text-accent-gradient text-4xl font-bold tracking-tight">placeholder</h1>
          <p className="text-sm text-neutral-500">
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
      </section>
      <p className="rounded-xl border border-line px-6 py-5 text-center text-sm">
        Have an account?{" "}
        <Link
          href={next === "/feed" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-accent-2"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
