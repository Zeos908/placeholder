import { differenceInCalendarDays, differenceInMinutes } from "date-fns";

export { gradeLabel, gradeRangeLabel } from "@/lib/grades";

export interface DeadlineInfo {
  label: string;
  /** ≤ 3 days away: shown in --danger (spec §9.1). */
  urgent: boolean;
  /** Calendar days until the deadline; null when rolling. */
  days: number | null;
}

/** "Due today" / "Due tomorrow" / "Due in 5 days" / "Rolling" / "Closed". */
export function deadlineInfo(deadline: string | null | undefined, now = new Date()): DeadlineInfo {
  if (!deadline) return { label: "Rolling", urgent: false, days: null };
  const due = new Date(deadline);
  if (due.getTime() < now.getTime()) return { label: "Closed", urgent: false, days: -1 };
  const days = differenceInCalendarDays(due, now);
  const label = days <= 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
  return { label, urgent: days <= 3, days };
}

/** Instagram-style short relative time: "now", "5m", "2h", "3d", "6w". */
export function relativeTime(iso: string, now = new Date()): string {
  const mins = differenceInMinutes(now, new Date(iso));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
