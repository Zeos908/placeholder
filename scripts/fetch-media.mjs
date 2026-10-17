#!/usr/bin/env node
/**
 * Gives every listing a photo or a short portrait video from Pexels (pexels.com/api).
 *
 *   npm run media:fetch              listings without media only
 *   npm run media:fetch -- --force   redo all of them
 *   npm run media:fetch -- --dry-run show what would be picked, change nothing
 *
 * Needs PEXELS_API_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * About half the listings try for a video first (clips of 3–19 s only); anything without a good
 * clip gets a photo. Media is linked from Pexels' CDN; each listing stores a creator credit.
 */
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const DRY = args.has("--dry-run");
const MAX_SECONDS = 19; // "less than 20 seconds"
const MIN_SECONDS = 3;

const { PEXELS_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
for (const [k, v] of Object.entries({ PEXELS_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) {
    console.error(`Missing ${k} in .env.local`);
    process.exit(1);
  }
}
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Words that describe the listing format rather than what's in the picture.
const GENERIC = new Set(
  "intern internship program scholarship award prize grant merit summer weekend shifts helper assistant crew day night virtual open the and of for in a & : - junior future young first-gen".split(
    " ",
  ),
);
const TAG_PHRASES = {
  stem: "students science lab",
  coding: "students coding laptop",
  engineering: "students building robot",
  research: "scientist laboratory research",
  science: "science laboratory",
  healthcare: "hospital nurse",
  environment: "nature cleanup volunteers",
  outdoors: "hiking trail forest",
  animals: "animal shelter dog",
  arts: "painting art studio",
  music: "orchestra musicians",
  writing: "writing notebook",
  law: "courthouse law books",
  government: "city hall government",
  business: "young professionals meeting",
  finance: "finance charts laptop",
  entrepreneurship: "startup pitch presentation",
  sports: "student athlete running",
  tutoring: "tutoring student homework",
  education: "college students studying",
  community: "community volunteers",
  leadership: "student leader speaking",
  media: "content creator camera",
  "social-justice": "community rally",
};
const TYPE_PHRASES = {
  internship: "young professional office",
  volunteer: "volunteers helping",
  event: "students conference event",
  scholarship: "graduation students",
};

function queriesFor(l) {
  const words = l.title
    .toLowerCase()
    .replace(/[^a-z0-9& -]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !GENERIC.has(w));
  const qs = [];
  if (words.length) qs.push(words.join(" "));
  if (words.length > 2) qs.push(words.slice(-2).join(" "));
  for (const t of l.tags ?? []) if (TAG_PHRASES[t]) qs.push(TAG_PHRASES[t]);
  qs.push(TYPE_PHRASES[l.type]);
  return [...new Set(qs)];
}

/** FNV-1a: same listing → same photo/video choice on every run. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

async function pexels(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://api.pexels.com${path}`, { headers: { Authorization: PEXELS_API_KEY } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error("Pexels rejected the API key (check PEXELS_API_KEY).");
    if (!res.ok) throw new Error(`Pexels ${res.status} for ${path}`);
    return res.json();
  }
  throw new Error("Pexels rate limit; try again in a few minutes.");
}

const usedVideos = new Set();
const usedPhotos = new Set();

/** A portrait mp4 around 720 px wide: sharp on phones without being huge. */
function pickFile(files) {
  const mp4 = files.filter((f) => f.file_type === "video/mp4" && f.height > f.width && f.width >= 360);
  if (!mp4.length) return null;
  const good = mp4.filter((f) => f.width >= 540 && f.width <= 1080).sort((a, b) => Math.abs(a.width - 720) - Math.abs(b.width - 720));
  return good[0] ?? mp4.sort((a, b) => a.width - b.width)[0];
}

async function findVideo(l) {
  for (const q of queriesFor(l)) {
    const data = await pexels(`/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=20`);
    const options = (data.videos ?? [])
      .filter((v) => v.duration >= MIN_SECONDS && v.duration <= MAX_SECONDS && !usedVideos.has(v.id))
      .map((v) => ({ v, file: pickFile(v.video_files ?? []) }))
      .filter((o) => o.file);
    if (!options.length) continue;
    const { v, file } = options[hash(l.id) % Math.min(options.length, 5)];
    usedVideos.add(v.id);
    return {
      query: q,
      seconds: v.duration,
      row: {
        video_url: file.link,
        image_url: v.image,
        image_alt: l.title,
        media_credit: `Video by ${v.user?.name ?? "a Pexels creator"} on Pexels`,
        media_credit_url: v.url,
      },
    };
  }
  return null;
}

async function findPhoto(l) {
  for (const q of queriesFor(l)) {
    const data = await pexels(`/v1/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=20`);
    const options = (data.photos ?? []).filter((p) => !usedPhotos.has(p.id));
    if (!options.length) continue;
    const p = options[hash(l.id) % Math.min(options.length, 5)];
    usedPhotos.add(p.id);
    return {
      query: q,
      row: {
        video_url: null,
        image_url: p.src.portrait ?? p.src.large,
        image_alt: p.alt || l.title,
        media_credit: `Photo by ${p.photographer} on Pexels`,
        media_credit_url: p.url,
      },
    };
  }
  return null;
}

let q = db.from("listings").select("id, title, type, tags, image_url, video_url").order("created_at");
if (!FORCE) q = q.is("image_url", null);
const { data: listings, error } = await q;
if (error) throw new Error(error.message);
if (!listings.length) {
  console.log("Every listing already has media. Use --force to redo them.");
  process.exit(0);
}

let videos = 0;
let photos = 0;
for (const l of listings) {
  const wantVideo = hash(`video:${l.id}`) % 2 === 0;
  const pick = (wantVideo && (await findVideo(l))) || (await findPhoto(l));
  if (!pick) {
    console.log(`  –  ${l.title}: nothing found, stays a text post`);
    continue;
  }
  if (pick.row.video_url) videos++;
  else photos++;
  console.log(`  ${pick.row.video_url ? `▶ ${pick.seconds}s` : "▣   "}  ${l.title}  ← "${pick.query}"`);
  if (!DRY) {
    const { error: upErr } = await db.from("listings").update(pick.row).eq("id", l.id);
    if (upErr) console.error(`     couldn't save: ${upErr.message}`);
  }
}
console.log(`\n${DRY ? "Would set" : "Set"} ${videos} videos and ${photos} photos for ${listings.length} listings.`);
