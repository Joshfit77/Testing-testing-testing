from scenes_foods import stage, done, spill, CLOTH_L, CLOTH_R, roast_chicken, floret, beet, almond, walnut
from scenes_fruits import fruit_group, grape_bunch, cherry, avocado_half, pear_shape, banana_shape
from items2 import *


def abundance():
    sc = stage(101, [(0, 520), (620, 480), (720, 750), (0, 750)], horizon=0.42)
    jug(sc, 760, 200, 190, 250, color=(200, 180, 140), band=(80, 100, 130))
    daisy_bunch(sc, 760, 180, 150, 9, seed=3)
    leaf(sc, 650, 190, 150, 50, -2.4, (70, 110, 50), seed=5)
    grape_bunch(sc, 300, 300, 230, 260, (90, 40, 90), 1, r=26)
    bowl_of(sc, 470, 420, 230, 150, lambda sc, cx, cy, rw, rh: fruit_group(sc, [
        (cx - 110, cy - 20, 78, (180, 30, 30), dict(hue=(220, 170, 60), seed=1, scale=12)),
        (cx + 10, cy - 50, 80, (230, 140, 30), dict(seed=2, scale=8)),
        (cx + 115, cy - 15, 74, (190, 180, 60), dict(hue=(200, 80, 40), seed=3, scale=12)),
        (cx - 30, cy + 15, 72, (200, 40, 34), dict(hue=(230, 180, 70), seed=4, scale=12))]), color=(210, 192, 160), mound=0)
    def arils(sc, inner, cx, cy, r):
        sc.over(solid(sc, (236, 210, 170)), inner)
        heap(sc, cx, cy, r * 0.8, r * 0.75, 70, lambda sc, x, y, i, g: small_round(sc, x, y, r * 0.08, (190, 20, 40), ks=1.0, shin=70, seed=i, shadow=False, squash=1.1), seed=int(cx), mound=False)
    sphere_fruit(sc, 760, 520, 90, (170, 30, 40), seed=5, hue=(200, 120, 70), stem=False, dimple=False)
    cut_disc(sc, 880, 600, 84, 84, 0, (160, 30, 40), 5, (236, 210, 170), seed=6, center=lambda sc, inner: arils(sc, inner, 880, 600, 84))
    for k in range(4):
        carrot(sc, 120 + k * 14, 560 + k * 26, 330, 52, 0.12 + k * 0.03, seed=k, tops=False)
    citrus_half(sc, 640, 620, 66, seed=7)
    citrus(sc, 520, 650, 70, peel=(240, 200, 40), seed=8)
    from foods1 import garlic
    garlic(sc, 380, 670, 52, seed=9)
    for k, (x, y) in enumerate([(720, 690), (770, 700)]):
        cherry(sc, x, y, 26, (160, 20, 34), 30 + k)
    return done(sc)


def berries():
    sc = stage(102, CLOTH_L, horizon=0.4)
    def fill(sc, cx, cy, rw, rh):
        def one(sc, x, y, i, g):
            k = g.random()
            if k < 0.35:
                strawberry(sc, x, y, 46, angle=(g.random() - 0.5) * 1.2, seed=i)
            elif k < 0.6:
                berry_cluster(sc, x, y, 26, (200, 40, 70), seed=i, elong=1.1)
            elif k < 0.8:
                berry_cluster(sc, x, y, 26, (40, 26, 44), seed=i, elong=1.15)
            else:
                small_round(sc, x, y, 18, (58, 70, 130), ks=0.3, seed=i)
        heap(sc, cx, cy, rw, rh, 34, one, seed=4)
    bowl_of(sc, 520, 430, 270, 180, fill, color=(230, 222, 206), band=(80, 100, 140))
    for k, (x, y) in enumerate([(200, 640), (250, 690), (160, 690), (300, 660)]):
        small_round(sc, x, y, 19, (56, 66, 128), ks=0.3, seed=k)
    strawberry(sc, 820, 630, 60, angle=-0.4, seed=40)
    berry_cluster(sc, 900, 690, 30, (200, 40, 70), seed=41)
    leaf(sc, 760, 690, 130, 50, -2.8, (70, 110, 50), seed=42)
    return done(sc)


def citrus_frame():
    sc = stage(103, CLOTH_R, horizon=0.4)
    bowl_of(sc, 480, 440, 260, 170, lambda sc, cx, cy, rw, rh: [
        citrus(sc, cx - 120, cy - 30, 80, peel=(238, 136, 24), seed=1, leafy=True),
        citrus(sc, cx + 10, cy - 50, 84, peel=(240, 206, 40), seed=2),
        citrus(sc, cx + 130, cy - 20, 74, peel=(90, 150, 40), seed=3),
        citrus(sc, cx - 40, cy + 10, 78, peel=(238, 150, 30), seed=4)], color=(214, 200, 170), band=(70, 90, 120), mound=0)
    citrus_half(sc, 760, 580, 92, peel=(238, 170, 70), flesh=(236, 104, 96), seed=5)
    citrus_half(sc, 300, 650, 72, seed=6)
    citrus_half(sc, 880, 680, 64, peel=(90, 150, 40), flesh=(176, 214, 100), seed=7)
    leaf(sc, 140, 600, 140, 50, -0.3, (52, 96, 40), seed=9)
    return done(sc)


def greens():
    sc = stage(104, CLOTH_L, horizon=0.38)
    g = G(4)
    for k in range(6):
        x, y = 600 + k * 50, 600 - g.random() * 30
        leaf(sc, x, y, 360, 130, -1.95 + k * 0.15, tuple(np.array((40, 76, 58)) * (0.75 + 0.45 * g.random())), curl=0.35, ruffle=0.22, seed=k)
    def fill(sc, cx, cy, rw, rh):
        for k in range(22):
            a, d = g.random() * TAU, g.random()
            leaf(sc, cx + np.cos(a) * rw * 0.75 * d, cy - rh * 0.6 + np.sin(a) * rh * d, 120 + g.random() * 50, 46 + g.random() * 16, g.random() * TAU, tuple(np.array((40, 96, 40)) * (0.75 + 0.5 * g.random())), curl=0.35, seed=20 + k)
    bowl_of(sc, 400, 430, 250, 170, fill, color=(196, 170, 130), inside=(120, 100, 76))
    for k, (x, y, r) in enumerate([(700, 600, 80), (820, 640, 70), (600, 660, 60)]):
        floret(sc, x, y, r, k)
    for k in range(4):
        leaf(sc, 120 + k * 60, 650 + (k % 2) * 30, 130, 50, -0.6 + k * 0.2, (44, 96, 42), curl=0.3, seed=60 + k)
    return done(sc)


def roots():
    sc = stage(105, CLOTH_R, horizon=0.38)
    beet(sc, 680, 480, 100, 1)
    for k in range(5):
        carrot(sc, 120 + k * 16, 380 + k * 40, 480 - k * 16, 70 - k * 3, 0.2 + k * 0.03, seed=k, tops=True)
    tuber(sc, 560, 620, 320, 130, 0.15, (150, 76, 52), seed=3)
    beet(sc, 840, 600, 86, 2, stems=False)
    cut_disc(sc, 880, 690, 70, 64, 0, (110, 26, 48), 5, (170, 30, 70), seed=4,
             center=lambda sc, inner: sc.over(rgb(150, 20, 60) * (0.75 + 0.35 * np.sin(np.hypot(sc.xx - 880, sc.yy - 690) * 0.4))[..., None], inner))
    return done(sc)


def fats():
    sc = stage(106, CLOTH_L, horizon=0.42)
    bottle(sc, 250, 140, 170, 440, liquid=(190, 170, 40), level=0.62)
    avocado_half(sc, 520, 520, 100, 0.15, 3, pit=True)
    avocado_half(sc, 700, 540, 94, -0.2, 4, pit=False)
    bowl_of(sc, 820, 400, 130, 90, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 16,
            lambda sc, x, y, i, g: small_round(sc, x, y, 22, (110, 120, 40) if i % 3 else (60, 40, 50), ks=0.8, squash=0.75, angle=g.random() * 3, seed=i), seed=3), color=(200, 184, 150))
    spill(sc, 400, 670, 120, 40, 7, lambda sc, x, y, i, g: walnut(sc, x, y, 30, g.random() * 3, i), 5)
    spill(sc, 820, 680, 90, 30, 8, lambda sc, x, y, i, g: almond(sc, x, y, 20, g.random() * 3, i), 6)
    branch_leaves(sc, [(470, 330), (600, 300), (720, 330)], 80, 11, (110, 130, 96), seed=7, every=0.1)
    return done(sc)


def herbs():
    sc = stage(107, CLOTH_R, horizon=0.42)
    jug(sc, 420, 260, 200, 260, color=(190, 170, 130))
    for k in range(5):
        basil(sc, 420 + (k - 2) * 30, 270, 220, -np.pi / 2 + (k - 2) * 0.3, seed=k)
    mortar(sc, 760, 560, 130, fill=lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 20, lambda sc, x, y, i, g: leaf(sc, x, y, 34, 14, g.random() * 6, (60, 110, 50), seed=i, vein=False), seed=3))
    sprig(sc, 120, 640, 240, -0.15, needle=22, color=(60, 96, 60), seed=8)
    sprig(sc, 160, 690, 220, -0.05, needle=13, color=(84, 112, 62), count=34, seed=9, round_leaves=True)
    mint_sprig(sc, 560, 690, 180, -0.3, seed=12)
    return done(sc)


def pomegranates():
    sc = stage(108, CLOTH_L, horizon=0.4)
    def arils(sc, inner, cx, cy, r):
        sc.over(solid(sc, (236, 210, 170)), inner)
        heap(sc, cx, cy, r * 0.8, r * 0.75, 110, lambda sc, x, y, i, g: small_round(sc, x, y, r * 0.075, (190, 20, 40), ks=1.0, shin=70, seed=i, shadow=False, squash=1.1), seed=int(cx), mound=False)
    for (x, y, r, sd) in [(330, 430, 130, 1), (560, 460, 120, 2)]:
        sphere_fruit(sc, x, y, r, (170, 30, 40), seed=sd, hue=(200, 120, 70), stem=False, dimple=False, scale=16)
        crown = sc.poly([(x - 22, y - r * 0.85), (x - 30, y - r * 1.15), (x - 10, y - r * 1.02), (x, y - r * 1.2), (x + 10, y - r * 1.02), (x + 30, y - r * 1.15), (x + 22, y - r * 0.85)], smooth=0.8)
        sc.shade(crown, rgb(150, 40, 40), ks=0.3, shin=20)
    for (x, y, r, sd) in [(780, 560, 120, 3), (440, 640, 90, 4)]:
        cut_disc(sc, x, y, r, r, 0, (160, 30, 40), 6, (236, 210, 170), seed=sd, center=lambda sc, inner, x=x, y=y, r=r: arils(sc, inner, x, y, r))
    spill(sc, 200, 660, 120, 40, 18, lambda sc, x, y, i, g: small_round(sc, x, y, 9, (190, 20, 40), ks=1.0, shin=70, seed=i), 8)
    leaf(sc, 860, 360, 150, 50, -0.5, (70, 110, 50), seed=11)
    return done(sc)


def honey_frame():
    import scenes_foods
    return scenes_foods.honey()


# ------------------------------------------------ remedy frames
def ginger():
    sc = stage(110, CLOTH_R, horizon=0.42)
    cup(sc, 620, 440, 130, 120, color=(234, 226, 212), liquid=(200, 160, 70), band=(80, 100, 130))
    steam(sc, 620, 420, 260, 50, seed=2)
    ginger_root(sc, 290, 560, 170, -0.2, seed=1)
    citrus_half(sc, 860, 640, 64, seed=3)
    for k in range(3):
        cut_disc(sc, 520 + k * 50, 680 + (k % 2) * 16, 34, 30, 0, (200, 160, 110), 3, (240, 214, 130), seed=k)
    return done(sc)


def honey_lemon():
    sc = stage(111, CLOTH_L, horizon=0.42)
    glass(sc, 560, 300, 200, 280, liquid=(236, 200, 120), level=0.8, opacity=0.6)
    cut_disc(sc, 560, 420, 70, 70, 0, (230, 196, 50), 6, (246, 222, 110), seed=1)
    jar(sc, 260, 300, 200, 260, fill=(214, 140, 30), level=0.88, lid=(150, 120, 80))
    for (x, y, sd) in [(800, 560, 2), (880, 640, 3)]:
        m = sc.egg_mask(x, y, 70, angle=0.15, elong=1.25, point=0.0)
        sc.contact(m)
        sc.shade(m, mottled(sc, rgb(240, 206, 40), 0.07, 2.5, sd), ks=0.45, shin=30)
    citrus_half(sc, 680, 660, 60, seed=4)
    return done(sc)


def peppermint():
    sc = stage(112, CLOTH_R, horizon=0.42)
    cup(sc, 520, 440, 140, 125, color=(232, 226, 214), liquid=(150, 150, 60), band=(70, 110, 90))
    steam(sc, 520, 420, 260, 50, seed=3)
    for k, (x, y, a) in enumerate([(160, 640, -0.4), (220, 690, -0.2), (760, 650, -2.7), (820, 610, -2.4)]):
        mint_sprig(sc, x, y, 200, a, seed=k)
    return done(sc)


def chamomile():
    sc = stage(113, CLOTH_L, horizon=0.42)
    cup(sc, 600, 450, 130, 120, color=(236, 230, 218), liquid=(214, 170, 60), band=(120, 150, 110))
    steam(sc, 600, 430, 240, 46, seed=4)
    jug(sc, 280, 250, 150, 220, color=(150, 170, 160))
    daisy_bunch(sc, 280, 230, 150, 11, seed=5, r=30)
    for k in range(6):
        g = G(k)
        flower(sc, 760 + g.random() * 160, 640 + g.random() * 60, 26, petals=16, seed=k + 20, squash=0.6)
    return done(sc)


def turmeric():
    sc = stage(114, CLOTH_R, horizon=0.42)
    bowl_of(sc, 520, 460, 170, 110, lambda sc, cx, cy, rw, rh: [sc.shade(sc.ellipse(cx, cy + 6, rw * 1.02, rh * 0.9), mottled(sc, rgb(236, 160, 20), 0.12, 2), h=sc.dome(sc.ellipse(cx, cy + 6, rw, rh * 0.9))[0] * 0.6, ks=0.1, shin=8)], color=(214, 204, 186), mound=0)
    cup(sc, 800, 420, 100, 100, color=(230, 222, 206), liquid=(240, 180, 60))
    for k, (x, y, a) in enumerate([(240, 600, -0.3), (340, 670, 0.2), (700, 660, -0.1)]):
        turmeric_root(sc, x, y, 110, a, seed=k, cut=k == 1)
    spoon(sc, 160, 470, 1, 0) if False else None
    return done(sc)


def elderberry():
    sc = stage(115, CLOTH_L, horizon=0.42)
    bottle(sc, 300, 170, 170, 400, liquid=(70, 16, 40), level=0.7)
    elderberry_cluster(sc, 600, 330, 180, 200, seed=1)
    elderberry_cluster(sc, 800, 420, 140, 160, seed=2)
    for k in range(4):
        leaf(sc, 640 + k * 60, 640, 130, 40, -2.6 + k * 0.4, (70, 110, 50), seed=k)
    return done(sc)


def garlic_frame():
    from foods1 import garlic
    sc = stage(116, CLOTH_R, horizon=0.42)
    board(sc, 500, 560, 760, 280)
    for (x, y, r, sd) in [(330, 480, 110, 1), (520, 500, 100, 2), (720, 520, 90, 3)]:
        garlic(sc, x, y, r, seed=sd)
    for k in range(6):
        g = G(k)
        pts = blob_pts(300 + k * 70, 650 + g.random() * 20, 30, 18, g.random() * 3, 0.05, k, shape=lambda t: 1 - 0.2 * np.cos(t))
        body(sc, pts, (238, 228, 210), ks=0.4, shin=24, seed=k)
    return done(sc)


def cinnamon():
    sc = stage(117, CLOTH_L, horizon=0.42)
    for k in range(6):
        cinnamon_stick(sc, 200 + k * 14, 520 + k * 22, 420, -0.18, r=18, seed=k)
    fruit_group(sc, [(720, 470, 92, (186, 34, 32), dict(hue=(226, 180, 70), seed=8, scale=14)),
                     (850, 560, 84, (200, 60, 36), dict(hue=(230, 190, 80), seed=9, scale=14))])
    cup(sc, 420, 650, 70, 60, color=(150, 110, 70), liquid=(120, 60, 30), saucer=False)
    return done(sc)


def rosemary():
    sc = stage(118, CLOTH_R, horizon=0.42)
    jug(sc, 450, 250, 180, 250, color=(204, 190, 160), band=(110, 70, 50))
    for k in range(6):
        sprig(sc, 450 + (k - 2.5) * 16, 280, 280, -np.pi / 2 + (k - 2.5) * 0.24, needle=24, color=(60, 96, 60), seed=k, count=30)
    for k in range(3):
        sprig(sc, 620 + k * 30, 630 + k * 24, 260, -0.15 + k * 0.05, needle=24, color=(60, 96, 60), seed=20 + k, count=30)
    return done(sc)


def thyme():
    sc = stage(119, CLOTH_L, horizon=0.42)
    mortar(sc, 560, 500, 150, fill=lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 60, lambda sc, x, y, i, g: small_round(sc, x, y, 6, (90, 110, 60), ks=0.2, seed=i, shadow=False), seed=3))
    for k in range(5):
        sprig(sc, 100 + k * 18, 620 + k * 20, 280, -0.2 + k * 0.05, needle=13, color=(84, 112, 62), count=40, seed=30 + k, round_leaves=True)
    for k in range(3):
        sprig(sc, 760 + k * 20, 660 + k * 14, 220, -0.3, needle=13, color=(84, 112, 62), count=34, seed=50 + k, round_leaves=True)
    return done(sc)


SCENES = {
    "oil-food-abundance": abundance, "oil-berries": berries, "oil-citrus": citrus_frame, "oil-greens": greens,
    "oil-roots": roots, "oil-avocado-olive": fats, "oil-herbs": herbs, "oil-pomegranate": pomegranates,
    "oil-honey": honey_frame, "oil-ginger": ginger, "oil-honey-lemon": honey_lemon, "oil-peppermint": peppermint,
    "oil-chamomile": chamomile, "oil-turmeric": turmeric, "oil-elderberry": elderberry, "oil-garlic": garlic_frame,
    "oil-cinnamon": cinnamon, "oil-rosemary": rosemary, "oil-thyme": thyme,
}
