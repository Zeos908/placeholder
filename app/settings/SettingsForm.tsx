"use client";

import { useActionState, useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { signOut } from "@/app/(auth)/actions";
import {
  deleteAccount,
  unblockUser,
  updateProfile,
  type ActionResult,
  type DeleteState,
  type UsernameStatus,
} from "@/app/actions/profile";
import { Avatar } from "@/components/Avatar";
import {
  AvatarPicker,
  BioField,
  GradeSelect,
  InterestPicker,
  LocationFields,
  SkillsInput,
  UsernameField,
} from "@/components/profile/fields";
import { Button, Field, Input, Notice, cx } from "@/components/ui";
import type { Profile } from "@/lib/profile";
import { applyTheme, type Theme } from "@/lib/theme-client";

export interface BlockedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Editable {
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

function editableFrom(p: Profile): Editable {
  return {
    username: p.username,
    display_name: p.display_name ?? "",
    avatar_url: p.avatar_url,
    grade_level: p.grade_level,
    school: p.school ?? "",
    bio: p.bio ?? "",
    interests: p.interests ?? [],
    zip: p.zip ?? "",
    radius_miles: p.radius_miles ?? 25,
    skills: p.skills ?? [],
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function SettingsForm({
  profile,
  email,
  blocked,
}: {
  profile: Profile;
  email: string | null;
  blocked: BlockedUser[];
}) {
  const [saved, setSaved] = useState<Editable>(() => editableFrom(profile));
  const [d, setD] = useState<Editable>(saved);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus | "checking">("yours");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const nameId = useId();
  const schoolId = useId();

  const set = <K extends keyof Editable>(key: K, value: Editable[K]) => {
    setResult(null);
    setD((prev) => ({ ...prev, [key]: value }));
  };

  const changes = useMemo(() => {
    const out: Partial<Editable> = {};
    for (const key of Object.keys(d) as (keyof Editable)[]) {
      if (!same(d[key], saved[key])) Object.assign(out, { [key]: d[key] });
    }
    return out;
  }, [d, saved]);
  const dirty = Object.keys(changes).length > 0;
  const blockedByUsername = "username" in changes && !["available", "yours"].includes(usernameStatus);
  const fieldError = (name: string) =>
    result && !result.ok && result.field === name ? result.error : undefined;

  function save() {
    startTransition(async () => {
      const res = await updateProfile(changes);
      setResult(res);
      if (res.ok) setSaved(d);
    });
  }

  return (
    <div className="space-y-2 pb-28">
      <Section title="Profile">
        <AvatarPicker
          userId={profile.id}
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
        <Field label="Name" htmlFor={nameId}>
          <Input
            id={nameId}
            value={d.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            maxLength={60}
            autoComplete="name"
          />
        </Field>
        <GradeSelect value={d.grade_level} onChange={(v) => set("grade_level", v)} />
        <Field label="School" htmlFor={schoolId}>
          <Input
            id={schoolId}
            value={d.school}
            onChange={(e) => set("school", e.target.value)}
            maxLength={120}
            autoComplete="organization"
          />
        </Field>
        <BioField value={d.bio} onChange={(v) => set("bio", v)} />
      </Section>

      <Section title="Interests" description="Your feed starts from these and learns from your swipes.">
        <InterestPicker value={d.interests} onChange={(v) => set("interests", v)} />
      </Section>

      <Section title="Location">
        <LocationFields
          zip={d.zip}
          radius={d.radius_miles}
          onZip={(v) => set("zip", v)}
          onRadius={(v) => set("radius_miles", v)}
          zipError={fieldError("zip")}
        />
      </Section>

      <Section title="Skills">
        <SkillsInput value={d.skills} onChange={(v) => set("skills", v)} />
      </Section>

      <PrivacySection initial={profile.share_saves} />
      <AppearanceSection initial={profile.theme} />
      <BlockedSection initial={blocked} />
      <AccountSection email={email} username={saved.username} />

      {(dirty || result) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-[438px] items-center gap-3">
            <p className="flex-1 text-sm" role="status" aria-live="polite">
              {result && !result.ok ? (
                <span className="text-red-600 dark:text-red-400">{result.error}</span>
              ) : dirty ? (
                "You have unsaved changes."
              ) : (
                "Saved."
              )}
            </p>
            {dirty && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setD(saved);
                    setResult(null);
                  }}
                  disabled={pending}
                >
                  Discard
                </Button>
                <Button type="button" onClick={save} pending={pending} disabled={blockedByUsername}>
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-b border-line px-4 py-6">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50",
        checked ? "bg-accent-gradient" : "bg-neutral-300 dark:bg-neutral-700",
      )}
    >
      <span
        className={cx(
          "inline-block size-5 rounded-full bg-white shadow transition",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

// Toggles save immediately; on failure they flip back.
function PrivacySection({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(v: boolean) {
    setOn(v);
    setError(null);
    startTransition(async () => {
      const res = await updateProfile({ share_saves: v });
      if (!res.ok) {
        setOn(!v);
        setError(res.error);
      }
    });
  }

  return (
    <Section title="Privacy">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Show my saves to friends</p>
          <p className="mt-0.5 text-sm text-neutral-500">
            When off, friends can&apos;t see anything you save. You can also hide single items from
            their detail page.
          </p>
        </div>
        <Switch checked={on} onChange={change} label="Show my saves to friends" disabled={pending} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </Section>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function AppearanceSection({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [error, setError] = useState<string | null>(null);

  function change(t: Theme) {
    const previous = theme;
    setTheme(t);
    setError(null);
    applyTheme(t);
    updateProfile({ theme: t }).then((res) => {
      if (!res.ok) {
        setTheme(previous);
        applyTheme(previous);
        setError(res.error);
      }
    });
  }

  return (
    <Section title="Appearance">
      <div className="grid grid-cols-3 rounded-lg border border-line p-1" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={theme === t.value}
            onClick={() => change(t.value)}
            className={cx(
              "h-9 rounded-md text-sm font-medium transition",
              theme === t.value ? "bg-fg text-bg" : "text-neutral-500 hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </Section>
  );
}

function BlockedSection({ initial }: { initial: BlockedUser[] }) {
  const [users, setUsers] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unblock(id: string) {
    setBusy(id);
    setError(null);
    const res = await unblockUser(id);
    setBusy(null);
    if (res.ok) setUsers((u) => u.filter((x) => x.id !== id));
    else setError(res.error);
  }

  return (
    <Section title="Blocked accounts">
      {users.length === 0 ? (
        <p className="text-sm text-neutral-500">You haven&apos;t blocked anyone.</p>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3">
              <Avatar url={u.avatar_url} name={u.display_name || u.username} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">@{u.username}</p>
                {u.display_name && <p className="truncate text-sm text-neutral-500">{u.display_name}</p>}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-9"
                pending={busy === u.id}
                onClick={() => unblock(u.id)}
              >
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Section>
  );
}

function AccountSection({ email, username }: { email: string | null; username: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});
  const confirmId = useId();

  return (
    <Section title="Account">
      {email && (
        <p className="text-sm">
          Signed in as <span className="font-medium">{email}</span>
        </p>
      )}
      <form action={signOut}>
        <Button type="submit" variant="secondary" className="w-full">
          Log out
        </Button>
      </form>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-red-600 dark:text-red-400"
        >
          Delete account…
        </button>
      ) : (
        <form action={action} className="space-y-3 rounded-lg border border-red-300 p-4 dark:border-red-900">
          <p className="text-sm">
            This permanently deletes your profile, saves, chats, reminders and friends. It can&apos;t
            be undone.
          </p>
          <Field label={`Type ${username} to confirm`} htmlFor={confirmId} error={state.error}>
            <Input id={confirmId} name="confirm" autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </Field>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" className="flex-1" pending={pending}>
              Delete my account
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}
