import type { PersonSummary } from "@/lib/types";

/** Generated SVG avatar (initial on a colored circle), so fixtures need no image files. */
function avatar(name: string, hue: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},75%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},70%,45%)"/>` +
    `</linearGradient></defs><rect width="64" height="64" fill="url(#g)"/>` +
    `<text x="32" y="41" font-family="Arial,sans-serif" font-size="26" font-weight="700" fill="#fff" text-anchor="middle">${name[0].toUpperCase()}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const person = (n: number, username: string, display_name: string, hue: number): PersonSummary => ({
  id: `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`,
  username,
  display_name,
  avatar_url: avatar(display_name, hue),
});

export const ME_ID = "00000000-0000-4000-9000-000000000000";

export const FRIENDS: (PersonSummary & { school: string; grade_level: number; bio: string; interests: string[] })[] = [
  { ...person(1, "maya", "Maya Chen", 330), school: "Lincoln HS", grade_level: 11, bio: "Robotics captain. Always looking for summer STEM programs.", interests: ["stem", "engineering", "coding"] },
  { ...person(2, "leo", "Leo Martinez", 200), school: "Lincoln HS", grade_level: 12, bio: "Future med student, part-time barista.", interests: ["healthcare", "science", "community"] },
  { ...person(3, "priya", "Priya Natarajan", 270), school: "Northeast Tech University", grade_level: 14, bio: "CS + policy. Ask me about hackathons.", interests: ["coding", "government", "entrepreneurship"] },
  { ...person(4, "sam", "Sam Okafor", 30), school: "Riverside HS", grade_level: 10, bio: "Trails, dogs, and climate action.", interests: ["environment", "animals", "outdoors"] },
  { ...person(5, "jess", "Jess Kim", 160), school: "Bay Arts Academy", grade_level: 11, bio: "Cellist and poster designer.", interests: ["music", "arts", "media"] },
  { ...person(6, "noah", "Noah Bennett", 100), school: "Lincoln HS", grade_level: 12, bio: "Debate, student council, too much coffee.", interests: ["leadership", "law", "writing"] },
];

/** Sent you a friend request (the one pending request in the fixtures). */
export const REQUESTER = {
  ...person(7, "ava", "Ava Thompson", 0),
  school: "Lincoln HS",
  grade_level: 11,
  bio: "Varsity soccer, aspiring vet.",
  interests: ["animals", "sports", "science"],
};

/** Other users that only show up in username search. */
export const STRANGERS = [
  { ...person(8, "maxwell", "Max Wells", 50), school: "Eastside HS", grade_level: 9, bio: "", interests: ["sports"] },
  { ...person(9, "mariana", "Mariana Lopez", 300), school: "Riverside HS", grade_level: 12, bio: "", interests: ["writing", "media"] },
  { ...person(10, "lucas_b", "Lucas Brown", 220), school: "Midwest College", grade_level: 13, bio: "", interests: ["finance"] },
  { ...person(11, "zoe.r", "Zoe Rivera", 140), school: "Bay Arts Academy", grade_level: 10, bio: "", interests: ["arts"] },
];

export const MOCK_ME = {
  id: ME_ID,
  username: "alex",
  display_name: "Alex Rivera",
  avatar_url: avatar("Alex", 280),
  email: "alex@example.com",
  grade_level: 11,
  school: "Lincoln HS",
  zip: "02139",
  lat: 42.3647,
  lng: -71.1042,
  radius_miles: 25,
  interests: ["stem", "coding", "environment"],
  skills: ["Python", "Spanish"],
  bio: "Junior who likes building things and being outside.",
  share_saves: true,
  theme: "system" as const,
  timezone: "America/New_York",
};
