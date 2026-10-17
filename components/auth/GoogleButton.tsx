"use client";

import { useState } from "react";
import { GoogleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/** "Continue with Google" (spec §17): white, bordered, Google "G". Supabase returns to /auth/callback. */
export function GoogleButton({ next, label }: { next: string; label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    // On success the browser navigates away, so we only get here on failure.
    if (error) {
      setError("Google sign-in isn't available right now. Use email instead.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="h-[38px] w-full border-border bg-white font-semibold text-[#0A0A0A] hover:bg-neutral-50 dark:bg-white dark:text-[#0A0A0A] dark:hover:bg-neutral-100"
        disabled={pending}
        onClick={start}
      >
        <GoogleIcon />
        {label}
      </Button>
      {error && (
        <p className="text-center text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-4 py-1 text-[13px] font-semibold text-muted-foreground" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      OR
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
