"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { checkUsername, type UsernameStatus } from "@/app/actions/profile";
import { Avatar } from "@/components/Avatar";
import { CameraIcon, CheckIcon, XIcon } from "@/components/icons";
import { Chip, Field, Input, Spinner, Textarea } from "@/components/ui";
import { uploadAvatar } from "@/lib/avatar-upload";
import { GRADE_OPTIONS } from "@/lib/grades";
import { BIO_MAX } from "@/lib/profile-schema";
import { TAGS, tagLabel, type Tag } from "@/lib/tags";

// ---------- username with live availability ----------

const STATUS_TEXT: Record<UsernameStatus, string> = {
  available: "Available",
  taken: "Already taken",
  invalid: "3–30 characters: letters, numbers, _ and .",
  yours: "This is your current username",
};

export function UsernameField({
  value,
  onChange,
  onStatus,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onStatus?: (s: UsernameStatus | "checking") => void;
  error?: string;
}) {
  const id = useId();
  // The field starts on the user's current username, so that value is known to be theirs.
  const [checked, setChecked] = useState<{ value: string; status: UsernameStatus }>({
    value,
    status: "yours",
  });
  const status: UsernameStatus | "checking" = checked.value === value ? checked.status : "checking";

  useEffect(() => {
    if (checked.value === value) return;
    let cancelled = false; // a newer keystroke wins
    const t = setTimeout(async () => {
      const s = await checkUsername(value).catch(() => "invalid" as const);
      if (!cancelled) setChecked({ value, status: s });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, checked.value]);

  // Report to the parent (it disables Save while the name is taken or still being checked).
  useEffect(() => {
    onStatus?.(status);
    // onStatus is a stable setter from the parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const good = status === "available" || status === "yours";
  return (
    <Field label="Username" htmlFor={id} error={error}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-neutral-500">
          @
        </span>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ""))}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          className="pr-9 pl-7"
          aria-describedby={`${id}-status`}
          aria-invalid={!good && status !== "checking"}
        />
        <span className="absolute top-1/2 right-3 -translate-y-1/2">
          {status === "checking" ? (
            <Spinner className="text-neutral-400" />
          ) : good ? (
            <CheckIcon className="size-4 text-green-600" />
          ) : (
            <XIcon className="size-4 text-red-600" />
          )}
        </span>
      </div>
      {!error && (
        <p
          id={`${id}-status`}
          aria-live="polite"
          className={`text-xs ${good ? "text-neutral-500" : status === "checking" ? "text-neutral-400" : "text-red-600 dark:text-red-400"}`}
        >
          {status === "checking" ? "Checking…" : STATUS_TEXT[status]}
        </p>
      )}
    </Field>
  );
}

// ---------- avatar ----------

export function AvatarPicker({
  userId,
  url,
  name,
  onChange,
}: {
  userId: string;
  url: string | null;
  name: string;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadAvatar(userId, file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="group relative rounded-full focus-visible:ring-2 focus-visible:ring-accent-2 focus-visible:outline-none"
        aria-label={url ? "Change profile photo" : "Add profile photo"}
      >
        <Avatar url={url} name={name} size={72} />
        <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full border-2 border-bg bg-fg text-bg">
          {busy ? <Spinner className="size-3" /> : <CameraIcon className="size-3.5" />}
        </span>
      </button>
      <div className="space-y-1 text-sm">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="font-semibold text-accent-2"
          disabled={busy}
        >
          {url ? "Change photo" : "Add a photo"}
        </button>
        {url && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="block text-neutral-500 hover:text-fg"
            disabled={busy}
          >
            Remove
          </button>
        )}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}

// ---------- grade ----------

export function GradeSelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const id = useId();
  const groups = ["High school", "College", "Grad"] as const;
  return (
    <Field label="Grade or year" htmlFor={id}>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="h-11 w-full rounded-lg border border-line bg-neutral-50 px-3 text-sm text-fg focus:border-neutral-400 focus:outline-none dark:bg-neutral-950"
      >
        <option value="">Prefer not to say</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {GRADE_OPTIONS.filter((o) => o.group === g).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </Field>
  );
}

// ---------- interests ----------

export function InterestPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (t: Tag) =>
    onChange(value.includes(t) ? value.filter((v) => v !== t) : [...value, t]);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Interests">
      {TAGS.map((t) => (
        <Chip key={t} selected={value.includes(t)} onClick={() => toggle(t)}>
          {tagLabel(t)}
        </Chip>
      ))}
    </div>
  );
}

// ---------- skills (free-text chips) ----------

export function SkillsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add() {
    const s = draft.trim().slice(0, 40);
    if (s && value.length < 20 && !value.some((v) => v.toLowerCase() === s.toLowerCase())) {
      onChange([...value, s]);
    }
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <Field label="Skills" htmlFor={id} hint="Press Enter after each one, e.g. Python, Spanish, video editing.">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2 pb-1">
          {value.map((s) => (
            <li
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1 pr-1.5 pl-3 text-sm dark:bg-neutral-900"
            >
              {s}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== s))}
                className="rounded-full p-0.5 text-neutral-500 hover:text-fg"
                aria-label={`Remove ${s}`}
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        maxLength={40}
        placeholder={value.length >= 20 ? "20 skills max" : "Add a skill"}
        disabled={value.length >= 20}
      />
    </Field>
  );
}

// ---------- zip + radius ----------

export function LocationFields({
  zip,
  radius,
  onZip,
  onRadius,
  zipError,
}: {
  zip: string;
  radius: number;
  onZip: (v: string) => void;
  onRadius: (v: number) => void;
  zipError?: string;
}) {
  const zipId = useId();
  const radiusId = useId();
  return (
    <div className="space-y-4">
      <Field
        label="Zip code"
        htmlFor={zipId}
        error={zipError}
        hint="Used only to show nearby opportunities. Never shown to anyone."
      >
        <Input
          id={zipId}
          value={zip}
          onChange={(e) => onZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="e.g. 02139"
          className="max-w-40"
        />
      </Field>
      <div className="space-y-1.5">
        <label htmlFor={radiusId} className="flex justify-between text-sm font-medium">
          <span>How far you&apos;ll travel</span>
          <span className="text-neutral-500">{radius} mi</span>
        </label>
        <input
          id={radiusId}
          type="range"
          min={5}
          max={100}
          step={5}
          value={radius}
          onChange={(e) => onRadius(Number(e.target.value))}
          className="w-full accent-[#DD2A7B]"
        />
      </div>
    </div>
  );
}

// ---------- bio ----------

export function BioField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <Field label="Bio" htmlFor={id} hint={`${value.length}/${BIO_MAX}`}>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, BIO_MAX))}
        maxLength={BIO_MAX}
        rows={3}
        placeholder="A line or two about you and what you're looking for."
      />
    </Field>
  );
}
