import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BADGE_ARTWORK, getBadgeArtwork } from "@/components/badges/badge-artwork";
import { BADGE_IMAGE_OVERRIDES } from "@/components/badges/badge-art";
import { RANKS } from "@/lib/domain/ranks";

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
      expect(existsSync(path.join(process.cwd(), "public", art!.image)), art!.image).toBe(true);
    }
  });
});
