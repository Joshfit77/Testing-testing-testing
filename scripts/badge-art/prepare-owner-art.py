"""Prepare the owner's 27 badge images for the app.

Input:  scripts/badge-art/owner-27/{category}-{NN}-{name}.webp, the files the owner supplied, kept unchanged.
Output: public/badges/{category}-{NN}-{name}.webp, the same illustrations with the poster's leftover gold
        divider lines trimmed off and the edges feathered to transparent, so each one sits cleanly on the
        app's black background. Nothing is redrawn, recoloured or resized.

Run: python3 scripts/badge-art/prepare-owner-art.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts/badge-art/owner-27"
OUT = ROOT / "public/badges"
FEATHER = 14  # px of fade on each edge

# Crop box per image (left, top, right, bottom); negative right/bottom count from the far edge.
# Fitness shields sit on the left of their crop, with the poster's vertical divider on the right.
FITNESS = (0, 0, 335, -8)
FOOD = (6, 0, -16, -7)
FAITH = (4, 0, -20, -8)
OVERRIDES = {
    "fitness-07-overcomer": (0, 8, 335, -4),
    "fitness-08-mighty": (0, 15, 335, -4),
    "fitness-09-conqueror": (0, 28, 325, -4),
    "food-04-torch": (6, 6, -16, -7),
    "food-05-blaze": (6, 6, -16, -7),
    "food-06-furnace": (6, 10, -16, -7),
    "food-07-forge": (6, 26, -16, -4),
    "food-08-inferno": (6, 40, -16, -4),
    "food-09-phoenix": (6, 58, -16, -20),
    "faith-09-cedar": (4, 0, -20, -16),
}


def box(name: str, w: int, h: int):
    l, t, r, b = OVERRIDES.get(name) or {"fitness": FITNESS, "food": FOOD, "faith": FAITH}[name.split("-")[0]]
    return l, t, r if r > 0 else w + r, b if b > 0 else h + b


def feather(w: int, h: int) -> Image.Image:
    ramp = lambda n: np.clip(np.minimum(np.arange(n), np.arange(n)[::-1]) / FEATHER, 0, 1)
    a = np.outer(ramp(h), ramp(w))
    a = a * a * (3 - 2 * a)  # smoothstep
    return Image.fromarray((a * 255).astype(np.uint8), "L")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(SRC.glob("*.webp"))
    assert len(files) == 27, f"expected 27 images, found {len(files)}"
    for f in files:
        im = Image.open(f).convert("RGB")
        c = im.crop(box(f.stem, *im.size)).convert("RGBA")
        c.putalpha(feather(*c.size))
        c.save(OUT / f.name, "WEBP", quality=92, method=6)
        print(f.name, im.size, "->", c.size)


if __name__ == "__main__":
    main()
