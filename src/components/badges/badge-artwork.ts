import { RANKS, type RankCategory } from "@/lib/domain/ranks";
import SIZES from "@/components/badges/badge-artwork-sizes.json";

/**
 * The owner's painted artwork for the 27 rank badges, one image per rank, cut from their three original badge
 * posters (scripts/badge-art/posters/, unchanged) by scripts/badge-art/crop-posters.py, which also writes each
 * image's pixel size to badge-artwork-sizes.json. Every image is 2 : 1.
 */
export interface BadgeArtwork {
  category: RankCategory;
  rank: number;
  name: string;
  image: string;
  /** The file's own pixel size. */
  width: number;
  height: number;
}

/**
 * The most a large view may enlarge the art on a 3x iPhone screen. Beyond about 1.5x, missing detail shows as
 * blur, so large views stop growing there instead of stretching the file.
 */
export const MAX_DEVICE_UPSCALE = 1.5;
const DEVICE_PIXEL_RATIO = 3;

export const BADGE_ARTWORK: BadgeArtwork[] = RANKS.map((r) => {
  const image = `/badges/${r.category}-${String(r.level).padStart(2, "0")}-${r.name.toLowerCase()}.webp`;
  const size = (SIZES as Record<string, { width: number; height: number }>)[image];
  return { category: r.category, rank: r.level, name: r.name, image, width: size?.width ?? 0, height: size?.height ?? 0 };
});

export function getBadgeArtwork(category: RankCategory, rank: number): BadgeArtwork | undefined {
  return BADGE_ARTWORK.find((b) => b.category === category && b.rank === rank);
}

/**
 * Widest a view should draw the art, in CSS pixels, before it would be enlarged more than MAX_DEVICE_UPSCALE on
 * a 3x screen. Large views use the smallest of these across all 27, so every badge's detail view is the same size.
 */
export const BADGE_MAX_SHARP_WIDTH = Math.floor(
  Math.min(...BADGE_ARTWORK.map((b) => b.width || Infinity)) * (MAX_DEVICE_UPSCALE / DEVICE_PIXEL_RATIO),
);
