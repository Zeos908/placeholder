import { z } from "zod";
import { TAGS } from "@/lib/tags";

export const USERNAME_RE = /^[A-Za-z0-9_.]{3,30}$/;
export const BIO_MAX = 300;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Every profile field a user can edit (onboarding + Settings). All optional in a partial update. */
export const profileUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .regex(USERNAME_RE, "3–30 characters: letters, numbers, underscores and periods."),
    display_name: optionalText(60),
    avatar_url: z.url().nullable(),
    grade_level: z.number().int().min(9).max(17).nullable(),
    school: optionalText(120),
    zip: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .refine((v) => v === null || /^\d{5}$/.test(v), "Enter a 5-digit US zip code."),
    radius_miles: z.number().int().min(5).max(100),
    interests: z.array(z.enum(TAGS)).max(TAGS.length),
    skills: z.array(z.string().trim().min(1).max(40)).max(20),
    bio: optionalText(BIO_MAX),
    share_saves: z.boolean(),
    theme: z.enum(["system", "light", "dark"]),
    timezone: z.string().refine(isTimeZone, "Unknown time zone."),
  })
  .partial();

// Interests arrive as plain strings from the client; the schema rejects anything not in TAGS.
export type ProfileUpdate = Omit<z.input<typeof profileUpdateSchema>, "interests"> & {
  interests?: string[];
};
