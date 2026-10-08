from scene import *

W, H = 1000, 750


def garlic(sc, cx, cy, r, seed=0):
    m = sc.egg_mask(cx, cy + r * 0.1, r, angle=-np.pi / 2, elong=0.95, point=0.35)
    sc.contact(m)
    ang = np.arctan2(sc.yy - cy, sc.xx - cx)
    ribs = 0.5 + 0.5 * np.cos((sc.xx - cx) / r * 7.5)
    col = mottled(sc, rgb(236, 226, 206), 0.06, 6, seed) * (0.9 + 0.1 * ribs)[..., None]
    col = col + (np.clip((sc.yy - cy) / r, 0, 1) * 0.12)[..., None] * (rgb(190, 140, 160) - rgb(236, 226, 206))
    h, R = sc.dome(m)
    sc.shade(m, col, h=h, R=R, bump=-(1 - ribs) * 2.5 * m, ks=0.3, shin=20, translucency=0.1)
    tip = sc.stroke_mask([(cx, cy - r * 0.95), (cx + r * 0.08, cy - r * 1.35)], max(2, r * 0.1))
    sc.over(np.broadcast_to(rgb(200, 180, 140), sc.img.shape), tip)


def eggs():
    sc = Scene(W, H, seed=11)
    sc.backdrop(base=(46, 34, 24), light=(122, 96, 64), horizon=0.56, wood=(104, 68, 40),
                cloth=([(0, 540), (470, 505), (610, 750), (0, 750)],))
    inner, front = bowl(sc, 610, 430, 235, 165, color=(206, 190, 158), inside=(170, 150, 120), band=(70, 86, 110))
    for (x, y, r, a, c, s) in [(470, 405, 58, -0.55, (186, 120, 74), 1), (705, 395, 57, 0.6, (176, 108, 64), 2),
                               (560, 385, 60, -0.15, (238, 226, 206), 3), (650, 380, 58, 0.25, (192, 128, 80), 4),
                               (520, 440, 62, -0.3, (170, 104, 62), 5), (610, 445, 63, 0.1, (196, 134, 86), 6),
                               (715, 440, 60, 0.45, (234, 222, 200), 7)]:
        egg(sc, x, y, r, a, c, speck=c[0] < 220, seed=s)
    front()
    egg(sc, 205, 610, 68, 0.2, (184, 118, 72), seed=21)
    egg(sc, 345, 660, 64, -0.35, (238, 228, 210), speck=False, seed=22)
    egg(sc, 120, 690, 60, 0.6, (172, 106, 64), seed=23)
    for i, (x, y, a) in enumerate([(840, 620, -2.6), (860, 600, -2.1), (870, 640, -2.9), (820, 650, -2.4)]):
        leaf(sc, x, y, 70, 22, a, (64, 104, 44), curl=0.3, seed=40 + i)
    sc.vignette(0.5)
    return sc.img


def chicken_piece(sc, cx, cy, s, angle, seed):
    """A roasted chicken breast: plump teardrop, golden with deeper browned patches."""
    t = np.linspace(0, 2 * np.pi, 80)
    rx = s * (1.0 + 0.28 * np.cos(t))
    ry = s * 0.62 * (1 + 0.08 * np.sin(3 * t))
    c, si = np.cos(angle), np.sin(angle)
    pts = [(cx + rx[i] * np.cos(t[i]) * c - ry[i] * np.sin(t[i]) * si, cy + rx[i] * np.cos(t[i]) * si + ry[i] * np.sin(t[i]) * c) for i in range(80)]
    m = sc.poly(pts, smooth=1.0)
    sc.contact(m)
    base = rgb(196, 128, 58)
    col = mottled(sc, base, 0.22, 7, seed, hue=rgb(128, 66, 28))
    crisp = np.clip(noise(sc.h, sc.w, 3, seed=seed + 3), 0, 1)
    col = col * (1 - 0.5 * crisp[..., None]) + rgb(110, 58, 24) * 0.5 * crisp[..., None]
    herbs = (np.random.default_rng(seed).random(sc.img.shape[:2]) < 0.0025).astype(np.float32)
    herbs = np.clip(ndi.gaussian_filter(herbs, 1.0) * 5, 0, 1)
    col = col * (1 - herbs[..., None]) + rgb(60, 76, 36) * herbs[..., None]
    h, R = sc.dome(m, soften=0.12)
    bump = noise(sc.h, sc.w, 2.5, seed=seed + 9) * 2.0
    sc.shade(m, col, h=h * 0.8, R=R, ks=0.55, shin=34, bump=bump, translucency=0.08, rim=0.2)
    return m


def chicken():
    sc = Scene(W, H, seed=12)
    sc.backdrop(base=(40, 30, 22), light=(110, 86, 58), horizon=0.5, wood=(92, 58, 34),
                cloth=([(560, 470), (1000, 440), (1000, 750), (700, 750)],))
    plate(sc, 470, 545, 360, color=(228, 220, 204), rimcol=(70, 90, 120))
    for i, (x, y, a) in enumerate([(220, 520, -0.4), (250, 560, -0.1), (700, 600, 2.9)]):
        sprig(sc, x, y, 150, a, seed=60 + i)
    chicken_piece(sc, 400, 500, 120, -0.12, 1)
    # sliced breast fanned out: pale meat inside a browned edge
    for i in range(5):
        x, y = 560 + i * 46, 590 - i * 16
        m = sc.ellipse(x, y, 34, 70, 0.35)
        sc.contact(m)
        inner = sc.ellipse(x - 3, y - 2, 27, 62, 0.35)
        meat = mottled(sc, rgb(236, 214, 182), 0.07, 2.5, i)
        fibers = 0.5 + 0.5 * np.sin((sc.xx * 0.8 + sc.yy * 1.6) * 0.9)
        meat *= (0.95 + 0.05 * fibers)[..., None]
        sc.shade(m, mottled(sc, rgb(178, 106, 46), 0.2, 4, i), ks=0.5, shin=30, rim=0.1)
        sc.shade(inner, meat, ks=0.25, shin=20, flat=0.6, strength=0.6, ao=0.15)
    citrus_half(sc, 790, 420, 58, seed=3)
    citrus_half(sc, 330, 640, 48, seed=4)
    garlic(sc, 880, 600, 52, seed=5)
    sc.vignette(0.5)
    return sc.img


if __name__ == "__main__":
    import sys, time
    from painter import paint, save
    for name in [a for a in sys.argv[1:] if not a.startswith('--')]:
        t = time.time()
        import os
        if os.path.exists(f"out/{name}-ref.npy") and "--fresh" not in sys.argv:
            ref = np.load(f"out/{name}-ref.npy")
        else:
            ref = globals()[name]()
            np.save(f"out/{name}-ref.npy", ref)
            save(ref, f"out/{name}-ref.jpg")
        out = paint(ref)
        save(out, f"out/{name}.jpg", (800, 600))
        print(name, round(time.time() - t, 1), "s")
