"use client";

import { useActionState } from "react";
import { continueAsGuest, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

/** "Continue as guest" (login and sign-up): browse, save and chat without an account. */
export function GuestButton({ next = "/feed" }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(continueAsGuest, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="next" value={next} />
      <Button type="submit" variant="surface" className="h-9 w-full" disabled={pending}>
        {pending ? "Starting…" : "Continue as guest"}
      </Button>
      {state.error && (
        <p role="alert" className="text-center text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
