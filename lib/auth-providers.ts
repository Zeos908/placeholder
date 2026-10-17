import "server-only";

/**
 * Whether Google sign-in is turned on in the Supabase project (Authentication → Providers).
 * Read from Supabase's public auth settings and cached for a minute, so the Google button only
 * appears when clicking it will work.
 */
export async function isGoogleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    return (await res.json())?.external?.google === true;
  } catch {
    return false;
  }
}
