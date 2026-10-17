"use client";

import { useState } from "react";
import { cn as cx } from "@/lib/utils";

/**
 * Round avatar with an initial fallback. Plain <img>: avatars are tiny, pre-sized files.
 * `no-referrer` matters: Google profile photos return 429 when the request carries a referrer.
 * If the image fails anyway, the initial is shown instead of a blank circle.
 */
export function Avatar({
  url,
  name,
  size = 32,
  className,
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (url && failedUrl !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(url)}
        className={cx("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cx(
        "bg-accent-gradient inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );
}
