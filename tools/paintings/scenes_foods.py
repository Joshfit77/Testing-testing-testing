from items import *

W, H = 1000, 750
CLOTH_L = [(0, 470), (430, 440), (560, 750), (0, 750)]
CLOTH_R = [(560, 450), (1000, 420), (1000, 750), (680, 750)]


def stage(seed, cloth=None, horizon=0.45, wall=(48, 36, 25), light=(132, 104, 70), wood=(108, 70, 42), stripes=True):
    sc = Scene(W, H, seed=seed)
    sc.backdrop(base=wall, light=light, horizon=horizon, wood=wood)
    if cloth:
        sc.linen(cloth, stripes=stripes)
    return sc


def done(sc):
    sc.vignette(0.42)
    return sc.img


def spill(sc, cx, cy, rw, rh, n, item, seed):
    heap(sc, cx, cy, rw, rh, n, item, seed=seed, mound=False)


def spoon(sc, x, y, length, angle, color=(150, 104, 62), bowl_r=None, fill=None):
    c, s = np.cos(angle), np.sin(angle)
    br = bowl_r or length * 0.16
    hx, hy = x + c * length, y + s * length
    hm = sc.stroke_mask([(x, y), (hx, hy)], br * 0.38)
    sc.contact(hm * 0.6)
    sc.shade(hm, mottled(sc, rgb(*color), 0.1, 4), ks=0.3, shin=20, strength=0.8)
    bm = sc.ellipse(x - c * br * 0.8, y - s * br * 0.8, br * 1.25, br * 0.8, angle)
    sc.contact(bm)
    sc.shade(bm, mottled(sc, rgb(*color), 0.1, 4), ks=0.3, shin=20)
    if fill:
        fm = sc.ellipse(x - c * br * 0.8, y - s * br * 0.8, br * 0.95, br * 0.55, angle)
        fill(sc, fm, x - c * br * 0.8, y - s * br * 0.8, br)


# ---------------------------------------------------------------- proteins
def eggs():
    sc = stage(11, CLOTH_L, horizon=0.42)
    inner, front = bowl(sc, 610, 410, 260, 185, color=(210, 194, 160), inside=(160, 140, 112), band=(70, 86, 110))
    for (x, y, r, a, c, s) in [(460, 385, 64, -0.55, (186, 120, 74), 1), (765, 380, 62, 0.6, (176, 108, 64), 2),
                               (560, 360, 66, -0.15, (238, 226, 206), 3), (665, 355, 64, 0.25, (192, 128, 80), 4),
                               (515, 425, 68, -0.3, (170, 104, 62), 5), (618, 432, 70, 0.1, (196, 134, 86), 6),
                               (725, 425, 66, 0.45, (234, 222, 200), 7)]:
        egg(sc, x, y, r, a, c, speck=c[0] < 220, seed=s)
    front()
    egg(sc, 215, 600, 76, 0.2, (184, 118, 72), seed=21)
    egg(sc, 370, 655, 72, -0.35, (238, 228, 210), speck=False, seed=22)
    egg(sc, 110, 680, 66, 0.6, (172, 106, 64), seed=23)
    herb_bunch(sc, 980, 690, 190, -2.5, seed=40, leaves=10, size=0.3)
    return done(sc)


def roast_breast(sc, cx, cy, s, angle, seed):
    pts = blob_pts(cx, cy, s, s * 0.62, angle, 0.05, seed, shape=lambda t: 1 + 0.22 * np.cos(t))
    m = sc.poly(pts, smooth=1.2)
    sc.contact(m)
    col = mottled(sc, rgb(204, 140, 64), 0.18, 14, seed, hue=rgb(150, 80, 30))
    roast = np.clip(noise(sc.h, sc.w, 9, seed=seed + 3) * 1.4, 0, 1)
    col = col * (1 - 0.45 * roast[..., None]) + rgb(126, 64, 26) * 0.45 * roast[..., None]
    pep = (G(seed).random(sc.img.shape[:2]) < 0.0018).astype(np.float32)
    pep = np.clip(ndi.gaussian_filter(pep, 0.9) * 5, 0, 1)
    col = col * (1 - pep[..., None]) + rgb(52, 40, 26) * pep[..., None]
    h, R = sc.dome(m, soften=0.15)
    sc.shade(m, col, h=h * 0.85, R=R, ks=0.7, shin=44, bump=noise(sc.h, sc.w, 4, seed=seed + 9) * 2.5, translucency=0.1, rim=0.2)
    return m


def roast_chicken(sc, cx, cy, s, seed=1):
    """A whole roast chicken, breast up, legs toward the viewer's right."""
    skin = lambda sd: mottled(sc, rgb(206, 140, 62), 0.16, 12, sd, hue=rgb(160, 88, 34))
    def roasted(m, sd, hs=0.85, ks=0.75):
        col = skin(sd)
        roast = np.clip(noise(sc.h, sc.w, 10, seed=sd + 3) * 1.3, 0, 1)
        col = col * (1 - 0.4 * roast[..., None]) + rgb(130, 66, 26) * 0.4 * roast[..., None]
        h, R = sc.dome(m, soften=0.15)
        sc.shade(m, col, h=h * hs, R=R, ks=ks, shin=46, bump=noise(sc.h, sc.w, 9, seed=sd + 9) * 1.5, translucency=0.12, rim=0.22)
    # far drumstick and wing (behind)
    wing = sc.poly(blob_pts(cx - s * 0.75, cy + s * 0.05, s * 0.38, s * 0.22, -0.5, 0.08, seed + 1), smooth=1)
    sc.contact(wing); roasted(wing, seed + 1)
    leg2 = sc.poly(blob_pts(cx + s * 0.55, cy - s * 0.18, s * 0.5, s * 0.26, -0.25, 0.06, seed + 2), smooth=1)
    sc.contact(leg2); roasted(leg2, seed + 2)
    bodym = sc.poly(blob_pts(cx, cy, s, s * 0.62, -0.06, 0.04, seed, shape=lambda t: 1 + 0.12 * np.cos(t)), smooth=1.2)
    sc.contact(bodym); roasted(bodym, seed)
    # breastbone ridge catches the light
    ridge = sc.stroke_mask([(cx - s * 0.7, cy - s * 0.12), (cx, cy - s * 0.3), (cx + s * 0.6, cy - s * 0.2)], s * 0.05)
    sc.img += (ndi.gaussian_filter(ridge, s * 0.04) * 0.12)[..., None]
    leg = sc.poly(blob_pts(cx + s * 0.62, cy + s * 0.28, s * 0.52, s * 0.3, 0.25, 0.06, seed + 3, shape=lambda t: 1 + 0.25 * np.cos(t)), smooth=1)
    sc.contact(leg); roasted(leg, seed + 3, ks=0.85)
    for (x, y) in [(cx + s * 1.18, cy + s * 0.45), (cx + s * 1.08, cy + 0.0 * s)]:
        bone = sc.ellipse(x, y, s * 0.07, s * 0.05)
        sc.shade(bone, rgb(232, 220, 196), ks=0.4, shin=30)


def chicken_breast():
    sc = stage(12, CLOTH_R, horizon=0.38)
    plate(sc, 470, 540, 420, color=(230, 222, 206), rimcol=(70, 92, 124))
    for i, (x, y, a) in enumerate([(120, 520, -0.25), (150, 570, 0.05)]):
        sprig(sc, x, y, 200, a, needle=14, seed=60 + i, count=26)
    roast_chicken(sc, 440, 500, 230, seed=1)
    citrus_half(sc, 820, 360, 70, seed=3)
    citrus_half(sc, 260, 660, 56, seed=4)
    for k, (x, y) in enumerate([(700, 650), (760, 670)]):
        sphere_fruit(sc, x, y, 30, (200, 36, 30), ks=0.8, seed=k, stem=False, dimple=False)
    from foods1 import garlic
    garlic(sc, 890, 620, 60, seed=5)
    return done(sc)


def fish_fillet(sc, cx, cy, length, width, angle, seed=0):
    t = np.linspace(0, 1, 50)
    wid = width / 2 * np.sin(np.pi * np.clip(t * 0.92 + 0.05, 0, 1)) ** 0.6 * (1 - 0.35 * t)
    c, s = np.cos(angle), np.sin(angle)
    x0, y0 = cx - c * length / 2, cy - s * length / 2
    L = [(x0 + t[i] * length * c - wid[i] * s, y0 + t[i] * length * s + wid[i] * c) for i in range(50)]
    Rr = [(x0 + t[i] * length * c + wid[i] * s, y0 + t[i] * length * s - wid[i] * c) for i in range(50)]
    m = sc.poly(L + Rr[::-1], smooth=1)
    sc.contact(m)
    along = (sc.xx - x0) * c + (sc.yy - y0) * s
    across = -(sc.xx - x0) * s + (sc.yy - y0) * c
    fat = np.clip(np.sin(along * 0.11 + across * 0.05 + noise(sc.h, sc.w, 6, seed=seed) * 1.5) * 4 - 3.2, 0, 1)
    col = mottled(sc, rgb(236, 112, 70), 0.1, 6, seed, hue=rgb(246, 140, 90))
    col = col * (1 - 0.75 * fat[..., None]) + rgb(250, 214, 190) * 0.75 * fat[..., None]
    h, R = sc.dome(m, flat=0.4)
    sc.shade(m, col, h=h * 0.6, R=R, ks=0.55, shin=40, translucency=0.2, bump=-fat * 1.2)
    return m


def salmon():
    sc = stage(13, CLOTH_L, horizon=0.4)
    board(sc, 560, 520, 720, 300)
    fish_fillet(sc, 540, 500, 560, 210, -0.12, seed=2)
    for i, x in enumerate([780, 860]):
        m = sc.ellipse(x, 620 - i * 20, 62, 58)
        cut_disc(sc, x, 620 - i * 20, 62, 58, 0, (230, 196, 50), 6, (246, 222, 110), seed=i,
                 center=lambda sc, mm: None)
    branch_leaves(sc, [(150, 640), (260, 600), (360, 580)], 40, 4, (70, 112, 60), seed=4, every=0.06, stem=(80, 110, 60), stem_w=2)
    branch_leaves(sc, [(130, 690), (240, 680), (330, 640)], 36, 4, (64, 106, 56), seed=5, every=0.06, stem=(80, 110, 60), stem_w=2)
    return done(sc)


def sardine(sc, cx, cy, length, angle, seed=0):
    t = np.linspace(0, 1, 50)
    wid = length * 0.13 * np.sin(np.pi * t) ** 0.7 * (1 - 0.3 * t) + length * 0.01
    c, s = np.cos(angle), np.sin(angle)
    x0, y0 = cx - c * length / 2, cy - s * length / 2
    L = [(x0 + t[i] * length * c - wid[i] * s, y0 + t[i] * length * s + wid[i] * c) for i in range(50)]
    Rr = [(x0 + t[i] * length * c + wid[i] * s, y0 + t[i] * length * s - wid[i] * c) for i in range(50)]
    tail = [(x0 + length * c, y0 + length * s), (x0 + length * 1.12 * c - length * 0.09 * s, y0 + length * 1.12 * s + length * 0.09 * c),
            (x0 + length * 1.05 * c, y0 + length * 1.05 * s), (x0 + length * 1.12 * c + length * 0.09 * s, y0 + length * 1.12 * s - length * 0.09 * c)]
    m = np.clip(sc.poly(L + Rr[::-1], smooth=0.8) + sc.poly(tail, smooth=0.6), 0, 1)
    sc.contact(m)
    across = (-(sc.xx - x0) * s + (sc.yy - y0) * c) / (length * 0.13)
    back = np.clip(-across * 1.2 + 0.2, 0, 1)
    col = rgb(206, 210, 214) * (1 - back[..., None]) + rgb(58, 82, 104) * back[..., None]
    col = col * (1 + 0.1 * noise(sc.h, sc.w, 2, seed=seed))[..., None]
    sc.shade(m, col, ks=0.9, shin=60, translucency=0.05)
    eye = sc.ellipse(x0 + length * 0.09 * c, y0 + length * 0.09 * s, length * 0.025, length * 0.025)
    sc.over(solid(sc, (20, 20, 20)), eye)


def sardines():
    sc = stage(14, CLOTH_R, horizon=0.4)
    plate(sc, 470, 520, 400, color=(216, 210, 196), rimcol=(120, 60, 50))
    for i in range(5):
        sardine(sc, 450 + (i - 2) * 26, 430 + i * 38, 380, -0.08 + (i - 2) * 0.03, seed=i)
    citrus_half(sc, 820, 420, 70, seed=6)
    herb_bunch(sc, 150, 650, 200, -0.4, color=(62, 100, 44), seed=7, leaves=12)
    return done(sc)


def steak(sc, cx, cy, rx, ry, angle, seed):
    pts = blob_pts(cx, cy, rx, ry, angle, 0.09, seed)
    fatring = sc.poly(pts, smooth=1.2)
    sc.contact(fatring)
    sc.shade(fatring, mottled(sc, rgb(240, 226, 200), 0.05, 4, seed), ks=0.5, shin=40, flat=0.5, strength=0.6)
    inner = sc.poly(blob_pts(cx - rx * 0.03, cy - ry * 0.02, rx * 0.9, ry * 0.86, angle, 0.07, seed + 1), smooth=1)
    marb = np.clip(1 - np.abs(noise(sc.h, sc.w, 6, seed=seed + 2)) * 7, 0, 1) * 0.75
    col = mottled(sc, rgb(170, 34, 42), 0.12, 5, seed, hue=rgb(196, 60, 64))
    col = col * (1 - marb[..., None]) + rgb(236, 214, 200) * marb[..., None]
    sc.shade(inner, col, ks=0.65, shin=50, flat=0.6, strength=0.5, ao=0.1, translucency=0.15)


def lean_beef():
    sc = stage(15, CLOTH_L, horizon=0.4, wood=(96, 60, 36))
    board(sc, 520, 530, 780, 330, color=(146, 100, 58))
    steak(sc, 420, 520, 230, 140, -0.08, 3)
    steak(sc, 690, 560, 170, 110, 0.2, 7)
    sprig(sc, 120, 660, 220, -0.2, needle=13, seed=8)
    from foods1 import garlic
    garlic(sc, 870, 380, 60, seed=9)
    for k in range(10):
        g = G(k)
        small_round(sc, 800 + g.random() * 80, 680 + g.random() * 30, 5, (30, 26, 22), ks=0.2, seed=k)
    return done(sc)


def tofu():
    sc = stage(16, CLOTH_R, horizon=0.42)
    plate(sc, 470, 540, 380, color=(74, 70, 66))
    for (x, y, s, sd) in [(300, 470, 150, 1), (470, 500, 140, 2), (380, 600, 130, 3)]:
        block(sc, x, y, s, s * 0.6, s * 0.75, (238, 230, 212), seed=sd, tex=0.04)
    for k in range(18):
        g = G(k)
        x, y = 640 + g.random() * 120, 560 + g.random() * 80
        m = np.clip(sc.ellipse(x, y, 11, 9) - sc.ellipse(x, y, 6, 5), 0, 1)
        sc.shade(m, rgb(96, 150, 66), ks=0.4, shin=20)
    bowl_of(sc, 820, 380, 100, 70, lambda sc, cx, cy, rw, rh: sc.over(solid(sc, (60, 30, 16)), sc.ellipse(cx, cy + 10, rw, rh * 0.6)), color=(214, 204, 186))
    return done(sc)


# ---------------------------------------------------------------- legumes & grains
def legume_bowl(seed, color, r, n, cloth, var=0.18, ks=0.5, squash=0.8, spill_n=24, shape="round", bowl_col=(212, 196, 164), band=None):
    sc = stage(seed, cloth, horizon=0.4)

    def one(sc, x, y, i, g):
        c = np.clip(np.array(color) * (1 + (g.random() - 0.5) * var * 2), 0, 255)
        if shape == "lentil":
            small_round(sc, x, y, r, tuple(c), ks=ks, squash=0.55, angle=g.random() * 3, seed=i)
        elif shape == "bean":
            small_round(sc, x, y, r * 1.25, tuple(c), ks=ks, squash=0.62, angle=g.random() * 3, seed=i, shin=60)
        else:
            small_round(sc, x, y, r, tuple(c), ks=ks, squash=squash, angle=g.random() * 3, seed=i)

    bowl_of(sc, 560, 400, 270, 200, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, n, one, seed=seed), color=bowl_col, band=band)
    spill(sc, 260, 640, 180, 60, spill_n, one, seed + 1)
    return sc


def lentils():
    sc = legume_bowl(17, (198, 110, 52), 9, 900, CLOTH_L, shape="lentil", band=(120, 70, 40))
    spoon(sc, 820, 650, 220, -0.35)
    return done(sc)


def chickpeas():
    sc = legume_bowl(18, (214, 176, 112), 15, 330, CLOTH_R, ks=0.25, band=(70, 90, 120))
    return done(sc)


def black_beans():
    sc = legume_bowl(19, (40, 30, 34), 11, 520, CLOTH_L, ks=0.9, shape="bean", bowl_col=(222, 206, 178))
    citrus_half(sc, 850, 600, 60, peel=(80, 150, 50), flesh=(170, 210, 90), seed=3)
    return done(sc)


def oats():
    sc = stage(20, CLOTH_R, horizon=0.4)

    def flake(sc, x, y, i, g):
        c = np.clip(np.array((222, 196, 150)) * (1 + (g.random() - 0.5) * 0.2), 0, 255)
        small_round(sc, x, y, 14, tuple(c), ks=0.2, squash=0.6, angle=g.random() * 3, seed=i, shin=12)

    bowl_of(sc, 520, 400, 270, 200, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 380, flake, seed=3), color=(120, 84, 52), inside=(90, 62, 40))
    spill(sc, 820, 620, 140, 50, 30, flake, 5)
    spoon(sc, 260, 650, 260, 0.25, fill=lambda sc, fm, x, y, br: sc.over(mottled(sc, rgb(222, 196, 150), 0.2, 2), fm))
    return done(sc)


def quinoa():
    sc = legume_bowl(21, (226, 210, 170), 5, 2200, CLOTH_L, var=0.25, ks=0.2, squash=0.85, spill_n=60, bowl_col=(160, 112, 72))
    return done(sc)


# ---------------------------------------------------------------- dairy
def creamy_bowl(sc, cx, cy, rw, rh, col=(246, 242, 232), swirl=True, curds=False, seed=0):
    m = sc.ellipse(cx, cy + rh * 0.2, rw, rh * 0.9)
    base = mottled(sc, rgb(*col), 0.03, 10, seed)
    h, R = sc.dome(m, flat=0.3)
    bump = None
    if swirl:
        ang = np.arctan2(sc.yy - cy, (sc.xx - cx) * 0.5)
        rad = np.hypot((sc.xx - cx) / rw, (sc.yy - cy) / rh)
        bump = np.sin(ang * 2 + rad * 9) * 2.2 * (rad < 1)
    sc.shade(m, base, h=h * 0.4, R=R, bump=bump, ks=0.6, shin=50, amb=0.55, kd=0.55, ao=0.1, translucency=0.1)
    if curds:
        heap(sc, cx, cy, rw * 0.9, rh * 0.8, 160, lambda sc, x, y, i, g: small_round(sc, x, y, 13 + g.random() * 6, (244, 240, 228), ks=0.4, squash=0.8, angle=g.random() * 3, seed=i, shadow=True), seed=seed)


def greek_yogurt():
    sc = stage(22, CLOTH_R, horizon=0.4)

    def fill(sc, cx, cy, rw, rh):
        creamy_bowl(sc, cx, cy, rw, rh)
        for k, (x, y) in enumerate([(cx - 60, cy - 10), (cx - 20, cy - 25), (cx + 30, cy - 15), (cx + 70, cy), (cx - 40, cy + 20), (cx + 10, cy + 10)]):
            small_round(sc, x, y, 17, (54, 60, 120), ks=0.5, squash=0.95, seed=k)
        for k, (x, y) in enumerate([(cx + 90, cy - 30), (cx - 100, cy + 5)]):
            berry_cluster(sc, x, y, 26, (190, 40, 60), seed=k + 3)
        drip = sc.stroke_mask([(cx - 120, cy - 40), (cx - 40, cy - 5), (cx + 40, cy + 20), (cx + 110, cy + 5)], 9)
        sc.shade(drip, rgb(214, 150, 40), ks=0.9, shin=60, translucency=0.3, amb=0.6)

    bowl_of(sc, 500, 410, 270, 190, fill, color=(232, 226, 214), inside=(220, 212, 196), band=(70, 90, 130))
    for k, (x, y) in enumerate([(200, 640), (240, 690), (160, 690)]):
        small_round(sc, x, y, 18, (50, 58, 118), ks=0.5, seed=k + 9)
    berry_cluster(sc, 300, 650, 30, (190, 40, 60), seed=12)
    spoon(sc, 820, 640, 220, -0.3, color=(200, 196, 190))
    return done(sc)


def cottage_cheese():
    sc = stage(23, CLOTH_L, horizon=0.4)
    bowl_of(sc, 540, 410, 270, 190, lambda sc, cx, cy, rw, rh: creamy_bowl(sc, cx, cy, rw, rh, swirl=False, curds=True, seed=4), color=(120, 140, 160), inside=(200, 200, 196))
    for k, (x, y) in enumerate([(840, 610), (900, 650)]):
        sphere_fruit(sc, x, y, 52, (220, 40, 40), ks=0.7, seed=k, stem=False, dimple=False)
    herb_bunch(sc, 200, 660, 180, -0.3, seed=5, leaves=9)
    return done(sc)


def kefir():
    sc = stage(24, CLOTH_R, horizon=0.45)
    jar(sc, 330, 250, 230, 330, fill=(240, 236, 226), level=0.85, lid=(120, 120, 120))
    glass(sc, 640, 330, 190, 270, liquid=(244, 240, 232), level=0.82, foam=(250, 248, 242))
    for k, (x, y) in enumerate([(820, 620), (860, 660), (790, 680)]):
        small_round(sc, x, y, 20, (56, 60, 124), ks=0.5, seed=k)
    return done(sc)


# ---------------------------------------------------------------- vegetables
def spinach():
    sc = stage(25, CLOTH_L, horizon=0.4)

    def fill(sc, cx, cy, rw, rh):
        g = G(3)
        for k in range(26):
            a = g.random() * TAU
            d = g.random()
            x, y = cx + np.cos(a) * rw * 0.75 * d, cy - rh * 0.6 + np.sin(a) * rh * d
            leaf(sc, x, y, 130 + g.random() * 60, 50 + g.random() * 20, g.random() * TAU, tuple(np.array((40, 92, 40)) * (0.75 + 0.5 * g.random())), curl=0.35, seed=k)

    bowl_of(sc, 560, 420, 270, 190, fill, color=(196, 170, 130), inside=(120, 100, 76))
    for k in range(6):
        g = G(40 + k)
        leaf(sc, 140 + k * 55, 640 + g.random() * 50, 140, 54, -0.5 + g.random(), (44, 96, 42), curl=0.3, seed=40 + k)
    return done(sc)


def kale():
    sc = stage(26, CLOTH_R, horizon=0.38)
    g = G(4)
    for k in range(8):
        x, y = 260 + k * 66 + g.random() * 20, 640 - g.random() * 40
        a = -1.9 + k * 0.12 + (g.random() - 0.5) * 0.3
        leaf(sc, x, y, 380 + g.random() * 80, 150 + g.random() * 30, a, tuple(np.array((40, 76, 58)) * (0.75 + 0.45 * g.random())), curl=0.35, ruffle=0.22, seed=k)
    return done(sc)


def floret(sc, x, y, r, seed):
    g = G(seed)
    st = sc.poly([(x - r * 0.35, y), (x + r * 0.35, y), (x + r * 0.2, y + r * 1.6), (x - r * 0.2, y + r * 1.6)], smooth=1)
    sc.contact(st)
    sc.shade(st, mottled(sc, rgb(160, 186, 110), 0.1, 4, seed), ks=0.3, shin=20)
    for k in range(26):
        a, d = g.random() * TAU, np.sqrt(g.random())
        bx, by = x + np.cos(a) * r * d, y - r * 0.35 + np.sin(a) * r * 0.75 * d
        small_round(sc, bx, by, r * 0.3, tuple(np.array((52, 104, 46)) * (0.75 + 0.5 * g.random())), ks=0.25, shin=16, seed=seed * 100 + k, shadow=False)


def broccoli():
    sc = stage(27, CLOTH_L, horizon=0.4)
    for k, (x, y, r) in enumerate([(480, 420, 120), (330, 470, 95), (640, 470, 100), (560, 540, 80), (390, 560, 75)]):
        floret(sc, x, y, r, k)
    citrus_half(sc, 820, 620, 64, seed=5)
    return done(sc)


def sweet_potato():
    sc = stage(28, CLOTH_R, horizon=0.4)
    tuber(sc, 380, 470, 380, 160, -0.15, (150, 76, 52), seed=1)
    tuber(sc, 560, 540, 360, 150, 0.2, (142, 70, 48), seed=2)
    cut_disc(sc, 790, 610, 110, 100, 0.1, (140, 70, 48), 8, (238, 128, 44), seed=3)
    return done(sc)


def carrots():
    sc = stage(29, CLOTH_L, horizon=0.4)
    for k in range(6):
        carrot(sc, 260 + k * 18, 340 + k * 40, 520 - k * 18, 74 - k * 3, 0.16 + k * 0.03, seed=k, tops=True)
    return done(sc)


def beet(sc, cx, cy, r, seed, cut=False, stems=True):
    g = G(seed)
    if stems:
        for j in range(4):
            a = -np.pi / 2 + (j - 1.5) * 0.3
            pts = [(cx + np.cos(a) * r * 1.4 * q, cy - r * 0.8 + np.sin(a) * r * 1.3 * q) for q in np.linspace(0, 1, 8)]
            st = sc.stroke_mask(pts, r * 0.09)
            sc.shade(st, rgb(170, 40, 70), ks=0.3, shin=20)
            ex, ey = pts[-1]
            leaf(sc, ex, ey, r * 1.3, r * 0.5, a + (j - 1.5) * 0.25, (60, 96, 50), curl=0.3, seed=seed * 10 + j)
    m = sphere_fruit(sc, cx, cy, r, (110, 26, 48), ry=r * 0.95, ks=0.35, shin=20, seed=seed, stem=False, dimple=False, hue=(140, 50, 70))
    tail = sc.stroke_mask([(cx, cy + r * 0.85), (cx + r * 0.2, cy + r * 1.4), (cx + r * 0.5, cy + r * 1.7)], r * 0.08)
    sc.over(solid(sc, (110, 40, 50)), tail)


def beets():
    sc = stage(30, CLOTH_R, horizon=0.38)
    beet(sc, 330, 540, 115, 1)
    beet(sc, 560, 580, 105, 2)
    rings = lambda sc, inner: sc.over(rgb(150, 20, 60) * (0.75 + 0.35 * np.sin(np.hypot(sc.xx - 800, sc.yy - 620) * 0.35))[..., None] * 1.0, inner)
    cut_disc(sc, 800, 620, 100, 92, 0, (110, 26, 48), 7, (170, 30, 70), seed=4, center=rings)
    return done(sc)


def sauerkraut():
    sc = stage(31, CLOTH_L, horizon=0.4)

    def shreds(sc):
        g = G(2)
        base = np.broadcast_to(rgb(222, 214, 160), sc.img.shape).copy()
        stripes = 0.5 + 0.5 * np.sin((sc.xx * 0.2 + sc.yy * 0.9) + noise(sc.h, sc.w, 4, seed=3) * 6)
        sc.img = base * (0.75 + 0.3 * stripes)[..., None]

    jar(sc, 470, 220, 300, 400, fill_fn=shreds, level=0.88, lid=(160, 150, 130))
    # half a cabbage beside
    m = sc.ellipse(790, 580, 150, 120)
    sc.contact(m)
    veins = 0.5 + 0.5 * np.sin(np.hypot(sc.xx - 790, (sc.yy - 640) * 1.3) * 0.25)
    sc.shade(m, rgb(196, 214, 150) * (0.85 + 0.2 * veins)[..., None], ks=0.3, shin=20)
    return done(sc)


# ---------------------------------------------------------------- nuts & seeds
def almond(sc, x, y, r, angle, seed):
    pts = blob_pts(x, y, r * 1.5, r * 0.9, angle, 0.02, seed, shape=lambda t: 1 - 0.2 * np.cos(t))
    col = mottled(sc, rgb(170, 110, 66), 0.2, 1.4, seed)
    lines = np.sin(((sc.xx - x) * np.cos(angle) + (sc.yy - y) * np.sin(angle)) * 0.25 + noise(sc.h, sc.w, 1.5, seed=seed) * 2)
    col = col * (0.88 + 0.12 * lines)[..., None]
    body(sc, pts, col, ks=0.3, shin=18, smooth=0.6)


def nut_bowl(seed, item, n, cloth, bowl_col=(210, 192, 160), spill_n=14, r=22, extra=None):
    sc = stage(seed, cloth, horizon=0.4)
    draw = lambda sc, x, y, i, g: item(sc, x, y, r * (0.85 + 0.3 * g.random()), g.random() * TAU, seed * 1000 + i)
    bowl_of(sc, 540, 410, 260, 190, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, n, draw, seed=seed), color=bowl_col)
    spill(sc, 230, 640, 170, 60, spill_n, draw, seed + 3)
    if extra:
        extra(sc)
    return done(sc)


def almonds():
    return nut_bowl(32, almond, 120, CLOTH_R, r=24)


def walnut(sc, x, y, r, angle, seed):
    m = sc.ellipse(x, y, r * 1.1, r, angle)
    sc.contact(m)
    wr = noise(sc.h, sc.w, 1.4, seed=seed)
    col = mottled(sc, rgb(176, 130, 82), 0.12, 2, seed)
    h, R = sc.dome(m)
    seam = np.exp(-(((sc.xx - x) * np.cos(angle) + (sc.yy - y) * np.sin(angle)) / 2.2) ** 2)
    sc.shade(m, col * (0.85 + 0.25 * wr)[..., None] * (1 - 0.4 * seam)[..., None], h=h, R=R, bump=wr * 3 - seam * 3, ks=0.2, shin=14)


def walnuts():
    return nut_bowl(33, walnut, 60, CLOTH_L, r=34, spill_n=8, bowl_col=(120, 84, 52))


def seed_dish(seed, color, r, n, cloth, var=0.3, ks=0.3, squash=0.7, extra=None, bowl_col=(214, 200, 172)):
    sc = stage(seed, cloth, horizon=0.42)

    def one(sc, x, y, i, g):
        c = np.clip(np.array(color) * (1 + (g.random() - 0.5) * var * 2), 0, 255)
        small_round(sc, x, y, r, tuple(c), ks=ks, squash=squash, angle=g.random() * 3, seed=i, shadow=r > 4)

    bowl_of(sc, 520, 420, 240, 170, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, n, one, seed=seed), color=bowl_col)
    spoon(sc, 800, 640, 220, -0.3, fill=lambda sc, fm, x, y, br: heap(sc, x, y, br * 0.8, br * 0.45, 30, one, seed=seed + 5, mound=False))
    spill(sc, 230, 650, 150, 45, 70, one, seed + 2)
    if extra:
        extra(sc)
    return done(sc)


def chia_seeds():
    return seed_dish(34, (92, 86, 80), 4.5, 2400, CLOTH_L, var=0.45, ks=0.6)


def flaxseed():
    return seed_dish(35, (150, 96, 50), 5.5, 1700, CLOTH_R, var=0.25, ks=0.8, squash=0.5)


def pumpkin_seeds():
    def extra(sc):
        sphere_fruit(sc, 860, 360, 90, (230, 120, 30), ry=72, seed=3, ks=0.3, hue=(200, 90, 20))
    return seed_dish(36, (82, 124, 58), 13, 260, CLOTH_L, var=0.2, ks=0.45, squash=0.5, extra=extra)


# ---------------------------------------------------------------- pantry
def olive_oil():
    sc = stage(37, CLOTH_R, horizon=0.45)
    bottle(sc, 400, 120, 210, 500, liquid=(190, 170, 40), level=0.62)
    bowl_of(sc, 680, 560, 150, 100, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 22,
            lambda sc, x, y, i, g: small_round(sc, x, y, 24, (110, 120, 40) if i % 3 else (60, 40, 50), ks=0.8, squash=0.75, angle=g.random() * 3, seed=i), seed=3), color=(200, 184, 150))
    branch_leaves(sc, [(620, 380), (760, 360), (930, 410)], 90, 12, (110, 130, 96), seed=7, every=0.1)
    return done(sc)


def honey():
    sc = stage(38, CLOTH_L, horizon=0.45)
    jar(sc, 470, 230, 290, 360, fill=(214, 140, 30), level=0.9, label=(214, 196, 160))
    # wooden dipper resting across the jar
    dip = sc.stroke_mask([(620, 220), (820, 430)], 16)
    sc.shade(dip, mottled(sc, rgb(170, 120, 70), 0.1, 3), ks=0.3, shin=20)
    for k in range(4):
        rm = sc.ellipse(820 + k * 9, 440 + k * 12, 34, 22, 0.8)
        sc.shade(rm, rgb(170, 120, 70), ks=0.4, shin=20)
    # honeycomb: hexagonal cells
    comb = sc.poly(blob_pts(760, 640, 160, 70, 0.05, 0.05, 2), smooth=1)
    sc.contact(comb)
    hx, hy = sc.xx / 30, sc.yy / 20
    cell = np.abs(np.sin(hx * np.pi + (np.floor(hy) % 2) * np.pi / 2)) * np.abs(np.sin(hy * np.pi))
    walls = np.clip(1 - cell * 3, 0, 1)
    col = rgb(226, 150, 30) * (0.65 + 0.5 * cell)[..., None] * (1 - walls[..., None]) + rgb(246, 210, 120) * walls[..., None]
    sc.shade(comb, col, ks=0.8, shin=50, translucency=0.25, flat=0.6, strength=0.5, bump=cell * 2)
    return done(sc)


def dark_chocolate():
    sc = stage(39, CLOTH_R, horizon=0.4, wall=(40, 28, 22))
    for (x, y, w, h, sd) in [(220, 470, 300, 50, 1), (300, 580, 260, 46, 2), (560, 520, 230, 44, 3)]:
        block(sc, x, y, w, h, 150, (74, 40, 26), seed=sd, top_light=1.25, side_dark=0.6, tex=0.03)
        for gx in range(1, 4):
            ln = sc.stroke_mask([(x + w * gx / 4 + 30, y - 70), (x + w * gx / 4 - 10, y - 2)], 2)
            sc.img *= (1 - 0.35 * ln)[..., None]
    for k in range(7):
        g = G(k)
        x, y = 820 + g.random() * 120, 600 + g.random() * 90
        pts = blob_pts(x, y, 34, 22, g.random() * 3, 0.05, k)
        body(sc, pts, (110, 60, 40), ks=0.5, shin=30, seed=k)
    return done(sc)


def bone_broth():
    sc = stage(40, CLOTH_L, horizon=0.42)

    def fill(sc, cx, cy, rw, rh):
        m = sc.ellipse(cx, cy + 20, rw * 1.02, rh * 0.75)
        col = rgb(186, 120, 40) * np.clip(0.8 + 0.3 * (sc.yy - cy) / rh, 0.6, 1.1)[..., None]
        sc.over(col, m)
        for k in range(7):
            g = G(k)
            x, y = cx + (g.random() - 0.5) * rw * 1.3, cy + (g.random() - 0.3) * rh
            if k % 2:
                cut_disc(sc, x, y, 24, 18, 0, (220, 110, 30), 3, (238, 130, 40), seed=k)
            else:
                leaf(sc, x, y, 36, 14, g.random() * 6, (60, 110, 50), seed=k)
        fat = (G(9).random(sc.img.shape[:2]) < 0.002) * m
        sc.img += (ndi.gaussian_filter(fat.astype(np.float32), 2.5) * 6 * 0.2)[..., None]

    bowl_of(sc, 520, 450, 270, 180, fill, color=(226, 218, 200), inside=(200, 190, 170), band=(120, 60, 50), mound=0.0)
    steam(sc, 520, 400, 330, 60, seed=3)
    carrot(sc, 760, 640, 220, 44, -0.25, seed=8, tops=False)
    from foods1 import garlic
    garlic(sc, 180, 620, 58, seed=6)
    return done(sc)


SCENES = {k.replace("_", "-"): v for k, v in dict(
    eggs=eggs, greek_yogurt=greek_yogurt, salmon=salmon, sardines=sardines, chicken_breast=chicken_breast,
    lean_beef=lean_beef, tofu=tofu, lentils=lentils, chickpeas=chickpeas, black_beans=black_beans,
    cottage_cheese=cottage_cheese, kefir=kefir, oats=oats, quinoa=quinoa, spinach=spinach, kale=kale,
    broccoli=broccoli, sweet_potato=sweet_potato, carrots=carrots, beets=beets, sauerkraut=sauerkraut,
    almonds=almonds, walnuts=walnuts, chia_seeds=chia_seeds, flaxseed=flaxseed, pumpkin_seeds=pumpkin_seeds,
    olive_oil=olive_oil, honey=honey, dark_chocolate=dark_chocolate, bone_broth=bone_broth).items()}
