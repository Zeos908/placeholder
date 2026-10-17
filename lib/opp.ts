import type { AppStatus, OppType } from "@/lib/types";

/** Per-type display data (spec §4, §9.3). Gradients run from the type color's 400 to 700 shade. */
export const TYPE_META: Record<
  OppType,
  { label: string; emoji: string; color: string; gradient: string }
> = {
  internship: { label: "Internship", emoji: "💼", color: "#3B82F6", gradient: "from-blue-400 to-blue-700" },
  volunteer: { label: "Volunteer", emoji: "🤝", color: "#22C55E", gradient: "from-green-400 to-green-700" },
  event: { label: "Event", emoji: "🎟️", color: "#A855F7", gradient: "from-purple-400 to-purple-700" },
  scholarship: { label: "Scholarship", emoji: "🎓", color: "#F59E0B", gradient: "from-amber-400 to-amber-700" },
};

export const STATUS_META: Record<AppStatus, { label: string; color: string }> = {
  interested: { label: "Interested", color: "#737373" },
  applying: { label: "Applying", color: "#3B82F6" },
  applied: { label: "Applied", color: "#A855F7" },
  accepted: { label: "Accepted", color: "#22C55E" },
  rejected: { label: "Rejected", color: "#ED4956" },
};
