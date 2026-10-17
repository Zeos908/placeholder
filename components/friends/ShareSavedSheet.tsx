"use client";

import { useState } from "react";
import { Thumb } from "@/components/common/Thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useShare } from "@/lib/friends";
import { TYPE_META } from "@/lib/opp";
import { useSaved } from "@/lib/saved";
import { cn } from "@/lib/utils";

/** The share sheet in reverse (spec §14): pick one of your saved items to send this friend. */
export function ShareSavedSheet({
  friend,
  open,
  onOpenChange,
}: {
  friend: { id: string; username: string };
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data } = useSaved("all");
  const share = useShare();
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[85dvh] max-w-[470px] flex-col gap-0 rounded-t-2xl bg-surface-2 p-0 pb-[max(12px,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="items-center border-b border-border pb-3">
          <span aria-hidden className="mb-1 h-1 w-10 rounded-full bg-border" />
          <SheetTitle>Send to @{friend.username}</SheetTitle>
          <SheetDescription>Pick something you saved.</SheetDescription>
        </SheetHeader>
        <ul role="radiogroup" aria-label="Your saved items" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {(data ?? []).length === 0 ? (
            <li className="px-3 py-6 text-center text-muted-foreground">You haven&apos;t saved anything yet.</li>
          ) : (
            data!.map(({ listing }) => (
              <li key={listing.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={picked === listing.id}
                  onClick={() => setPicked(listing.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left",
                    picked === listing.id ? "bg-surface" : "hover:bg-surface",
                  )}
                >
                  <Thumb listing={listing} size={44} className="rounded-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{listing.title}</span>
                    <span className="block truncate text-muted-foreground">
                      {listing.org_name} · {TYPE_META[listing.type].label}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="space-y-2 border-t border-border px-4 pt-3">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            placeholder="Write a message…"
            aria-label="Message"
            className="h-10 bg-surface"
          />
          <Button
            variant="gradient"
            className="h-11 w-full"
            disabled={!picked || share.isPending}
            onClick={() =>
              picked &&
              share.mutate(
                { toUserIds: [friend.id], listingId: picked, message: message.trim() || undefined },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    setPicked(null);
                    setMessage("");
                  },
                },
              )
            }
          >
            Send
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
