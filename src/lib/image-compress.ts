/** Browser-only image downscaling for uploads. */
import { fitWithin, PHOTO_MAX_DIMENSION } from "@/lib/domain/progress-photos";

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // Honour EXIF orientation so phone photos aren't sideways.
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // Fall back to <img> below (older Safari doesn't support the options bag).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Downscale to at most `maxDimension` on the longest edge and re-encode as JPEG.
 * Re-encoding also strips EXIF metadata (including GPS location) from the original.
 */
export async function compressImage(file: Blob, maxDimension = PHOTO_MAX_DIMENSION, quality = 0.85): Promise<Blob> {
  const img = await decode(file);
  try {
    const { width, height } = fitWithin(img.width, img.height, maxDimension);
    if (!width || !height) throw new Error("Image has no size");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height); // transparent PNGs → black, not undefined
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Encoding failed");
    return blob;
  } finally {
    img.close();
  }
}
