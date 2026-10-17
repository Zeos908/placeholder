"use client";

import { ChevronLeft } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { completeOnboarding, updateProfile, type ActionResult, type UsernameStatus } from "@/app/actions/profile";
import { Field, TextInput } from "@/components/common/Field";
import {
  AvatarPicker,
  BioField,
  GradeSelect,
  InterestPicker,
  LocationFields,
  SkillsInput,
  UsernameField,
} from "@/components/profile/fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Draft {
  username: string;
  display_name: string;
  avatar_url: string | null;
  grade_level: number | null;
  school: string;
  interests: string[];
  zip: string;
  radius_miles: number;
  skills: string[];
  bio: string;
}

const STEPS = [
  { title: "Set up your profile", subtitle: "Pick a username so friends can find you." },
  { title: "Where are you in school?", subtitle: "We'll skip opportunities you aren't eligible for." },
  { title: "What are you into?", subtitle: "Pick as many as you like. Your feed learns from your swipes too." },
  { title: "A few more details", subtitle: "Location helps us show in-person opportunities near you." },
] as const;

const INLINE_ERROR_FIELDS = ["username", "zip"];

function timeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * Onboarding (spec §17): 4 steps, progress dots, "Skip" top-right on every step, a big gradient
 * Next pinned to the bottom ("Start exploring" on the last). Only the username is required.
 */
export function OnboardingFlow({ userId, initial }: { userId: string; initial: Draft }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(initial);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus | "checking">("yours");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const displayNameId = useId();
  const schoolId = useId();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const last = step === STEPS.length - 1;
  const fieldError = (name: string) => (result && !result.ok && result.field === name ? result.error : undefined);

  // Fields saved by each step's Next.
  function stepPayload() {
    switch (step) {
      case 0:
        return {
          ...(d.username !== initial.username && { username: d.username }),
          ...(d.avatar_url !== initial.avatar_url && { avatar_url: d.avatar_url }),
          display_name: d.display_name,
        };
      case 1:
        return { grade_level: d.grade_level, school: d.school };
      case 2:
        return { interests: d.interests };
      default:
        return { zip: d.zip, radius_miles: d.radius_miles, skills: d.skills, bio: d.bio };
    }
  }

  function next() {
    startTransition(async () => {
      const res = await updateProfile(stepPayload());
      setResult(res);
      if (!res.ok) return;
      if (last) await completeOnboarding(timeZone());
      else setStep((s) => s + 1);
    });
  }

  // Skip this step without saving it (on the last step, finish).
  function skip() {
    setResult(null);
    if (last) startTransition(() => completeOnboarding(timeZone()));
    else setStep((s) => s + 1);
  }

  const usernameBlocked = step === 0 && !["available", "yours"].includes(usernameStatus);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[470px] flex-col px-4 pt-3">
      <header className="grid grid-cols-[44px_1fr_44px] items-center py-2">
        {step > 0 ? (
          <button
            type="button"
            aria-label="Back"
            onClick={() => setStep((s) => s - 1)}
            disabled={pending}
            className="flex size-10 items-center justify-center rounded-full hover:bg-surface"
          >
            <ChevronLeft className="size-6" />
          </button>
        ) : (
          <span />
        )}
        <div
          className="flex justify-center gap-2"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label={`Step ${step + 1} of ${STEPS.length}`}
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn("size-2 rounded-full transition-colors", i <= step ? "bg-accent-gradient" : "bg-border")}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={skip}
          disabled={pending}
          className="justify-self-end text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Skip
        </button>
      </header>

      <section className="flex-1 space-y-6 pt-6 pb-28" aria-live="polite">
        <div className="space-y-1">
          <h1 className="text-[22px] leading-7 font-bold">{STEPS[step].title}</h1>
          <p className="text-muted-foreground">{STEPS[step].subtitle}</p>
        </div>

        {step === 0 && (
          <div className="space-y-5">
            <AvatarPicker
              userId={userId}
              url={d.avatar_url}
              name={d.display_name || d.username}
              onChange={(url) => set("avatar_url", url)}
            />
            <UsernameField
              value={d.username}
              onChange={(v) => set("username", v)}
              onStatus={setUsernameStatus}
              error={fieldError("username")}
            />
            <Field label="Name" htmlFor={displayNameId} hint="Optional. Shown to friends.">
              <TextInput
                id={displayNameId}
                value={d.display_name}
                onChange={(e) => set("display_name", e.target.value)}
                maxLength={60}
                autoComplete="name"
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <GradeSelect value={d.grade_level} onChange={(v) => set("grade_level", v)} />
            <Field label="School" htmlFor={schoolId} hint="Optional.">
              <TextInput
                id={schoolId}
                value={d.school}
                onChange={(e) => set("school", e.target.value)}
                maxLength={120}
                autoComplete="organization"
              />
            </Field>
          </div>
        )}

        {step === 2 && <InterestPicker value={d.interests} onChange={(v) => set("interests", v)} />}

        {step === 3 && (
          <div className="space-y-6">
            <LocationFields
              zip={d.zip}
              radius={d.radius_miles}
              onZip={(v) => set("zip", v)}
              onRadius={(v) => set("radius_miles", v)}
              zipError={fieldError("zip")}
            />
            <SkillsInput value={d.skills} onChange={(v) => set("skills", v)} />
            <BioField value={d.bio} onChange={(v) => set("bio", v)} />
          </div>
        )}

        {/* Username and zip show their errors inline; everything else shows here. */}
        {result && !result.ok && !INLINE_ERROR_FIELDS.includes(result.field ?? "") && (
          <p role="alert" className="text-sm text-danger">
            {result.error}
          </p>
        )}
      </section>

      <footer className="fixed inset-x-0 bottom-0 bg-background/95 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-[438px]">
          <Button variant="gradient" className="h-12 w-full text-base" onClick={next} disabled={pending || usernameBlocked}>
            {pending ? "Saving…" : last ? "Start exploring" : "Next"}
          </Button>
        </div>
      </footer>
    </main>
  );
}
