"use client";

import { Check, Link2, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFriends, useShare } from "@/lib/friends";
import { cn } from "@/lib/utils";

/**
 * Share a post with friends (spec §9.5, §13): search, friend rows with round checkboxes,
 * an optional message, and a gradient "Send to 2" button. Also "Copy link".
 */
export function ShareSheet({
  listing,
  open,
  onOpenChange,
}: {
  listing: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isPending } = useFriends();
  const share = useShare();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  const friends = (data?.friends ?? []).filter((f) => {
    const needle = q.trim().toLowerCase().replace(/^@/, "");
    return !needle || f.username.toLowerCase().includes(needle) || f.display_name?.toLowerCase().includes(needle);
  });

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setQ("");
    setSelected(new Set());
    setMessage("");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/l/${listing.id}`);
      toast("Link copied");
    } catch {
      toast("Couldn't copy the link.");
    }
  }

  function send() {
    share.mutate(
      { toUserIds: [...selected], listingId: listing.id, message: message.trim() || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          reset();
        },
      },
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[85dvh] max-w-[470px] flex-col gap-0 rounded-t-2xl bg-surface-2 p-0 pb-[max(12px,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="items-center border-b border-border pb-3">
          <span aria-hidden className="mb-1 h-1 w-10 rounded-full bg-border" />
          <SheetTitle>Share</SheetTitle>
          <SheetDescription className="max-w-full truncate">{listing.title}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pt-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search friends"
              aria-label="Search friends"
              className="h-10 bg-surface pl-9"
            />
          </label>
        </div>

        <ul aria-label="Friends" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {isPending ? (
            <li className="px-3 py-6 text-center text-muted-foreground">Loading friends…</li>
          ) : friends.length === 0 ? (
            <li className="px-3 py-6 text-center text-muted-foreground">
              {data?.friends.length ? "No friends match that." : "Add friends to share with them."}
            </li>
          ) : (
            friends.map((f) => {
              const on = selected.has(f.id);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`${f.display_name || f.username} (@${f.username})`}
                    onClick={() => toggle(f.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface"
                  >
                    <Avatar url={f.avatar_url} name={f.display_name || f.username} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{f.display_name || f.username}</span>
                      <span className="block truncate text-muted-foreground">@{f.username}</span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full border-2",
                        on ? "border-transparent bg-accent-gradient text-white" : "border-muted-foreground",
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="space-y-2 border-t border-border px-4 pt-3">
          {selected.size > 0 && (
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder="Write a message…"
              aria-label="Message"
              className="h-10 bg-surface"
            />
          )}
          <div className="flex gap-2">
            <Button variant="surface" className="h-11" onClick={copy}>
              <Link2 /> Copy link
            </Button>
            <Button
              variant="gradient"
              className="h-11 flex-1"
              disabled={!selected.size || share.isPending}
              onClick={send}
            >
              {selected.size > 1 ? `Send to ${selected.size}` : "Send"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
