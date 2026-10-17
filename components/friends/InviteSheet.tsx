"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy, Share } from "lucide-react";
import { useTheme } from "next-themes";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api";

/** Invite sheet (spec §13): QR code, the invite link with Copy, and native Share when available. */
export function InviteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data } = useQuery({ queryKey: ["invite"], queryFn: api.invite, enabled: open, staleTime: Infinity });
  const url = data?.url;
  const dark = useTheme().resolvedTheme === "dark";
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast("Invite link copied");
    } catch {
      toast("Couldn't copy the link.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-[470px] items-center rounded-t-2xl bg-surface-2 pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="items-center text-center">
          <span aria-hidden className="mb-1 h-1 w-10 rounded-full bg-border" />
          <SheetTitle>Invite friends</SheetTitle>
          <SheetDescription>They&apos;ll send you a friend request when they sign up.</SheetDescription>
        </SheetHeader>
        <div className="flex size-[252px] items-center justify-center rounded-2xl border border-border bg-background">
          {url ? (
            <QRCodeSVG
              value={url}
              size={220}
              // Concrete colors: SVG fill attributes don't reliably resolve CSS variables.
              bgColor={dark ? "#000000" : "#FFFFFF"}
              fgColor={dark ? "#F5F5F5" : "#0A0A0A"}
              level="M"
              title="Invite QR code"
            />
          ) : (
            <span className="skeleton-shimmer size-[220px] rounded-lg" />
          )}
        </div>
        <div className="flex w-full max-w-[360px] items-center gap-2 rounded-lg bg-surface px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm" data-testid="invite-url">
            {url ?? "…"}
          </span>
          <Button variant="ghost" size="sm" onClick={copy} disabled={!url} aria-label="Copy invite link">
            <Copy /> Copy
          </Button>
        </div>
        {canShare && (
          <Button
            variant="gradient"
            className="h-11 w-full max-w-[360px]"
            disabled={!url}
            onClick={() => url && navigator.share({ title: "Join me on placeholder", url }).catch(() => {})}
          >
            <Share /> Share
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
