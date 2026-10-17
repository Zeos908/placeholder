"use client";

import { useActionState, useState } from "react";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import { signIn, type AuthState } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  const [email, setEmail] = useState(state.email ?? "");
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="next" value={next} />
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
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" variant="gradient" className="mt-2 h-9 w-full" disabled={pending || !email || !password}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
      {state.error && (
        <p role="alert" className="pt-2 text-center text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
