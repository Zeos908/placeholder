"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export interface AuthState {
  error?: string;
  message?: string;
  email?: string;
}

const credentials = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

// Supabase's messages are written for developers; these are for students.
function friendly(message: string): string {
  console.error("[auth]", message);
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox for the link.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Log in instead.";
  if (m.includes("email address") && (m.includes("invalid") || m.includes("not authorized")))
    return "That email address can't be used. Check it and try again.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Wait a minute and try again.";
  if (m.includes("password")) return message;
  return "Something went wrong. Try again.";
}

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? process.env.APP_URL ?? "http://localhost:3000";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendly(error.message), email };

  redirect(safeNext(formData.get("next")));
}

const signUpSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Use at least 8 characters for your password.")
    .max(72, "Passwords can be at most 72 characters."),
  age: z.literal("on", { error: "You need to be 13 or older to use placeholder." }),
});

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    age: formData.get("age") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: friendly(error.message), email };

  // With "Confirm email" off in Supabase, sign-up returns a session right away.
  if (data.session) redirect("/onboarding");

  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "An account with this email already exists. Log in instead.", email };
  }
  return {
    message: `We sent a confirmation link to ${parsed.data.email}. Open it on this device to finish signing up.`,
    email,
  };
}

/**
 * "Continue as guest": a Supabase anonymous account (no email). The database flags it as a
 * guest, skips onboarding, hides it from other people and blocks friend/share features.
 */
export async function continueAsGuest(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const next = safeNext(formData.get("next"));
  if (process.env.NEXT_PUBLIC_MOCK_API === "1") redirect(next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("[auth] guest sign-in:", error.message);
    const m = error.message.toLowerCase();
    if (m.includes("anonymous") && (m.includes("disabled") || m.includes("not enabled")))
      return { error: "Guest access isn't turned on yet. Sign up or log in instead." };
    if (m.includes("rate limit") || m.includes("too many"))
      return { error: "Too many guest sessions from this network. Try again in a while, or sign up." };
    return { error: "Couldn't start a guest session. Try again." };
  }
  redirect(next);
}

export async function signOut() {
  if (process.env.NEXT_PUBLIC_MOCK_API === "1") redirect("/feed"); // the mock user can't sign out
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
