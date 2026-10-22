"""Cut the 27 badge illustrations from the owner's three original badge posters.

Input:  scripts/badge-art/posters/{fitness,food,faith}.webp, the owner's 1290 x 2796 poster screenshots, stored
        losslessly and unchanged.
Output: public/badges/{category}-{NN}-{name}.webp, one per rank, all exactly 2 : 1:
        - the full height of the row between its gold rules, at the poster's own pixels (never resized, so nothing
          is stretched or upscaled);
        - centred on the badge's subject (found from where the bright, coloured artwork sits in the row);
        - where the 2 : 1 window would run past the art (into the rank number or the text), the canvas is left
          transparent instead, so the subject stays centred;
        - the edges fade to transparent inside the file itself (top and bottom 10 px, each side 7 % of the width),
          so the app needs no CSS mask or filter to blend them, both of which can make Safari redraw the image
          at lower quality;
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
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts/badge-art/posters"
OUT = ROOT / "public/badges"
INSET = 5  # px kept clear of each gold rule
FEATHER_Y = 10  # px of fade at the top and bottom
FEATHER_SIDE = 0.07  # share of the width that fades out on each side (the art reaches the canvas edge or is cut there)

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


def subject_x(rgb: np.ndarray) -> float:
    """Horizontal centre of the artwork: a weighted centroid of the bright, coloured pixels."""
    lum = rgb.mean(2)
    sat = rgb.max(2) - rgb.min(2)
    weight = np.clip(lum - 55, 0, None) * (1 + sat / 255)
    cols = weight.sum(0)
    return float((cols * np.arange(len(cols))).sum() / cols.sum())


def ramp(n: int, feather: int, fade_start: bool, fade_end: bool) -> np.ndarray:
    i = np.arange(n, dtype=float)
    a = np.ones(n)
    if fade_start:
        a = np.minimum(a, i / feather)
    if fade_end:
        a = np.minimum(a, (n - 1 - i) / feather)
    a = np.clip(a, 0, 1)
    return a * a * (3 - 2 * a)  # smoothstep


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {}
    for cat, names in NAMES.items():
        poster = Image.open(SRC / f"{cat}.webp").convert("RGB")
        assert poster.size == (1290, 2796), poster.size
        x0, x1 = ART_X[cat]
        for i, name in enumerate(names):
            top, bottom = RULES[cat][i] + INSET, BOTTOM.get((cat, i + 1), RULES[cat][i + 1] - INSET)
            h = bottom - top
            w = 2 * h
            band = np.asarray(poster.crop((x0, top, x1, bottom)), dtype=float)
            cx = x0 + round(subject_x(band))
            left, right = cx - h, cx + h  # the 2 : 1 window centred on the subject
            src_l, src_r = max(left, x0), min(right, x1)
            canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            canvas.paste(poster.crop((src_l, top, src_r, bottom)), (src_l - left, 0))
            # Fade measured on the whole 2 : 1 canvas, so every badge fades the same way; where the art was padded
            # (cut short of the canvas edge) its own cut edge fades too.
            ax = ramp(w, round(w * FEATHER_SIDE), True, True)
            pad_l, pad_r = src_l - left, right - src_r
            if pad_l or pad_r:
                inner = np.zeros(w)
                inner[pad_l : w - pad_r] = ramp(w - pad_l - pad_r, round(w * FEATHER_SIDE / 2), pad_l > 0, pad_r > 0)
                ax = ax * inner
            ay = ramp(h, FEATHER_Y, True, True)
            alpha = np.asarray(canvas.getchannel("A"), dtype=float) / 255 * np.outer(ay, ax)
            canvas.putalpha(Image.fromarray((alpha * 255).round().astype(np.uint8), "L"))
            path = OUT / f"{cat}-{i + 1:02d}-{name}.webp"
            canvas.save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)
            sizes[f"/badges/{path.name}"] = {"width": w, "height": h}
            print(f"{path.name:28} {w}x{h}  subject x={cx}  padded left={src_l - left} right={right - src_r}")


    (ROOT / "src/components/badges/badge-artwork-sizes.json").write_text(json.dumps(sizes, indent=2) + "\n")


if __name__ == "__main__":
    main()
