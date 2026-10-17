import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { Wordmark } from "@/components/common/Wordmark";
import { Notice } from "@/components/legacy-ui";
import { isGoogleEnabled } from "@/lib/auth-providers";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in · placeholder" };

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
      <section className="space-y-5 rounded-xl border border-border px-6 py-8 sm:px-8">
        <div className="space-y-2 text-center">
          <h1 className="flex justify-center">
            <Wordmark size={52} />
          </h1>
          <p className="text-sm text-muted-foreground">
            Internships, volunteering, events and scholarships, picked for you.
          </p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {deleted && <Notice tone="success">Your account was deleted.</Notice>}
        {google && (
          <>
            <GoogleButton next={next} label="Continue with Google" />
            <OrDivider />
          </>
        )}
        <LoginForm next={next} />
      </section>
      <p className="rounded-xl border border-border px-6 py-5 text-center text-sm">
        New here?{" "}
        <Link
          href={next === "/feed" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-link"
        >
          Sign up
        </Link>
      </p>
    </>
  );
}
