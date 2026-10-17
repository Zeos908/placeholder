"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { ReportReason } from "@/lib/types";
import { cn } from "@/lib/utils";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or scam" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "wrong_info", label: "Wrong info" },
  { value: "other", label: "Other" },
];

/** Report a listing or user (build spec §12): reason + optional details. */
export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "listing" | "user";
  targetId: string;
  targetName: string;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!reason) return;
    setPending(true);
    try {
      await api.report(targetType, targetId, reason, details.trim() || undefined);
      toast("Thanks. We'll take a look.");
      onOpenChange(false);
      setReason(null);
      setDetails("");
    } catch {
      toast("Couldn't send the report. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Report {targetType === "listing" ? "listing" : "account"}</DialogTitle>
          <DialogDescription className="truncate">Why are you reporting {targetName}?</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Reason" className="divide-y divide-border rounded-lg border border-border">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={reason === r.value}
              onClick={() => setReason(r.value)}
              className={cn("flex w-full items-center justify-between px-3 py-3 text-left", reason === r.value && "font-semibold")}
            >
              {r.label}
              <span
                className={cn(
                  "size-4 rounded-full border-2",
                  reason === r.value ? "border-foreground bg-foreground" : "border-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 500))}
          placeholder="Add details (optional)"
          aria-label="Details"
          className="bg-surface"
        />
        <Button variant="gradient" className="h-10" disabled={!reason || pending} onClick={submit}>
          Submit report
        </Button>
      </DialogContent>
    </Dialog>
  );
}
