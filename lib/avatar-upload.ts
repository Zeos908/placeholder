import { createClient } from "@/lib/supabase/client";

const SIZE = 320;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

/**
 * Center-crops an image to a square, resizes to 320×320 WebP, uploads it to
 * avatars/{userId}/, removes the user's older avatar files, and returns the public URL.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("That image is too large (15 MB max).");

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That image couldn't be read. Try a JPG or PNG.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Couldn't process that image.");

  const supabase = createClient();
  const bucket = supabase.storage.from("avatars");
  const name = `${Date.now()}.webp`;
  const { error } = await bucket.upload(`${userId}/${name}`, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (error) throw new Error("Upload failed. Try again.");

  // Best effort: keep only the newest avatar.
  const { data: existing } = await bucket.list(userId, { limit: 100 });
  const stale = (existing ?? []).filter((f) => f.name !== name).map((f) => `${userId}/${f.name}`);
  if (stale.length) await bucket.remove(stale);

  return bucket.getPublicUrl(`${userId}/${name}`).data.publicUrl;
}
