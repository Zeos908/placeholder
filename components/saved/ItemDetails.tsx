"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";
import { TypeBadge } from "@/components/common/TypeBadge";
import { PostMedia } from "@/components/feed/PostMedia";
import { Checklist } from "@/components/saved/Checklist";
import { Reminders } from "@/components/saved/Reminders";
import { StatusPill, StatusSheet } from "@/components/saved/StatusSheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSwipeActions } from "@/lib/feed";
import { deadlineInfo, gradeRangeLabel } from "@/lib/format";
import { qk } from "@/lib/queries";
import { useHideFromFriends } from "@/lib/saved";
import type { ListingDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const NOT_LISTED = "Not listed";

function money(l: ListingDetail["listing"]) {
  return l.compensation_text ?? (l.amount_usd ? `$${l.amount_usd.toLocaleString()}` : null);
}

/** Details tab of a saved item (spec §12.1). */
export function ItemDetails({ detail }: { detail: ListingDetail }) {
  const { listing } = detail;
  const [statusOpen, setStatusOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hide = useHideFromFriends();
  const actions = useSwipeActions();
  const queryClient = useQueryClient();
  const saved = detail.state === "saved";
  const due = deadlineInfo(listing.deadline);
  const description = listing.description ?? listing.summary ?? "";
  const longDescription = description.split("\n").length > 8 || description.length > 480;

  const dates = listing.starts_at
    ? `${format(new Date(listing.starts_at), "MMM d, yyyy")}${listing.ends_at ? ` – ${format(new Date(listing.ends_at), "MMM d, yyyy")}` : ""}`
    : null;

  return (
    <div className="mx-auto max-w-[600px] pb-10">
      {/* 1. media */}
      <PostMedia listing={listing} group="detail" />

      <div className="space-y-5 px-4 pt-4">
        {/* 2. title, org, type */}
        <div className="space-y-1.5">
          <h2 className="text-xl leading-[26px] font-bold">{listing.title}</h2>
          <div className="flex items-center gap-2">
            <span className="truncate text-muted-foreground">{listing.org_name}</span>
            <TypeBadge type={listing.type} />
          </div>
        </div>

        {/* 3. status */}
        {saved && detail.app_status ? (
          <StatusPill status={detail.app_status} onClick={() => setStatusOpen(true)} className="h-8 px-3 text-sm" />
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2.5">
            <span className="text-muted-foreground">This isn&apos;t in your Saved list.</span>
            <Button
              variant="gradient"
              size="sm"
              onClick={() =>
                actions
                  .swipe({ ...listing, saved: false, friends_saved: detail.friends_saved }, "right", { removeNow: true })
                  .request.then(() => queryClient.invalidateQueries({ queryKey: qk.listing(listing.id) }))
              }
            >
              Save
            </Button>
          </div>
        )}

        {/* 4. info grid */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Info label="Deadline">
            {listing.deadline ? (
              <>
                {format(new Date(listing.deadline), "EEE, MMM d, yyyy")}
                <span className={cn("block text-xs", due.urgent ? "font-semibold text-danger" : "text-muted-foreground")}>
                  {due.label}
                </span>
              </>
            ) : (
              "Rolling"
            )}
          </Info>
          <Info label="Location">{listing.is_remote ? "Remote" : (listing.location_text ?? NOT_LISTED)}</Info>
          <Info label="Dates">{dates ?? NOT_LISTED}</Info>
          <Info label="Compensation">{money(listing) ?? NOT_LISTED}</Info>
          <Info label="Eligibility">{listing.eligibility_text ?? NOT_LISTED}</Info>
          <Info label="Grade range">{gradeRangeLabel(listing.grade_min, listing.grade_max) ?? "Any"}</Info>
        </dl>

        {/* 5. description */}
        {description && (
          <div>
            <p className={cn("whitespace-pre-line", !expanded && "line-clamp-8")}>{description}</p>
            {longDescription && (
              <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 text-muted-foreground">
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {/* 6. open original */}
        <Button asChild variant="gradient" className="h-11 w-full text-[15px]">
          <a href={listing.url} target="_blank" rel="noopener noreferrer">
            Open original listing <ExternalLink />
          </a>
        </Button>

        {/* 7. hide from friends */}
        {saved && (
          <label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3">
            <span>
              <span className="block font-medium">Hide from friends</span>
              <span className="block text-xs text-muted-foreground">Friends won&apos;t see that you saved this.</span>
            </span>
            <Switch
              checked={detail.hidden_from_friends}
              onCheckedChange={(hidden) => hide.mutate({ listingId: listing.id, hidden })}
              aria-label="Hide from friends"
            />
          </label>
        )}

        {/* 8. checklist */}
        <Checklist listingId={listing.id} items={detail.checklist} />

        {/* 9. reminders */}
        {saved && <Reminders listing={listing} reminders={detail.reminders} />}
      </div>

      <StatusSheet
        listingId={listing.id}
        current={detail.app_status}
        open={statusOpen}
        onOpenChange={setStatusOpen}
      />
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
