"use client";

import { useActionState, useState } from "react";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import { signUp, type AuthState } from "../actions";

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  const [email, setEmail] = useState(state.email ?? "");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState(false);

  if (state.message) {
    return (
      <p role="status" className="rounded-lg bg-surface px-3 py-3 text-center text-sm">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <AuthField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <AuthField
        label="Password (8+ characters)"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <label className="flex items-start gap-2.5 py-1 text-[13px] text-muted-foreground">
        <input
          type="checkbox"
          name="age"
          required
          checked={age}
          onChange={(e) => setAge(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[#DD2A7B]"
        />
        <span>I&apos;m 13 or older.</span>
      </label>
      <Button
        type="submit"
        variant="gradient"
        className="h-9 w-full"
        disabled={pending || !email || password.length < 8 || !age}
      >
        {pending ? "Signing up…" : "Sign up"}
      </Button>
      {state.error && (
        <p role="alert" className="pt-2 text-center text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
