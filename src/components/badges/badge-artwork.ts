import { RANKS, type RankCategory } from "@/lib/domain/ranks";

/**
 * The owner's painted artwork for the 27 rank badges, one image per rank. The source files are kept unchanged
 * in scripts/badge-art/owner-27/. public/badges/ holds the same images with the poster's divider lines trimmed
 * off and the edges faded to transparent (scripts/badge-art/prepare-owner-art.py).
 */
export interface BadgeArtwork {
  category: RankCategory;
  rank: number;
  name: string;
  image: string;
}

export const BADGE_ARTWORK: BadgeArtwork[] = RANKS.map((r) => ({
  category: r.category,
  rank: r.level,
  name: r.name,
  image: `/badges/${r.category}-${String(r.level).padStart(2, "0")}-${r.name.toLowerCase()}.webp`,
}));

export function getBadgeArtwork(category: RankCategory, rank: number): BadgeArtwork | undefined {
  return BADGE_ARTWORK.find((b) => b.category === category && b.rank === rank);
}
