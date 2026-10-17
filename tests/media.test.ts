/** Spec §21 test 6: getListingMedia — image beats video beats text; stable pick; empty → text. */
import { describe, expect, it } from "vitest";
import { getListingMedia, type MediaManifest } from "@/lib/media";

const manifest: MediaManifest = {
  baseUrl: "https://cdn.example.com/test-media/",
  internship: [
    { src: "internship/1.mp4", poster: "internship/1.jpg" },
    { src: "internship/2.mp4" },
    { src: "internship/3.mp4" },
  ],
  volunteer: [],
  event: [{ src: "https://other.example.com/event.mp4" }],
  scholarship: [],
};

const listing = (id: string, type: "internship" | "volunteer" | "event", image_url: string | null = null) => ({
  id,
  type,
  image_url,
  image_alt: image_url ? "A photo" : null,
});

describe("getListingMedia", () => {
  it("prefers the listing's own image over any video", () => {
    expect(getListingMedia(listing("a", "internship", "https://img/x.webp"), manifest)).toEqual({
      kind: "image",
      src: "https://img/x.webp",
      alt: "A photo",
    });
  });

  it("uses a test video for the type, resolved against the base URL", () => {
    const media = getListingMedia(listing("a", "internship"), manifest);
    expect(media.kind).toBe("video");
    if (media.kind === "video") expect(media.src).toMatch(/^https:\/\/cdn\.example\.com\/test-media\/internship\/\d\.mp4$/);
  });

  it("keeps absolute clip URLs as they are", () => {
    expect(getListingMedia(listing("a", "event"), manifest)).toEqual({
      kind: "video",
      src: "https://other.example.com/event.mp4",
      poster: undefined,
    });
  });

  it("always picks the same clip for the same listing", () => {
    const picks = new Set(Array.from({ length: 5 }, () => JSON.stringify(getListingMedia(listing("same-id", "internship"), manifest))));
    expect(picks.size).toBe(1);
  });

  it("spreads different listings across clips", () => {
    const srcs = new Set(
      Array.from({ length: 30 }, (_, i) => {
        const m = getListingMedia(listing(`listing-${i}`, "internship"), manifest);
        return m.kind === "video" ? m.src : "";
      }),
    );
    expect(srcs.size).toBeGreaterThan(1);
  });

  it("falls back to a text post when the type has no clips", () => {
    expect(getListingMedia(listing("a", "volunteer"), manifest)).toEqual({ kind: "text" });
  });

  it("uses /test-media when neither the env var nor the manifest set a base URL", () => {
    const media = getListingMedia(listing("a", "internship"), { ...manifest, baseUrl: "" });
    expect(media.kind === "video" && media.src.startsWith("/test-media/internship/")).toBe(true);
  });
});
