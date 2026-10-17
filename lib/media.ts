/**
 * Media resolver (front-end spec §9.4): image → test video by type → text post.
 *
 * ─── README: adding test videos ────────────────────────────────────────────────────────────
 * 1. Export each clip as MP4 (H.264 video + AAC audio), 4:5 portrait at 720×900 or 1080×1350,
 *    15 seconds or less, 5 MB or less. For example:
 *      ffmpeg -i in.mov -vf "crop=ih*4/5:ih,scale=720:900" -c:v libx264 -crf 26 -preset slow \
 *        -c:a aac -b:a 96k -movflags +faststart out.mp4
 *    A poster frame (JPG) is optional.
 * 2. Put the files somewhere public: either `public/test-media/` in this repo, or a public
 *    Supabase Storage bucket (or any CDN).
 * 3. List them by type in `public/media-manifest.json`, with paths relative to the base URL:
 *      { "baseUrl": "",
 *        "internship": [ { "src": "internship/1.mp4", "poster": "internship/1.jpg" } ],
 *        "volunteer": [], "event": [], "scholarship": [] }
 *    An empty list means that type shows text posts.
 * 4. Base URL: `NEXT_PUBLIC_TEST_MEDIA_BASE_URL` if set, else the manifest's `baseUrl`, else
 *    `/test-media` (i.e. `public/test-media/`). Point it at the bucket URL to use Storage.
 * Each listing always shows the same clip (stable hash of its id). A clip that fails to load
 * falls back to the text post. When AI images return, `listing.image_url` wins automatically.
 * ───────────────────────────────────────────────────────────────────────────────────────────
 */
import defaultManifest from "@/public/media-manifest.json";
import type { Listing, OppType } from "@/lib/types";

export type Media =
  | { kind: "image"; src: string; alt?: string }
  | { kind: "video"; src: string; poster?: string }
  | { kind: "text" };

export interface ManifestEntry {
  src: string;
  poster?: string;
}

export type MediaManifest = { baseUrl?: string } & Record<OppType, ManifestEntry[]>;

/** FNV-1a 32-bit: small, stable, good enough spread for picking a clip. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function baseUrl(manifest: MediaManifest): string {
  const base = process.env.NEXT_PUBLIC_TEST_MEDIA_BASE_URL || manifest.baseUrl || "/test-media";
  return base.replace(/\/+$/, "");
}

function resolve(base: string, path: string): string {
  return /^(https?:)?\/\//.test(path) || path.startsWith("/") ? path : `${base}/${path.replace(/^\/+/, "")}`;
}

export function getListingMedia(
  listing: Pick<Listing, "id" | "type" | "image_url" | "image_alt">,
  manifest: MediaManifest = defaultManifest as MediaManifest,
): Media {
  if (listing.image_url) return { kind: "image", src: listing.image_url, alt: listing.image_alt ?? undefined };
  const clips = manifest[listing.type] ?? [];
  if (clips.length) {
    const clip = clips[fnv1a(listing.id) % clips.length];
    const base = baseUrl(manifest);
    return { kind: "video", src: resolve(base, clip.src), poster: clip.poster ? resolve(base, clip.poster) : undefined };
  }
  return { kind: "text" };
}
