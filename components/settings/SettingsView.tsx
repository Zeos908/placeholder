"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useActionState, useEffect, useId, useState, type ReactNode } from "react";
import { signOut } from "@/app/(auth)/actions";
import { deleteAccount, type DeleteState } from "@/app/actions/profile";
import { Avatar } from "@/components/Avatar";
import { ErrorState } from "@/components/common/EmptyState";
import { TextInput } from "@/components/common/Field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useUpdateMe } from "@/lib/me";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";
import { useMe } from "@/lib/queries";
import { usePrefs } from "@/lib/store";
import type { Theme } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Settings (spec §17): Account · Preferences · Notifications · Privacy, then Sign out / Delete. */
export function SettingsView() {
  const { data: me, isPending, isError, refetch } = useMe();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isPending) return <SettingsSkeleton />;
  if (isError || !me) return <ErrorState message="Couldn't load your settings." onRetry={() => refetch()} />;

  return (
    <div className="pb-10">
      <Group title="Account">
        <RowLink href="/settings/profile" label="Edit profile">
          <Avatar url={me.avatar_url} name={me.display_name || me.username} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Edit profile</span>
            <span className="block truncate text-muted-foreground">@{me.username}</span>
          </span>
        </RowLink>
        {me.email && (
          <Row>
            <span className="flex-1 text-muted-foreground">Email</span>
            <span className="truncate">{me.email}</span>
          </Row>
        )}
      </Group>

      <Group title="Preferences">
        <ThemeRow initial={me.theme} />
        <SoundRow />
        <ShareSavesRow on={me.share_saves} />
      </Group>

      <Group title="Notifications">
        <PushRow />
      </Group>

      <Group title="Privacy">
        <BlockedRow />
      </Group>

      <Group title="About">
        <RowLink href="/privacy" label="Privacy Policy">
          <span className="flex-1">Privacy Policy</span>
        </RowLink>
        <RowLink href="/terms" label="Terms of Service">
          <span className="flex-1">Terms of Service</span>
        </RowLink>
      </Group>

      <div className="mt-6 space-y-1 border-t border-border pt-4">
        <form action={signOut}>
          <button type="submit" className="w-full px-4 py-3 text-left font-semibold text-link">
            Sign out
          </button>
        </form>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="w-full px-4 py-3 text-left font-semibold text-danger"
        >
          Delete account
        </button>
      </div>

      <DeleteAccountDialog username={me.username} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="pt-5">
      <h2 className="px-4 pb-1.5 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <div className="divide-y divide-border border-y border-border">{children}</div>
    </section>
  );
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-12 items-center gap-3 px-4 py-2.5", className)}>{children}</div>;
}

function RowLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link href={href} aria-label={label} className="flex min-h-12 items-center gap-3 px-4 py-2.5 hover:bg-surface">
      {children}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function ThemeRow({ initial }: { initial: Theme }) {
  const { theme, setTheme } = useTheme();
  const update = useUpdateMe();
  const current = (theme as Theme | undefined) ?? initial;

  return (
    <Row className="flex-col items-stretch gap-2">
      <span id="theme-label">Theme</span>
      <div role="radiogroup" aria-labelledby="theme-label" className="grid grid-cols-3 rounded-lg bg-surface p-1">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={current === t.value}
            onClick={() => {
              setTheme(t.value);
              update.mutate({ theme: t.value });
            }}
            className={cn(
              "h-8 rounded-md text-sm font-medium transition",
              current === t.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </Row>
  );
}

function SoundRow() {
  const soundEnabled = usePrefs((s) => s.soundEnabled);
  const setSoundEnabled = usePrefs((s) => s.setSoundEnabled);
  return (
    <Row>
      <label htmlFor="sound-effects" className="flex-1">
        Sound effects
      </label>
      <Switch id="sound-effects" checked={soundEnabled} onCheckedChange={setSoundEnabled} />
    </Row>
  );
}

function ShareSavesRow({ on }: { on: boolean }) {
  const update = useUpdateMe();
  return (
    <Row>
      <label htmlFor="share-saves" className="flex-1">
        <span className="block">Share my saves with friends</span>
        <span className="block text-xs text-muted-foreground">You can also hide single items from their page.</span>
      </label>
      <Switch id="share-saves" checked={on} onCheckedChange={(v) => update.mutate({ share_saves: v })} />
    </Row>
  );
}

const PUSH_TEXT: Partial<Record<PushState, string>> = {
  unsupported: "This browser doesn't support push notifications.",
  unconfigured: "Push notifications aren't set up on this server yet.",
  denied: "Notifications are blocked. Allow them in your browser settings.",
};

function PushRow() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    getPushState().then((s) => alive && setState(s), () => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      setState(state === "on" ? await disablePush() : await enablePush());
    } catch {
      setState(await getPushState().catch(() => "unsupported" as const));
    } finally {
      setBusy(false);
    }
  }

  const note = state ? PUSH_TEXT[state] : undefined;
  return (
    <Row>
      <span className="min-w-0 flex-1">
        <span className="block">Push notifications</span>
        <span className="block text-xs text-muted-foreground">{note ?? "Reminders and friend activity on this device."}</span>
      </span>
      {state === "on" ? (
        <Button variant="surface" size="sm" onClick={toggle} disabled={busy} aria-label="Turn push notifications off">
          On
        </Button>
      ) : (
        <Button
          variant="gradient"
          size="sm"
          onClick={toggle}
          disabled={busy || !state || state === "unsupported" || state === "unconfigured" || state === "denied"}
        >
          Enable push notifications
        </Button>
      )}
    </Row>
  );
}

function BlockedRow() {
  const { data } = useQuery({ queryKey: ["blocked"], queryFn: api.blocked });
  return (
    <RowLink href="/settings/blocked" label="Blocked users">
      <span className="flex-1">Blocked users</span>
      {data && <span className="text-muted-foreground">{data.length}</span>}
    </RowLink>
  );
}

function DeleteAccountDialog({
  username,
  open,
  onOpenChange,
}: {
  username: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});
  const [typed, setTyped] = useState("");
  const id = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your profile, saves, chats, reminders and friends. It can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <label htmlFor={id} className="block space-y-1.5 text-sm">
            <span>
              Type <span className="font-semibold">{username}</span> to confirm
            </span>
            <TextInput
              id={id}
              name="confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="h-10" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="h-10 flex-1"
              disabled={pending || typed.trim().replace(/^@/, "").toLowerCase() !== username.toLowerCase()}
            >
              Delete my account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading settings" className="space-y-6 px-4 pt-6">
      {[3, 3, 1, 1].map((rows, g) => (
        <div key={g} className="space-y-2" aria-hidden>
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
