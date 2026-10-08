from scenes_foods import stage, done, spill, spoon, CLOTH_L, CLOTH_R, almond, roast_breast
from scenes_fruits import fruit_group, cherry
from items2 import *


def candle(sc, cx, top, w, height, color=(238, 228, 206)):
    rx = w / 2
    rect = ((np.abs(sc.xx - cx) <= rx) & (sc.yy >= top) & (sc.yy <= top + height)).astype(np.float32)
    m = np.clip(ndi.gaussian_filter(rect, 0.8) + sc.ellipse(cx, top + height, rx, rx * 0.2), 0, 1)
    sc.contact(m * 0.7, size=w)
    u = np.clip((sc.xx - cx) / rx, -1, 1)
    hw = np.sqrt(np.clip(1 - u * u, 0, 1)) * rx
    sc.shade(m, mottled(sc, rgb(*color), 0.04, 8), h=hw, R=rx, ks=0.2, shin=20, translucency=0.3)
    sc.over(solid(sc, tuple(np.array(color) * 0.9)), sc.ellipse(cx, top, rx, rx * 0.2))
    wick = sc.stroke_mask([(cx, top), (cx + 1, top - 14)], 2.5)
    sc.over(solid(sc, (40, 30, 20)), wick)
    # flame and its warm glow on everything around it
    glow = np.exp(-((sc.xx - cx) ** 2 + (sc.yy - top + 40) ** 2) / (2 * (w * 1.8) ** 2))
    sc.img = sc.img + glow[..., None] * np.array([0.42, 0.28, 0.1])
    fl = sc.egg_mask(cx, top - 38, 12, angle=np.pi / 2, elong=2.0, point=0.5)
    sc.over(solid(sc, (255, 236, 170)), fl)
    core = sc.egg_mask(cx, top - 30, 6, angle=np.pi / 2, elong=1.6, point=0.3)
    sc.over(solid(sc, (255, 252, 230)), core)


def towel(sc, x, y, w, h, color=(232, 226, 214), stripe=(120, 150, 170), seed=0):
    allm = block(sc, x, y, w, h, w * 0.5, color, seed=seed, top_light=1.08, side_dark=0.8, tex=0.06)
    b = ((sc.xx > x + w * 0.12) & (sc.xx < x + w * 0.2)).astype(np.float32) * allm
    sc.over(solid(sc, stripe), b * 0.7)
    return allm


def hot_water_bottle(sc, cx, cy, w, h, color=(170, 40, 40), seed=0):
    pts = blob_pts(cx, cy, w / 2, h / 2, -0.15, 0.0, n=80, shape=lambda t: 1 / np.maximum(np.abs(np.cos(t)) ** 5 + np.abs(np.sin(t)) ** 5, 1e-3) ** (1 / 5))
    ribs = 0.5 + 0.5 * np.sin((sc.xx * 0.15 + sc.yy * 0.98) * 0.35)
    col = mottled(sc, rgb(*color), 0.08, 6, seed) * (0.9 + 0.12 * ribs)[..., None]
    m = body(sc, pts, col, ks=0.45, shin=30, bump=ribs * 2, flat=0.3, seed=seed)
    nx, ny = cx + np.sin(0.15) * h * 0.55, cy - h * 0.55
    neck = sc.poly([(nx - w * 0.14, ny + 20), (nx + w * 0.14, ny + 20), (nx + w * 0.1, ny - h * 0.12), (nx - w * 0.1, ny - h * 0.12)], smooth=1)
    sc.shade(neck, rgb(*color), ks=0.4, shin=30)
    cap = sc.ellipse(nx, ny - h * 0.14, w * 0.12, w * 0.07)
    sc.shade(cap, rgb(60, 50, 44), ks=0.5, shin=30)


def pitcher(sc, cx, top, w, height, liquid=(214, 226, 214), slices=None, seed=0):
    shape = glass(sc, cx, top, w, height, liquid=liquid, level=0.85, opacity=0.45)
    if slices:
        slices(sc, shape)
    hm = np.clip(sc.ellipse(cx + w * 0.55, top + height * 0.4, w * 0.18, height * 0.28) - sc.ellipse(cx + w * 0.55, top + height * 0.4, w * 0.1, height * 0.2), 0, 1) * (sc.xx > cx + w * 0.45)
    sc.img += (hm * 0.25)[..., None]
    return shape


def water_bowl(sc, cx, cy, rw, depth, color=(222, 214, 198), steam_h=0):
    def fill(sc, x, y, rx, ry):
        m = sc.ellipse(x, y + 18, rx * 1.02, ry * 0.7)
        sc.over(rgb(150, 170, 176) * np.clip(0.7 + 0.4 * (sc.yy - y) / ry, 0.5, 1.15)[..., None], m)
        glint = sc.ellipse(x - rx * 0.3, y + 4, rx * 0.25, ry * 0.12)
        sc.img += (ndi.gaussian_filter(glint, 3) * 0.3)[..., None]
    bowl_of(sc, cx, cy, rw, depth, fill, color=color, mound=0.0)
    if steam_h:
        steam(sc, cx, cy - 10, steam_h, rw * 0.35, seed=5, strength=0.3)


# ---------------------------------------------------------------- scenes
def fennel_seeds():
    sc = stage(201, CLOTH_L, horizon=0.42)
    def seed_item(sc, x, y, i, g):
        small_round(sc, x, y, 8, tuple(np.clip(np.array((150, 156, 90)) * (0.85 + 0.3 * g.random()), 0, 255)), ks=0.3, squash=0.38, angle=g.random() * 3, seed=i, shadow=False)
    bowl_of(sc, 560, 460, 190, 130, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 500, seed_item, seed=2), color=(200, 184, 150), band=(70, 90, 120))
    bulb = sc.poly(blob_pts(260, 500, 120, 100, 0, 0.05, 3, shape=lambda t: 1 - 0.2 * np.clip(-np.sin(t), 0, 1)), smooth=1)
    sc.contact(bulb)
    sc.shade(bulb, mottled(sc, rgb(226, 232, 196), 0.06, 10, 3), ks=0.4, shin=24, bump=np.sin(sc.xx * 0.12) * 2)
    for k in range(4):
        a = -np.pi / 2 + (k - 1.5) * 0.3
        st = sc.stroke_mask([(260 + (k - 1.5) * 20, 410), (260 + np.cos(a) * 200, 410 + np.sin(a) * 200)], 12)
        sc.shade(st, rgb(170, 200, 120), ks=0.3, shin=20)
    spill(sc, 820, 660, 110, 40, 60, seed_item, 5)
    return done(sc)


def lemon_balm_tea():
    sc = stage(202, CLOTH_R, horizon=0.42)
    cup(sc, 520, 440, 140, 125, color=(232, 226, 214), liquid=(196, 180, 80), band=(150, 170, 90))
    steam(sc, 520, 420, 240, 50, seed=7)
    for k, (x, y, a) in enumerate([(150, 640, -0.4), (230, 690, -0.15)]):
        mint_sprig(sc, x, y, 190, a, color=(110, 160, 60), seed=k + 30)
    citrus_half(sc, 830, 600, 70, seed=4)
    citrus(sc, 760, 380, 70, peel=(240, 206, 40), seed=5)
    return done(sc)


def box_breathing():
    sc = stage(203, CLOTH_L, horizon=0.45, light=(120, 92, 62))
    candle(sc, 560, 260, 110, 260)
    candle(sc, 720, 380, 80, 160, color=(232, 222, 200))
    for k in range(4):
        lavender_sprig(sc, 180 + k * 30, 690, 330, -1.1 - k * 0.12, seed=k)
    return done(sc)


def lavender():
    sc = stage(204, CLOTH_R, horizon=0.42)
    jug(sc, 400, 300, 170, 230, color=(214, 206, 196))
    for k in range(9):
        lavender_sprig(sc, 400 + (k - 4) * 10, 310, 300, -np.pi / 2 + (k - 4) * 0.14, seed=k)
    bottle(sc, 680, 380, 90, 200, liquid=(150, 110, 170), level=0.6, cork=(60, 50, 44))
    for k in range(3):
        lavender_sprig(sc, 640 + k * 30, 690, 260, -0.25 - k * 0.1, seed=20 + k)
    return done(sc)


def peppermint_oil():
    sc = stage(205, CLOTH_L, horizon=0.42)
    bottle(sc, 470, 300, 130, 280, liquid=(150, 90, 30), level=0.9, cork=(40, 36, 32))
    for k, (x, y, a) in enumerate([(160, 640, -0.5), (720, 620, -2.6), (780, 680, -2.8), (250, 690, -0.2)]):
        mint_sprig(sc, x, y, 190, a, seed=k + 40)
    return done(sc)


def cool_compress():
    sc = stage(206, CLOTH_R, horizon=0.42)
    water_bowl(sc, 560, 440, 230, 150, color=(200, 214, 220))
    towel(sc, 180, 580, 260, 60, color=(236, 232, 224), stripe=(120, 150, 180))
    for k in range(3):
        sphere_fruit(sc, 830 + k * 40, 640 + (k % 2) * 30, 30, (220, 236, 240), ks=1.0, shin=80, seed=k, stem=False, dimple=False, var=0.02)
    return done(sc)


def salt_gargle():
    sc = stage(207, CLOTH_L, horizon=0.42)
    glass(sc, 470, 290, 180, 300, liquid=(214, 224, 226), level=0.75, opacity=0.35)
    bowl_of(sc, 720, 560, 110, 70, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 180, lambda sc, x, y, i, g: small_round(sc, x, y, 4, (246, 246, 242), ks=0.6, seed=i, shadow=False), seed=3), color=(110, 120, 140))
    spoon(sc, 260, 660, 220, 0.2, color=(200, 196, 190), fill=lambda sc, fm, x, y, br: sc.over(solid(sc, (246, 246, 240)), fm))
    return done(sc)


def steam_inhalation():
    sc = stage(208, CLOTH_R, horizon=0.42)
    water_bowl(sc, 500, 450, 260, 170, color=(226, 220, 206), steam_h=360)
    towel(sc, 760, 600, 200, 56, color=(230, 222, 206), stripe=(170, 90, 70), seed=2)
    branch_leaves(sc, [(120, 650), (230, 610), (330, 600)], 60, 22, (120, 150, 130), seed=3, every=0.12)
    return done(sc)


def chicken_soup():
    sc = stage(209, CLOTH_L, horizon=0.42)
    def fill(sc, cx, cy, rw, rh):
        m = sc.ellipse(cx, cy + 20, rw * 1.02, rh * 0.75)
        sc.over(rgb(214, 160, 70) * np.clip(0.8 + 0.3 * (sc.yy - cy) / rh, 0.6, 1.1)[..., None], m)
        g = G(4)
        for k in range(14):
            x, y = cx + (g.random() - 0.5) * rw * 1.4, cy + (g.random() - 0.3) * rh
            r = g.random()
            if r < 0.35:
                cut_disc(sc, x, y, 22, 17, 0, (220, 110, 30), 3, (238, 130, 40), seed=k)
            elif r < 0.65:
                body(sc, blob_pts(x, y, 30, 20, g.random() * 3, 0.15, k), (236, 220, 190), ks=0.3, shin=20, seed=k)
            elif r < 0.85:
                small_round(sc, x, y, 14, (150, 190, 90), ks=0.4, squash=0.7, seed=k)
            else:
                leaf(sc, x, y, 34, 14, g.random() * 6, (60, 110, 50), seed=k)
    bowl_of(sc, 520, 450, 270, 180, fill, color=(226, 218, 200), inside=(200, 190, 170), band=(70, 90, 130), mound=0.0)
    steam(sc, 520, 400, 320, 60, seed=3)
    carrot(sc, 760, 650, 230, 46, -0.25, seed=8, tops=True)
    from foods1 import garlic
    garlic(sc, 170, 620, 56, seed=6)
    return done(sc)


def saline_rinse():
    sc = stage(210, CLOTH_R, horizon=0.42)
    glass(sc, 380, 300, 170, 290, liquid=(214, 224, 226), level=0.8, opacity=0.35)
    jar(sc, 640, 380, 150, 200, fill=(244, 244, 238), level=0.7, lid=(150, 150, 150))
    spoon(sc, 820, 680, 180, -0.3, color=(200, 196, 190), fill=lambda sc, fm, x, y, br: sc.over(solid(sc, (246, 246, 240)), fm))
    return done(sc)


def steady_snack():
    sc = stage(211, CLOTH_L, horizon=0.42)
    sphere_fruit(sc, 380, 470, 120, (186, 34, 32), hue=(226, 180, 70), seed=8, scale=14)
    cut_disc(sc, 560, 560, 90, 84, 0.2, (190, 40, 30), 5, (246, 236, 200), seed=9)
    bowl_of(sc, 800, 520, 140, 90, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 30, lambda sc, x, y, i, g: almond(sc, x, y, 20, g.random() * 6, i), seed=3), color=(200, 184, 150))
    spill(sc, 250, 680, 120, 30, 6, lambda sc, x, y, i, g: almond(sc, x, y, 22, g.random() * 6, i + 50), 4)
    return done(sc)


def morning_light():
    sc = stage(212, CLOTH_R, horizon=0.42, light=(190, 150, 90))
    # a shaft of morning light across the wall and table
    beam = np.clip(1 - np.abs((sc.xx - 0.9 * sc.yy) - 260) / 220, 0, 1) ** 1.5
    sc.img = sc.img * (1 + 0.55 * beam)[..., None] + (beam * 0.08)[..., None]
    glass(sc, 470, 320, 160, 270, liquid=(222, 230, 226), level=0.8, opacity=0.3)
    citrus(sc, 700, 520, 90, peel=(238, 136, 24), seed=2, leafy=True)
    citrus_half(sc, 830, 630, 64, peel=(238, 136, 24), flesh=(246, 160, 50), seed=3)
    return done(sc)


def green_tea():
    sc = stage(213, CLOTH_L, horizon=0.42)
    cup(sc, 560, 440, 140, 120, color=(214, 220, 206), liquid=(170, 170, 70), band=(90, 120, 90), handle=False)
    steam(sc, 560, 420, 240, 50, seed=8)
    spill(sc, 240, 650, 150, 50, 50, lambda sc, x, y, i, g: leaf(sc, x, y, 26, 7, g.random() * 6, (70, 90, 40), curl=0.4, vein=False, seed=i), 3)
    for k in range(3):
        leaf(sc, 780 + k * 40, 640, 120, 44, -2.5 + k * 0.3, (60, 110, 50), seed=k + 10)
    return done(sc)


def ginger_cramps():
    sc = stage(214, CLOTH_R, horizon=0.42)
    hot_water_bottle(sc, 330, 470, 260, 300, seed=1)
    ginger_root(sc, 690, 560, 150, 0.2, seed=3)
    cup(sc, 760, 380, 80, 80, color=(232, 226, 212), liquid=(200, 160, 70), saucer=False)
    return done(sc)


def heat_therapy():
    sc = stage(215, CLOTH_L, horizon=0.42)
    towel(sc, 380, 560, 420, 70, color=(206, 190, 170), stripe=(150, 80, 60), seed=4)
    hot_water_bottle(sc, 560, 420, 260, 300, color=(150, 40, 46), seed=2)
    cup(sc, 830, 430, 80, 80, color=(232, 226, 212), liquid=(150, 90, 50), saucer=False)
    return done(sc)


def aloe():
    sc = stage(216, CLOTH_R, horizon=0.42)
    for k in range(4):
        aloe_leaf(sc, 180 + k * 30, 560 + k * 30, 460, 90 - k * 8, -0.25 + k * 0.08, seed=k, cut=True)
    bowl_of(sc, 760, 470, 130, 90, lambda sc, cx, cy, rw, rh: sc.shade(sc.ellipse(cx, cy + 8, rw, rh * 0.8), rgb(214, 236, 200), h=sc.dome(sc.ellipse(cx, cy + 8, rw, rh * 0.8))[0] * 0.4, ks=0.9, shin=60, translucency=0.3), color=(214, 204, 186), mound=0)
    return done(sc)


def rehydration():
    sc = stage(217, CLOTH_L, horizon=0.42)
    pitcher(sc, 400, 220, 220, 360, liquid=(218, 228, 220))
    glass(sc, 640, 360, 130, 220, liquid=(218, 228, 220), level=0.8, opacity=0.35)
    citrus_half(sc, 820, 620, 70, seed=3)
    bowl_of(sc, 220, 650, 70, 50, lambda sc, cx, cy, rw, rh: heap(sc, cx, cy, rw, rh, 90, lambda sc, x, y, i, g: small_round(sc, x, y, 3.5, (246, 246, 242), ks=0.6, seed=i, shadow=False), seed=3), color=(110, 120, 140))
    return done(sc)


def infused_water():
    sc = stage(218, CLOTH_R, horizon=0.4)
    def slices(sc, shape):
        for k, (x, y) in enumerate([(430, 420), (480, 500), (410, 560)]):
            if k == 1:
                cut_disc(sc, x, y, 44, 44, 0, (230, 196, 50), 4, (246, 222, 110), seed=k, glints=0)
            else:
                cut_disc(sc, x, y, 40, 38, 0, (50, 90, 40), 3, (210, 230, 160), seed=k, glints=0)
        sc.img = sc.img * (1 - 0.25 * shape[..., None]) + rgb(214, 230, 220) * 0.25 * shape[..., None]
    pitcher(sc, 450, 220, 230, 380, slices=slices)
    for k, (x, y) in enumerate([(780, 620), (860, 660)]):
        cut_disc(sc, x, y, 56, 52, 0, (50, 90, 40), 4, (210, 230, 160), seed=k + 5)
    citrus_half(sc, 720, 470, 62, seed=8)
    mint_sprig(sc, 140, 650, 180, -0.3, seed=9)
    return done(sc)


SCENES = {
    "fennel-seeds-after-meals": fennel_seeds, "lemon-balm-tea": lemon_balm_tea, "box-breathing": box_breathing,
    "lavender-aromatherapy": lavender, "peppermint-oil-temples": peppermint_oil, "cool-compress-water": cool_compress,
    "salt-water-gargle": salt_gargle, "steam-inhalation": steam_inhalation, "chicken-vegetable-soup": chicken_soup,
    "saline-nasal-rinse": saline_rinse, "steady-energy-snack": steady_snack, "morning-light-walk": morning_light,
    "green-tea-pick-me-up": green_tea, "ginger-for-cramps": ginger_cramps, "heat-therapy-cramps": heat_therapy,
    "aloe-for-sunburn": aloe, "homemade-rehydration-drink": rehydration, "fruit-infused-water": infused_water,
}
