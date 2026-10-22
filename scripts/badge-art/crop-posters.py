"""Cut the 27 badge illustrations from the owner's three original badge posters.

Input:  scripts/badge-art/posters/{fitness,food,faith}.webp, the owner's 1290 x 2796 poster screenshots, stored
        losslessly and unchanged.
Output: public/badges/{category}-{NN}-{name}.webp, one per rank, all exactly 2 : 1:
        - a tight window (TIGHT of the row's height between its gold rules) centred on the badge's subject,
          found from where the bright, coloured artwork sits, so every badge fills its tile the same way;
        - at the poster's own pixels (never enlarged), clipped to the artwork column, never padded;
        - opaque, with crisp edges (no fades): the app frames each tile itself;
        - a mild unsharp mask (radius 1 px, 60 %), which raises edge contrast a little. It adds no detail:
          the posters are phone screenshots, so their own detail is the limit;
        - the Conqueror badge's cross made 30 % smaller first (edit_conqueror.py), keeping the wings;
        - saved as lossless WebP, so no compression smudging is added.
Also writes src/components/badges/badge-artwork-sizes.json with each image's pixel size, which the app uses
for the <img> width/height and to keep large views from enlarging the art more than 1.5x on a 3x iPhone.

Replacing the art: a higher-resolution image with the same name and a 2 : 1 shape can be dropped into
public/badges/ (see docs/BADGES.md). Don't re-run this script afterwards, or it will overwrite it.

Run: python3 scripts/badge-art/crop-posters.py
"""
from pathlib import Path

import json

import numpy as np
from PIL import Image, ImageFilter

from edit_conqueror import shrink_cross

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts/badge-art/posters"
OUT = ROOT / "public/badges"
INSET = 5  # px kept clear of each gold rule
TIGHT = 0.92  # crop height as a share of the row's height
SHARPEN = ImageFilter.UnsharpMask(radius=1.0, percent=60, threshold=2)

NAMES = {
    "fitness": ["foundation", "faithful", "endurance", "disciplined", "refined", "steadfast", "overcomer", "mighty", "conqueror"],
    "food": ["spark", "ember", "flame", "torch", "blaze", "furnace", "forge", "inferno", "phoenix"],
    "faith": ["seed", "sprout", "sapling", "root", "branch", "vine", "fruit", "olive", "cedar"],
}
# y of the gold rules above row 1, between rows, and below row 9.
RULES = {
    "fitness": [524, 729, 939, 1166, 1384, 1614, 1847, 2071, 2308, 2600],
    "food": [454, 664, 876, 1100, 1319, 1546, 1779, 2002, 2239, 2540],
    "faith": [492, 699, 915, 1137, 1356, 1584, 1818, 2041, 2279, 2575],
}
# x range of the artwork: from just right of the rank number to just left of the text.
ART_X = {"fitness": (155, 750), "food": (205, 720), "faith": (150, 775)}
# Where the next row's art reaches up into a row, stop that row's crop above it (category, rank): bottom y.
BOTTOM = {("fitness", 3): 1135}


def _weight(rgb: np.ndarray) -> np.ndarray:
    """How much each pixel belongs to the artwork: bright and coloured pixels count, the dark background doesn't."""
    lum = rgb.mean(2)
    sat = rgb.max(2) - rgb.min(2)
    return np.clip(lum - 55, 0, None) * (1 + sat / 255)


def subject_x(rgb: np.ndarray) -> float:
    """Horizontal centre of the artwork (a weighted centroid)."""
    cols = _weight(rgb).sum(0)
    return float((cols * np.arange(len(cols))).sum() / cols.sum())


def subject_y(rgb: np.ndarray) -> float:
    """Vertical centre of the artwork."""
    rows = _weight(rgb).sum(1)
    return float((rows * np.arange(len(rows))).sum() / rows.sum())


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {}
    for cat, names in NAMES.items():
        poster = Image.open(SRC / f"{cat}.webp").convert("RGB")
        assert poster.size == (1290, 2796), poster.size
        if cat == "fitness":
            poster = shrink_cross(poster)
        x0, x1 = ART_X[cat]
        for i, name in enumerate(names):
            top, bottom = RULES[cat][i] + INSET, BOTTOM.get((cat, i + 1), RULES[cat][i + 1] - INSET)
            band = np.asarray(poster.crop((x0, top, x1, bottom)), dtype=float)
            h = min(round((bottom - top) * TIGHT), (x1 - x0) // 2)
            w = 2 * h
            # Centred on the subject, then kept inside the row and the artwork column.
            left = min(max(round(x0 + subject_x(band) - h), x0), x1 - w)
            upper = min(max(round(top + subject_y(band) - h / 2), top), bottom - h)
            tile = poster.crop((left, upper, left + w, upper + h)).filter(SHARPEN)
            path = OUT / f"{cat}-{i + 1:02d}-{name}.webp"
            tile.save(path, "WEBP", lossless=True, quality=100, method=6)
            sizes[f"/badges/{path.name}"] = {"width": w, "height": h}
            print(f"{path.name:28} {w}x{h}  from x={left} y={upper}")

    (ROOT / "src/components/badges/badge-artwork-sizes.json").write_text(json.dumps(sizes, indent=2) + "\n")


if __name__ == "__main__":
    main()
