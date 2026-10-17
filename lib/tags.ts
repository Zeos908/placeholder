// Fixed tag list (§6.2). Enrichment may only emit these; onboarding interest chips use the same list.
export const TAGS = [
  "stem",
  "coding",
  "engineering",
  "science",
  "healthcare",
  "environment",
  "animals",
  "education",
  "tutoring",
  "arts",
  "music",
  "writing",
  "media",
  "business",
  "finance",
  "law",
  "government",
  "community",
  "sports",
  "leadership",
  "research",
  "outdoors",
  "social-justice",
  "entrepreneurship",
] as const;

export type Tag = (typeof TAGS)[number];

const TAG_SET: ReadonlySet<string> = new Set(TAGS);

export function isTag(value: string): value is Tag {
  return TAG_SET.has(value);
}

/** Lowercases, drops unknown tags and duplicates, caps at `max` (enrichment allows 6). */
export function normalizeTags(values: readonly string[], max = 6): Tag[] {
  const out: Tag[] = [];
  for (const raw of values) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (isTag(t) && !out.includes(t)) out.push(t);
    if (out.length === max) break;
  }
  return out;
}

export function tagLabel(tag: Tag): string {
  return tag === "stem" ? "STEM" : tag.replace("-", " ").replace(/^\w/, (c) => c.toUpperCase());
}
