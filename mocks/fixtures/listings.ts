import type { Listing, OppType } from "@/lib/types";

/**
 * 40 fixture listings, 10 per type (front-end spec §20). Organizations are fictional.
 * Deadlines are relative to load time and include today, tomorrow, 3 days, 10 days and none.
 */

type Row = [
  type: OppType,
  title: string,
  org: string,
  tags: string[],
  place: keyof typeof PLACES,
  dueDays: number | null,
  comp: string | null,
  amount: number | null,
  grades: [number, number],
  summary: string,
];

const PLACES = {
  remote: { location_text: null, lat: null, lng: null, is_remote: true },
  boston: { location_text: "Boston, MA", lat: 42.3601, lng: -71.0589, is_remote: false },
  cambridge: { location_text: "Cambridge, MA", lat: 42.3736, lng: -71.1097, is_remote: false },
  somerville: { location_text: "Somerville, MA", lat: 42.3876, lng: -71.0995, is_remote: false },
  newyork: { location_text: "New York, NY", lat: 40.7128, lng: -74.006, is_remote: false },
  chicago: { location_text: "Chicago, IL", lat: 41.8781, lng: -87.6298, is_remote: false },
  austin: { location_text: "Austin, TX", lat: 30.2672, lng: -97.7431, is_remote: false },
  sf: { location_text: "San Francisco, CA", lat: 37.7749, lng: -122.4194, is_remote: false },
  atlanta: { location_text: "Atlanta, GA", lat: 33.749, lng: -84.388, is_remote: false },
} as const;

const ROWS: Row[] = [
  // ---------- internships ----------
  ["internship", "Summer Rocketry Lab Intern", "Orbital Youth Lab", ["stem", "engineering", "research"], "boston", 5, "$18/hr", null, [11, 14], "Build and test model rocket payloads alongside lab engineers for eight weeks this summer."],
  ["internship", "Junior Web Developer Intern", "Brightline Studio", ["coding", "media"], "remote", 12, "$20/hr", null, [12, 16], "Ship real features on a small product team using React and TypeScript, fully remote."],
  ["internship", "Hospital Patient Experience Intern", "Lakeside Community Health", ["healthcare", "community"], "chicago", 0, "School credit", null, [11, 13], "Shadow care teams and help improve how patients and families experience hospital visits."],
  ["internship", "Climate Data Research Assistant", "Greenfield Climate Institute", ["environment", "science", "research", "coding"], "cambridge", 25, "$19/hr", null, [11, 16], "Clean and map local climate data and present findings to the research team in August."],
  ["internship", "Marketing & Social Media Intern", "Corner Bakehouse Co.", ["business", "media", "writing"], "austin", 9, "$15/hr", null, [11, 16], "Plan posts, shoot short videos, and track what works for a growing neighborhood bakery chain."],
  ["internship", "City Hall Policy Intern", "Office of Civic Innovation", ["government", "law", "leadership"], "newyork", 40, "Stipend $1,500", 1500, [12, 16], "Research local policy questions and brief staff on what residents are asking for."],
  ["internship", "Finance Analyst Summer Intern", "Harborview Capital Partners", ["finance", "business"], "boston", 60, "$28/hr", null, [14, 16], "Build models and market summaries with a small investment team over ten weeks."],
  ["internship", "Wildlife Rehab Intern", "Cedar Ridge Wildlife Center", ["animals", "environment", "outdoors"], "atlanta", null, null, null, [10, 16], "Care for injured native animals and help prepare them for release. Rolling applications."],
  ["internship", "Game Design Intern", "Pixel Harbor Games", ["coding", "arts", "media"], "sf", 3, "$22/hr", null, [12, 16], "Prototype levels and playtest new mechanics with an indie studio for the summer."],
  ["internship", "Legal Aid Clinic Intern", "Northside Legal Aid", ["law", "social-justice", "community"], "chicago", 30, "$17/hr", null, [13, 17], "Help a legal aid team prepare intake files and support residents at weekly clinics."],

  // ---------- volunteering ----------
  ["volunteer", "Riverside Cleanup Crew", "Riverkeepers Alliance", ["environment", "outdoors", "community"], "cambridge", 6, null, null, [9, 17], "Join a Saturday crew pulling trash and invasive plants from the river trail. Gloves provided."],
  ["volunteer", "Homework Help Tutor", "Open Door Learning Center", ["tutoring", "education", "community"], "somerville", null, null, null, [10, 17], "Tutor elementary students in reading and math two afternoons a week after school."],
  ["volunteer", "Animal Shelter Weekend Helper", "Second Chance Paws", ["animals", "community"], "boston", 14, null, null, [9, 17], "Walk dogs, socialize cats, and help adoption events run smoothly on weekends."],
  ["volunteer", "Virtual Coding Mentor", "CodeBridge Youth", ["coding", "tutoring", "stem"], "remote", 21, null, null, [11, 17], "Mentor middle schoolers through their first Scratch and Python projects over video calls."],
  ["volunteer", "Food Bank Packing Shifts", "Harvest Table Food Bank", ["community", "social-justice"], "chicago", null, null, null, [9, 17], "Pack and sort food boxes for families in need; shifts every weekday evening."],
  ["volunteer", "Hospital Volunteer Program", "St. Brigid Medical Center", ["healthcare", "community"], "boston", 1, null, null, [10, 16], "Greet visitors, deliver supplies, and support nurses on non-clinical tasks."],
  ["volunteer", "Community Mural Painter", "Eastside Arts Collective", ["arts", "community"], "sf", 10, null, null, [9, 17], "Help design and paint a neighborhood mural over three weekends this fall."],
  ["volunteer", "Voter Registration Volunteer", "Every Voice Civic Project", ["government", "leadership", "social-justice"], "remote", 8, null, null, [11, 17], "Phone-bank and text new voters with registration info from anywhere."],
  ["volunteer", "Trail Restoration Weekend", "High Country Trails", ["outdoors", "environment", "sports"], "austin", 35, null, null, [10, 17], "Rebuild eroded hiking trails with a crew leader; camping and meals provided."],
  ["volunteer", "Senior Center Tech Buddy", "Golden Years Center", ["community", "education", "coding"], "somerville", 3, null, null, [9, 17], "Help older adults set up phones, video calls, and email in friendly one-on-one sessions."],

  // ---------- events ----------
  ["event", "City Youth Hackathon", "HackTheCity", ["coding", "stem", "entrepreneurship"], "boston", 4, "Free; prizes", null, [9, 16], "A 24-hour hackathon for students with mentors, workshops, food, and $5k in prizes."],
  ["event", "College Essay Workshop", "Pathway Admissions Lab", ["writing", "education"], "remote", 7, "Free", null, [11, 12], "Live online workshop on brainstorming and drafting a strong personal statement."],
  ["event", "Women in Engineering Day", "Northeast Tech University", ["engineering", "stem", "leadership"], "cambridge", 16, "Free", null, [9, 12], "Hands-on labs, campus tours, and a panel of engineers sharing how they got started."],
  ["event", "Startup Pitch Night", "Founders Garage", ["entrepreneurship", "business"], "sf", 11, "$10 ticket", null, [11, 17], "Watch student founders pitch, then network with local investors and mentors."],
  ["event", "Youth Climate Summit", "Greenfield Climate Institute", ["environment", "leadership", "government"], "boston", 0, "Free", null, [9, 16], "A day of workshops on organizing climate projects at your school and in your city."],
  ["event", "Medical School Open House", "Midwest College of Medicine", ["healthcare", "science"], "chicago", 45, "Free", null, [13, 17], "Tour simulation labs and hear from current med students about the path to medicine."],
  ["event", "Poetry Slam Open Mic", "Lantern Writers House", ["writing", "arts", "music"], "atlanta", null, "Free", null, [9, 17], "Monthly open mic for young poets and musicians. Sign up at the door."],
  ["event", "Robotics Build Weekend", "Gearworks Makerspace", ["engineering", "stem", "coding"], "somerville", 3, "$25, scholarships available", null, [9, 12], "Build and program a small robot over one weekend; take it home at the end."],
  ["event", "Virtual Career Fair: Public Service", "Civic Careers Network", ["government", "law", "community"], "remote", 20, "Free", null, [13, 17], "Meet recruiters from public agencies and nonprofits hiring interns and new grads."],
  ["event", "Youth Orchestra Open Rehearsal", "Bay Youth Symphony", ["music", "arts"], "sf", 13, "Free", null, [9, 12], "Sit in on a rehearsal and meet section leaders before spring auditions."],

  // ---------- scholarships ----------
  ["scholarship", "Future STEM Leaders Scholarship", "Brightpath Foundation", ["stem", "leadership"], "remote", 1, "$5,000", 5000, [12, 12], "A $5,000 award for seniors planning to study science, technology, engineering, or math."],
  ["scholarship", "Community Service Award", "Neighbors United Fund", ["community", "leadership"], "remote", 30, "$1,000", 1000, [9, 12], "Recognizes students who have led a service project in their community."],
  ["scholarship", "First-Gen College Scholarship", "Open Gates Foundation", ["education", "social-justice"], "remote", 21, "$2,500 renewable", 2500, [12, 13], "Renewable award for first-generation students heading to a two- or four-year college."],
  ["scholarship", "Young Writers Prize", "Lantern Writers House", ["writing", "arts"], "remote", 10, "$750", 750, [9, 12], "Submit a short story or essay up to 2,000 words for a cash prize and publication."],
  ["scholarship", "Healthcare Heroes Scholarship", "Lakeside Community Health", ["healthcare", "science"], "chicago", 50, "$3,000", 3000, [12, 16], "Supports students pursuing nursing, pre-med, or public health at an Illinois college."],
  ["scholarship", "Women in Coding Scholarship", "CodeBridge Youth", ["coding", "stem"], "remote", 15, "$4,000", 4000, [12, 16], "Award plus a summer mentor for women and nonbinary students studying computing."],
  ["scholarship", "Environmental Stewardship Grant", "Riverkeepers Alliance", ["environment", "research", "outdoors"], "remote", 75, "Up to $2,000", 2000, [10, 16], "Project grant for students who propose a local environmental improvement project."],
  ["scholarship", "Young Entrepreneurs Award", "Founders Garage", ["entrepreneurship", "business", "finance"], "remote", 26, "$2,000", 2000, [10, 14], "For students who have started a business, club, or product. Include a short pitch video."],
  ["scholarship", "Arts & Music Merit Scholarship", "Bay Youth Symphony", ["music", "arts"], "sf", 40, "$1,500", 1500, [11, 12], "Merit award for student artists and musicians; submit a portfolio or recording."],
  ["scholarship", "Student Athlete Scholar Award", "Hometown Sports League", ["sports", "leadership", "education"], "remote", null, "$1,000", 1000, [12, 12], "Recognizes senior athletes who balance sports, grades, and community involvement. Rolling."],
];

export const listingId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Deadline at 11:59 PM local time, `days` from today. */
function dueAt(days: number): string {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function buildListings(): Listing[] {
  const now = Date.now();
  return ROWS.map(([type, title, org, tags, place, dueDays, comp, amount, [gmin, gmax], summary], i) => {
    const n = i + 1;
    const p = PLACES[place];
    const eligibility =
      gmin >= 13 ? "College students." : gmax <= 12 ? `High school grades ${gmin}–${gmax}.` : "High school and college students.";
    const deadline = dueDays === null ? null : dueAt(dueDays);
    return {
      id: listingId(n),
      url: `https://example.com/opportunities/${n}`,
      title,
      org_name: org,
      org_logo_url: null,
      type,
      description: `${summary}\n\nWhat you'll do: work alongside experienced mentors, take on a real project, and share what you learned at the end.\n\nThis is sample data for development; the organization is fictional.`,
      summary,
      tags,
      ...p,
      grade_min: gmin,
      grade_max: gmax,
      eligibility_text: eligibility,
      deadline,
      starts_at: type === "event" && dueDays !== null ? dueAt(dueDays + 3) : null,
      ends_at: null,
      compensation_text: comp,
      amount_usd: amount,
      image_url: null,
      image_alt: null,
      // Stagger creation over the last two weeks.
      created_at: new Date(now - ((n * 7) % 330) * 3_600_000).toISOString(),
    };
  });
}
