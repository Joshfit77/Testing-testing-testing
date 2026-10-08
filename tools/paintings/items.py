"""Painted objects for the still lifes: produce, dishes, glass, herbs."""
from scene import *

TAU = 2 * np.pi


def G(seed):
    return np.random.default_rng(seed)


def solid(sc, c):
    return np.broadcast_to(rgb(*c), sc.img.shape)


def blob_pts(cx, cy, rx, ry, angle=0.0, wobble=0.06, seed=0, n=64, shape=None):
    g = G(seed)
    t = np.linspace(0, TAU, n, endpoint=False)
    ph = g.random(3) * TAU
    r = 1 + wobble * (np.sin(2 * t + ph[0]) * 0.6 + np.sin(3 * t + ph[1]) * 0.4 + np.sin(5 * t + ph[2]) * 0.25)
    if shape is not None:
        r = r * shape(t)
    c, s = np.cos(angle), np.sin(angle)
    x, y = rx * r * np.cos(t), ry * r * np.sin(t)
    return [(cx + x[i] * c - y[i] * s, cy + x[i] * s + y[i] * c) for i in range(n)]


def body(sc, pts, color, var=0.12, scale=8, seed=0, hue=None, ks=0.35, shin=28, smooth=1.0, contact=True,
         bump=None, flat=0.0, translucency=0.06, amb=0.42, kd=0.75, rim=0.12, hscale=1.0, ao=0.35):
    m = sc.poly(pts, smooth=smooth)
    if contact:
        sc.contact(m)
    col = color if np.ndim(color) == 3 else mottled(sc, rgb(*color), var, scale, seed, None if hue is None else rgb(*hue))
    h, R = sc.dome(m, flat=flat)
    sc.shade(m, col, h=h * hscale, R=R, ks=ks, shin=shin, bump=bump, translucency=translucency, amb=amb, kd=kd, rim=rim, ao=ao)
    return m


# ---------------------------------------------------------------- tableware
def board(sc, cx, cy, w, h, color=(150, 104, 62), handle=True):
    """A wooden cutting board seen at a low angle."""
    pts = blob_pts(cx, cy, w / 2, h / 2, 0, 0.0, n=80, shape=lambda t: 1 / np.maximum(np.abs(np.cos(t)) ** 6 + np.abs(np.sin(t)) ** 6, 1e-3) ** (1 / 6))
    m = sc.poly(pts, smooth=1)
    edge = sc.poly([(x, y + h * 0.08) for x, y in pts], smooth=1)
    sc.contact(np.clip(m + edge, 0, 1), size=w * 0.3)
    sc.over(solid(sc, tuple(np.array(color) * 0.62)), edge)
    grain = ndi.gaussian_filter(noise(sc.h, sc.w, 1.5, seed=5, octaves=1), (0.5, 14))
    col = solid(sc, color) * (0.9 + 0.22 * grain)[..., None]
    col = col * (1.08 - 0.25 * np.clip((sc.xx - (cx - w / 2)) / w, 0, 1))[..., None]
    sc.over(col, m)
    if handle:
        hm = sc.ellipse(cx + w / 2 + w * 0.06, cy, w * 0.09, h * 0.12)
        sc.over(col, hm)
    return m


def glass(sc, cx, top, w, height, liquid=None, level=0.75, tint=(200, 210, 210), opacity=0.92, foam=None):
    """A drinking glass: liquid inside, glass highlights and a rim."""
    rx = w / 2
    ry = rx * 0.22
    bottom = top + height
    rect = (np.abs(sc.xx - cx) <= rx) & (sc.yy >= top) & (sc.yy <= bottom)
    shape = np.clip(rect.astype(np.float32) + sc.ellipse(cx, bottom, rx, ry) + sc.ellipse(cx, top, rx, ry), 0, 1)
    shape = ndi.gaussian_filter(shape, 0.7)
    sc.contact(shape * 0.6, size=w * 0.6)
    u = np.clip((sc.xx - cx) / rx, -1, 1)
    cyl = np.sqrt(np.clip(1 - u * u, 0, 1))
    # what shows through the glass, slightly darkened and tinted
    behind = sc.img * (0.82 + 0.1 * cyl)[..., None] * rgb(*tint)[None, None] / 0.8
    sc.over(np.clip(behind, 0, 1), shape * 0.5)
    if liquid is not None:
        ltop = top + height * (1 - level)
        lrect = (np.abs(sc.xx - cx) <= rx * 0.94) & (sc.yy >= ltop) & (sc.yy <= bottom - 2)
        lm = np.clip(lrect.astype(np.float32) + sc.ellipse(cx, bottom - 2, rx * 0.94, ry * 0.9), 0, 1)
        lm = ndi.gaussian_filter(lm, 0.7)
        lcol = rgb(*liquid) * (0.62 + 0.45 * cyl ** 0.6)[..., None] * (1.05 - 0.15 * u)[..., None]
        sc.over(lcol, lm * opacity)
        surf = sc.ellipse(cx, ltop, rx * 0.94, ry * 0.9)
        scol = rgb(*(foam or liquid)) * 1.1
        sc.over(solid(sc, tuple(np.clip(scol * 255, 0, 255))), surf * (0.95 if foam else 0.6))
    # vertical highlights
    hl = np.exp(-((u + 0.55) / 0.08) ** 2) * 0.55 + np.exp(-((u - 0.62) / 0.05) ** 2) * 0.22
    sc.img += (hl * shape * ((sc.yy > top) & (sc.yy < bottom)))[..., None]
    rim = np.clip(sc.ellipse(cx, top, rx, ry) - sc.ellipse(cx, top, rx * 0.95, ry * 0.8), 0, 1)
    sc.img += (rim * 0.35)[..., None]
    return shape


def jar(sc, cx, top, w, height, fill=None, fill_fn=None, level=0.9, lid=None, label=None):
    """A glass jar with shoulders; contents color or a function painting the contents."""
    rx = w / 2
    neck = rx * 0.78
    pts = [(cx - neck, top), (cx + neck, top), (cx + neck, top + height * 0.06), (cx + rx, top + height * 0.16),
           (cx + rx, top + height * 0.95), (cx + rx * 0.9, top + height), (cx - rx * 0.9, top + height),
           (cx - rx, top + height * 0.95), (cx - rx, top + height * 0.16), (cx - neck, top + height * 0.06)]
    m = sc.poly(pts, smooth=1.2)
    sc.contact(m * 0.8, size=w * 0.6)
    u = np.clip((sc.xx - cx) / rx, -1, 1)
    cyl = np.sqrt(np.clip(1 - u * u, 0, 1))
    behind = sc.img * 0.85
    sc.over(behind, m * 0.5)
    ftop = top + height * (1 - level)
    inside = m * (sc.yy >= ftop)
    if fill_fn:
        before = sc.img.copy()
        fill_fn(sc)
        sc.img = before * (1 - inside[..., None]) + sc.img * inside[..., None]
    elif fill is not None:
        col = mottled(sc, rgb(*fill), 0.08, 6) * (0.6 + 0.5 * cyl ** 0.7)[..., None]
        sc.over(col, inside)
    if label:
        lb = m * (sc.yy > top + height * 0.42) * (sc.yy < top + height * 0.7)
        lcol = solid(sc, label) * (0.75 + 0.35 * cyl)[..., None]
        sc.over(lcol, lb)
    hl = np.exp(-((u + 0.6) / 0.07) ** 2) * 0.6 + np.exp(-((u - 0.55) / 0.05) ** 2) * 0.2
    sc.img += (hl * m)[..., None]
    if lid:
        lm = sc.poly([(cx - neck * 1.05, top - height * 0.08), (cx + neck * 1.05, top - height * 0.08),
                      (cx + neck * 1.05, top + height * 0.04), (cx - neck * 1.05, top + height * 0.04)], smooth=1)
        lc = solid(sc, lid) * (0.7 + 0.45 * cyl)[..., None]
        sc.over(lc, lm)
    return m


def bottle(sc, cx, top, w, height, liquid=(150, 140, 30), level=0.7, cork=(180, 140, 90)):
    rx = w / 2
    nk = rx * 0.28
    pts = [(cx - nk, top), (cx + nk, top), (cx + nk, top + height * 0.28), (cx + rx, top + height * 0.45),
           (cx + rx, top + height * 0.97), (cx + rx * 0.9, top + height), (cx - rx * 0.9, top + height),
           (cx - rx, top + height * 0.97), (cx - rx, top + height * 0.45), (cx - nk, top + height * 0.28)]
    m = sc.poly(pts, smooth=1.5)
    sc.contact(m * 0.8, size=w * 0.7)
    u = np.clip((sc.xx - cx) / rx, -1, 1)
    cyl = np.sqrt(np.clip(1 - u * u, 0, 1))
    glassc = sc.img * 0.7 + rgb(60, 80, 50) * 0.3
    sc.over(glassc, m * 0.7)
    ltop = top + height * (1 - level)
    lm = m * (sc.yy >= ltop)
    lc = rgb(*liquid) * (0.45 + 0.75 * cyl ** 0.5)[..., None] * (1.15 - 0.3 * (u + 1) / 2)[..., None]
    sc.over(lc, lm * 0.95)
    hl = np.exp(-((u + 0.55) / 0.07) ** 2) * 0.7 + np.exp(-((u - 0.6) / 0.05) ** 2) * 0.25
    sc.img += (hl * m)[..., None]
    ck = sc.poly([(cx - nk * 0.9, top - height * 0.07), (cx + nk * 0.9, top - height * 0.07), (cx + nk * 0.85, top + height * 0.04), (cx - nk * 0.85, top + height * 0.04)], smooth=1)
    sc.shade(ck, mottled(sc, rgb(*cork), 0.15, 2), ks=0.1, shin=8)
    return m


def cup(sc, cx, cy, rw, height, color=(232, 224, 208), liquid=(150, 110, 50), saucer=True, handle=True, band=None):
    """A teacup on a saucer, seen slightly from above."""
    if saucer:
        sm = sc.ellipse(cx, cy + height * 0.98, rw * 1.65, rw * 0.42)
        sc.contact(sm, size=rw)
        sc.shade(sm, solid(sc, color), h=sc.dome(sm, flat=0.7)[0] * 0.3, R=rw, ks=0.45, shin=50, ao=0.2)
        well = sc.ellipse(cx, cy + height * 0.98, rw * 1.0, rw * 0.25)
        sc.img *= (1 - 0.12 * well)[..., None]
    ry = rw * 0.3
    rim = sc.ellipse(cx, cy, rw, ry)
    t = np.clip((sc.yy - cy) / height, 0, 1)
    prof = rw * (1 - 0.32 * t ** 1.6)
    lower = (np.abs(sc.xx - cx) <= prof) & (sc.yy >= cy) & (sc.yy <= cy + height)
    bowlm = np.clip(rim + ndi.gaussian_filter(lower.astype(np.float32), 0.8) + sc.ellipse(cx, cy + height, rw * 0.68, ry * 0.6), 0, 1)
    if handle:
        hm = np.clip(sc.ellipse(cx + rw * 1.0, cy + height * 0.4, rw * 0.32, height * 0.32) - sc.ellipse(cx + rw * 1.0, cy + height * 0.4, rw * 0.18, height * 0.2), 0, 1)
        hm *= (sc.xx > cx + rw * 0.85)
        sc.shade(hm, solid(sc, color), ks=0.5, shin=40)
    sc.contact(bowlm * 0.5, size=rw * 0.6)
    u = np.clip((sc.xx - cx) / rw, -1, 1)
    hw = np.sqrt(np.clip(1 - u * u, 0, 1)) * rw
    col = solid(sc, color)
    if band:
        b = np.exp(-((sc.yy - (cy + height * 0.28)) / (height * 0.06)) ** 2)
        col = col * (1 - 0.8 * b[..., None]) + rgb(*band) * 0.8 * b[..., None]
    sc.shade(bowlm, col, h=hw, R=rw, ks=0.55, shin=60, ao=0.15, rim=0.1)
    inner = sc.ellipse(cx, cy, rw * 0.93, ry * 0.82)
    lc = rgb(*liquid) * np.clip(0.75 + 0.4 * (sc.yy - cy) / ry, 0.5, 1.1)[..., None] * np.clip(1.15 - 0.3 * (sc.xx - cx + rw) / (2 * rw), 0.7, 1.2)[..., None]
    sc.over(lc, inner)
    glint = sc.ellipse(cx - rw * 0.35, cy - ry * 0.15, rw * 0.22, ry * 0.18)
    sc.img += (ndi.gaussian_filter(glint, 2) * 0.35)[..., None]
    return bowlm


def steam(sc, cx, cy, height, width=30, seed=0, strength=0.22):
    g = G(seed)
    acc = np.zeros((sc.h, sc.w), np.float32)
    for k in range(3):
        ph = g.random() * TAU
        pts = [(cx + (k - 1) * width * 0.4 + np.sin(t * 5 + ph) * width * (0.3 + t), cy - t * height) for t in np.linspace(0, 1, 30)]
        acc += sc.stroke_mask(pts, width * 0.35)
    acc = ndi.gaussian_filter(acc, width * 0.3)
    fade = np.clip((cy - sc.yy) / height, 0, 1)
    fade = np.sin(np.pi * np.clip(fade, 0, 1)) * (sc.yy < cy)
    sc.img = sc.img + (np.clip(acc, 0, 1) * fade * strength)[..., None] * np.array([1, 0.97, 0.92])


# ---------------------------------------------------------------- heaps and filled bowls
def heap(sc, cx, cy, rw, rh, n, draw, seed=0, mound=True):
    """Lay n things in a mound centered at (cx, cy); draw(sc, x, y, i, g) paints one. Back to front."""
    g = G(seed)
    pts = []
    while len(pts) < n:
        x = (g.random() * 2 - 1)
        y = (g.random() * 2 - 1)
        if x * x + y * y > 1:
            continue
        yy = cy + y * rh
        if mound:
            yy -= rh * 0.8 * (1 - x * x) * (1 - abs(y)) * 0.6
        pts.append((cx + x * rw, yy))
    pts.sort(key=lambda p: p[1])
    for i, (x, y) in enumerate(pts):
        draw(sc, x, y, i, g)
    return pts


def bowl_of(sc, cx, cy, rw, depth, fill, color=(206, 190, 158), inside=(150, 128, 100), band=None, mound=0.55):
    """A bowl heaped with something; fill(sc, cx, cy, rw, rh) paints the contents."""
    inner, front = bowl(sc, cx, cy, rw, depth, color=color, inside=inside, band=band)
    fill(sc, cx, cy - rw * 0.08, rw * 0.86, rw * 0.22 + rw * mound * 0.2)
    front()


def small_round(sc, x, y, r, color, ks=0.45, shin=36, seed=0, var=0.0, squash=0.9, angle=0.0, shadow=True):
    m = sc.ellipse(x, y, r, r * squash, angle)
    if shadow:
        sc.shadow(m, r * 0.3, r * 0.25, r * 0.35, 0.4)
    c = np.array(color, np.float32)
    if var:
        c = c * (1 + G(seed).normal(0, var, 3))
    sc.shade(m, rgb(*np.clip(c, 0, 255)), ks=ks, shin=shin, translucency=0.05, ao=0.3)
    return m


# ---------------------------------------------------------------- produce
def berry_cluster(sc, cx, cy, r, color, drupe=0.2, seed=0, ks=0.7, elong=1.0, calyx=None):
    """Raspberry or blackberry: a cone of shiny drupelets."""
    g = G(seed)
    base = sc.ellipse(cx, cy, r, r * elong)
    sc.contact(base)
    sc.shade(base, rgb(*(np.array(color) * 0.7)), ks=0.2, shin=10)
    dr = r * drupe
    pts = []
    for ring in np.linspace(0.15, 1.0, 5):
        k = max(5, int(ring * 14))
        for j in range(k):
            a = j / k * TAU + g.random() * 0.4
            pts.append((cx + np.cos(a) * r * 0.82 * ring, cy + np.sin(a) * r * 0.82 * ring * elong))
    pts.sort(key=lambda p: -np.hypot(p[0] - cx, p[1] - cy))
    for i, (x, y) in enumerate(pts):
        c = np.array(color) * (0.85 + 0.3 * g.random())
        m = sc.ellipse(x, y, dr, dr)
        sc.shade(m, rgb(*np.clip(c, 0, 255)), ks=ks, shin=50, translucency=0.15, ao=0.45)
    if calyx:
        for j in range(5):
            a = -np.pi / 2 + (j - 2) * 0.5
            leaf(sc, cx, cy - r * elong * 0.9, r * 0.5, r * 0.1, a, calyx, curl=0.1, vein=False, seed=seed + j)


def strawberry(sc, cx, cy, r, angle=0.0, seed=0):
    shape = lambda t: 1 - 0.28 * np.clip(np.sin(t), 0, 1) ** 2 + 0.1 * np.clip(-np.sin(t), 0, 1)
    pts = blob_pts(cx, cy, r * 0.92, r * 1.08, angle, 0.03, seed, shape=lambda t: 1 + 0.25 * np.sin(t) ** 3)
    m = sc.poly(pts, smooth=1)
    sc.contact(m)
    col = mottled(sc, rgb(200, 34, 34), 0.12, 5, seed, hue=rgb(230, 80, 50))
    col = speckle(sc, m, col, rgb(240, 200, 90), 0.006, 0.6, seed)
    sc.shade(m, col, ks=0.6, shin=45, translucency=0.12)
    c, s = np.cos(angle), np.sin(angle)
    tx, ty = cx + r * 1.0 * s, cy - r * 1.0 * c
    for j in range(6):
        a = angle - np.pi / 2 + (j - 2.5) * 0.55
        leaf(sc, tx, ty, r * 0.55, r * 0.14, a, (64, 116, 46), curl=0.2, vein=False, seed=seed * 10 + j)


def citrus(sc, cx, cy, r, peel=(232, 160, 30), seed=0, leafy=False, squash=0.95):
    m = sc.ellipse(cx, cy, r, r * squash)
    sc.contact(m)
    col = mottled(sc, rgb(*peel), 0.08, 2.5, seed)
    dimples = noise(sc.h, sc.w, 1.0, seed=seed + 2, octaves=1)
    h, R = sc.dome(m)
    sc.shade(m, col, h=h, R=R, bump=dimples * 1.4, ks=0.4, shin=24, translucency=0.1)
    nub = sc.ellipse(cx + r * 0.1, cy - r * squash * 0.82, r * 0.07, r * 0.05)
    sc.over(solid(sc, (110, 100, 40)), nub)
    if leafy:
        leaf(sc, cx + r * 0.1, cy - r * 0.85, r * 0.9, r * 0.28, -0.5, (52, 92, 40), curl=0.3, seed=seed + 4)
    return m


def cut_disc(sc, cx, cy, rx, ry, angle, rim_color, rim_w, flesh, center=None, seed=0, glints=0.003):
    """A cut face (kiwi, fig, avocado, papaya...) showing skin rim and flesh; center(sc, mask) adds detail."""
    outer = sc.ellipse(cx, cy, rx, ry, angle)
    sc.contact(outer)
    sc.shade(outer, mottled(sc, rgb(*rim_color), 0.12, 4, seed), ks=0.3, shin=20)
    inner = sc.ellipse(cx, cy, rx - rim_w, ry - rim_w, angle)
    col = flesh if np.ndim(flesh) == 3 else mottled(sc, rgb(*flesh), 0.08, 5, seed)
    rad = np.hypot((sc.xx - cx) / rx, (sc.yy - cy) / ry)
    col = col * (1.06 - 0.18 * rad)[..., None] * (1.06 - 0.12 * (sc.xx - cx) / rx)[..., None]
    sc.over(col, inner)
    if center:
        center(sc, inner)
    if glints:
        gl = (G(seed).random(sc.img.shape[:2]) < glints) * inner
        sc.img += (ndi.gaussian_filter(gl.astype(np.float32), 0.8) * 1.6)[..., None]
    return outer


def herb_bunch(sc, x, y, length, angle, color=(64, 104, 46), leaves=14, size=0.25, seed=0, stem=(96, 120, 60)):
    g = G(seed)
    c, s = np.cos(angle), np.sin(angle)
    for i in range(leaves):
        t = 0.25 + 0.75 * g.random()
        bx, by = x + t * length * c, y + t * length * s
        a = angle + (g.random() - 0.5) * 1.6
        l = length * size * (0.7 + 0.6 * g.random())
        st = sc.stroke_mask([(x, y), (bx, by)], 1.6)
        sc.over(solid(sc, stem), st)
        leaf(sc, bx, by, l, l * 0.42, a, tuple(np.array(color) * (0.8 + 0.4 * g.random())), curl=0.2, seed=seed * 50 + i)


def tuber(sc, cx, cy, length, width, angle, skin, seed=0, knobs=0.12, eyes=True):
    pts = blob_pts(cx, cy, length / 2, width / 2, angle, knobs, seed, n=72,
                   shape=lambda t: 1 - 0.18 * np.cos(t) ** 2 * (np.cos(t) > 0))
    col = mottled(sc, rgb(*skin), 0.16, 5, seed, hue=rgb(*(np.array(skin) * 0.7)))
    if eyes:
        col = speckle(sc, None, col, rgb(*(np.array(skin) * 0.55)), 0.0015, 1.2, seed)
    return body(sc, pts, col, ks=0.25, shin=16, seed=seed)


def carrot(sc, x, y, length, width, angle, seed=0, tops=True):
    g = G(seed)
    t = np.linspace(0, 1, 40)
    wid = width / 2 * (1 - t ** 1.4 * 0.92)
    c, s = np.cos(angle), np.sin(angle)
    bend = np.sin(t * np.pi) * length * 0.04 * (g.random() - 0.5)
    L = [(x + t[i] * length * c - (bend[i] + wid[i]) * s, y + t[i] * length * s + (bend[i] + wid[i]) * c) for i in range(40)]
    Rr = [(x + t[i] * length * c - (bend[i] - wid[i]) * s, y + t[i] * length * s + (bend[i] - wid[i]) * c) for i in range(40)]
    m = sc.poly(L + Rr[::-1], smooth=0.8)
    sc.contact(m)
    along = (sc.xx - x) * c + (sc.yy - y) * s
    rings = np.clip(np.sin(along * 0.55 + noise(sc.h, sc.w, 3, seed=seed) * 3) * 3 - 2.2, 0, 1)
    col = mottled(sc, rgb(232, 118, 34), 0.1, 6, seed, hue=rgb(214, 90, 20)) * (1 - 0.28 * rings[..., None])
    h, R = sc.dome(m)
    sc.shade(m, col, h=h, R=R, bump=-rings * 1.5, ks=0.35, shin=22, translucency=0.1)
    if tops:
        for j in range(6):
            a = angle + np.pi + (j - 2.5) * 0.22
            l = length * (0.45 + 0.3 * g.random())
            pts = [(x + np.cos(a) * l * q + np.sin(q * 4) * 6, y + np.sin(a) * l * q) for q in np.linspace(0, 1, 10)]
            st = sc.stroke_mask(pts, 2.4)
            sc.over(solid(sc, (80, 120, 50)), st)
            for k in range(5):
                q = 0.4 + 0.6 * k / 5
                px, py = x + np.cos(a) * l * q, y + np.sin(a) * l * q
                leaf(sc, px, py, l * 0.18, l * 0.035, a + (0.8 if k % 2 else -0.8), (74, 126, 50), curl=0.2, vein=False, seed=seed * 100 + j * 10 + k)


def wedge(sc, cx, cy, r, a0, a1, flesh, rind, rind_w, seeds=None, seed=0, white=None):
    """A slice seen face-on: watermelon, melon, orange wedge."""
    t = np.linspace(a0, a1, 40)
    pts = [(cx, cy)] + [(cx + np.cos(a) * r, cy + np.sin(a) * r) for a in t]
    m = sc.poly(pts, smooth=0.8)
    sc.contact(m)
    rad = np.hypot(sc.xx - cx, sc.yy - cy) / r
    col = mottled(sc, rgb(*flesh), 0.1, 3, seed) * (1.08 - 0.15 * rad)[..., None]
    if white:
        wb = np.clip((rad - (1 - rind_w / r * 2.2)) * r / rind_w, 0, 1)
        col = col * (1 - wb[..., None]) + rgb(*white) * wb[..., None]
    rb = np.clip((rad - (1 - rind_w / r)) * r / 2 + 0.5, 0, 1)
    col = col * (1 - rb[..., None]) + mottled(sc, rgb(*rind), 0.2, 3, seed + 1) * rb[..., None]
    sc.shade(m, col, ks=0.4, shin=30, flat=0.5, strength=0.5, ao=0.2)
    if seeds:
        g = G(seed)
        for k in range(seeds):
            a = a0 + (a1 - a0) * (0.15 + 0.7 * g.random())
            d = r * (0.35 + 0.35 * g.random())
            sm = sc.ellipse(cx + np.cos(a) * d, cy + np.sin(a) * d, r * 0.025, r * 0.045, a)
            sc.over(solid(sc, (30, 22, 18)), sm)
    return m


def branch_leaves(sc, pts, leaf_len, leaf_w, color, seed=0, every=0.12, stem=(96, 82, 56), stem_w=3):
    g = G(seed)
    st = sc.stroke_mask(pts, stem_w)
    sc.over(solid(sc, stem), st)
    P = np.array(pts)
    seg = np.cumsum(np.r_[0, np.hypot(*np.diff(P, axis=0).T)])
    for k, t in enumerate(np.arange(every, 1, every)):
        d = t * seg[-1]
        i = np.searchsorted(seg, d) - 1
        i = max(0, min(i, len(P) - 2))
        f = (d - seg[i]) / max(1e-6, seg[i + 1] - seg[i])
        x, y = P[i] + (P[i + 1] - P[i]) * f
        dirn = np.arctan2(*(P[i + 1] - P[i])[::-1])
        side = 1 if k % 2 else -1
        a = dirn + side * (0.6 + 0.3 * g.random())
        leaf(sc, x, y, leaf_len * (0.8 + 0.4 * g.random()), leaf_w, a, tuple(np.array(color) * (0.85 + 0.3 * g.random())), curl=0.15, seed=seed * 70 + k)


def flower(sc, cx, cy, r, petals=14, petal=(246, 242, 232), center=(232, 180, 40), seed=0, squash=0.85):
    g = G(seed)
    for k in range(petals):
        a = k / petals * TAU + g.random() * 0.2
        px, py = cx + np.cos(a) * r * 0.55, cy + np.sin(a) * r * 0.55 * squash
        m = sc.ellipse(px, py, r * 0.5, r * 0.13, a)
        sc.shade(m, rgb(*petal), ks=0.15, shin=10, ao=0.15, strength=0.5)
    cm = sc.ellipse(cx, cy, r * 0.26, r * 0.24)
    col = speckle(sc, cm, mottled(sc, rgb(*center), 0.15, 1.5, seed), rgb(*(np.array(center) * 0.7)), 0.08, 0.5, seed)
    sc.shade(cm, col, ks=0.2, shin=10)


def block(sc, x, y, w, h, d, color, seed=0, top_light=1.12, side_dark=0.7, tex=0.05):
    """A box seen from slightly above and to the right: top, front and side faces."""
    top = [(x, y), (x + w, y), (x + w + d * 0.6, y - d * 0.5), (x + d * 0.6, y - d * 0.5)]
    front = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    side = [(x + w, y), (x + w + d * 0.6, y - d * 0.5), (x + w + d * 0.6, y + h - d * 0.5), (x + w, y + h)]
    allm = np.clip(sc.poly(top) + sc.poly(front) + sc.poly(side), 0, 1)
    sc.contact(allm)
    base = mottled(sc, rgb(*color), tex, 3, seed)
    sc.over(base * top_light, sc.poly(top, smooth=0.5))
    grad = (1.02 - 0.12 * np.clip((sc.yy - y) / h, 0, 1))[..., None]
    sc.over(base * 0.92 * grad, sc.poly(front, smooth=0.5))
    sc.over(base * side_dark * grad, sc.poly(side, smooth=0.5))
    return allm
