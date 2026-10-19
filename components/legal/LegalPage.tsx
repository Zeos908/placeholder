import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/common/Wordmark";

/** When the current versions took effect. Update it whenever either document changes. */
export const LEGAL_EFFECTIVE_DATE = "October 19, 2026";

/**
 * Public layout for /privacy and /terms: readable without an account, so no app shell.
 * Plain server-rendered prose; the wordmark links home (login, or the feed when signed in).
 */
export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[680px] px-4 pt-6 pb-16 text-[15px] leading-6">
      <header className="flex items-center justify-between border-b border-border pb-4">
        <Link href="/" aria-label="placeholder home">
          <Wordmark size={32} />
        </Link>
        <nav aria-label="Legal" className="flex gap-4 text-sm">
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">
            Terms
          </Link>
        </nav>
      </header>
      <h1 className="mt-8 text-[28px] leading-9 font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Effective {LEGAL_EFFECTIVE_DATE}</p>
      <div className="mt-6 space-y-3">{intro}</div>
      <div className="mt-2">{children}</div>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">{children}</ul>;
}

/** Contact line: NEXT_PUBLIC_CONTACT_EMAIL when set, otherwise an honest "coming soon". */
export function Contact() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return email ? (
    <p>
      Questions or requests? Email{" "}
      <a href={`mailto:${email}`} className="font-semibold text-link">
        {email}
      </a>
      .
    </p>
  ) : (
    <p>
      Questions or requests? Contact the developer of placeholder. A dedicated contact email will be listed here before
      public launch. Until then, you can delete your account and all of its data yourself in Settings.
    </p>
  );
}
