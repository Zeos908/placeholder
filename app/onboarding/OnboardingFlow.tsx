"use client";

import { useId, useState, useTransition } from "react";
import { completeOnboarding, updateProfile, type ActionResult } from "@/app/actions/profile";
import {
  AvatarPicker,
  BioField,
  GradeSelect,
  InterestPicker,
  LocationFields,
  SkillsInput,
  UsernameField,
} from "@/components/profile/fields";
import { Wordmark } from "@/components/common/Wordmark";
import { Button, Field, Input, Notice } from "@/components/legacy-ui";
import type { UsernameStatus } from "@/app/actions/profile";

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
  const fieldError = (name: string) =>
    result && !result.ok && result.field === name ? result.error : undefined;

  // Fields saved by each step's "Next" button.
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

  function finish() {
    startTransition(() => completeOnboarding(timeZone()));
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

  function skip() {
    setResult(null);
    if (last) finish();
    else setStep((s) => s + 1);
  }

  const usernameBlocked = step === 0 && !["available", "yours"].includes(usernameStatus);

  return (
    <main className="flex min-h-dvh flex-col px-4 pt-4 pb-6">
      <header className="flex items-center justify-between py-2">
        <Wordmark size={30} />
        <button
          type="button"
          onClick={finish}
          disabled={pending}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Skip setup
        </button>
      </header>

      <div
        className="mt-2 flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={step + 1}
        aria-label={`Step ${step + 1} of ${STEPS.length}`}
      >
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent-gradient" : "bg-border"}`}
          />
        ))}
      </div>

      <section className="mt-8 flex-1 space-y-6" aria-live="polite">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="text-2xl font-bold">{STEPS[step].title}</h1>
          <p className="text-sm text-muted-foreground">{STEPS[step].subtitle}</p>
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
              <Input
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
              <Input
                id={schoolId}
                value={d.school}
                onChange={(e) => set("school", e.target.value)}
                maxLength={120}
                autoComplete="organization"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <InterestPicker value={d.interests} onChange={(v) => set("interests", v)} />
        )}

        {step === 3 && (
          <div className="space-y-5">
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
          <Notice tone="error">{result.error}</Notice>
        )}
      </section>

      <footer className="mt-8 flex items-center gap-3">
        {step > 0 && (
          <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            Back
          </Button>
        )}
        <Button type="button" variant="secondary" className="ml-auto" onClick={skip} disabled={pending}>
          Skip
        </Button>
        <Button type="button" onClick={next} pending={pending} disabled={usernameBlocked}>
          {last ? "Finish" : "Next"}
        </Button>
      </footer>
    </main>
  );
}
