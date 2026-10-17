"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TextPost } from "@/components/feed/TextPost";
import { useTabActive } from "@/components/shell/shell-context";
import { getListingMedia } from "@/lib/media";
import { useUi } from "@/lib/store";
import type { Listing } from "@/lib/types";
import { videoManager } from "@/lib/video-manager";
import { cn } from "@/lib/utils";

type MediaListing = Pick<Listing, "id" | "type" | "title" | "org_name" | "deadline" | "image_url" | "image_alt"> &
  Pick<Partial<Listing>, "video_url">;

/** 4:5 media for a listing (spec §9.4–9.5): image, test video, or the text post fallback. */
export function PostMedia({
  listing,
  index = 0,
  group = "feed",
  className,
  compact,
}: {
  listing: MediaListing;
  /** Position in its list, for preloading the next videos. */
  index?: number;
  group?: string;
  className?: string;
  compact?: boolean;
}) {
  const media = getListingMedia(listing);
  const [failed, setFailed] = useState(false);

  if (failed || media.kind === "text") return <TextPost listing={listing} className={className} compact={compact} />;

  if (media.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.src}
        alt={media.alt ?? ""}
        draggable={false}
        onError={() => setFailed(true)}
        className={cn("aspect-[4/5] w-full object-cover select-none", className)}
      />
    );
  }

  return (
    <FeedVideo
      src={media.src}
      poster={media.poster}
      index={index}
      group={group}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function FeedVideo({
  src,
  poster,
  index,
  group,
  className,
  onError,
}: {
  src: string;
  poster?: string;
  index: number;
  group: string;
  className?: string;
  onError: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const { active } = useTabActive();
  const muted = useUi((s) => s.videoMuted);
  const setMuted = useUi((s) => s.setVideoMuted);
  const [preload, setPreload] = useState<"auto" | "metadata">("metadata");
  const [near, setNear] = useState(true);

  // Join the shared player so only the most-visible video plays.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    videoManager.register(el, { group, index, enabled: active, setPreload });
    return () => videoManager.unregister(el);
    // index/active are pushed through update() below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  useEffect(() => {
    if (ref.current) videoManager.update(ref.current, { index, enabled: active });
  }, [index, active]);

  // Keep the global mute in sync (React doesn't reliably update the muted attribute).
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  // Memory: more than 3 screens away, drop the source (keep the poster); restore on return.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "300% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (near) {
      if (el.getAttribute("src") !== src) el.setAttribute("src", src);
    } else if (el.hasAttribute("src")) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
  }, [near, src]);

  return (
    <div className={cn("relative aspect-[4/5] w-full bg-black", className)}>
      <video
        ref={ref}
        poster={poster}
        muted
        loop
        playsInline
        preload={preload}
        onError={() => near && onError()}
        className="h-full w-full object-cover"
      />
      <button
        type="button"
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        onClick={(e) => {
          e.stopPropagation();
          setMuted(!muted);
        }}
        className="absolute right-3 bottom-3 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
      >
        {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
      </button>
    </div>
  );
}
