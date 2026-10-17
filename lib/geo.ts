import "server-only";

/**
 * US zip → approximate center coordinates, for the feed's radius filter (§7).
 * Uses the free Zippopotam.us API (no key). Only the zip code is sent. Returns null if the
 * lookup fails, in which case the feed simply doesn't filter by distance.
 */
export async function zipToLatLng(zip: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) return null;
    const place = (await res.json())?.places?.[0];
    const lat = Number(place?.latitude);
    const lng = Number(place?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}
