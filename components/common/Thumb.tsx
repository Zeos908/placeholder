"use client";

import { useState } from "react";
import { MiniTile } from "@/components/common/MiniTile";
import { getListingMedia } from "@/lib/media";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Square thumbnail for a listing (spec §11): image or video poster → the video's first frame →
 * a mini text tile (type gradient + emoji). Falls back to the tile if media fails to load.
 */
export function Thumb({
  listing,
  size = 56,
  className,
}: {
  listing: Pick<Listing, "id" | "type" | "image_url" | "image_alt">;
  size?: number;
  className?: string;
}) {
  const media = getListingMedia(listing);
  const [failed, setFailed] = useState(false);
  const box = cn("shrink-0 overflow-hidden bg-surface object-cover", className);
  const style = { width: size, height: size };

  if (!failed && media.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.src} alt="" className={box} style={style} onError={() => setFailed(true)} />;
  }
  if (!failed && media.kind === "video") {
    if (media.poster) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={media.poster} alt="" className={box} style={style} onError={() => setFailed(true)} />;
    }
    return (
      <video
        src={`${media.src}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        aria-hidden
        className={box}
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }
  return <MiniTile type={listing.type} size={size} className={className} />;
}
