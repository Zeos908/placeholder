"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { signUp, type AuthState } from "../actions";

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});

  if (state.message) return <Notice tone="success">{state.message}</Notice>;

  return (
    <form action={action} className="space-y-3">
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
        />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
      </Field>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="age"
          required
          className="mt-0.5 size-4 shrink-0 accent-[#DD2A7B]"
        />
        <span>I&apos;m 13 or older.</span>
      </label>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" className="w-full" pending={pending}>
        Sign up
      </Button>
    </form>
  );
}
