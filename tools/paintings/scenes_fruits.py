from scenes_foods import stage, done, spill, CLOTH_L, CLOTH_R
from items import *


def fruit_group(sc, items):
    """items: list of (x, y, r, color, kw) painted back to front."""
    for (x, y, r, c, kw) in sorted(items, key=lambda t: t[1]):
        sphere_fruit(sc, x, y, r, c, **kw)


def apple():
    sc = stage(51, CLOTH_L, horizon=0.4)
    bowl_of(sc, 560, 430, 280, 180, lambda sc, cx, cy, rw, rh: fruit_group(sc, [
        (cx - 130, cy - 40, 92, (180, 30, 30), dict(hue=(220, 170, 60), seed=1, scale=14)),
        (cx + 10, cy - 70, 96, (196, 44, 32), dict(hue=(230, 190, 70), seed=2, scale=14)),
        (cx + 140, cy - 30, 90, (150, 170, 50), dict(hue=(200, 60, 40), seed=3, scale=14)),
        (cx - 60, cy + 10, 88, (170, 26, 30), dict(hue=(220, 160, 60), seed=4, scale=14)),
        (cx + 75, cy + 15, 86, (200, 60, 36), dict(hue=(230, 190, 80), seed=5, scale=14))]), color=(196, 176, 140), mound=0)
    sphere_fruit(sc, 200, 640, 92, (186, 34, 32), hue=(226, 180, 70), seed=8, scale=14)
    cut_disc(sc, 360, 680, 80, 72, 0.2, (190, 40, 30), 5, (246, 236, 200), seed=9,
             center=lambda sc, m: [small_round(sc, 350 + k * 14, 680 + (k % 2) * 10, 6, (70, 40, 24), ks=0.6, squash=0.6, seed=k, shadow=False) for k in range(3)])
    leaf(sc, 860, 600, 130, 46, -2.6, (70, 110, 46), seed=11)
    return done(sc)


def avocado_half(sc, cx, cy, r, angle, seed, pit=True):
    pts = blob_pts(cx, cy, r, r * 1.3, angle, 0.04, seed, shape=lambda t: 1 - 0.18 * np.clip(-np.sin(t), 0, 1))
    outer = sc.poly(pts, smooth=1)
    sc.contact(outer)
    sc.shade(outer, mottled(sc, rgb(40, 66, 30), 0.2, 3, seed), ks=0.4, shin=20)
    inner = sc.poly(blob_pts(cx, cy, r * 0.9, r * 1.18, angle, 0.04, seed, shape=lambda t: 1 - 0.18 * np.clip(-np.sin(t), 0, 1)), smooth=1)
    rad = np.hypot((sc.xx - cx) / r, (sc.yy - cy) / (r * 1.2))
    col = rgb(214, 220, 120) * (1 - np.clip(rad - 0.55, 0, 1)[..., None] * 0.9) + rgb(110, 150, 50) * np.clip(rad - 0.55, 0, 1)[..., None] * 0.9
    sc.shade(inner, col, ks=0.45, shin=30, flat=0.6, strength=0.4, ao=0.1)
    if pit:
        c, s = np.cos(angle), np.sin(angle)
        px, py = cx - s * r * 0.15, cy + c * r * 0.15
        pm = sc.ellipse(px, py, r * 0.42, r * 0.46)
        sc.shadow(pm, 4, 4, 5, 0.4)
        sc.shade(pm, mottled(sc, rgb(140, 84, 44), 0.12, 3, seed), ks=0.7, shin=40)


def avocado():
    sc = stage(52, CLOTH_R, horizon=0.4)
    board(sc, 500, 540, 760, 300)
    m = sc.egg_mask(300, 480, 105, angle=-np.pi / 2 - 0.3, elong=1.3, point=0.3)
    sc.contact(m)
    col = mottled(sc, rgb(46, 64, 28), 0.15, 3, 1)
    sc.shade(m, col, ks=0.45, shin=24, bump=noise(sc.h, sc.w, 1.2, seed=2) * 2)
    avocado_half(sc, 520, 520, 110, 0.15, 3, pit=True)
    avocado_half(sc, 730, 540, 105, -0.2, 4, pit=False)
    citrus_half(sc, 880, 380, 58, peel=(80, 150, 50), flesh=(176, 212, 96), seed=5)
    return done(sc)


def banana_shape(sc, cx, cy, length, width, angle, seed):
    t = np.linspace(0, 1, 50)
    c, s = np.cos(angle), np.sin(angle)
    curve = -np.sin(np.pi * t) * length * 0.22
    wid = width / 2 * np.sin(np.pi * np.clip(t * 0.94 + 0.03, 0, 1)) ** 0.5
    x0 = cx - length / 2
    L = [(x0 + t[i] * length, cy + curve[i] - wid[i]) for i in range(50)]
    Rr = [(x0 + t[i] * length, cy + curve[i] + wid[i]) for i in range(50)]
    rot = lambda p: (cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c)
    m = sc.poly([rot(p) for p in L + Rr[::-1]], smooth=1)
    sc.contact(m)
    along = ((sc.xx - cx) * c + (sc.yy - cy) * s) / (length / 2)
    col = mottled(sc, rgb(238, 200, 50), 0.08, 6, seed)
    tips = np.clip(np.abs(along) * 3 - 2.4, 0, 1)
    col = col * (1 - tips[..., None]) + rgb(110, 90, 30) * tips[..., None]
    col = speckle(sc, m, col, rgb(120, 80, 30), 0.0012, 1.1, seed)
    h, R = sc.dome(m)
    ridge = 0.5 + 0.5 * np.cos(((-(sc.xx - cx) * s + (sc.yy - cy) * c)) / (width * 0.18))
    sc.shade(m, col, h=h, R=R, bump=ridge * 1.6, ks=0.35, shin=24, translucency=0.1)
    stem = sc.stroke_mask([rot((x0 - width * 0.1, cy)), rot((x0 - width * 0.6, cy - width * 0.25))], width * 0.25)
    sc.over(solid(sc, (100, 90, 50)), stem)


def banana():
    sc = stage(53, CLOTH_L, horizon=0.4)
    for k in range(4):
        banana_shape(sc, 520 + k * 10, 420 + k * 48, 560, 104, -0.08 + k * 0.05, k)
    return done(sc)


def berry_bowl(seed, cloth, item, n, r, spill_n=8, bowl=(220, 208, 186), extra=None, mound=0.55):
    sc = stage(seed, cloth, horizon=0.4)
    draw = lambda sc, x, y, i, g: item(sc, x, y, r * (0.85 + 0.3 * g.random()), seed * 1000 + i, g)
    bowl_of(sc, 540, 420, 270, 190, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, n, draw, seed=seed), color=bowl, mound=mound)
    spill(sc, 240, 650, 170, 55, spill_n, draw, seed + 2)
    if extra:
        extra(sc)
    return done(sc)


def blackberry():
    return berry_bowl(54, CLOTH_R, lambda sc, x, y, r, s, g: berry_cluster(sc, x, y, r, (40, 26, 44), seed=s, elong=1.15), 60, 34,
                      extra=lambda sc: leaf(sc, 860, 640, 140, 60, -2.4, (70, 110, 50), seed=3))


def blueberry():
    def b(sc, x, y, r, s, g):
        small_round(sc, x, y, r, (58, 70, 130) if g.random() > 0.3 else (70, 80, 140), ks=0.25, shin=16, seed=s)
        sc.img += (sc.ellipse(x - r * 0.25, y - r * 0.25, r * 0.35, r * 0.3) * 0.08)[..., None]
        sc.over(solid(sc, (40, 40, 70)), sc.ellipse(x + r * 0.05, y - r * 0.05, r * 0.18, r * 0.16))
    return berry_bowl(55, CLOTH_L, b, 220, 21, spill_n=14)


def cherry(sc, x, y, r, color, seed, stem=True, g=None):
    m = sphere_fruit(sc, x, y, r, color, ks=0.9, shin=60, seed=seed, stem=False, dimple=True, hue=(90, 10, 20))
    if stem:
        g = g or G(seed)
        sx = x + (g.random() - 0.5) * r * 2
        st = sc.stroke_mask([(x, y - r * 0.8), (x + (sx - x) * 0.5, y - r * 2.2), (sx, y - r * 3.2)], max(2, r * 0.1))
        sc.over(solid(sc, (90, 110, 50)), st)


def cherries():
    sc = stage(56, CLOTH_R, horizon=0.4)
    bowl_of(sc, 520, 440, 260, 170, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 34,
            lambda sc, x, y, i, g: cherry(sc, x, y, 38, (150, 16, 30), i, stem=g.random() > 0.4, g=g), seed=4), color=(226, 218, 200), band=(80, 100, 140))
    for k, (x, y) in enumerate([(200, 660), (270, 640), (830, 640)]):
        cherry(sc, x, y, 40, (160, 20, 34), 100 + k)
    return done(sc)


def tart_cherry():
    sc = stage(57, CLOTH_L, horizon=0.42)
    glass(sc, 330, 300, 170, 290, liquid=(150, 14, 30), level=0.8, opacity=0.95)
    bowl_of(sc, 640, 520, 190, 130, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 26,
            lambda sc, x, y, i, g: cherry(sc, x, y, 30, (196, 30, 36), i, stem=g.random() > 0.5, g=g), seed=7), color=(214, 204, 186))
    for k, (x, y) in enumerate([(860, 650), (900, 690)]):
        cherry(sc, x, y, 32, (200, 34, 38), 200 + k)
    return done(sc)


def coconut():
    sc = stage(58, CLOTH_R, horizon=0.4)
    hair = lambda sd: mottled(sc, rgb(110, 72, 44), 0.3, 1.2, sd)
    m = sc.ellipse(330, 470, 170, 160)
    sc.contact(m)
    sc.shade(m, hair(1), ks=0.1, shin=8, bump=noise(sc.h, sc.w, 1, seed=2) * 3)
    for k, (x, y) in enumerate([(300, 420), (360, 420), (330, 470)]):
        sc.over(solid(sc, (60, 40, 26)), sc.ellipse(x, y, 13, 11))
    # halved coconut: brown shell, white flesh ring, hollow
    for (cx, cy, r, sd) in [(640, 560, 150, 3), (860, 640, 110, 4)]:
        outer = sc.ellipse(cx, cy, r, r * 0.6)
        sc.contact(outer)
        sc.shade(outer, hair(sd), ks=0.1, shin=8)
        flesh = sc.ellipse(cx, cy - r * 0.04, r * 0.92, r * 0.54)
        sc.over(solid(sc, (246, 242, 232)), flesh)
        hol = sc.ellipse(cx + r * 0.03, cy - r * 0.02, r * 0.74, r * 0.4)
        sc.over(rgb(222, 214, 196) * np.clip(0.7 + 0.5 * (sc.yy - cy) / (r * 0.4), 0.5, 1.1)[..., None], hol)
    return done(sc)


def date_fruit(sc, x, y, r, seed, g=None):
    pts = blob_pts(x, y, r * 1.6, r, (g.random() if g is not None else 0) * 3, 0.05, seed)
    wr = noise(sc.h, sc.w, 2, seed=seed)
    col = mottled(sc, rgb(110, 50, 26), 0.2, 3, seed) * (0.85 + 0.25 * wr)[..., None]
    body(sc, pts, col, ks=0.8, shin=50, bump=wr * 3, seed=seed)


def date():
    sc = stage(59, CLOTH_L, horizon=0.4)
    bowl_of(sc, 540, 440, 260, 160, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 22, lambda sc, x, y, i, g: date_fruit(sc, x, y, 34, i, g), seed=5), color=(196, 160, 110), band=(60, 90, 120))
    for k in range(4):
        date_fruit(sc, 200 + k * 60, 650 + (k % 2) * 30, 36, 50 + k, G(k))
    return done(sc)


def fig():
    sc = stage(60, CLOTH_R, horizon=0.4)
    for (x, y, r, sd) in [(320, 450, 110, 1), (470, 470, 100, 2)]:
        pts = blob_pts(x, y, r, r * 1.05, 0, 0.03, sd, shape=lambda t: 1 - 0.25 * np.clip(-np.sin(t), 0, 1) ** 2)
        body(sc, pts, mottled(sc, rgb(84, 40, 74), 0.18, 8, sd, hue=rgb(120, 110, 60)), ks=0.5, shin=30)
        st = sc.stroke_mask([(x, y - r * 0.95), (x + 8, y - r * 1.2)], 10)
        sc.over(solid(sc, (100, 100, 50)), st)

    def seeds(sc, inner, cx, cy, r):
        rad = np.hypot((sc.xx - cx) / r, (sc.yy - cy) / r)
        pulp = rgb(196, 70, 80) * (1 - np.clip(rad * 1.3 - 0.2, 0, 1))[..., None] + rgb(240, 214, 190) * np.clip(rad * 1.3 - 0.2, 0, 1)[..., None]
        sc.over(pulp, inner)
        dots = (G(7).random(sc.img.shape[:2]) < 0.01) * inner * (rad < 0.75)
        sc.over(solid(sc, (240, 210, 140)), np.clip(ndi.gaussian_filter(dots.astype(np.float32), 0.7) * 4, 0, 1))
    for (x, y, r, sd) in [(660, 560, 100, 3), (830, 600, 92, 4)]:
        cut_disc(sc, x, y, r, r * 1.1, 0.1, (90, 44, 80), 6, (230, 200, 180), seed=sd, center=lambda sc, inner, x=x, y=y, r=r: seeds(sc, inner, x, y, r))
    return done(sc)


def grape_bunch(sc, cx, cy, w, h, color, seed, r=30):
    g = G(seed)
    pts = []
    for row in range(9):
        t = row / 8
        width = w * (1 - t * 0.85)
        k = max(1, int(width / (r * 1.5)))
        for j in range(k):
            x = cx - width / 2 + (j + 0.5) * width / k + (g.random() - 0.5) * r * 0.5
            pts.append((x, cy + t * h + (g.random() - 0.5) * r * 0.4))
    stem = sc.stroke_mask([(cx, cy - r * 0.5), (cx + 10, cy - r * 2.2), (cx + 40, cy - r * 3)], 6)
    sc.over(solid(sc, (100, 90, 50)), stem)
    for i, (x, y) in enumerate(sorted(pts, key=lambda p: p[1])):
        c = np.array(color) * (0.85 + 0.3 * g.random())
        m = sc.ellipse(x, y, r, r * 1.1)
        sc.shadow(m, r * 0.2, r * 0.2, r * 0.3, 0.4)
        sc.shade(m, rgb(*np.clip(c, 0, 255)), ks=0.6, shin=40, translucency=0.25, ao=0.4)


def grape():
    sc = stage(61, CLOTH_L, horizon=0.38)
    plate(sc, 520, 600, 400, color=(222, 214, 196), rimcol=(80, 100, 130))
    leaf(sc, 300, 560, 220, 120, -0.3, (70, 106, 44), curl=0.2, seed=2)
    grape_bunch(sc, 420, 400, 280, 240, (80, 40, 90), 1)
    grape_bunch(sc, 650, 430, 230, 210, (170, 190, 80), 2, r=27)
    return done(sc)


def citrus_scene(seed, cloth, peel, flesh, whole_r=110, extra=None):
    sc = stage(seed, cloth, horizon=0.4)
    citrus(sc, 330, 460, whole_r, peel=peel, seed=1, leafy=True)
    citrus(sc, 520, 520, whole_r * 0.9, peel=peel, seed=2)
    citrus_half(sc, 730, 560, whole_r * 0.9, peel=peel, flesh=flesh, seed=3)
    leaf(sc, 870, 660, 150, 52, -2.7, (52, 96, 40), seed=9)
    if extra:
        extra(sc)
    return done(sc)


def grapefruit():
    return citrus_scene(62, CLOTH_R, (238, 170, 70), (236, 104, 96), whole_r=130)


def kiwi():
    sc = stage(63, CLOTH_L, horizon=0.4)
    fuzz = lambda sd: mottled(sc, rgb(140, 104, 62), 0.2, 1.3, sd)
    for (x, y, sd) in [(320, 460, 1), (470, 490, 2)]:
        m = sc.egg_mask(x, y, 95, angle=0.2, elong=1.25, point=0.0)
        sc.contact(m)
        sc.shade(m, fuzz(sd), ks=0.1, shin=8)

    def center(sc, inner, cx, cy, r):
        ang = np.arctan2(sc.yy - cy, sc.xx - cx)
        rad = np.hypot(sc.xx - cx, sc.yy - cy) / r
        rays = 0.5 + 0.5 * np.cos(ang * 22)
        col = rgb(120, 170, 40) * (1 - np.clip(0.35 - rad, 0, 1)[..., None] * 2.5) + rgb(236, 236, 200) * np.clip(0.35 - rad, 0, 1)[..., None] * 2.5
        col = col * (0.92 + 0.12 * rays)[..., None]
        sc.over(col, inner)
        g = G(int(cx))
        for k in range(30):
            a = g.random() * TAU
            d = r * (0.38 + 0.08 * g.random())
            sc.over(solid(sc, (30, 26, 20)), sc.ellipse(cx + np.cos(a) * d, cy + np.sin(a) * d, r * 0.03, r * 0.06, a))
    for (x, y, r, sd) in [(680, 560, 100, 3), (860, 620, 90, 4)]:
        cut_disc(sc, x, y, r, r, 0, (120, 90, 56), 5, (120, 170, 40), seed=sd, center=lambda sc, inner, x=x, y=y, r=r: center(sc, inner, x, y, r))
    return done(sc)


def lemon():
    def extra(sc):
        leaf(sc, 180, 640, 150, 54, -0.4, (52, 96, 40), seed=9)
    sc = stage(64, CLOTH_R, horizon=0.4)
    for (x, y, r, sd) in [(330, 450, 110, 1), (520, 500, 100, 2)]:
        m = sc.egg_mask(x, y, r * 0.82, angle=0.15, elong=1.25, point=0.0)
        sc.contact(m)
        sc.shade(m, mottled(sc, rgb(240, 206, 40), 0.07, 2.5, sd), ks=0.45, shin=30, bump=noise(sc.h, sc.w, 1, seed=sd) * 1.2)
        for sgn in (-1, 1):
            tip = sc.ellipse(x + sgn * r * 1.0, y + sgn * r * 0.15, r * 0.12, r * 0.09)
            sc.shade(tip, rgb(220, 190, 40), ks=0.3, shin=20)
    citrus_half(sc, 730, 560, 95, seed=3)
    extra(sc)
    return done(sc)


def lime():
    return citrus_scene(65, CLOTH_L, (90, 150, 40), (176, 214, 100), whole_r=95)


def orange():
    return citrus_scene(66, CLOTH_R, (238, 136, 24), (246, 160, 50), whole_r=115)


def mango():
    sc = stage(67, CLOTH_L, horizon=0.4)
    for (x, y, sd, a) in [(340, 460, 1, -0.3), (540, 500, 2, 0.2)]:
        m = sc.egg_mask(x, y, 120, angle=a, elong=1.3, point=0.2)
        sc.contact(m)
        col = mottled(sc, rgb(240, 170, 40), 0.15, 14, sd, hue=rgb(200, 50, 40))
        sc.shade(m, col, ks=0.55, shin=36, translucency=0.1)
    # a mango cheek cut into a hedgehog
    cx, cy = 770, 590
    outer = sc.ellipse(cx, cy, 120, 90)
    sc.contact(outer)
    sc.shade(outer, mottled(sc, rgb(210, 90, 40), 0.15, 6, 3), ks=0.4, shin=20)
    for i in range(5):
        for j in range(4):
            x, y = cx - 80 + i * 40, cy - 60 + j * 38
            if ((x - cx) / 110) ** 2 + ((y - cy) / 80) ** 2 < 1:
                block(sc, x - 16, y, 32, 18, 26, (250, 176, 40), seed=i * 10 + j, top_light=1.15, tex=0.03)
    return done(sc)


def papaya():
    sc = stage(68, CLOTH_R, horizon=0.4)
    m = sc.egg_mask(320, 470, 130, angle=0.1, elong=1.35, point=0.15)
    sc.contact(m)
    sc.shade(m, mottled(sc, rgb(200, 170, 50), 0.2, 14, 1, hue=rgb(110, 140, 40)), ks=0.5, shin=30)

    def center(sc, inner, cx, cy):
        cav = sc.egg_mask(cx, cy, 52, angle=0.1, elong=1.6, point=0.1)
        sc.over(solid(sc, (230, 120, 70)), cav)
        heap(sc, cx, cy + 5, 70, 34, 60, lambda sc, x, y, i, g: small_round(sc, x, y, 10, (26, 22, 20), ks=0.9, shin=60, seed=i, shadow=False), seed=4, mound=False)
    for (x, y, sd) in [(640, 560, 2), (850, 620, 3)]:
        cut_disc(sc, x, y, 105, 150 * 0.95, 0.1 if sd == 2 else -0.2, (180, 160, 50), 7, (246, 136, 60), seed=sd, center=lambda sc, inner, x=x, y=y: center(sc, inner, x, y))
    return done(sc)


def peach():
    sc = stage(69, CLOTH_L, horizon=0.4)
    fruit_group(sc, [(330, 460, 110, (236, 150, 80), dict(hue=(200, 50, 50), seed=1, ks=0.15, shin=10, scale=16)),
                     (520, 500, 104, (240, 170, 90), dict(hue=(210, 60, 50), seed=2, ks=0.15, shin=10, scale=16))])
    def center(sc, inner, cx, cy):
        pit = sc.ellipse(cx, cy, 34, 44)
        sc.over(rgb(170, 70, 40) * (0.8 + 0.3 * noise(sc.h, sc.w, 1.5, seed=3))[..., None], pit)
    cut_disc(sc, 740, 580, 100, 100, 0, (220, 110, 70), 5, (250, 190, 90), seed=3, center=lambda sc, inner: center(sc, inner, 740, 580))
    leaf(sc, 600, 640, 150, 46, 0.3, (70, 110, 46), seed=4)
    return done(sc)


def pear_shape(sc, cx, cy, r, color, seed, angle=0.0, hue=None):
    pts = blob_pts(cx, cy, r, r * 1.55, angle, 0.03, seed, shape=lambda t: 1 - 0.42 * np.clip(-np.sin(t), 0, 1) ** 1.6)
    col = mottled(sc, rgb(*color), 0.14, 12, seed, hue=None if hue is None else rgb(*hue))
    col = speckle(sc, None, col, rgb(*(np.array(color) * 0.6)), 0.0015, 0.8, seed)
    body(sc, pts, col, ks=0.35, shin=24, seed=seed)
    st = sc.stroke_mask([(cx + np.sin(angle) * r * 0.9, cy - r * 0.86), (cx + 6 + np.sin(angle) * r * 1.1, cy - r * 1.15), (cx + 16 + np.sin(angle) * r * 1.2, cy - r * 1.3)], 7)
    sc.over(solid(sc, (90, 70, 40)), st)


def pear():
    sc = stage(70, CLOTH_R, horizon=0.38)
    pear_shape(sc, 330, 480, 100, (196, 186, 70), 1, -0.1, hue=(200, 110, 50))
    pear_shape(sc, 520, 510, 96, (210, 180, 70), 2, 0.12, hue=(190, 90, 40))
    pear_shape(sc, 720, 560, 90, (186, 180, 80), 3, 0.3)
    return done(sc)


def pineapple():
    sc = stage(71, CLOTH_L, horizon=0.38)
    cx, cy = 450, 470
    m = sc.egg_mask(cx, cy, 140, angle=-np.pi / 2, elong=1.35, point=0.05)
    sc.contact(m)
    u, v = (sc.xx - cx) / 34, (sc.yy - cy) / 30
    dia = np.abs(np.sin((u + v) * np.pi / 2)) * np.abs(np.sin((u - v) * np.pi / 2))
    col = rgb(200, 140, 40) * (0.6 + 0.6 * dia)[..., None] + rgb(90, 110, 40) * (1 - dia)[..., None] * 0.3
    h, R = sc.dome(m)
    sc.shade(m, col, h=h, R=R, bump=dia * 4, ks=0.4, shin=24)
    for k in range(13):
        a = -np.pi / 2 + (k - 6) * 0.17
        leaf(sc, cx + (k - 6) * 6, cy - 175, 200 + 40 * np.cos((k - 6) * 0.4), 26, a, (70, 110, 70), curl=0.1, vein=False, seed=k)
    for k, (x, y) in enumerate([(760, 620), (880, 660)]):
        def ring(sc, inner, x=x, y=y):
            rad = np.hypot(sc.xx - x, sc.yy - y) / 80
            sc.over(rgb(246, 214, 80) * (0.9 + 0.15 * np.cos(np.arctan2(sc.yy - y, sc.xx - x) * 16))[..., None], inner)
            sc.over(solid(sc, (240, 226, 150)), sc.ellipse(x, y, 18, 16))
        cut_disc(sc, x, y, 84, 78, 0, (170, 120, 40), 7, (246, 214, 80), seed=k, center=ring)
    return done(sc)


def pomegranate():
    sc = stage(72, CLOTH_R, horizon=0.4)
    for (x, y, r, sd) in [(330, 460, 125, 1), (530, 500, 110, 2)]:
        sphere_fruit(sc, x, y, r, (170, 30, 40), seed=sd, hue=(200, 120, 70), stem=False, dimple=False, scale=16)
        crown = sc.poly([(x - 22, y - r * 0.85), (x - 30, y - r * 1.15), (x - 10, y - r * 1.02), (x, y - r * 1.2), (x + 10, y - r * 1.02), (x + 30, y - r * 1.15), (x + 22, y - r * 0.85)], smooth=0.8)
        sc.shade(crown, rgb(150, 40, 40), ks=0.3, shin=20)

    def arils(sc, inner, cx, cy, r):
        sc.over(solid(sc, (236, 210, 170)), inner)
        heap(sc, cx, cy, r * 0.8, r * 0.75, 90, lambda sc, x, y, i, g: small_round(sc, x, y, r * 0.075, (190, 20, 40), ks=1.0, shin=70, seed=i, shadow=False, squash=1.1), seed=int(cx), mound=False)
    for (x, y, r, sd) in [(750, 580, 110, 3), (880, 680, 80, 4)]:
        cut_disc(sc, x, y, r, r, 0, (160, 30, 40), 6, (236, 210, 170), seed=sd, center=lambda sc, inner, x=x, y=y, r=r: arils(sc, inner, x, y, r))
    spill(sc, 230, 660, 120, 40, 14, lambda sc, x, y, i, g: small_round(sc, x, y, 9, (190, 20, 40), ks=1.0, shin=70, seed=i), 8)
    return done(sc)


def prune():
    sc = stage(73, CLOTH_L, horizon=0.4)
    def p(sc, x, y, i, g):
        pts = blob_pts(x, y, 40, 30, g.random() * 3, 0.12, i)
        wr = noise(sc.h, sc.w, 1.8, seed=i)
        body(sc, pts, mottled(sc, rgb(44, 24, 32), 0.2, 3, i) * (0.85 + 0.3 * wr)[..., None], ks=0.9, shin=60, bump=wr * 4, seed=i)
    bowl_of(sc, 540, 440, 260, 160, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 22, p, seed=3), color=(220, 210, 190), band=(80, 100, 130))
    for k, (x, y) in enumerate([(200, 660), (280, 690)]):
        p(sc, x, y, 40 + k, G(k))
    sphere_fruit(sc, 850, 620, 70, (90, 50, 110), seed=5, hue=(60, 40, 90), ks=0.3)
    return done(sc)


def raspberry():
    return berry_bowl(74, CLOTH_R, lambda sc, x, y, r, s, g: berry_cluster(sc, x, y, r, (200, 40, 70), drupe=0.22, seed=s, elong=1.1), 55, 34,
                      extra=lambda sc: leaf(sc, 860, 650, 140, 56, -2.5, (80, 120, 60), seed=3))


def strawberry_scene():
    sc = stage(75, CLOTH_L, horizon=0.4)
    bowl_of(sc, 540, 430, 260, 180, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 16,
            lambda sc, x, y, i, g: strawberry(sc, x, y, 56, angle=(g.random() - 0.5) * 1.2, seed=i), seed=2), color=(230, 222, 206), band=(80, 100, 140))
    strawberry(sc, 220, 640, 66, angle=0.3, seed=30)
    strawberry(sc, 830, 640, 62, angle=-0.4, seed=31)
    return done(sc)


def watermelon():
    sc = stage(76, CLOTH_R, horizon=0.4)
    m = sc.ellipse(300, 450, 200, 150)
    sc.contact(m)
    stripes = 0.5 + 0.5 * np.sin((sc.xx - 300) / 22 + noise(sc.h, sc.w, 6, seed=2) * 2)
    sc.shade(m, rgb(60, 110, 50) * (0.7 + 0.45 * stripes)[..., None], ks=0.5, shin=30)
    for k, (x, y, a0) in enumerate([(560, 640, -2.2), (720, 660, -2.0), (880, 690, -2.1)]):
        wedge(sc, x, y, 190, a0, a0 + 0.9, (226, 50, 60), (60, 110, 50), 12, seeds=9, seed=k, white=(220, 236, 190))
    return done(sc)


def olive():
    sc = stage(77, CLOTH_L, horizon=0.4)
    def o(sc, x, y, i, g):
        c = (100, 120, 40) if g.random() > 0.4 else (50, 34, 46)
        small_round(sc, x, y, 30, c, ks=0.9, shin=60, squash=0.75, angle=g.random() * 3, seed=i)
    bowl_of(sc, 520, 450, 250, 160, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 40, o, seed=2), color=(216, 200, 160), band=(60, 90, 130))
    branch_leaves(sc, [(640, 560), (760, 600), (920, 640)], 100, 14, (110, 130, 96), seed=7, every=0.1)
    for k in range(4):
        o(sc, 760 + k * 40, 660 + (k % 2) * 20, 90 + k, G(k))
    return done(sc)


def tomato():
    sc = stage(78, CLOTH_R, horizon=0.4)
    vine = sc.stroke_mask([(220, 330), (380, 350), (560, 340), (720, 380)], 8)
    sc.over(solid(sc, (80, 110, 50)), vine)
    fruit_group(sc, [(300, 470, 100, (210, 40, 30), dict(seed=1, ks=0.9, shin=60, stem=False)),
                     (480, 480, 110, (220, 50, 30), dict(seed=2, ks=0.9, shin=60, stem=False)),
                     (660, 500, 96, (200, 36, 30), dict(seed=3, ks=0.9, shin=60, stem=False))])
    for (x, y) in [(300, 380), (480, 380), (660, 410)]:
        for j in range(5):
            leaf(sc, x, y, 40, 10, -np.pi / 2 + (j - 2) * 0.7 + np.pi, (70, 110, 50), curl=0.2, vein=False, seed=int(x) + j)
    def c(sc, inner, cx, cy):
        rad = np.hypot(sc.xx - cx, sc.yy - cy) / 80
        col = rgb(230, 70, 50) * (1 - 0.3 * (np.abs(np.sin(np.arctan2(sc.yy - cy, sc.xx - cx) * 2)) < 0.3))[..., None]
        sc.over(col, inner)
        for a in np.linspace(0, TAU, 4, endpoint=False):
            heap(sc, cx + np.cos(a + 0.4) * 38, cy + np.sin(a + 0.4) * 38, 18, 14, 6, lambda sc, x, y, i, g: small_round(sc, x, y, 5, (240, 220, 140), ks=0.8, seed=i, shadow=False), seed=int(a * 10), mound=False)
    cut_disc(sc, 840, 640, 92, 88, 0, (200, 36, 30), 6, (230, 70, 50), seed=5, center=lambda sc, inner: c(sc, inner, 840, 640))
    return done(sc)


def cucumber():
    sc = stage(79, CLOTH_L, horizon=0.4)
    for (x, y, a, sd) in [(420, 470, -0.12, 1), (470, 540, 0.06, 2)]:
        pts = blob_pts(x, y, 300, 62, a, 0.03, sd)
        col = mottled(sc, rgb(50, 90, 40), 0.18, 4, sd, hue=rgb(140, 170, 80))
        col = speckle(sc, None, col, rgb(170, 200, 120), 0.002, 1, sd)
        body(sc, pts, col, ks=0.55, shin=36, seed=sd)
    def c(sc, inner, cx, cy, r):
        rad = np.hypot(sc.xx - cx, sc.yy - cy) / r
        col = rgb(210, 230, 160) * (1 - np.clip(0.55 - rad, 0, 1)[..., None]) + rgb(190, 214, 140) * np.clip(0.55 - rad, 0, 1)[..., None]
        sc.over(col, inner)
        for a in np.linspace(0, TAU, 7, endpoint=False):
            sc.over(solid(sc, (240, 244, 220)), sc.ellipse(cx + np.cos(a) * r * 0.3, cy + np.sin(a) * r * 0.3, r * 0.08, r * 0.05, a))
    for k, (x, y) in enumerate([(780, 620), (870, 660), (700, 670)]):
        cut_disc(sc, x, y, 62, 58, 0, (50, 90, 40), 4, (210, 230, 160), seed=k, center=lambda sc, inner, x=x, y=y: c(sc, inner, x, y, 58))
    return done(sc)


def pumpkin_body(sc, cx, cy, rw, rh, color, seed):
    lobes = 8
    for k in sorted(range(lobes), key=lambda k: -abs(np.sin(k / lobes * np.pi))):
        u = np.cos(k / lobes * np.pi)
        x = cx + u * rw * 0.6
        m = sc.ellipse(x, cy, rw * 0.5 * (0.55 + 0.45 * np.sqrt(1 - u * u)), rh * (0.92 + 0.08 * np.sqrt(1 - u * u)))
        sc.shade(m, mottled(sc, rgb(*color), 0.12, 8, seed + k), ks=0.35, shin=20, ao=0.3)
    st = sc.poly([(cx - 14, cy - rh * 0.9), (cx + 14, cy - rh * 0.9), (cx + 24, cy - rh * 1.3), (cx + 4, cy - rh * 1.32)], smooth=1)
    sc.shade(st, rgb(110, 100, 60), ks=0.2, shin=10)


def pumpkin():
    sc = stage(80, CLOTH_R, horizon=0.4)
    pumpkin_body(sc, 430, 480, 280, 150, (230, 120, 30), 1)
    pumpkin_body(sc, 760, 600, 140, 80, (240, 150, 50), 2)
    leaf(sc, 180, 650, 170, 70, -0.3, (70, 100, 50), seed=4)
    return done(sc)


SCENES = {
    "apple": apple, "avocado": avocado, "banana": banana, "blackberry": blackberry, "blueberry": blueberry,
    "cherry": cherries, "tart-cherry": tart_cherry, "coconut": coconut, "date": date, "fig": fig, "grape": grape,
    "grapefruit": grapefruit, "kiwi": kiwi, "lemon": lemon, "lime": lime, "mango": mango, "orange": orange,
    "papaya": papaya, "peach": peach, "pear": pear, "pineapple": pineapple, "pomegranate": pomegranate,
    "prune": prune, "raspberry": raspberry, "strawberry": strawberry_scene, "watermelon": watermelon,
    "olive": olive, "tomato": tomato, "cucumber": cucumber, "pumpkin": pumpkin,
}
