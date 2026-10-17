"use client";

import { EyeOff, Play } from "lucide-react";
import { useState } from "react";
import { getListingMedia } from "@/lib/media";
import { TYPE_META } from "@/lib/opp";
import type { ProfileGridItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Square profile grid tile (spec §14): image/poster → video first frame → a text tile (type
 * gradient, 13/600 white title, 3 lines). Play icon on video tiles; EyeOff on items hidden from
 * friends (only ever true on your own profile).
 */
export function GridTile({ item, onOpen }: { item: ProfileGridItem; onOpen: () => void }) {
  const media = getListingMedia(item);
  const [failed, setFailed] = useState(false);
  const poster = media.kind === "image" ? media.src : media.kind === "video" ? media.poster : undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${item.title}${item.hidden_from_friends ? " (hidden from friends)" : ""}`}
      className="relative aspect-square overflow-hidden bg-surface"
    >
      {!failed && poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : !failed && media.kind === "video" ? (
        <video src={`${media.src}#t=0.1`} preload="metadata" muted playsInline aria-hidden className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className={cn("flex size-full items-center bg-gradient-to-br p-2.5 text-left", TYPE_META[item.type].gradient)}>
          <span className="line-clamp-3 text-[13px] leading-[17px] font-semibold text-white">{item.title}</span>
        </span>
      )}
      {media.kind === "video" && !failed && (
        <Play aria-hidden className="absolute top-2 right-2 size-4 fill-white text-white drop-shadow" />
      )}
      {item.hidden_from_friends && (
        <span
          data-testid="hidden-from-friends"
          className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
        >
          <EyeOff className="size-3.5" />
        </span>
      )}
    </button>
  );
}
