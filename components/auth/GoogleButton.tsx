"use client";

import { useState } from "react";
import { GoogleIcon } from "@/components/icons";
import { Button } from "@/components/legacy-ui";
import { createClient } from "@/lib/supabase/client";

/** Starts Google OAuth; Supabase redirects back to /auth/callback, then on to `next`. */
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
      <Button type="button" variant="secondary" className="w-full" pending={pending} onClick={start}>
        {!pending && <GoogleIcon />}
        {label}
      </Button>
      {error && (
        <p className="text-center text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-4 py-1 text-xs font-semibold text-muted-foreground" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      OR
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
