"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/common/EmptyState";
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
import type { UsernameStatus } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import type { MeUpdate } from "@/lib/api";
import { errorField, useUpdateMe } from "@/lib/me";
import { useMe } from "@/lib/queries";
import type { Me } from "@/lib/types";

interface Draft {
  username: string;
  display_name: string;
  avatar_url: string | null;
  grade_level: number | null;
  school: string;
  bio: string;
  interests: string[];
  zip: string;
  radius_miles: number;
  skills: string[];
}

const fromMe = (me: Me): Draft => ({
  username: me.username,
  display_name: me.display_name ?? "",
  avatar_url: me.avatar_url,
  grade_level: me.grade_level,
  school: me.school ?? "",
  bio: me.bio ?? "",
  interests: me.interests,
  zip: me.zip ?? "",
  radius_miles: me.radius_miles,
  skills: me.skills,
});

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Edit profile (Settings → Account): every onboarding field, editable later (build spec §9.9). */
export function EditProfileView() {
  const { data: me, isPending, isError, refetch } = useMe();
  if (isPending) return <p className="p-6 text-center text-muted-foreground">Loading…</p>;
  if (isError || !me) return <ErrorState message="Couldn't load your profile." onRetry={() => refetch()} />;
  return <EditProfileForm key={me.id} me={me} />;
}

function EditProfileForm({ me }: { me: Me }) {
  const [saved, setSaved] = useState<Draft>(() => fromMe(me));
  const [d, setD] = useState<Draft>(saved);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus | "checking">("yours");
  const [errors, setErrors] = useState<{ field?: string; message: string } | null>(null);
  const update = useUpdateMe({ quiet: true });
  const ids = { name: useId(), school: useId() };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setErrors(null);
    setD((prev) => ({ ...prev, [key]: value }));
  };
  const changes = Object.fromEntries(
    (Object.keys(d) as (keyof Draft)[]).filter((k) => !same(d[k], saved[k])).map((k) => [k, d[k]]),
  ) as MeUpdate;
  const dirty = Object.keys(changes).length > 0;
  const usernameBlocked = "username" in changes && !["available", "yours"].includes(usernameStatus);
  const fieldError = (f: string) => (errors?.field === f ? errors.message : undefined);

  function save() {
    update.mutate(changes, {
      onSuccess: () => {
        setSaved(d);
        toast("Profile saved");
      },
      onError: (e) => setErrors({ field: errorField(e), message: e.message || "Couldn't save. Try again." }),
    });
  }

  return (
    <div className="space-y-8 px-4 pt-5 pb-32">
      <section className="space-y-5">
        <AvatarPicker userId={me.id} url={d.avatar_url} name={d.display_name || d.username} onChange={(url) => set("avatar_url", url)} />
        <UsernameField value={d.username} onChange={(v) => set("username", v)} onStatus={setUsernameStatus} error={fieldError("username")} />
        <Field label="Name" htmlFor={ids.name}>
          <TextInput id={ids.name} value={d.display_name} onChange={(e) => set("display_name", e.target.value)} maxLength={60} autoComplete="name" />
        </Field>
        <GradeSelect value={d.grade_level} onChange={(v) => set("grade_level", v)} />
        <Field label="School" htmlFor={ids.school}>
          <TextInput id={ids.school} value={d.school} onChange={(e) => set("school", e.target.value)} maxLength={120} autoComplete="organization" />
        </Field>
        <BioField value={d.bio} onChange={(v) => set("bio", v)} />
      </section>

      <section className="space-y-3" aria-labelledby="interests-heading">
        <div>
          <h2 id="interests-heading" className="text-base font-semibold">
            Interests
          </h2>
          <p className="text-sm text-muted-foreground">Your feed starts from these and learns from your swipes.</p>
        </div>
        <InterestPicker value={d.interests} onChange={(v) => set("interests", v)} />
      </section>

      <section className="space-y-3" aria-labelledby="location-heading">
        <h2 id="location-heading" className="text-base font-semibold">
          Location
        </h2>
        <LocationFields
          zip={d.zip}
          radius={d.radius_miles}
          onZip={(v) => set("zip", v)}
          onRadius={(v) => set("radius_miles", v)}
          zipError={fieldError("zip")}
        />
      </section>

      <SkillsInput value={d.skills} onChange={(v) => set("skills", v)} />

      {(dirty || errors) && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:left-[72px] wide:left-[244px]">
          <div className="mx-auto flex max-w-[568px] items-center gap-3">
            <p className="flex-1 text-sm" role="status" aria-live="polite">
              {errors && !["username", "zip"].includes(errors.field ?? "") ? (
                <span className="text-danger">{errors.message}</span>
              ) : (
                "You have unsaved changes."
              )}
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setD(saved);
                setErrors(null);
              }}
              disabled={update.isPending}
            >
              Discard
            </Button>
            <Button variant="gradient" onClick={save} disabled={!dirty || usernameBlocked || update.isPending}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
