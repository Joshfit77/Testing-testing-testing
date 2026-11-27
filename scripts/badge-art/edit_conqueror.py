"""Make the cross in the Conqueror badge smaller, keeping the shield, laurels and silver wings.

The cross is painted into the poster, so no CSS can resize it. This is a classical raster edit of the owner's
artwork (no AI generation or upscaling):

  1. The cross is lifted out of the poster with a mask drawn from its measured geometry.
  2. The area it covered is filled from the painting around it. On the bright rim and laurels, each half of
     the gap takes a mirror image of the texture just beside it (the badge is mirror-symmetric about the
     cross, so the halves meet almost seamlessly); across the shield's dark field the fill is smooth. The
     fill is blended into the painting with soft edges.
  3. The cross is put back at `SCALE` of its size, centred in the shield's dark field with a soft glow, so it
     sits inside the shield as on the owner's reference poster.

The fill can't recreate painted detail that was never there, so this is a careful edit, not new artwork: for
the best result the artist should supply a Conqueror badge with the smaller cross painted in (docs/BADGES.md).
Used by crop-posters.py on the fitness poster before cropping.
"""
import numpy as np
from PIL import Image, ImageFilter

SCALE = 0.70  # the new cross is 30 % smaller
# Measured on the 1290 x 2796 fitness poster (x0, y0, x1, y1; end-exclusive).
# The cross as it is lifted out: from its flared shoulders under the rim down to where it meets the laurels.
# (Above the rim its top merges into the rim's own highlights and can't be separated cleanly.)
CROSS_BAR = (398, 2366, 426, 2552)
CROSS_ARM = (364, 2393, 459, 2430)
# What is refilled: the whole upright including the part over the rim and down into the glow under the
# laurels, and the crossbar with the glow around it.
HOLE_BAR = (395, 2312, 429, 2584)
HOLE_GLOW = (390, 2372, 434, 2530)  # wider across the dark field, where the old glow reached further
HOLE_ARM = (356, 2380, 467, 2444)
FIELD = (2372, 2530)  # rows of the shield's dark field, filled smoothly; the rim above and laurels below keep texture
FEATHER = 3  # px over which the fill blends into the painting
NEW_CENTRE_Y = 2452  # the smaller cross is centred in the shield's dark field
REGION = (320, 2290, 510, 2610)  # working window around the shield


def _rects(shape, rects, offset, grow=0) -> np.ndarray:
    m = np.zeros(shape, bool)
    ox, oy = offset
    for x0, y0, x1, y1 in rects:
        m[y0 - oy - grow : y1 - oy + grow, x0 - ox - grow : x1 - ox + grow] = True
    return m


def _reflect_rows(img: np.ndarray, x0: int, x1: int, y0: int, y1: int) -> None:
    """Fill columns [x0, x1) of rows [y0, y1): each half mirrors the texture just outside its side."""
    w = x1 - x0
    xs = np.arange(x0, x1)
    left = 2 * x0 - 1 - xs  # reflected about the left edge
    right = 2 * x1 - 1 - xs  # reflected about the right edge
    t = np.clip((xs - x0 - w / 2 + 4) / 8, 0, 1)
    t = (t * t * (3 - 2 * t))[None, :, None]
    band = img[y0:y1]
    img[y0:y1, x0:x1] = band[:, left] * (1 - t) + band[:, right] * t


def _reflect_cols(img: np.ndarray, x0: int, x1: int, y0: int, y1: int) -> None:
    """Fill rows [y0, y1) of columns [x0, x1) from the texture just above and below."""
    h = y1 - y0
    ys = np.arange(y0, y1)
    top = 2 * y0 - 1 - ys
    bottom = 2 * y1 - 1 - ys
    t = np.clip((ys - y0 - h / 2 + 4) / 8, 0, 1)
    t = (t * t * (3 - 2 * t))[:, None, None]
    img[y0:y1, x0:x1] = img[top, x0:x1] * (1 - t) + img[bottom, x0:x1] * t


def _box_blur(a: np.ndarray, r: int) -> np.ndarray:
    """Separable box blur (edges clamped); three passes approximate a Gaussian."""
    for axis in (0, 1):
        pad = [(0, 0)] * a.ndim
        pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis)
        hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
        lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
        a = (hi - lo) / (2 * r + 1)
    return a


def _harmonic(img: np.ndarray, hole: np.ndarray, iterations: int = 2500) -> np.ndarray:
    """Smooth fill: every hole pixel becomes the average of its neighbours (a Laplace solve from the edges),
    started from a blur of the surrounding known pixels so it settles quickly."""
    known = (~hole).astype(float)[..., None]
    num, den = img * known, known
    for _ in range(3):
        num, den = _box_blur(num, 8), _box_blur(den, 8)
    out = img.copy()
    out[hole] = (num / np.maximum(den, 1e-6))[hole]
    ys, xs = np.where(hole)
    for _ in range(iterations):
        out[ys, xs] = (out[ys - 1, xs] + out[ys + 1, xs] + out[ys, xs - 1] + out[ys, xs + 1]) / 4
    return out


def _texture_fill(win: np.ndarray, offset) -> np.ndarray:
    """The painting with the cross removed: the crossbar's ends from above and below, then the upright from
    the sides (the upright's fill covers the middle of the crossbar too). Filled slightly past the hole so the
    soft blend has real values to blend towards."""
    out = win.copy()
    ox, oy = offset
    g = FEATHER
    bx0, by0, bx1, by1 = HOLE_BAR[0] - ox - g, HOLE_BAR[1] - oy - g, HOLE_BAR[2] - ox + g, HOLE_BAR[3] - oy + g
    ax0, ay0, ax1, ay1 = HOLE_ARM[0] - ox - g, HOLE_ARM[1] - oy - g, HOLE_ARM[2] - ox + g, HOLE_ARM[3] - oy + g
    _reflect_cols(out, ax0, bx0, ay0, ay1)
    _reflect_cols(out, bx1, ax1, ay0, ay1)
    _reflect_rows(out, bx0, bx1, by0, by1)
    return out


def _fill(win: np.ndarray, hole: np.ndarray, offset) -> np.ndarray:
    """Textured (mirrored) fill on the rim and the laurels; smooth fill across the dark field, where mirroring
    would copy the old cross's glow; blended between the two over 8 rows."""
    textured = _texture_fill(win, offset)
    smooth = _harmonic(win, hole)
    ys = np.arange(win.shape[0]) + offset[1]
    f0, f1 = FIELD
    w = np.clip(np.minimum(ys - f0, f1 - ys) / 8 + 0.5, 0, 1)[:, None, None]  # 1 inside the field, 0 outside
    return textured * (1 - w) + smooth * w


def shrink_cross(poster: Image.Image) -> Image.Image:
    """Return a copy of the fitness poster with the Conqueror cross at SCALE of its size."""
    poster = poster.convert("RGB")
    x0, y0, x1, y1 = REGION
    off = (x0, y0)
    win = np.asarray(poster.crop(REGION), dtype=float)
    shape = win.shape[:2]

    # 1. The cross, with a soft one-pixel edge, its foot fading out as it did into the laurels.
    cross_mask = _rects(shape, (CROSS_BAR, CROSS_ARM), off).astype(float)
    foot = np.clip((CROSS_BAR[3] - (np.arange(shape[0]) + y0)) / 14, 0, 1)
    cross_mask *= foot[:, None]
    alpha = Image.fromarray((cross_mask * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.8))
    layer = Image.fromarray(win.astype(np.uint8), "RGB").convert("RGBA")
    layer.putalpha(alpha)
    lx0, ly0 = CROSS_ARM[0] - 2 - x0, CROSS_BAR[1] - 2 - y0
    lx1, ly1 = CROSS_ARM[2] + 2 - x0, CROSS_BAR[3] + 2 - y0
    layer = layer.crop((lx0, ly0, lx1, ly1))

    # 2. The painting without it, blended in over FEATHER pixels.
    hole = _rects(shape, (HOLE_BAR, HOLE_ARM, HOLE_GLOW), off)
    filled = _fill(win, hole, off)
    soft = np.asarray(Image.fromarray((hole * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(FEATHER / 2)), dtype=float) / 255
    a = np.maximum(soft, hole)[..., None]  # fully replaced inside the hole, fading out around it
    plate = win * (1 - a) + filled * a

    # 3. The smaller cross, centred in the dark field, with a soft glow like the original's.
    w, h = layer.size
    small = layer.resize((round(w * SCALE), round(h * SCALE)), Image.LANCZOS)
    centre_x = (CROSS_BAR[0] + CROSS_BAR[2]) / 2 - x0
    px = round(centre_x - (centre_x - lx0) * SCALE)
    py = round((NEW_CENTRE_Y - y0) - h * SCALE / 2)
    base = Image.fromarray(np.clip(plate, 0, 255).round().astype(np.uint8), "RGB").convert("RGBA")
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    glow.alpha_composite(small, (px, py))
    halo = np.asarray(glow.filter(ImageFilter.GaussianBlur(5)), dtype=float)
    lifted = np.asarray(base, dtype=float)
    a = halo[..., 3:4] / 255 * 0.35
    lifted[..., :3] = 255 - (255 - lifted[..., :3]) * (1 - a * halo[..., :3] / 255)  # screen blend
    base = Image.fromarray(lifted.round().astype(np.uint8), "RGBA")
    base.alpha_composite(small, (px, py))

    out = poster.copy()
    out.paste(base.convert("RGB"), (x0, y0))
    return out
