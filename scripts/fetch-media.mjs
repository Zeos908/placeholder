#!/usr/bin/env node
/**
 * Gives every listing a photo or a short video:
 *   - With PIXABAY_API_KEY (free: sign in at pixabay.com, the key is on pixabay.com/api/docs):
 *     about half the listings get a Pixabay clip of 3–19 s, the rest a Pixabay photo. Pixabay
 *     doesn't allow hotlinking, so files are copied into the public `listing-images` bucket.
 *   - Without it: Creative Commons photos from Openverse (openverse.org), linked from source.
 *   (Pexels paused new API keys in Oct 2026. Wikimedia Commons clips were tried and dropped:
 *   its search returned off-topic and unsuitable footage.)
 *
 *   npm run media:fetch              listings without media only
 *   npm run media:fetch -- --force   redo all of them
 *   npm run media:fetch -- --dry-run show what would be picked, change nothing
 *   npm run media:fetch -- --review  also write scripts/.media-review.json to eyeball the picks
 *   npm run media:fetch -- --no-picks  ignore scripts/media-picks.json (hand-reviewed photos for the
 *                                      demo listings, used first by default)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local. Each listing
 * stores a creator/license credit, shown on its details page.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const DRY = args.has("--dry-run");
const REVIEW = args.has("--review");
const MAX_SECONDS = 19; // "less than 20 seconds"
const MIN_SECONDS = 3;
const BUCKET = "listing-images";
const UA = "placeholder-app/0.1 (student project demo)";

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PIXABAY_API_KEY } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
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
  research: "scientist laboratory",
  science: "science laboratory",
  healthcare: "hospital nurse",
  environment: "volunteers cleanup park",
  outdoors: "hiking trail forest",
  animals: "animal shelter dog",
  arts: "painting art class",
  music: "orchestra students",
  writing: "writing notebook",
  law: "courthouse",
  government: "city hall",
  business: "business meeting",
  finance: "stock market charts",
  entrepreneurship: "startup pitch",
  sports: "track athletes running",
  tutoring: "tutoring student",
  education: "college students studying",
  community: "community volunteers",
  leadership: "student speaking podium",
  media: "video camera filming",
  "social-justice": "community rally",
};
const TYPE_PHRASES = {
  internship: "office teamwork",
  volunteer: "volunteers",
  event: "students conference",
  scholarship: "graduation",
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

/** FNV-1a: same listing → same choice on every run. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Polite JSON GET: identifies the app, spaces requests out, retries 429 and 5xx. */
async function getJson(url) {
  const host = new URL(url).host;
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(600);
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.status === 429 || res.status >= 500) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (res.status === 400 && host.includes("pixabay")) throw new Error("Pixabay rejected the request (check PIXABAY_API_KEY).");
    if (!res.ok) throw new Error(`${res.status} from ${host}`);
    return res.json();
  }
  throw new Error(`${host} is busy; try again in a few minutes.`);
}

const used = new Set();

// ---------- Pixabay (with a key): copied into Storage ----------
async function store(listingId, name, sourceUrl) {
  const res = await fetch(sourceUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const type = res.headers.get("content-type") ?? "application/octet-stream";
  const path = `media/${listingId}/${name}`;
  const { error } = await db.storage.from(BUCKET).upload(path, Buffer.from(await res.arrayBuffer()), {
    contentType: type,
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function pixabayVideo(l) {
  for (const q of queriesFor(l)) {
    const data = await getJson(
      `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(q.slice(0, 100))}&safesearch=true&per_page=20`,
    );
    const hits = (data.hits ?? []).filter((h) => h.duration >= MIN_SECONDS && h.duration <= MAX_SECONDS && !used.has(`pv${h.id}`));
    if (!hits.length) continue;
    const h = hits[hash(l.id) % Math.min(hits.length, 4)];
    // ~960 px wide is plenty for a phone feed and keeps files small.
    const file = h.videos?.small?.url ? h.videos.small : h.videos?.tiny?.url ? h.videos.tiny : h.videos?.medium;
    if (!file?.url) continue;
    used.add(`pv${h.id}`);
    return {
      query: q,
      seconds: h.duration,
      preview: file.thumbnail,
      row: async () => ({
        video_url: await store(l.id, "clip.mp4", file.url),
        image_url: await store(l.id, "poster.jpg", file.thumbnail),
        image_alt: l.title,
        media_credit: `Video by ${h.user} on Pixabay`,
        media_credit_url: h.pageURL,
      }),
    };
  }
  return null;
}

async function pixabayPhoto(l) {
  for (const q of queriesFor(l)) {
    const data = await getJson(
      `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(q.slice(0, 100))}&image_type=photo&safesearch=true&per_page=20&orientation=vertical`,
    );
    const hits = (data.hits ?? []).filter((h) => !used.has(`pp${h.id}`));
    if (!hits.length) continue;
    const h = hits[hash(l.id) % Math.min(hits.length, 4)];
    used.add(`pp${h.id}`);
    return {
      query: q,
      preview: h.webformatURL,
      row: async () => ({
        video_url: null,
        image_url: await store(l.id, "photo.jpg", h.largeImageURL),
        image_alt: l.title,
        media_credit: `Photo by ${h.user} on Pixabay`,
        media_credit_url: h.pageURL,
      }),
    };
  }
  return null;
}

// ---------- Openverse (no key): linked from source ----------
const LICENSE = {
  by: "CC BY",
  "by-sa": "CC BY-SA",
  "by-nd": "CC BY-ND",
  "by-nc": "CC BY-NC",
  "by-nc-sa": "CC BY-NC-SA",
  "by-nc-nd": "CC BY-NC-ND",
  cc0: "CC0",
  pdm: "Public domain",
};

async function openversePhoto(l) {
  for (const q of queriesFor(l)) {
    for (const aspect of ["tall", "square", null]) {
      const data = await getJson(
        `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20&category=photograph&mature=false` +
          (aspect ? `&aspect_ratio=${aspect}` : ""),
      );
      const options = (data.results ?? []).filter(
        (p) => !used.has(p.id) && /^https:/.test(p.url ?? "") && (p.width ?? 0) >= 600 && (p.height ?? 0) >= 600,
      );
      if (!options.length) continue;
      const p = options[hash(l.id) % Math.min(options.length, 4)];
      used.add(p.id);
      const license = `${LICENSE[p.license] ?? (p.license ?? "").toUpperCase()}${p.license_version ? ` ${p.license_version}` : ""}`;
      const row = {
        video_url: null,
        image_url: p.url,
        image_alt: l.title,
        media_credit: `Photo: ${(p.creator || "unknown").slice(0, 60)} · ${license} · ${p.source ?? "Openverse"}`,
        media_credit_url: p.foreign_landing_url ?? p.url,
      };
      return { query: q, preview: p.thumbnail ?? p.url, row: async () => row };
    }
  }
  return null;
}

// Hand-reviewed photos for the demo listings, keyed by title (ids change when the DB is reseeded).
const PICKS = existsSync(new URL("./media-picks.json", import.meta.url))
  ? JSON.parse(readFileSync(new URL("./media-picks.json", import.meta.url), "utf8"))
  : {};

async function pick(l) {
  const curated = PICKS[l.title];
  if (curated && !args.has("--no-picks")) {
    return { query: "curated", preview: curated.image_url, row: async () => ({ video_url: null, image_alt: l.title, ...curated }) };
  }
  if (PIXABAY_API_KEY) {
    const wantVideo = hash(`video:${l.id}`) % 2 === 0;
    return (wantVideo && (await pixabayVideo(l))) || (await pixabayPhoto(l)) || (await openversePhoto(l));
  }
  return openversePhoto(l);
}

let q = db.from("listings").select("id, title, type, tags, image_url").order("created_at");
if (!FORCE) q = q.is("image_url", null);
const { data: listings, error } = await q;
if (error) throw new Error(error.message);
if (!listings.length) {
  console.log("Every listing already has media. Use --force to redo them.");
  process.exit(0);
}
console.log(PIXABAY_API_KEY ? "Using Pixabay (photos + short videos)." : "No PIXABAY_API_KEY: Openverse photos only.");

let videos = 0;
let photos = 0;
const review = [];
for (const l of listings) {
  try {
    const p = await pick(l);
    if (!p) {
      console.log(`  –  ${l.title}: nothing found, stays a text post`);
      continue;
    }
    const isVideo = p.seconds !== undefined;
    review.push({ id: l.id, title: l.title, query: p.query, preview: p.preview, video: isVideo });
    console.log(`  ${isVideo ? `▶ ${p.seconds}s` : "▣   "}  ${l.title}  ← "${p.query}"`);
    if (isVideo) videos++;
    else photos++;
    if (!DRY) {
      const { error: upErr } = await db.from("listings").update(await p.row()).eq("id", l.id);
      if (upErr) console.error(`     couldn't save: ${upErr.message}`);
    }
  } catch (e) {
    console.error(`  !  ${l.title}: ${e.message}`);
  }
}
if (REVIEW) writeFileSync(new URL("./.media-review.json", import.meta.url), JSON.stringify(review, null, 1));
console.log(`\n${DRY ? "Would set" : "Set"} ${videos} videos and ${photos} photos for ${listings.length} listings.`);
