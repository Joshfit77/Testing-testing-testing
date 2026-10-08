"""More painted objects: roots and spices, herbs, flowers, stoneware."""
from items import *


def ginger_root(sc, cx, cy, s, angle=0.0, seed=0, cut=True):
    g = G(seed)
    c, si = np.cos(angle), np.sin(angle)
    lobes = [(0, 0, 1.0, 0.45), (0.75, -0.25, 0.55, 0.32), (-0.7, 0.1, 0.6, 0.36), (0.3, 0.35, 0.5, 0.3), (1.15, 0.15, 0.4, 0.26)]
    for i, (dx, dy, lx, ly) in enumerate(lobes):
        x, y = cx + (dx * c - dy * si) * s, cy + (dx * si + dy * c) * s
        pts = blob_pts(x, y, lx * s * 0.6, ly * s * 0.6, angle + (g.random() - 0.5) * 0.8, 0.1, seed * 10 + i)
        rings = 0.5 + 0.5 * np.sin(((sc.xx - x) * c + (sc.yy - y) * si) * 0.3)
        col = mottled(sc, rgb(206, 170, 112), 0.14, 4, seed + i, hue=rgb(180, 130, 80)) * (0.9 + 0.12 * rings)[..., None]
        body(sc, pts, col, ks=0.3, shin=18, seed=seed + i, bump=rings * 1.5)
    if cut:
        x, y = cx - 1.05 * s * c, cy - 1.05 * s * si
        cut_disc(sc, x, y, s * 0.26, s * 0.24, 0, (190, 150, 100), 3, (240, 214, 130), seed=seed + 9)


def cinnamon_stick(sc, x0, y0, length, angle, r=16, seed=0):
    c, s = np.cos(angle), np.sin(angle)
    x1, y1 = x0 + c * length, y0 + s * length
    m = sc.stroke_mask([(x0, y0), (x1, y1)], r * 2)
    sc.contact(m)
    across = (-(sc.xx - x0) * s + (sc.yy - y0) * c) / r
    along = ((sc.xx - x0) * c + (sc.yy - y0) * s)
    bark = mottled(sc, rgb(150, 82, 44), 0.15, 2, seed) * (0.9 + 0.1 * np.sin(along * 0.4 + noise(sc.h, sc.w, 2, seed=seed) * 2))[..., None]
    seam = np.exp(-((across - 0.2) / 0.12) ** 2)
    h = np.sqrt(np.clip(1 - across ** 2, 0, 1)) * r
    sc.shade(m, bark * (1 - 0.5 * seam)[..., None], h=h, R=r, ks=0.25, shin=16)
    end = sc.ellipse(x1, y1, r * 0.55, r, angle)
    ang = np.arctan2(sc.yy - y1, sc.xx - x1)
    rad = np.hypot(sc.xx - x1, sc.yy - y1) / r
    spiral = 0.5 + 0.5 * np.sin(rad * 14 - ang * 2)
    sc.over(rgb(120, 60, 30) * (0.7 + 0.45 * spiral)[..., None], end)


def turmeric_root(sc, cx, cy, s, angle, seed=0, cut=True):
    pts = blob_pts(cx, cy, s, s * 0.32, angle, 0.12, seed)
    rings = 0.5 + 0.5 * np.sin(((sc.xx - cx) * np.cos(angle) + (sc.yy - cy) * np.sin(angle)) * 0.35)
    col = mottled(sc, rgb(170, 110, 60), 0.15, 3, seed) * (0.85 + 0.2 * rings)[..., None]
    body(sc, pts, col, ks=0.3, shin=18, seed=seed, bump=rings * 1.5)
    if cut:
        x, y = cx + np.cos(angle) * s * 0.95, cy + np.sin(angle) * s * 0.95
        cut_disc(sc, x, y, s * 0.28, s * 0.3, angle, (170, 110, 60), 3, (242, 140, 20), seed=seed + 1, glints=0.0)


def mint_sprig(sc, x, y, length, angle, color=(70, 140, 60), seed=0, pairs=4):
    c, s = np.cos(angle), np.sin(angle)
    stem = sc.stroke_mask([(x, y), (x + c * length, y + s * length)], 3)
    sc.over(solid(sc, (90, 120, 60)), stem)
    for k in range(pairs):
        t = 0.3 + 0.7 * k / pairs
        bx, by = x + c * length * t, y + s * length * t
        l = length * 0.42 * (1.1 - 0.5 * t)
        for side in (-1, 1):
            leaf(sc, bx, by, l, l * 0.55, angle + side * 0.8, tuple(np.array(color) * (0.85 + 0.25 * G(seed + k).random())), curl=0.25, ruffle=0.08, seed=seed * 20 + k * 2 + (side > 0))
    leaf(sc, x + c * length, y + s * length, length * 0.25, length * 0.14, angle, color, curl=0.2, seed=seed + 99)


def basil(sc, x, y, length, angle, seed=0):
    mint_sprig(sc, x, y, length, angle, color=(52, 118, 40), seed=seed, pairs=3)


def elderberry_cluster(sc, cx, cy, w, h, seed=0):
    g = G(seed)
    stems = []
    for k in range(7):
        a = -np.pi / 2 + (k - 3) * 0.32
        ex, ey = cx + np.cos(a) * w * 0.6, cy + h * 0.9 + np.sin(a) * h * 0.9
        stems.append((ex, ey))
        st = sc.stroke_mask([(cx, cy + h), (ex, ey)], 2.5)
        sc.over(solid(sc, (120, 40, 70)), st)
    for (ex, ey) in stems:
        for j in range(16):
            a, d = g.random() * TAU, np.sqrt(g.random())
            small_round(sc, ex + np.cos(a) * w * 0.2 * d, ey + np.sin(a) * h * 0.18 * d, 7.5, (40, 22, 44), ks=0.9, shin=60, seed=j, shadow=False)


def mortar(sc, cx, cy, rw, color=(150, 146, 136), fill=None):
    inner, front = bowl(sc, cx, cy, rw, rw * 0.75, color=color, inside=tuple(np.array(color) * 0.6), glaze=0.1)
    if fill:
        fill(sc, cx, cy, rw * 0.8, rw * 0.18)
    front()
    pest = sc.stroke_mask([(cx + rw * 0.2, cy + rw * 0.05), (cx + rw * 0.9, cy - rw * 0.8)], rw * 0.22)
    sc.shade(pest, mottled(sc, rgb(*color), 0.12, 3), ks=0.2, shin=12)


def jug(sc, cx, top, w, height, color=(214, 200, 170), band=None):
    rx = w / 2
    pts = []
    for t in np.linspace(0, 1, 30):
        r = rx * (0.62 + 0.38 * np.sin(np.pi * (0.15 + 0.8 * t)))
        pts.append((cx + r, top + t * height))
    pts = pts + [(cx - (p[0] - cx), p[1]) for p in pts[::-1]]
    m = sc.poly(pts, smooth=1.2)
    sc.contact(m, size=w * 0.5)
    u = np.clip((sc.xx - cx) / rx, -1, 1)
    hw = np.sqrt(np.clip(1 - u * u, 0, 1)) * rx
    col = mottled(sc, rgb(*color), 0.08, 10)
    if band:
        b = np.exp(-((sc.yy - (top + height * 0.55)) / (height * 0.05)) ** 2)
        col = col * (1 - 0.8 * b[..., None]) + rgb(*band) * 0.8 * b[..., None]
    sc.shade(m, col, h=hw, R=rx, ks=0.4, shin=40, ao=0.25)
    hm = np.clip(sc.ellipse(cx + rx * 0.95, top + height * 0.4, rx * 0.35, height * 0.25) - sc.ellipse(cx + rx * 0.95, top + height * 0.4, rx * 0.2, height * 0.15), 0, 1) * (sc.xx > cx + rx * 0.8)
    sc.shade(hm, col, ks=0.4, shin=30)
    mouth = sc.ellipse(cx, top, rx * 0.62, rx * 0.16)
    sc.over(solid(sc, (60, 44, 30)), mouth)
    return m


def daisy_bunch(sc, cx, cy, spread, n, seed=0, petal=(246, 242, 232), center=(232, 180, 40), r=34):
    g = G(seed)
    heads = []
    for k in range(n):
        a = -np.pi / 2 + (g.random() - 0.5) * 1.8
        d = spread * (0.5 + 0.5 * g.random())
        hx, hy = cx + np.cos(a) * d, cy + np.sin(a) * d
        st = sc.stroke_mask([(cx, cy + spread * 0.2), ((cx + hx) / 2 + (g.random() - 0.5) * 20, (cy + hy) / 2), (hx, hy)], 2.5)
        sc.over(solid(sc, (80, 110, 56)), st)
        heads.append((hx, hy))
    for k, (hx, hy) in enumerate(sorted(heads, key=lambda p: p[1])):
        flower(sc, hx, hy, r * (0.8 + 0.4 * g.random()), petals=16, petal=petal, center=center, seed=seed * 50 + k, squash=0.75 + 0.2 * g.random())


def lavender_sprig(sc, x, y, length, angle, seed=0):
    c, s = np.cos(angle), np.sin(angle)
    st = sc.stroke_mask([(x, y), (x + c * length, y + s * length)], 2.5)
    sc.over(solid(sc, (110, 130, 80)), st)
    g = G(seed)
    for k in range(18):
        t = 0.62 + 0.38 * k / 18
        bx, by = x + c * length * t, y + s * length * t
        for side in (-1, 1):
            small_round(sc, bx - s * side * 5, by + c * side * 5, 5.5, tuple(np.array((120, 90, 170)) * (0.8 + 0.4 * g.random())), ks=0.2, seed=k, shadow=False)


def aloe_leaf(sc, x, y, length, width, angle, seed=0, cut=False):
    t = np.linspace(0, 1, 40)
    c, s = np.cos(angle), np.sin(angle)
    wid = width / 2 * (1 - t) ** 0.8
    L = [(x + t[i] * length * c - wid[i] * s, y + t[i] * length * s + wid[i] * c) for i in range(40)]
    Rr = [(x + t[i] * length * c + wid[i] * s, y + t[i] * length * s - wid[i] * c) for i in range(40)]
    m = sc.poly(L + Rr[::-1], smooth=0.6)
    sc.contact(m)
    col = speckle(sc, m, mottled(sc, rgb(90, 140, 90), 0.12, 6, seed), rgb(200, 220, 190), 0.002, 1.2, seed)
    sc.shade(m, col, ks=0.5, shin=30, translucency=0.15)
    if cut:
        e = sc.ellipse(x, y, width * 0.2, width * 0.5, angle)
        sc.over(solid(sc, (214, 236, 200)), e)
