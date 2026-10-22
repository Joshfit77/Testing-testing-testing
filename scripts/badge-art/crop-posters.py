"""Cut the 27 badge illustrations from the owner's three original badge posters.

Input:  scripts/badge-art/posters/{fitness,food,faith}.webp, the owner's 1290 x 2796 poster screenshots, stored
        losslessly and unchanged.
Output: public/badges/{category}-{NN}-{name}.webp, one per rank: the artwork between the rank number and the
        text, inside the row's gold rules, with the top and bottom edges faded to transparent. The art itself is
        not redrawn, recoloured or resized.

Run: python3 scripts/badge-art/crop-posters.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts/badge-art/posters"
OUT = ROOT / "public/badges"
INSET = 5  # px kept clear of each gold rule
FEATHER = 10  # px of fade at the top and bottom

NAMES = {
    "fitness": ["foundation", "faithful", "endurance", "disciplined", "refined", "steadfast", "overcomer", "mighty", "conqueror"],
    "food": ["spark", "ember", "flame", "torch", "blaze", "furnace", "forge", "inferno", "phoenix"],
    "faith": ["seed", "sprout", "sapling", "root", "branch", "vine", "fruit", "olive", "cedar"],
}
# y of the gold rules above row 1, between rows, and below row 9; x from the number badge to the text.
RULES = {
    "fitness": [524, 729, 939, 1166, 1384, 1614, 1847, 2071, 2308, 2600],
    "food": [454, 664, 876, 1100, 1319, 1546, 1779, 2002, 2239, 2540],
    "faith": [492, 699, 915, 1137, 1356, 1584, 1818, 2041, 2279, 2575],
}
ART_X = {"fitness": (155, 750), "food": (205, 720), "faith": (150, 775)}
# Where the next row's art reaches up into a row, stop that row's crop above it (category, rank): bottom y.
BOTTOM = {("fitness", 3): 1135}


def fade(w: int, h: int) -> Image.Image:
    y = np.arange(h)
    a = np.clip(np.minimum(y, h - 1 - y) / FEATHER, 0, 1)
    a = a * a * (3 - 2 * a)
    return Image.fromarray((np.tile(a[:, None], (1, w)) * 255).astype(np.uint8), "L")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for cat, names in NAMES.items():
        poster = Image.open(SRC / f"{cat}.webp").convert("RGB")
        assert poster.size == (1290, 2796), poster.size
        x0, x1 = ART_X[cat]
        for i, name in enumerate(names):
            top, bottom = RULES[cat][i] + INSET, BOTTOM.get((cat, i + 1), RULES[cat][i + 1] - INSET)
            art = poster.crop((x0, top, x1, bottom)).convert("RGBA")
            art.putalpha(fade(*art.size))
            path = OUT / f"{cat}-{i + 1:02d}-{name}.webp"
            art.save(path, "WEBP", quality=92, method=6)
            print(path.name, art.size)


if __name__ == "__main__":
    main()
