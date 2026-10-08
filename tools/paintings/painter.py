"""Turns a reference still life into an oil painting with layered curved brush strokes.

Follows Hertzmann's painterly rendering (large brushes first, then smaller ones only where
detail is needed), with bristle streaks inside each stroke, raised paint (impasto) lit from the
upper left, a canvas weave and a warm varnish.
"""
import numpy as np
from scipy import ndimage as ndi
from PIL import Image, ImageDraw


def _lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def paint(ref, radii=(20, 11, 6, 3), threshold=0.05, max_len=7, min_len=2, curve=0.4, seed=3,
          jitter=0.035, bristles=True, edge_stop=0.22, keep=0.18, bristle_var=0.07, relief=0.16, weave=0.028, bloom=0.0, soften=0.0):
    """ref: float RGB 0..1 (H, W, 3). Returns float RGB 0..1."""
    rng = np.random.default_rng(seed)
    H, W = ref.shape[:2]
    # underpainting: a warm, very soft version of the scene
    under = ndi.gaussian_filter(ref, (radii[0] * 0.5, radii[0] * 0.5, 0)) * np.array([1.02, 0.95, 0.85])
    canvas = Image.fromarray((np.clip(under, 0, 1) * 255).astype(np.uint8))
    hmap = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(canvas)
    hdraw = ImageDraw.Draw(hmap)
    for R in radii:
        refb = ndi.gaussian_filter(ref, (R * 0.5, R * 0.5, 0))
        L = _lum(refb)
        gx = ndi.sobel(L, 1)
        gy = ndi.sobel(L, 0)
        # smooth the direction field so strokes sweep calmly along forms instead of wriggling
        gx = ndi.gaussian_filter(gx, max(2.0, R * 1.6))
        gy = ndi.gaussian_filter(gy, max(2.0, R * 1.6))
        gmag = np.hypot(gx, gy)
        gmin = np.percentile(gmag, 35)
        cur = np.asarray(canvas, np.float32) / 255
        diff = np.sqrt(((cur - refb) ** 2).sum(2))
        strokes = []
        step = max(1, int(R * 0.9))
        for y0 in range(0, H, step):
            for x0 in range(0, W, step):
                cell = diff[y0:y0 + step, x0:x0 + step]
                if R != radii[0] and cell.mean() <= threshold:
                    continue
                iy, ix = np.unravel_index(np.argmax(cell), cell.shape)
                strokes.append((x0 + ix, y0 + iy))
        rng.shuffle(strokes)
        for (sx, sy) in strokes:
            col = refb[sy, sx]
            pts = [(float(sx), float(sy))]
            x, y = float(sx), float(sy)
            ldx = ldy = 0.0
            for i in range(max_len):
                ix, iy = int(min(W - 1, max(0, x))), int(min(H - 1, max(0, y)))
                if i > min_len and np.abs(refb[iy, ix] - cur[iy, ix]).sum() < np.abs(refb[iy, ix] - col).sum():
                    break
                # never drag paint across a strong edge
                if i > 0 and np.abs(ref[iy, ix] - col).sum() > edge_stop:
                    pts.pop()
                    break
                gxx, gyy = gx[iy, ix], gy[iy, ix]
                g = np.hypot(gxx, gyy)
                if g < gmin:
                    # flat area: keep going in the previous direction, or a gentle default slant
                    dx, dy = (ldx, ldy) if (ldx or ldy) else (0.94, -0.34)
                else:
                    dx, dy = -gyy / g, gxx / g
                if ldx * dx + ldy * dy < 0:
                    dx, dy = -dx, -dy
                dx, dy = curve * dx + (1 - curve) * ldx, curve * dy + (1 - curve) * ldy
                n = np.hypot(dx, dy) or 1
                dx, dy = dx / n, dy / n
                x, y = x + R * dx, y + R * dy
                if not (0 <= x < W and 0 <= y < H):
                    break
                ldx, ldy = dx, dy
                pts.append((x, y))
            _stroke(draw, hdraw, pts, col, R, rng, jitter, bristles, bristle_var)
    out = np.asarray(canvas, np.float32) / 255
    hm = np.asarray(hmap, np.float32) / 255
    # glaze: let a little of the fully modelled form show through, as in a finished painting
    if soften:
        out = ndi.gaussian_filter(out, (soften, soften, 0))
    out = out * (1 - keep) + ref * keep
    out = finish(out, hm, rng, relief=relief, weave=weave)
    if bloom:
        # a soft glow around the brightest passages, like light on varnish
        L = _lum(out)
        glow = ndi.gaussian_filter(np.clip(L - 0.55, 0, 1)[..., None] * out, (18, 18, 0))
        out = np.clip(out + glow * bloom, 0, 1)
    return out


def refined(ref, seed=3):
    """The site's finish: smooth, blended forms with a quiet brush texture and a warm glow."""
    sm = ndi.gaussian_filter(ref, (0.8, 0.8, 0))
    return paint(sm, radii=(16, 8, 4), threshold=0.04, max_len=8, curve=0.3, seed=seed, jitter=0.012,
                 bristle_var=0.025, edge_stop=0.14, keep=0.62, relief=0.05, weave=0.007, bloom=0.35, soften=0.7)


def _stroke(draw, hdraw, pts, col, R, rng, jitter, bristles, bristle_var=0.07):
    # each stroke mixes slightly differently on the palette
    # value varies a little from stroke to stroke; hue stays true so whites never turn pink or green
    c = np.clip(col * (1 + rng.normal(0, jitter)), 0, 1)
    fill = tuple(int(v * 255) for v in c)
    w = max(1, int(R * 2))
    hv = int(90 + rng.random() * 165)
    if len(pts) == 1:
        x, y = pts[0]
        draw.ellipse([x - R, y - R, x + R, y + R], fill=fill)
        hdraw.ellipse([x - R, y - R, x + R, y + R], fill=hv)
        return
    draw.line(pts, fill=fill, width=w, joint="curve")
    hdraw.line(pts, fill=hv, width=w, joint="curve")
    for (x, y) in (pts[0], pts[-1]):
        draw.ellipse([x - R, y - R, x + R, y + R], fill=fill)
        hdraw.ellipse([x - R * 0.9, y - R * 0.9, x + R * 0.9, y + R * 0.9], fill=hv)
    if bristles and R >= 3:
        # bristle streaks: thin lines running along the stroke, a little lighter or darker
        P = np.array(pts)
        d = np.gradient(P, axis=0)
        nrm = np.stack([-d[:, 1], d[:, 0]], 1)
        nrm /= (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-6)
        k = max(2, int(R / 1.6))
        for j in range(k):
            off = (rng.random() * 2 - 1) * R * 0.8
            cc = np.clip(c * (1 + rng.normal(0, bristle_var)), 0, 1)
            line = [tuple(p) for p in (P + nrm * off)]
            draw.line(line, fill=tuple(int(v * 255) for v in cc), width=max(1, int(R * 0.35)), joint="curve")
            hdraw.line(line, fill=int(min(255, hv + rng.integers(-60, 60))), width=max(1, int(R * 0.3)))


def finish(img, hm, rng, relief=0.16, weave=0.028, varnish=0.10):
    H, W = img.shape[:2]
    h = ndi.gaussian_filter(hm, 1.4)
    # impasto: light from the upper left catches the raised edges of the paint
    gy, gx = np.gradient(h)
    shade = -(gx * -0.6 + gy * -0.75) * relief * 4
    img = img + shade[..., None] * 0.35
    # canvas weave
    yy, xx = np.mgrid[0:H, 0:W]
    tw = (np.sin(xx * 2.4) * np.sin(yy * 2.4)) * weave
    img = img + tw[..., None] * (0.6 + 0.4 * (1 - h))[..., None]
    # warm varnish and gentle contrast
    img = img * np.array([1.0, 0.975, 0.92]) + np.array([0.012, 0.006, -0.004])
    img = np.clip((img - 0.5) * 1.06 + 0.5, 0, 1)
    lum = img[..., 0] * 0.299 + img[..., 1] * 0.587 + img[..., 2] * 0.114
    img = np.clip(lum[..., None] + (img - lum[..., None]) * 1.08, 0, 1)
    return img


def save(img, path, size=None, quality=86):
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    if size:
        im = im.resize(size, Image.LANCZOS)
    im.save(path, quality=quality, optimize=True, progressive=True)
