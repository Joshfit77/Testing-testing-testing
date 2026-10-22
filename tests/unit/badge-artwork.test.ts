import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BADGE_ARTWORK, getBadgeArtwork } from "@/components/badges/badge-artwork";
import { BADGE_IMAGE_OVERRIDES } from "@/components/badges/badge-art";
import { RANKS } from "@/lib/domain/ranks";

/** Width and height from a WebP file's header (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  expect(b.toString("ascii", 0, 4)).toBe("RIFF");
  expect(b.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  throw new Error(`${file}: unknown WebP chunk ${chunk}`);
}

const file = (image: string) => path.join(process.cwd(), "public", image);

describe("badge artwork", () => {
  it("keeps the owner's three original posters the art is cut from", () => {
    for (const c of ["fitness", "food", "faith"]) expect(existsSync(path.join(process.cwd(), "scripts/badge-art/posters", `${c}.webp`))).toBe(true);
  });

  it("has one of the owner's images for each of the 27 ranks, and every file exists", () => {
    expect(BADGE_ARTWORK).toHaveLength(27);
    for (const r of RANKS) {
      const art = getBadgeArtwork(r.category, r.level);
      expect(art?.name).toBe(r.name);
      expect(BADGE_IMAGE_OVERRIDES[`${r.category}-${r.level}`]).toBe(art!.image);
      expect(existsSync(file(art!.image)), art!.image).toBe(true);
    }
  });

  it("every image is exactly 2 : 1, so the screen never crops or stretches it (replacements must keep this shape)", () => {
    for (const art of BADGE_ARTWORK) {
      const { width, height } = webpSize(file(art.image));
      expect(Math.abs(width - 2 * height), `${art.image} is ${width}x${height}`).toBeLessThanOrEqual(1);
      expect(height, art.image).toBeGreaterThanOrEqual(190);
    }
  });
});
