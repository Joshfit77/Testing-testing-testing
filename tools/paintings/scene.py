"""Still-life scene builder: shaded objects on a table, lit from the upper left.

All images are float32 arrays in 0..1, shape (H, W, 3). Masks are float32 (H, W) in 0..1.
"""
import numpy as np
from scipy import ndimage as ndi

LIGHT = np.array([-0.55, -0.68, 0.48]); LIGHT /= np.linalg.norm(LIGHT)
HALF = LIGHT + np.array([0, 0, 1.0]); HALF /= np.linalg.norm(HALF)
rng = np.random.default_rng(7)


def rgb(*c):
    return np.array(c, dtype=np.float32) / 255.0


_NOISE = {}


def noise(h, w, scale, seed=None, octaves=3):
    """Smooth random field, roughly -1..1. Fields are cached and reused at shifted offsets."""
    key = (h, w, round(float(scale), 1), octaves, (seed if seed is not None else int(rng.integers(0, 6))) % 6)
    base = _NOISE.get(key)
    if base is None:
        base = _noise(h, w, scale, key[-1] + 1000, octaves)
        _NOISE[key] = base
    r = np.random.default_rng(None if seed is None else seed)
    return np.roll(base, (int(r.integers(0, h)), int(r.integers(0, w))), (0, 1))


def _noise(h, w, scale, seed=None, octaves=3):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = max(0.6, scale / (2 ** o))
        out += amp * ndi.gaussian_filter(r.standard_normal((h, w)).astype(np.float32), s, mode="wrap")
        tot += amp
        amp *= 0.5
    out /= tot
    sd = out.std() or 1
    return out / (3 * sd)  # roughly -1..1


class Scene:
    def __init__(self, w, h, seed=1):
        self.w, self.h = w, h
        self.img = np.zeros((h, w, 3), np.float32)
        self.yy, self.xx = np.mgrid[0:h, 0:w].astype(np.float32)
        global rng
        rng = np.random.default_rng(seed)

    # ---------- masks ----------
    def ellipse(self, cx, cy, rx, ry, angle=0.0):
        c, s = np.cos(angle), np.sin(angle)
        x, y = self.xx - cx, self.yy - cy
        u, v = (x * c + y * s) / rx, (-x * s + y * c) / ry
        d = np.sqrt(u * u + v * v)
        edge = 1.0 / max(1.0, min(rx, ry))
        return np.clip((1 - d) / edge + 0.5, 0, 1).astype(np.float32)

    def egg_mask(self, cx, cy, r, angle=0.0, elong=1.28, point=0.18):
        c, s = np.cos(angle), np.sin(angle)
        x, y = self.xx - cx, self.yy - cy
        u, v = x * c + y * s, -x * s + y * c  # u along long axis (pointy end at -u)
        a = r * elong
        k = 1 + point * (u / a)  # wider at +u, narrower at -u
        d = np.sqrt((u / a) ** 2 + (v / (r * np.clip(k, 0.6, 1.4))) ** 2)
        return np.clip((1 - d) * r + 0.5, 0, 1).astype(np.float32)

    def _raster(self, pts, pad, fn):
        from PIL import Image, ImageDraw
        ss = 4
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        x0 = int(max(0, min(xs) - pad)); y0 = int(max(0, min(ys) - pad))
        x1 = int(min(self.w, max(xs) + pad + 1)); y1 = int(min(self.h, max(ys) + pad + 1))
        out = np.zeros((self.h, self.w), np.float32)
        if x1 <= x0 or y1 <= y0:
            return out
        im = Image.new("L", ((x1 - x0) * ss, (y1 - y0) * ss), 0)
        fn(ImageDraw.Draw(im), [((x - x0) * ss, (y - y0) * ss) for x, y in pts], ss)
        out[y0:y1, x0:x1] = np.asarray(im.resize((x1 - x0, y1 - y0), Image.LANCZOS), np.float32) / 255
        return out

    def poly(self, pts, smooth=0.0):
        m = self._raster(pts, 4 + 3 * smooth, lambda d, P, ss: d.polygon(P, fill=255))
        if smooth:
            m = np.clip((ndi.gaussian_filter(m, smooth) - 0.5) * 3 + 0.5, 0, 1)
        return m

    def stroke_mask(self, pts, width):
        def fn(d, P, ss):
            d.line(P, fill=255, width=max(1, int(width * ss)), joint="curve")
            for x, y in (P[0], P[-1]):
                rr = width * ss / 2
                d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=255)
        return self._raster(pts, width + 2, fn)

    # ---------- height / normals ----------
    @staticmethod
    def dome(mask, flat=0.0, soften=0.06):
        inside = mask > 0.5
        if not inside.any():
            return np.zeros_like(mask), 1.0
        ys, xs = np.nonzero(inside)
        y0, y1, x0, x1 = max(0, ys.min() - 6), ys.max() + 7, max(0, xs.min() - 6), xs.max() + 7
        dc = ndi.distance_transform_edt(inside[y0:y1, x0:x1]).astype(np.float32)
        R = float(dc.max())
        dc = ndi.gaussian_filter(dc, max(0.8, R * soften))
        d = np.zeros_like(mask)
        d[y0:y1, x0:x1] = dc
        t = np.clip(d / (R * (1 - flat) + 1e-6), 0, 1)
        h = np.sqrt(np.clip(1 - (1 - t) ** 2, 0, 1)) * R
        return h.astype(np.float32), R

    @staticmethod
    def normals(h, strength=1.0, bump=None):
        if bump is not None:
            h = h + bump
        gy, gx = np.gradient(h)
        n = np.dstack([-gx * strength, -gy * strength, np.ones_like(h)])
        n /= np.linalg.norm(n, axis=2, keepdims=True)
        return n

    # ---------- compositing ----------
    def over(self, color, mask):
        m = mask[..., None]
        self.img = self.img * (1 - m) + color * m

    def shadow(self, mask, dx, dy, blur, strength, clip=None):
        ys, xs = np.nonzero(mask > 0.01)
        if not len(ys):
            return
        pad = int(abs(dx) + abs(dy) + blur * 3 + 4)
        y0, y1 = max(0, ys.min() - pad), min(self.h, ys.max() + pad + 1)
        x0, x1 = max(0, xs.min() - pad), min(self.w, xs.max() + pad + 1)
        sl = (slice(y0, y1), slice(x0, x1))
        sh = ndi.shift(mask[sl], (dy, dx), order=1, mode="constant")
        sh = ndi.gaussian_filter(sh, blur)
        if clip is not None:
            sh = sh * clip[sl]
        self.img[sl] *= (1 - strength * np.clip(sh, 0, 1))[..., None]

    def contact(self, mask, size=None):
        """A cast shadow down-right of the object plus a tight dark contact line."""
        ys, xs = np.nonzero(mask > 0.5)
        if not len(ys):
            return
        R = max(np.ptp(ys), np.ptp(xs)) / 2 if size is None else size
        self.shadow(mask, R * 0.32, R * 0.16, R * 0.28, 0.5)
        self.shadow(mask, R * 0.06, R * 0.05, R * 0.06, 0.55)

    def shade(self, mask, color, h=None, R=None, amb=0.42, kd=0.75, ks=0.35, shin=28, bump=None,
              strength=1.0, rim=0.12, flat=0.0, ao=0.35, clip=None, spec_color=None, translucency=0.0):
        """Shade an object of `mask` and lay it over the image (worked on its bounding box only)."""
        m = mask if clip is None else mask * clip
        ys, xs = np.nonzero(m > 0.002)
        if not len(ys):
            return
        y0, y1, x0, x1 = max(0, ys.min() - 2), min(self.h, ys.max() + 3), max(0, xs.min() - 2), min(self.w, xs.max() + 3)
        sl = (slice(y0, y1), slice(x0, x1))
        if h is None:
            h, R = self.dome(mask, flat=flat)
        hc = h[sl]
        n = self.normals(hc, strength, None if bump is None else bump[sl])
        ndl = np.clip((n * LIGHT).sum(2), 0, 1)
        ndh = np.clip((n * HALF).sum(2), 0, 1)
        col = color[sl] if np.ndim(color) == 3 else np.broadcast_to(np.asarray(color, np.float32), hc.shape + (3,))
        lit = col * (amb + kd * ndl)[..., None]
        lit = lit + col * (translucency * np.clip(0.5 + 0.5 * (n * LIGHT).sum(2), 0, 1))[..., None]
        if ao and R:
            edge = np.clip(1 - hc / (R + 1e-6), 0, 1) ** 2
            lit = lit * (1 - ao * edge)[..., None]
        sc = np.ones(3, np.float32) if spec_color is None else spec_color
        lit = lit + (ks * ndh ** shin)[..., None] * sc
        if rim:
            up = np.clip(n[..., 1], 0, 1)
            lit = lit + (rim * up * (1 - ndl))[..., None] * np.array([0.55, 0.38, 0.22], np.float32)
        mm = m[sl][..., None]
        self.img[sl] = self.img[sl] * (1 - mm) + np.clip(lit, 0, 1.2) * mm
        return n

    # ---------- settings ----------
    def backdrop(self, base=(52, 38, 26), light=(118, 92, 62), horizon=0.6, wood=(96, 62, 38), cloth=None):
        H, W = self.h, self.w
        x, y = self.xx / W, self.yy / H
        # warm dark wall, lighter where the light falls (upper left)
        g = np.clip(1 - np.hypot(x - 0.28, y - 0.18) / 0.95, 0, 1) ** 1.6
        wall = rgb(*base) * (1 - g[..., None]) + rgb(*light) * g[..., None]
        wall *= (1 + 0.10 * noise(H, W, 40))[..., None]
        self.img[:] = wall
        hy = int(H * horizon)
        self.horizon = hy
        # wooden table top with grain, darker toward the front edge
        t = (self.yy - hy) / max(1, H - hy)
        grain = noise(H, W, 2.0, octaves=2)
        grain = ndi.gaussian_filter(grain, (0.6, 18))
        streak = 0.5 + 0.5 * np.sin(self.yy * 0.9 + 6 * ndi.gaussian_filter(noise(H, W, 30), 4))
        wcol = rgb(*wood) * (0.82 + 0.16 * streak + 0.18 * grain)[..., None]
        lightx = np.clip(1.1 - np.abs(x - 0.35) * 1.1, 0.55, 1.1)
        wcol *= (lightx * (1.05 - 0.35 * np.clip(t, 0, 1)))[..., None]
        table = (self.yy >= hy).astype(np.float32)
        table = ndi.gaussian_filter(table, 0.7)
        self.over(wcol, table)
        # the table's back edge catches the light
        edge = np.exp(-((self.yy - hy) / 2.2) ** 2) * (self.yy >= hy - 3)
        self.img += (edge * 0.10 * lightx)[..., None]
        if cloth:
            self.linen(*cloth)

    def linen(self, pts, color=(232, 222, 202), stripe=(150, 52, 40), stripes=True):
        m = self.poly(pts, smooth=1.2)
        H, W = self.h, self.w
        folds = ndi.gaussian_filter(noise(H, W, 40, octaves=1), (6, 22))
        hh = folds * 38
        weave = 0.03 * np.sin(self.xx * 2.1) * np.sin(self.yy * 2.1)
        col = np.broadcast_to(rgb(*color), self.img.shape).copy() * (1 + weave)[..., None]
        if stripes:
            # a pair of woven stripes running across the cloth
            ys, xs = np.nonzero(m > 0.5)
            y0 = ys.min() + 0.55 * (ys.max() - ys.min())
            band = np.exp(-((self.yy - y0 - 0.25 * (self.xx - xs.mean()) * 0.08 - folds * 6) / 7) ** 2)
            band2 = np.exp(-((self.yy - y0 - 22 - 0.25 * (self.xx - xs.mean()) * 0.08 - folds * 6) / 4) ** 2)
            b = np.clip(band + band2, 0, 1)
            col = col * (1 - 0.8 * b[..., None]) + rgb(*stripe) * 0.8 * b[..., None]
        self.contact(m * 0.25)
        self.shade(m, col, h=hh, R=None, amb=0.55, kd=0.55, ks=0.05, shin=6, strength=1.0, rim=0, ao=0)

    # ---------- finishing the reference ----------
    def vignette(self, amount=0.45):
        x, y = self.xx / self.w, self.yy / self.h
        d = np.hypot((x - 0.45) * 1.1, (y - 0.42) * 1.2)
        self.img *= (1 - amount * np.clip(d - 0.25, 0, 1) ** 1.4)[..., None]


# ---------- reusable objects ----------
def lerp(a, b, t):
    return a + (b - a) * t


def speckle(sc, mask, base, dark, density=0.02, size=1.2, seed=None):
    """Base color with small darker speckles (egg shells, pears, seeds)."""
    H, W = sc.h, sc.w
    r = np.random.default_rng(seed)
    dots = (r.random((H, W)) < density).astype(np.float32)
    dots = np.clip(ndi.gaussian_filter(dots, size) * 6, 0, 1)
    col = np.broadcast_to(base, sc.img.shape).copy()
    col = col * (1 - dots[..., None]) + dark * dots[..., None]
    return col


def mottled(sc, base, var=0.12, scale=14, seed=None, hue=None):
    H, W = sc.h, sc.w
    n = noise(H, W, scale, seed=seed)
    col = np.broadcast_to(base, sc.img.shape).copy() * (1 + var * n)[..., None]
    if hue is not None:
        n2 = noise(H, W, scale * 1.7, seed=None if seed is None else seed + 1)
        col = col + (np.clip(n2, 0, 1) * 0.6)[..., None] * (hue - base)
    return col


def egg(sc, cx, cy, r, angle=0.0, color=(178, 112, 70), speck=True, seed=0):
    m = sc.egg_mask(cx, cy, r, angle)
    sc.contact(m)
    base = rgb(*color)
    col = mottled(sc, base, 0.10, 10, seed)
    if speck:
        col = speckle(sc, m, col, base * 0.62, 0.0025, 0.9, seed)
    sc.shade(m, col, amb=0.40, kd=0.78, ks=0.22, shin=18, translucency=0.10, rim=0.16)
    return m


def bowl(sc, cx, cy, rw, depth, color=(205, 190, 160), inside=None, glaze=0.45, band=None):
    """A round bowl seen slightly from above. Returns (front_wall_mask, draw_front, rim_mask).

    Draw the contents after calling this, then call draw_front() so the front wall overlaps them."""
    rim_ry = rw * 0.28
    rim = sc.ellipse(cx, cy, rw, rim_ry)
    lower = sc.ellipse(cx, cy, rw, depth) * (sc.yy >= cy)
    body = np.clip(rim + lower, 0, 1)
    sc.contact(body, size=rw)
    base = rgb(*color)
    col = mottled(sc, base, 0.06, 18)
    if band:
        b = np.exp(-((sc.yy - (cy + depth * 0.35)) / (depth * 0.08)) ** 2)
        col = col * (1 - 0.7 * b[..., None]) + rgb(*band) * 0.7 * b[..., None]
    h, R = sc.dome(body)
    # a bowl is a cylinder-like wall: shade by horizontal profile
    u = np.clip((sc.xx - cx) / rw, -1, 1)
    hw = np.sqrt(np.clip(1 - u * u, 0, 1)) * rw * 0.9
    shaded_before = sc.img.copy()
    sc.shade(body, col, h=hw, R=rw, amb=0.40, kd=0.72, ks=glaze, shin=40, ao=0.2, rim=0.15)
    body_img = sc.img.copy()
    # interior: darker, lit on the far (front-inner) wall
    inner = sc.ellipse(cx, cy, rw * 0.93, rim_ry * 0.86)
    icol = rgb(*(inside or color)) * np.clip(0.45 + 0.55 * ((sc.yy - (cy - rim_ry)) / (2 * rim_ry)), 0.35, 1.0)[..., None] * \
        np.clip(1.15 - 0.5 * (sc.xx - (cx - rw)) / (2 * rw), 0.6, 1.1)[..., None]
    sc.over(icol, inner)
    front = body * (1 - inner) * (sc.yy >= cy - rim_ry * 0.2)

    def draw_front():
        m = front[..., None]
        sc.img = sc.img * (1 - m) + body_img * m
        # thin bright rim highlight on the lip
        lip = np.clip(rim - sc.ellipse(cx, cy, rw * 0.965, rim_ry * 0.9), 0, 1)
        lip *= np.clip(1.0 - (sc.xx - cx) / rw * 0.6, 0.3, 1.3)
        sc.img += (lip * 0.22)[..., None]

    return inner, draw_front


def plate(sc, cx, cy, rw, color=(226, 218, 200), rimcol=None):
    ry = rw * 0.34
    m = sc.ellipse(cx, cy, rw, ry)
    sc.contact(m, size=rw * 0.5)
    base = rgb(*color)
    well = sc.ellipse(cx, cy + ry * 0.04, rw * 0.72, ry * 0.68)
    d = np.clip((sc.xx - cx) / rw, -1, 1)
    shade_lr = 1.06 - 0.18 * d
    col = np.broadcast_to(base, sc.img.shape) * shade_lr[..., None]
    sc.over(col, m)
    # rim catches light at the top left, shadowed bottom right
    ring = np.clip(m - well, 0, 1)
    ang = np.arctan2((sc.yy - cy) / ry, (sc.xx - cx) / rw)
    lightness = 0.5 + 0.5 * np.cos(ang - np.arctan2(-0.7, -0.6))
    sc.img += (ring * 0.10 * (lightness - 0.4))[..., None]
    wcol = np.broadcast_to(base * 0.9, sc.img.shape) * shade_lr[..., None]
    sc.over(wcol, well * 0.85)
    if rimcol:
        band = np.clip(sc.ellipse(cx, cy, rw * 0.97, ry * 0.95) - sc.ellipse(cx, cy, rw * 0.91, ry * 0.88), 0, 1)
        sc.over(np.broadcast_to(rgb(*rimcol), sc.img.shape), band * 0.8)
    return m


def leaf(sc, x, y, length, width, angle, color=(70, 110, 48), curl=0.25, ruffle=0.0, vein=True, seed=None):
    t = np.linspace(0, 1, 40)
    c, s = np.cos(angle), np.sin(angle)
    bend = curl * length * np.sin(np.pi * t) * 0.4
    wid = width * np.sin(np.pi * t) ** 0.8 * (1 - 0.25 * t)
    if ruffle:
        r = np.random.default_rng(seed)
        wid = wid * (1 + ruffle * np.sin(t * 40 + r.random() * 6) * np.sin(np.pi * t))
    px = t * length
    left = [(x + (px[i]) * c - (bend[i] + wid[i]) * s, y + (px[i]) * s + (bend[i] + wid[i]) * c) for i in range(40)]
    right = [(x + (px[i]) * c - (bend[i] - wid[i]) * s, y + (px[i]) * s + (bend[i] - wid[i]) * c) for i in range(40)]
    m = sc.poly(left + right[::-1], smooth=0.6)
    sc.contact(m * 0.6)
    base = rgb(*color)
    col = mottled(sc, base, 0.14, 8, seed, hue=base * np.array([1.25, 1.1, 0.7], np.float32))
    h, R = sc.dome(m, soften=0.2)
    bump = None
    if vein:
        mid = [(x + px[i] * c - bend[i] * s, y + px[i] * s + bend[i] * c) for i in range(40)]
        vm = sc.stroke_mask(mid, max(1.2, width * 0.08))
        col = col * (1 - 0.35 * vm[..., None]) + base * 1.45 * 0.35 * vm[..., None]
        bump = -vm * 1.5
    sc.shade(m, col, h=h * 0.5, R=R, amb=0.45, kd=0.72, ks=0.25, shin=20, bump=bump, rim=0.08, ao=0.25)
    return m


def sprig(sc, x, y, length, angle, needle=9, color=(58, 84, 52), count=24, seed=0, round_leaves=False):
    """Rosemary/thyme-like sprig: a woody stem with small narrow (or round) leaves."""
    r = np.random.default_rng(seed)
    c, s = np.cos(angle), np.sin(angle)
    pts = [(x + t * length * c, y + t * length * s + np.sin(t * 3) * 4) for t in np.linspace(0, 1, 12)]
    stem = sc.stroke_mask(pts, 3.0)
    sc.over(np.broadcast_to(rgb(100, 76, 50), sc.img.shape), stem)
    for i in range(count):
        t = 0.06 + 0.92 * i / count
        bx, by = x + t * length * c, y + t * length * s + np.sin(t * 3) * 4
        side = 1 if i % 2 else -1
        a = angle + side * (0.7 + r.random() * 0.4) - 0.2
        l = needle * (1.2 - 0.45 * t) * (0.85 + 0.3 * r.random())
        tone = np.clip(np.array(color) * (0.85 + 0.4 * r.random()), 0, 255)
        if round_leaves:
            m = sc.ellipse(bx + np.cos(a) * l * 0.6, by + np.sin(a) * l * 0.6, l * 0.55, l * 0.35, a)
            sc.shade(m, rgb(*tone), ks=0.25, shin=16, ao=0.2)
        else:
            leaf(sc, bx, by, l, l * 0.2, a, tuple(tone), curl=0.1, vein=False, seed=seed * 100 + i)


def citrus_half(sc, cx, cy, r, peel=(232, 180, 40), flesh=(246, 214, 92), pith=(250, 240, 210), angle=0.0, seed=0, segments=10):
    """A halved citrus, cut face toward the viewer, slightly foreshortened."""
    ry = r * 0.92
    outer = sc.ellipse(cx, cy, r, ry, angle)
    sc.contact(outer)
    # peel rim
    sc.shade(outer, mottled(sc, rgb(*peel), 0.1, 3, seed), amb=0.45, kd=0.7, ks=0.3, shin=30)
    p = sc.ellipse(cx, cy, r * 0.9, ry * 0.9, angle)
    sc.over(np.broadcast_to(rgb(*pith), sc.img.shape), p)
    f = sc.ellipse(cx, cy, r * 0.84, ry * 0.84, angle)
    ang = np.arctan2(sc.yy - cy, sc.xx - cx)
    rad = np.hypot((sc.xx - cx) / r, (sc.yy - cy) / ry)
    seg = np.abs(np.sin(ang * segments / 2))
    membrane = np.clip(1 - seg * 9, 0, 1) * (rad > 0.12)
    juice = mottled(sc, rgb(*flesh), 0.16, 1.5, seed)
    col = juice * (1 - 0.6 * membrane[..., None]) + rgb(*pith) * 0.6 * membrane[..., None]
    col *= (1.08 - 0.25 * rad)[..., None]
    sc.over(col, f)
    # wet glints
    glint = (np.random.default_rng(seed).random(sc.img.shape[:2]) < 0.004) * f
    sc.img += (ndi.gaussian_filter(glint.astype(np.float32), 0.8) * 2.2)[..., None]
    return outer


def sphere_fruit(sc, cx, cy, r, color, ry=None, var=0.12, hue=None, ks=0.45, shin=30, seed=0, dimple=True, stem=True, speck=0.0, angle=0.0, scale=10):
    ry = ry or r * 0.95
    m = sc.ellipse(cx, cy, r, ry, angle)
    sc.contact(m)
    base = rgb(*color)
    col = mottled(sc, base, var, scale, seed, hue=None if hue is None else rgb(*hue))
    if speck:
        col = speckle(sc, m, col, np.minimum(base * 1.35, 1), speck, 0.7, seed)
    h, R = sc.dome(m)
    bump = None
    if dimple:
        top = sc.ellipse(cx + r * 0.05, cy - ry * 0.72, r * 0.22, ry * 0.1)
        bump = -ndi.gaussian_filter(top, 3) * R * 0.25
    sc.shade(m, col, h=h, R=R, ks=ks, shin=shin, bump=bump, translucency=0.08)
    if stem:
        sx, sy = cx + r * 0.05, cy - ry * 0.75
        s = sc.stroke_mask([(sx, sy), (sx + r * 0.08, sy - r * 0.28), (sx + r * 0.16, sy - r * 0.36)], max(2, r * 0.07))
        sc.over(np.broadcast_to(rgb(86, 62, 36), sc.img.shape), s)
    return m


def cluster(sc, cx, cy, rw, rh, n, r, color, var=0.15, ks=0.5, shin=40, seed=0, hue=None, jitter=0.25, sort=True, item=None):
    """Many small round things in a heap (berries, beans, lentils, nuts, grapes)."""
    g = np.random.default_rng(seed)
    pts = []
    for i in range(n * 4):
        a, d = g.random() * 2 * np.pi, np.sqrt(g.random())
        x, y = cx + np.cos(a) * d * rw, cy + np.sin(a) * d * rh
        pts.append((x, y))
        if len(pts) >= n:
            break
    pts.sort(key=lambda p: p[1])  # back to front
    for i, (x, y) in enumerate(pts):
        rr = r * (1 + jitter * (g.random() - 0.5))
        tone = np.array(color, np.float32) * (1 + var * (g.random() - 0.5) * 2)
        if item:
            item(sc, x, y, rr, tuple(np.clip(tone, 0, 255)), seed * 1000 + i, g)
        else:
            m = sc.ellipse(x, y, rr, rr * 0.92, g.random() * 3)
            sc.shadow(m, rr * 0.25, rr * 0.2, rr * 0.3, 0.35)
            sc.shade(m, rgb(*np.clip(tone, 0, 255)), ks=ks, shin=shin, translucency=0.05)
    return pts
