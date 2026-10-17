import "server-only";
import type { Listing, ListingSummary, SavedItem } from "@/lib/types";

/** Listing columns the client sees (no source, dedupe hash, prompts, or status). */
export const LISTING_COLUMNS =
  "id, url, title, org_name, org_logo_url, type, description, summary, tags, location_text, lat, lng, is_remote, grade_min, grade_max, eligibility_text, deadline, starts_at, ends_at, compensation_text, amount_usd, image_url, image_alt, created_at";

export const SUMMARY_COLUMNS = "id, title, type, org_name, image_url, image_alt, deadline";

export function toListing(row: Record<string, unknown>): Listing {
  const l = row as unknown as Listing;
  return { ...l, tags: l.tags ?? [], amount_usd: l.amount_usd === null ? null : Number(l.amount_usd) };
}

export function toSummary(row: Record<string, unknown>): ListingSummary {
  const l = row as unknown as ListingSummary;
  return {
    id: l.id,
    title: l.title,
    type: l.type,
    org_name: l.org_name,
    image_url: l.image_url,
    image_alt: l.image_alt,
    deadline: l.deadline,
  };
}

/** Saved list order (spec §9.6): soonest deadline first, no-deadline items last. */
export function byDeadline(a: SavedItem, b: SavedItem) {
  const da = a.listing.deadline;
  const db = b.listing.deadline;
  if (!da) return db ? 1 : 0;
  if (!db) return -1;
  return da.localeCompare(db);
}
