"use client";

import { addDays, format, isAfter, startOfDay, subDays } from "date-fns";
import { Bell, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAddReminder, useDeleteReminder } from "@/lib/saved";
import type { Listing, Reminder } from "@/lib/types";

const fmt = (iso: string) => format(new Date(iso), "EEE, MMM d · h:mm a");

/** Upcoming reminders with delete, and "Add reminder" (spec §12.1). */
export function Reminders({ listing, reminders }: { listing: Listing; reminders: Reminder[] }) {
  const del = useDeleteReminder(listing.id);
  const [adding, setAdding] = useState(false);
  const [openedAt] = useState(() => Date.now()); // render must be pure; "upcoming" as of opening
  const upcoming = reminders
    .filter((r) => !r.sent_at && new Date(r.remind_at).getTime() > openedAt)
    .sort((a, b) => a.remind_at.localeCompare(b.remind_at));

  return (
    <section id="reminders" aria-labelledby="reminders-heading" className="scroll-mt-4 space-y-2">
      <h3 id="reminders-heading" className="text-base font-semibold">
        Reminders
      </h3>
      {upcoming.length === 0 ? (
        <p className="text-muted-foreground">No reminders yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {upcoming.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <Bell className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.title}</span>
                <span className="block text-xs text-muted-foreground">{fmt(r.remind_at)}</span>
              </span>
              <button
                type="button"
                aria-label={`Delete reminder: ${r.title}`}
                onClick={() => del.mutate(r.id)}
                disabled={r.id.startsWith("temp-")}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="surface" className="h-10 w-full" onClick={() => setAdding(true)}>
        <Plus /> Add reminder
      </Button>
      <AddReminderSheet listing={listing} open={adding} onOpenChange={setAdding} />
    </section>
  );
}

function defaultDate(listing: Listing) {
  const tomorrow = startOfDay(addDays(new Date(), 1));
  if (!listing.deadline) return tomorrow;
  const twoBefore = startOfDay(subDays(new Date(listing.deadline), 2));
  return isAfter(twoBefore, tomorrow) ? twoBefore : tomorrow;
}

function AddReminderSheet({
  listing,
  open,
  onOpenChange,
}: {
  listing: Listing;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const add = useAddReminder(listing.id);
  const ids = { title: useId(), date: useId(), time: useId() };
  const [title, setTitle] = useState(`Apply: ${listing.title}`);
  const [date, setDate] = useState(() => format(defaultDate(listing), "yyyy-MM-dd"));
  const [time, setTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);

  function save() {
    const at = new Date(`${date}T${time}`);
    if (!title.trim()) return setError("Give the reminder a title.");
    if (Number.isNaN(at.getTime())) return setError("Pick a date and time.");
    if (at.getTime() <= Date.now()) return setError("Pick a time in the future.");
    setError(null);
    add.mutate({ remind_at: at.toISOString(), title: title.trim() });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-[470px] rounded-t-2xl bg-surface-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Add reminder</SheetTitle>
          <SheetDescription>We&apos;ll notify you here and with a push notification if you&apos;ve turned them on.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4">
          <label htmlFor={ids.title} className="block space-y-1.5">
            <span className="text-sm font-medium">Title</span>
            <Input id={ids.title} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="h-10 bg-surface" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label htmlFor={ids.date} className="block space-y-1.5">
              <span className="text-sm font-medium">Date</span>
              <Input id={ids.date} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 bg-surface" />
            </label>
            <label htmlFor={ids.time} className="block space-y-1.5">
              <span className="text-sm font-medium">Time</span>
              <Input id={ids.time} type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 bg-surface" />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button variant="gradient" className="h-11 w-full" onClick={save}>
            Save reminder
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
