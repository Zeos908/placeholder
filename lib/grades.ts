// Grade levels stored as ints (§5): 9–12 = HS grades, 13–16 = college years 1–4, 17 = grad.
export const GRADE_OPTIONS = [
  { value: 9, label: "9th grade", group: "High school" },
  { value: 10, label: "10th grade", group: "High school" },
  { value: 11, label: "11th grade", group: "High school" },
  { value: 12, label: "12th grade", group: "High school" },
  { value: 13, label: "College year 1", group: "College" },
  { value: 14, label: "College year 2", group: "College" },
  { value: 15, label: "College year 3", group: "College" },
  { value: 16, label: "College year 4", group: "College" },
  { value: 17, label: "Grad school", group: "Grad" },
] as const;

export type GradeLevel = (typeof GRADE_OPTIONS)[number]["value"];

export function gradeLabel(level: number | null | undefined): string | null {
  return GRADE_OPTIONS.find((g) => g.value === level)?.label ?? null;
}

/** Short label for a listing's eligible range, e.g. "Grades 11–12" or "College". */
export function gradeRangeLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const lo = min ?? 9;
  const hi = max ?? 17;
  if (lo >= 13 && hi <= 16) return "College";
  if (lo >= 9 && hi <= 12) return lo === hi ? `Grade ${lo}` : `Grades ${lo}–${hi}`;
  return `${gradeLabel(lo) ?? lo} – ${gradeLabel(hi) ?? hi}`;
}
