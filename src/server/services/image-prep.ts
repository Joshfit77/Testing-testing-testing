import "server-only";
import { logError } from "@/server/log";

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

/** Larger images than this (in pixels) are refused before decoding, so a small file can't expand into a huge one. */
const MAX_INPUT_PIXELS = 40_000_000;

export class UnreadableImageError extends Error {}

/**
 * Prepare an uploaded photo on the server before it goes to the AI, whatever the device did:
 * - turned upright from its EXIF orientation, then every bit of metadata (location, camera, time) is dropped;
 * - fitted inside `maxDimension` pixels (never enlarged), which also caps the image tokens a request can cost;
 * - re-encoded as JPEG.
 * If the image library isn't available on this server the original bytes are used (the app already resized and
 * re-encoded the photo on the phone); a photo that can't be decoded is refused.
 */
export async function prepareImageForAi(bytes: Uint8Array, mediaType: PhotoType, maxDimension: number): Promise<{ bytes: Uint8Array; mediaType: PhotoType; reencoded: boolean }> {
  let sharp: typeof import("sharp").default;
  try {
    sharp = (await import("sharp")).default;
  } catch (err) {
    logError("image_prep.unavailable", err);
    return { bytes, mediaType, reencoded: false };
  }
  try {
    const out = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return { bytes: new Uint8Array(out), mediaType: "image/jpeg", reencoded: true };
  } catch {
    throw new UnreadableImageError("That photo couldn't be read.");
  }
}
