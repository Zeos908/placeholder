import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { Wordmark } from "@/components/common/Wordmark";
import { isGoogleEnabled } from "@/lib/auth-providers";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in · placeholder" };

/** Instagram-style login (spec §17). */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; deleted?: string }>;
}) {
  const { next: rawNext, error, deleted } = await searchParams;
  const next = safeNext(rawNext);
  const google = await isGoogleEnabled();

  return (
    <>
      <section className="space-y-4 rounded-sm border border-border px-8 pt-10 pb-6">
        <h1 className="flex justify-center pb-4">
          <Wordmark size={52} />
        </h1>
        {deleted && (
          <p role="status" className="text-center text-sm text-muted-foreground">
            Your account was deleted.
          </p>
        )}
        {google && (
          <>
            <GoogleButton next={next} label="Continue with Google" />
            <OrDivider />
          </>
        )}
        <LoginForm next={next} />
        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}
      </section>
      <p className="rounded-sm border border-border px-6 py-5 text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link
          href={next === "/feed" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-link"
        >
          Sign up
        </Link>
      </p>
      <nav aria-label="Legal" className="flex justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms of Service
        </Link>
      </nav>
    </>
  );
}
