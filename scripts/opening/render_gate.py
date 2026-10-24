"""Renders the opening's gate as image layers for the app (public/opening/).

A small physically based renderer in numpy. A camera stands in front of a dark stone wall with a tall, narrow arched
doorway: a moulded bronze-and-gold architrave with a keystone and plinths, a deep stone reveal, a polished stone
threshold and a polished floor. Beyond the doorway is soft white light (a bright, hazy space). That light is an area
light seen through the doorway: it lights the reveal, the floor (with the open door's shadow) and the inner edge of the
mouldings, it scatters in the haze in front of the wall (single scattering), and the polished floor reflects it. The
image is exposed and tone-mapped like film (ACES), with a little bloom, and split into the layers the app animates:

  gate-base.webp   the scene with the door shut: only the light leaking round the door; the bright space beyond the
                   doorway is already there, hidden behind the door leaf the app draws on top
  gate-light.webp  what the open door adds (the light on the floor and the reveal, the lit haze, the reflection, the
                   bloom), added on top in proportion to how far the door has opened
  gate-door.webp   the door leaf (with transparency); the app turns it about its hinge in 3D
  gate-haze.webp   a tileable mist texture the app drifts slowly through the light
  src/components/common/gate-geometry.json   where the door, the hinge and the camera are in the picture

  python3 scripts/opening/render_gate.py             full size (1800 × 2700), about two minutes
  python3 scripts/opening/render_gate.py --preview   half size, to a scratch folder, for quick looks
"""

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]

# ------------------------------------------------------------------------------------------------ scene (metres)
A = 0.45  # half width of the doorway
YS = 2.45  # spring line of the arch
TOP = YS + A
T = 0.62  # depth of the wall (the reveal)
HS = 0.06  # threshold slab height
XS = A + 0.30  # threshold half width
ZS0 = -0.36  # front edge of the threshold
BAND = 0.205  # width of the moulded architrave on the wall face
OPEN = math.radians(80)  # how far the door ends up open (inward)
GAP = {"hinge": 0.006, "free": 0.013, "top": 0.013, "bottom": 0.016}
DOOR_T = 0.05  # door leaf thickness

CAM = np.array([0.0, 1.30, -4.30])
L_IN = np.array([1.0, 0.985, 0.955])  # the light beyond the doorway: soft, very slightly warm white
KEY_DIR = np.array([-0.45, 0.85, -1.0]) / np.linalg.norm([-0.45, 0.85, -1.0])  # dim cool key light from up front-left
KEY_E = 0.065
KEY_COL = np.array([0.84, 0.89, 1.0])
AMB = 0.006
EXPOSURE = 3.3
SIGMA_FOG = 0.095  # haze density (1/m)

KIND = {"none": 0, "floor": 1, "slab": 2, "wall": 3, "jamb": 4, "soffit": 5, "interior": 6}


def norm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)


def smooth(e0, e1, x):
    u = np.clip((x - e0) / (e1 - e0), 0, 1)
    return u * u * (3 - 2 * u)


def inside_opening(x, y):
    return (y >= HS) & (np.abs(x) <= A) & ((y <= YS) | (x * x + (y - YS) ** 2 <= A * A))


# ------------------------------------------------------------------------------------------------ textures
def fbm(n, beta, seed, aniso=(1.0, 1.0)):
    """Tileable fractal noise (n × n), zero mean, unit deviation: random phases under a 1/f^beta spectrum."""
    r = np.random.default_rng(seed)
    fx = np.fft.fftfreq(n)[None, :] * aniso[0]
    fy = np.fft.fftfreq(n)[:, None] * aniso[1]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    spec = (r.normal(size=(n, n)) + 1j * r.normal(size=(n, n))) / f ** (beta / 2)
    spec[0, 0] = 0
    img = np.real(np.fft.ifft2(spec))
    return ((img - img.mean()) / img.std()).astype(np.float32)


def sample(tex, u, v):
    """Bilinear lookup with wrap-around; u, v in texels."""
    n0, n1 = tex.shape[:2]
    u0 = np.floor(u).astype(np.int64)
    v0 = np.floor(v).astype(np.int64)
    fu = (u - u0).astype(np.float32)
    fv = (v - v0).astype(np.float32)
    u0 %= n1
    v0 %= n0
    u1 = (u0 + 1) % n1
    v1 = (v0 + 1) % n0
    a = tex[v0, u0] * (1 - fu) + tex[v0, u1] * fu
    b = tex[v1, u0] * (1 - fu) + tex[v1, u1] * fu
    return a * (1 - fv) + b * fv


def blur(img, sx, sy=None):
    """Gaussian blur through the FFT (edges padded with zeros). img: (h, w) or (h, w, c)."""
    sy = sx if sy is None else sy
    h, w = img.shape[:2]
    py, px = int(3 * sy) + 1, int(3 * sx) + 1
    hh, ww = h + 2 * py, w + 2 * px
    fy = np.fft.fftfreq(hh)[:, None]
    fx = np.fft.rfftfreq(ww)[None, :]
    g = np.exp(-2 * (math.pi**2) * ((fx * sx) ** 2 + (fy * sy) ** 2))
    chans = img[..., None] if img.ndim == 2 else img
    out = np.empty_like(chans)
    for c in range(chans.shape[2]):
        pad = np.zeros((hh, ww), np.float32)
        pad[py : py + h, px : px + w] = chans[..., c]
        out[..., c] = np.fft.irfft2(np.fft.rfft2(pad) * g, s=(hh, ww))[py : py + h, px : px + w]
    return out[..., 0] if img.ndim == 2 else out


# ------------------------------------------------------------------------------------------------ geometry
def trace(o, d):
    """Nearest hit of rays (o + t d) with the scene. Returns t, kind, hit point, geometric normal."""
    n = len(d)
    t = np.full(n, np.inf, np.float64)
    kind = np.zeros(n, np.int8)
    ng = np.zeros((n, 3), np.float64)

    def take(ok, tt, k, normal):
        better = ok & (tt < t)
        t[better] = tt[better]
        kind[better] = KIND[k]
        ng[better] = normal[better] if np.ndim(normal) == 2 else normal

    with np.errstate(divide="ignore", invalid="ignore"):
        # Floor in front of the wall.
        tf = -o[:, 1] / d[:, 1]
        p = o + tf[:, None] * d
        take((d[:, 1] < 0) & (tf > 1e-6) & (p[:, 2] < 0) & ~((np.abs(p[:, 0]) <= XS) & (p[:, 2] >= ZS0)), tf, "floor", np.array([0, 1, 0.0]))
        # Threshold slab (box).
        lo = np.array([-XS, 0.0, ZS0])
        hi = np.array([XS, HS, T])
        t1 = (lo - o) / d
        t2 = (hi - o) / d
        tmin = np.minimum(t1, t2)
        tmax = np.maximum(t1, t2)
        tin = tmin.max(axis=1)
        tout = tmax.min(axis=1)
        axis = tmin.argmax(axis=1)
        nb = np.zeros((n, 3))
        nb[np.arange(n), axis] = -np.sign(d[np.arange(n), axis])
        take((tin <= tout) & (tin > 1e-6), tin, "slab", nb)
        # Wall face (z = 0), outside the doorway.
        tw = -o[:, 2] / d[:, 2]
        p = o + tw[:, None] * d
        take((tw > 1e-6) & (p[:, 1] >= 0) & ~inside_opening(p[:, 0], p[:, 1]), tw, "wall", np.array([0, 0, -1.0]))
        # Reveal: the two jambs and the soffit of the arch, between z = 0 and z = T.
        for s in (1.0, -1.0):
            tj = (s * A - o[:, 0]) / d[:, 0]
            p = o + tj[:, None] * d
            take((tj > 1e-6) & (p[:, 2] >= 0) & (p[:, 2] <= T) & (p[:, 1] >= HS) & (p[:, 1] <= YS), tj, "jamb", np.array([-s, 0, 0.0]))
        qa = d[:, 0] ** 2 + d[:, 1] ** 2
        qb = 2 * (o[:, 0] * d[:, 0] + (o[:, 1] - YS) * d[:, 1])
        qc = o[:, 0] ** 2 + (o[:, 1] - YS) ** 2 - A * A
        disc = qb * qb - 4 * qa * qc
        ts = (-qb + np.sqrt(np.maximum(disc, 0))) / (2 * qa)
        p = o + ts[:, None] * d
        nsof = -np.stack([p[:, 0], p[:, 1] - YS, np.zeros(n)], 1) / A
        take((disc > 0) & (ts > 1e-6) & (p[:, 2] >= 0) & (p[:, 2] <= T) & (p[:, 1] > YS), ts, "soffit", nsof)
        # Beyond the doorway.
        tt = (T - o[:, 2]) / d[:, 2]
        p = o + tt[:, None] * d
        take((tt > 1e-6) & inside_opening(p[:, 0], p[:, 1]), tt, "interior", np.array([0, 0, -1.0]))
    return t, kind, o + np.where(np.isfinite(t), t, 0)[:, None] * d, ng


def door_frame(theta):
    """Hinge point, the leaf's along-direction and plane normal for a door opened by theta (inward)."""
    hinge = np.array([-A + GAP["hinge"], 0.0, T])
    u = np.array([math.cos(theta), 0.0, math.sin(theta)])
    nrm = np.array([-math.sin(theta), 0.0, math.cos(theta)])
    return hinge, u, nrm


LEAF_W = 2 * A - GAP["hinge"] - GAP["free"]
LEAF_R = LEAF_W / 2
LEAF_Y0 = HS + GAP["bottom"]
LEAF_TOP = TOP - GAP["top"]
LEAF_SPRING = LEAF_TOP - LEAF_R


def door_blocks(a, w, theta):
    """For rays a + s w (s > 0, w unit), whether they hit the open door leaf."""
    hinge, u, nrm = door_frame(theta)
    with np.errstate(divide="ignore", invalid="ignore"):
        s = ((hinge - a) @ nrm) / (w @ nrm)
        x = a + s[..., None] * w
        along = (x - hinge) @ u
        top = LEAF_SPRING + np.sqrt(np.maximum(0, LEAF_R**2 - (along - LEAF_R) ** 2))
        return (s > 0) & (along >= 0) & (along <= LEAF_W) & (x[..., 1] >= LEAF_Y0) & (x[..., 1] <= top)


# ------------------------------------------------------------------------------------------------ the light
def aperture_samples(nx, ny):
    """Stratified points over the doorway at the back of the reveal (z = T), with the area each stands for."""
    xs = (np.arange(nx) + 0.5) / nx * 2 * A - A
    ys = HS + (np.arange(ny) + 0.5) / ny * (TOP - HS)
    gx, gy = np.meshgrid(xs, ys)
    keep = inside_opening(gx, gy)
    pts = np.stack([gx[keep], gy[keep], np.full(keep.sum(), T)], 1)
    return pts, (2 * A / nx) * ((TOP - HS) / ny)


def gap_samples(step=0.01):
    """Points along the gaps round the shut door (the light that leaks out), with their area."""
    pts, areas = [], []
    for y in np.arange(LEAF_Y0, LEAF_SPRING, step):  # both sides
        pts += [[-A + GAP["hinge"] / 2, y, T], [A - GAP["free"] / 2, y, T]]
        areas += [GAP["hinge"] * step, GAP["free"] * step]
    for x in np.arange(-A + 0.01, A - 0.01, step):  # under the door
        pts.append([x, HS + GAP["bottom"] / 2, T])
        areas.append(GAP["bottom"] * step)
    for ang in np.arange(0, math.pi, step / A):  # round the arch
        r = A - GAP["top"] / 2
        pts.append([r * math.cos(ang), YS + r * math.sin(ang), T])
        areas.append(GAP["top"] * step)
    return np.array(pts), np.array(areas)


def irradiance_vector(p, front, lights, area, theta, chunk=6000, jitter=None, seed=0):
    """Vector irradiance at points p from the light beyond the doorway.

    The doorway is a window onto uniform white radiance: each light point emits L_IN toward the receiver unless the
    open door leaf (behind the window) is in the way. `front` marks points in front of the wall face, which must see
    the light through the doorway's front opening; points in the reveal see all of it (the opening is convex).
    """
    out = np.zeros((len(p), 3))
    rng = np.random.default_rng(seed)
    for i in range(0, len(p), chunk):
        q = p[i : i + chunk, None, :]
        lts = lights[None, :, :]
        ok = True
        if jitter is not None:
            # A different random point in each light cell for every receiver: noise (smoothed later) instead of the
            # streaks a fixed grid of samples draws on surfaces close to the doorway.
            off = (rng.random((q.shape[0], len(lights), 2)) - 0.5) * jitter
            lts = lts + np.concatenate([off, np.zeros((q.shape[0], len(lights), 1))], -1)
            ok = inside_opening(lts[..., 0], lts[..., 1])
        v = lts - q
        r2 = (v**2).sum(-1)
        r = np.sqrt(r2)
        w = v / r[..., None]
        cos_a = np.maximum(0, w[..., 2])  # the window faces -z
        vis = np.ones(r.shape, bool) & ok
        fr = front[i : i + chunk]
        if fr.any():
            s = -q[..., 2] / np.maximum(v[..., 2], 1e-9)
            x = q + s[..., None] * v
            vis &= ~fr[:, None] | inside_opening(x[..., 0], x[..., 1])
        if theta is not None:
            vis &= ~door_blocks(lts, w, theta)
        wt = np.where(vis, cos_a * area / r2, 0)
        out[i : i + chunk] = (wt[..., None] * w).sum(1)
    return out


def hg(cos, g):
    return (1 - g * g) / (4 * math.pi * (1 + g * g - 2 * g * cos) ** 1.5)


# ------------------------------------------------------------------------------------------------ materials
def moulding_height(d):
    """Profile of the architrave across its width (d = distance from the doorway edge, m): bead, fillet, cyma
    reversa, fillet, torus, then down to the wall."""
    h = np.zeros_like(d)
    m = d < 0.03
    h[m] = 0.012 + 0.022 * np.sqrt(np.maximum(0, 1 - ((d[m] - 0.03) / 0.03) ** 2))
    m = (d >= 0.03) & (d < 0.045)
    h[m] = 0.034
    m = (d >= 0.045) & (d < 0.12)
    h[m] = 0.034 - 0.02 * smooth(0.045, 0.12, d[m])
    m = (d >= 0.12) & (d < 0.135)
    h[m] = 0.014
    m = (d >= 0.135) & (d < 0.185)
    h[m] = 0.014 + 0.016 * np.sqrt(np.maximum(0, 1 - ((d[m] - 0.16) / 0.025) ** 2))
    m = (d >= 0.185) & (d < BAND)
    h[m] = 0.014 * (1 - smooth(0.185, BAND, d[m]))
    return h


def wall_height(x, y, tex):
    """Relief of the wall face (m, toward the camera): architrave, keystone, plinths, block joints, grain. Also
    returns the metal mask and the distance from the doorway edge."""
    below = y <= YS
    d = np.where(below, np.abs(x) - A, np.sqrt(x * x + (y - YS) ** 2) - A)
    h = np.where(d < BAND, moulding_height(np.clip(d, 0, BAND)), 0.0)
    # How much of a pixel is metal: a soft edge (about one pixel) instead of a hard switch, against jagged outlines.
    metal = 1 - smooth(BAND - 0.002, BAND + 0.002, d)
    # Keystone: a tapered block over the top of the arch.
    ky = y - (TOP - 0.02)
    half = 0.07 + 0.06 * np.clip(ky / 0.27, 0, 1)
    key = (ky >= 0) & (ky <= 0.27) & (np.abs(x) <= half)
    bev = np.minimum.reduce([half - np.abs(x), ky, 0.27 - ky])
    h = np.where(key, np.maximum(h, 0.026 + 0.03 * smooth(0, 0.012, bev)), h)
    metal = np.maximum(metal, smooth(-0.002, 0.002, bev))
    # Plinths at the foot of the architrave.
    pl = below & (d >= -0.002) & (d <= BAND + 0.03) & (y <= 0.4)
    pb = np.minimum.reduce([BAND + 0.03 - d, 0.4 - y, d + 0.002])
    h = np.where(pl, np.maximum(h, 0.03 + 0.012 * smooth(0, 0.01, pb)), h)
    metal = np.maximum(metal, np.where(below, smooth(-0.002, 0.002, pb), 0))
    # Ashlar blocks (stone only): staggered courses, fine joints.
    row = np.floor(y / 0.34)
    off = np.where(row % 2 == 0, 0.0, 0.33)
    jx = np.abs(((x + off) / 0.66) % 1 - 0.5) * 0.66
    jy = np.abs((y / 0.34) % 1 - 0.5) * 0.34
    joint = np.minimum(0.33 - jx, 0.17 - jy)
    groove = -0.005 * (1 - smooth(0.002, 0.006, joint))
    grain = 0.0012 * sample(tex["fine"], x * 300, y * 300) + 0.002 * sample(tex["mid"], x * 60, y * 60)
    h = h + metal * 0.00006 * sample(tex["fine"], x * 400, y * 400) + (1 - metal) * (groove + grain)
    block = (np.floor((x + off) / 0.66) * 7.31 + row * 3.17) % 1.0
    return h, metal, d, block


def ggx_spec(n, l, v, rough, f0):
    h = norm(l + v)
    nh = np.clip((n * h).sum(-1), 0, 1)
    nl = np.clip((n * l).sum(-1), 0, 1)
    nv = np.clip((n * v).sum(-1), 1e-4, 1)
    vh = np.clip((v * h).sum(-1), 0, 1)
    a2 = (rough**2) ** 2
    dd = a2 / (math.pi * (nh * nh * (a2 - 1) + 1) ** 2)
    k = (rough + 1) ** 2 / 8
    g = nl / (nl * (1 - k) + k) * nv / (nv * (1 - k) + k)
    f = f0 + (1 - f0) * ((1 - vh) ** 5)[..., None]
    return (dd * g / (4 * nv * np.maximum(nl, 1e-4)))[..., None] * f * nl[..., None]


# ------------------------------------------------------------------------------------------------ render
def aces(x):
    return np.clip(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)


def to_srgb(x):
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.maximum(x, 0), 1 / 2.4) - 0.055)


def render(scale, out_dir, geo_path):
    W, H = int(1800 * scale), int(2700 * scale)
    F = 1580.0 * scale
    CX, CY = W / 2, 1250.0 * scale
    tex = {"fine": fbm(512, 1.2, 1), "mid": fbm(512, 2.2, 2), "big": fbm(512, 3.0, 3), "streak": fbm(512, 2.0, 4, (0.15, 3.0))}

    def rays(w, h):
        u = (np.arange(w) + 0.5) * (W / w)
        v = (np.arange(h) + 0.5) * (H / h)
        uu, vv = np.meshgrid(u, v)
        d = np.stack([(uu - CX) / F, -(vv - CY) / F, np.ones_like(uu)], -1).reshape(-1, 3)
        return norm(d)

    d = rays(W, H)
    o = np.broadcast_to(CAM, d.shape)
    t, kind, p, ng = trace(o, d)
    print("traced", W, H)

    # ---- per-pixel surface: normal, albedo, metal f0, roughness
    n = ng.copy()
    alb = np.zeros((len(d), 3))
    f0 = np.full((len(d), 3), 0.04)
    rough = np.full(len(d), 0.8)
    mw = np.zeros(len(d))  # metal weight (0 stone .. 1 metal)
    wall = kind == KIND["wall"]
    hgt, mmask, dist, block = wall_height(p[:, 0], p[:, 1], tex)
    # Normals of the wall relief from its height field (the wall is parallel to the picture: x, y map linearly).
    hm = np.zeros(len(d))
    hm[wall] = hgt[wall]
    hm2 = hm.reshape(H, W)
    gy_, gx_ = np.gradient(hm2)
    mpp = -CAM[2] / F  # metres per pixel on the wall face
    gx_ = (gx_ / mpp).reshape(-1)
    gy_ = (-gy_ / mpp).reshape(-1)  # image rows go down, y goes up
    nw = norm(np.stack([-gx_, -gy_, -np.ones(len(d))], 1))
    n[wall] = nw[wall]
    p[wall, 2] = -hgt[wall]
    stone_var = 0.75 + 0.5 * block
    noise_big = sample(tex["big"], p[:, 0] * 40, p[:, 1] * 40)
    alb[wall] = (np.array([0.052, 0.049, 0.045]) * (stone_var * (1 + 0.18 * noise_big))[:, None])[wall]
    mw[wall] = mmask[wall]
    metal = mw > 0
    patina = np.clip(0.5 + 0.35 * sample(tex["big"], p[:, 0] * 25 + 3, p[:, 1] * 25), 0, 1)
    gold = np.array([0.80, 0.60, 0.31])
    bronze = np.array([0.40, 0.27, 0.14])
    mf0 = gold[None, :] * (1 - 0.55 * patina[:, None]) + bronze[None, :] * 0.55 * patina[:, None]
    mrough = 0.30 + 0.16 * patina + 0.04 * sample(tex["streak"], p[:, 0] * 200, p[:, 1] * 30)
    # Recesses of the moulding read darker (ambient occlusion from the profile).
    ao = np.ones(len(d))
    ao[metal] = (1 - mw[metal]) + mw[metal] * np.clip(0.55 + 18 * hgt[metal], 0.55, 1)

    floor = kind == KIND["floor"]
    tile = (np.abs((p[:, 0] / 0.6) % 1 - 0.5) > 0.494) | (np.abs((p[:, 2] / 0.6) % 1 - 0.5) > 0.494)
    tv = (np.floor(p[:, 0] / 0.6) * 5.7 + np.floor(p[:, 2] / 0.6) * 2.3) % 1
    alb[floor] = (np.array([0.078, 0.074, 0.069]) * ((0.82 + 0.36 * tv) * (1 + 0.16 * sample(tex["mid"], p[:, 0] * 50, p[:, 2] * 50)))[:, None])[floor]
    alb[floor & tile] *= 0.5
    rough[floor] = 0.35
    slab = kind == KIND["slab"]
    alb[slab] = (np.array([0.075, 0.07, 0.064]) * (1 + 0.25 * sample(tex["fine"], p[:, 0] * 220, p[:, 2] * 220))[:, None])[slab]
    rough[slab] = 0.3
    rev = (kind == KIND["jamb"]) | (kind == KIND["soffit"])
    arc = np.arctan2(np.maximum(p[:, 1] - YS, 0), p[:, 0]) * A  # length round the arch
    ru = np.where(kind == KIND["jamb"], p[:, 2] * 60, p[:, 2] * 60 + 17)
    rv = np.where(kind == KIND["jamb"], p[:, 1] * 60, arc * 60)
    alb[rev] = (np.array([0.13, 0.124, 0.115]) * (1 + 0.22 * sample(tex["mid"], ru, rv))[:, None])[rev]
    rough[rev] = 0.85

    v = -d
    # ---- light from beyond the doorway: open (for the light layer) and shut (the leak round the door)
    lights, area = aperture_samples(10, 34)
    glights, gareas = gap_samples(0.025)
    surf = kind > 0
    surf &= kind != KIND["interior"]
    front = p[:, 2] < 1e-6
    # Only points that can see the doorway need the expensive sum: everything in or near the doorway, the floor and
    # the threshold, and the inner edge of the architrave.
    need = surf & ((kind != KIND["wall"]) | (dist < 0.08))
    idx = np.nonzero(need)[0]
    print("lighting", len(idx), "points")
    e_open = np.zeros((len(d), 3))
    e_shut = np.zeros((len(d), 3))
    e_open[idx] = irradiance_vector(p[idx], front[idx], lights, area, OPEN, jitter=np.array([2 * A / 10, (TOP - HS) / 34]))
    e_shut[idx] = irradiance_vector(p[idx], front[idx], glights, gareas[None, :], None)

    # Smooth the sampling noise within each surface (never across the edge between two surfaces).
    def denoise(e, sigma):
        img = e.reshape(H, W, 3)
        out = img.copy()
        kk = kind.reshape(H, W)
        band = (dist < 0.08).reshape(H, W)
        for kd in ("floor", "slab", "jamb", "soffit", "wall"):
            m = (kk == KIND[kd]) & (band if kd == "wall" else True)
            if not m.any():
                continue
            mf = m.astype(np.float32)
            num = blur(img * mf[..., None], sigma)
            den = blur(mf, sigma)
            out[m] = (num / np.maximum(den, 1e-6)[..., None])[m]
        return out.reshape(-1, 3)

    e_open = denoise(e_open, 1.6 * scale + 0.4)

    def shade(evec, light_col):
        mag = np.linalg.norm(evec, axis=1)
        ldir = evec / np.maximum(mag, 1e-9)[:, None]
        e_n = np.clip((n * evec).sum(1), 0, None)
        diff = alb / math.pi * e_n[:, None]
        # The light is large: widen the highlight with it (a "representative point" approximation).
        spec = ggx_spec(n, ldir, v, np.clip(rough + 0.12, 0, 1), f0) * mag[:, None]
        out = diff + 0.25 * spec
        if metal.any():
            ms = ggx_spec(n[metal], ldir[metal], v[metal], np.clip(mrough[metal] + 0.12, 0, 1), mf0[metal]) * mag[metal, None]
            out[metal] = (1 - mw[metal, None]) * out[metal] + mw[metal, None] * ms
        return out * light_col

    key = np.broadcast_to(KEY_DIR, d.shape)
    key_diff = alb / math.pi * np.clip((n * key).sum(1), 0, 1)[:, None] * KEY_E
    key_spec = ggx_spec(n, key, v, rough, f0) * KEY_E
    base = (key_diff + 0.3 * key_spec) * KEY_COL + alb * AMB * ao[:, None]
    if metal.any():
        mk = ggx_spec(n[metal], key[metal], v[metal], mrough[metal], mf0[metal]) * KEY_E * KEY_COL + mf0[metal] * AMB * ao[metal, None]
        base[metal] = (1 - mw[metal, None]) * base[metal] + mw[metal, None] * mk
    base[~surf] = 0
    lit_open = shade(e_open, L_IN)
    lit_shut = shade(e_shut, L_IN)
    lit_open[~surf] = 0
    lit_shut[~surf] = 0

    # ---- what is seen through the doorway: white haze, with the floor beyond fading into it
    inter = kind == KIND["interior"]
    beyond = np.zeros((len(d), 3))
    with np.errstate(divide="ignore", invalid="ignore"):
        tfl = (HS - CAM[1]) / d[:, 1]
    dist_in = np.where(d[:, 1] < 0, (tfl - t), 99)
    fl = np.clip(dist_in, 0, 99)
    floor_glow = 0.62 + 0.38 * (1 - np.exp(-fl / 1.4))
    height = p[:, 1]
    # Brightest straight ahead, a little softer toward the top of the arch, so the light has depth.
    beyond_l = np.where(d[:, 1] < 0, floor_glow, 1.0) * (0.86 + 0.14 * np.exp(-(((height - 1.3) / 1.4) ** 2)))
    beyond[inter] = (beyond_l[:, None] * L_IN)[inter]

    # ---- the polished floor and threshold reflect the doorway
    refl = np.zeros((len(d), 3))
    glossy = floor | (slab & (ng[:, 1] > 0.5))
    gi = np.nonzero(glossy)[0]
    dr = d[gi].copy()
    dr[:, 1] *= -1
    _, rk, rp, _ = trace(p[gi] + dr * 1e-4, dr)
    see = rk == KIND["interior"]
    blocked = door_blocks(rp, dr, OPEN)
    rad = np.zeros((len(gi), 3))
    rad[see & ~blocked] = L_IN
    rad[rk == KIND["jamb"]] = 0.18 * L_IN
    rad[rk == KIND["soffit"]] = 0.12 * L_IN
    cosv = np.clip(-d[gi, 1], 0, 1)
    fres = 0.04 + 0.96 * (1 - cosv) ** 5
    # Honed stone: a soft sheen that fades as the floor recedes from the doorway (and blurs with distance).
    fade = np.exp(-np.maximum(0, -p[gi, 2]) / 1.6)
    refl[gi] = rad * (0.3 * fres * fade)[:, None]
    refl_img = refl.reshape(H, W, 3)
    refl_img = 0.5 * blur(refl_img, 6 * scale, 22 * scale) + 0.5 * blur(refl_img, 14 * scale, 60 * scale)

    # ---- haze: single scattering of the doorway's light toward the camera (low resolution, then smoothed up)
    fw, fh = W // 6, H // 6
    fd = rays(fw, fh)
    ft, fk, _, _ = trace(np.broadcast_to(CAM, fd.shape), fd)
    tmax = np.where(fk == KIND["interior"], ft, np.minimum(ft, 40))
    vlights, varea = aperture_samples(6, 20)
    steps = 40
    scat = np.zeros((len(fd), 3))
    rng = np.random.default_rng(5)
    for i in range(0, len(fd), 2500):
        dd = fd[i : i + 2500]
        tm = tmax[i : i + 2500]
        acc = np.zeros(len(dd))
        for k in range(steps):
            s = (k + rng.random(len(dd))) / steps * tm
            q = CAM + s[:, None] * dd
            dens = SIGMA_FOG * (0.45 + 1.1 * np.exp(-q[:, 1] / 0.9)) * (0.7 + 0.3 * sample(tex["big"], q[:, 0] * 30 + q[:, 2] * 9, q[:, 1] * 30))
            inside = q[:, 2] < T
            vv = vlights[None, :, :] - q[:, None, :]
            r2 = (vv**2).sum(-1)
            r = np.sqrt(r2)
            w = vv / r[..., None]
            cos_a = np.maximum(0, w[..., 2])
            sz = -q[:, None, 2] / np.maximum(vv[..., 2], 1e-9)
            xx = q[:, None, :] + sz[..., None] * vv
            vis = (q[:, None, 2] >= 0) | inside_opening(xx[..., 0], xx[..., 1])
            vis &= ~door_blocks(vlights[None, :, :], w, OPEN)
            ph = hg((-w * dd[:, None, :]).sum(-1) * -1, 0.55)  # light travels -w; the camera looks back along -dd
            e = np.where(vis, cos_a * varea / r2 * ph, 0).sum(1)
            acc += np.where(inside & (q[:, 2] > -6), dens * e, 0) * (tm / steps)
        scat[i : i + 2500] = acc[:, None] * L_IN
    scat_img = np.stack([np.asarray(Image.fromarray(scat[:, c].reshape(fh, fw).astype(np.float32), "F").resize((W, H), Image.BICUBIC)) for c in range(3)], -1)
    scat_img = blur(scat_img, 3 * scale)
    print("haze done")

    # ---- assemble the two states
    def img(a):
        return a.reshape(H, W, 3)

    shut = img(base + lit_shut)  # the doorway itself is taken from the open state below (the door leaf covers it)
    opened = img(base + lit_open) + refl_img + scat_img
    inter_img = img(beyond)
    in_mask = inter.reshape(H, W)
    # Light leaking round the shut door lights the haze faintly.
    shut = shut + scat_img * 0.035

    def bloom(hdr):
        hi = np.clip(hdr * EXPOSURE - 1.2, 0, None)
        return (0.05 * blur(hi, 7 * scale) + 0.035 * blur(hi, 28 * scale) + 0.03 * blur(hi, 90 * scale)) / EXPOSURE

    full_open = opened + inter_img
    full_open += bloom(full_open)
    # The shut state's own bloom: the doorway's light only escapes through the gaps.
    shut_full = shut + bloom(shut)
    base_img = np.where(in_mask[..., None], full_open, shut_full)

    rng2 = np.random.default_rng(11)

    def finish(hdr):
        x = to_srgb(aces(hdr * EXPOSURE)) * 255 + rng2.random(hdr.shape) - 0.5  # dither against banding
        return np.clip(x, 0, 255).astype(np.uint8)

    base_8 = finish(base_img)
    open_8 = finish(full_open)
    # Anti-aliasing where one surface meets another (the doorway's edges, the wall against the reveal): soften those
    # pixels a little, as a lens would, instead of leaving stair-steps.
    k = kind.reshape(H, W)
    edge = np.zeros((H, W), bool)
    edge[1:] |= k[1:] != k[:-1]
    edge[:-1] |= k[1:] != k[:-1]
    edge[:, 1:] |= k[:, 1:] != k[:, :-1]
    edge[:, :-1] |= k[:, 1:] != k[:, :-1]

    def soften(im):
        f = im.astype(np.float32)
        b = (f + np.roll(f, 1, 0) + np.roll(f, -1, 0) + np.roll(f, 1, 1) + np.roll(f, -1, 1)) / 5
        f[edge] = b[edge]
        return np.clip(f + 0.5, 0, 255).astype(np.uint8)

    base_8 = soften(base_8)
    open_8 = soften(open_8)
    light_8 = np.clip(open_8.astype(np.int16) - base_8.astype(np.int16), 0, 255).astype(np.uint8)
    light_8[in_mask] = 0

    # ---- the door leaf, in its own picture (seen square on, as when shut), twice the resolution it is drawn at
    zd = T - CAM[2]
    sc = F / zd  # pixels per metre at the door's plane
    dw, dh = int(round(LEAF_W * sc * 2)), int(round((LEAF_TOP - LEAF_Y0) * sc * 2))
    door_rgba = render_door(dw, dh, tex)

    out_dir.mkdir(parents=True, exist_ok=True)
    Image.fromarray(base_8).save(out_dir / "gate-base.webp", quality=92, method=6)
    Image.fromarray(light_8).save(out_dir / "gate-light.webp", quality=92, method=6)
    Image.fromarray(door_rgba, "RGBA").save(out_dir / "gate-door.webp", quality=92, method=6)
    write_haze(out_dir)
    if not geo_path:  # preview runs: also the open state as one picture
        Image.fromarray(open_8).save(out_dir / "_preview-open.webp", quality=90)

    # Where things are, as fractions of the picture, for the CSS.
    def proj(x, y, z):
        return (CX + F * x / (z - CAM[2])) / W, (CY - F * (y - CAM[1]) / (z - CAM[2])) / H

    left, top = proj(-A + GAP["hinge"], LEAF_TOP, T)
    right, bottom = proj(A - GAP["free"], LEAF_Y0, T)
    cx_, cy_ = proj(0, (HS + TOP) / 2, T)
    geo = {
        "aspect": [W, H],
        "door": {"left": left, "top": top, "right": right, "bottom": bottom, "archRadius": LEAF_R / (LEAF_TOP - LEAF_Y0)},
        "perspective": F / H,
        "origin": [CX / W, CY / H],
        "doorway": [cx_, cy_],
        "openDeg": math.degrees(OPEN),
    }
    if geo_path:
        geo_path.write_text(json.dumps(geo, indent=2) + "\n")
    print(json.dumps(geo))


def write_haze(out_dir):
    """A soft, even veil of mist (tileable): gentle variation only, no clumps that read as smoke."""
    haze = 0.6 * fbm(768, 2.6, 9) + 0.4 * fbm(768, 3.6, 10)
    haze = 0.5 + 0.5 * np.tanh(0.7 * haze / haze.std())
    img = (0.08 + 0.32 * haze) * 255
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "L").save(out_dir / "gate-haze.webp", quality=88, method=6)


def render_door(w, h, tex):
    """The door leaf, square on: dark bronze with a raised frame round an arched upper panel and a lower panel,
    bevelled, with a ring pull; lit by the dim key light, and transparent outside its arched outline."""
    sc = w / LEAF_W
    xs = (np.arange(w) + 0.5) / sc
    ys = LEAF_TOP - LEAF_Y0 - (np.arange(h) + 0.5) / sc  # height above the bottom of the leaf
    x, y = np.meshgrid(xs, ys)
    yy = y + LEAF_Y0
    r = LEAF_R
    spring = LEAF_SPRING
    inside = (yy <= spring) | ((x - r) ** 2 + (yy - spring) ** 2 <= r * r)
    edge = np.where(yy <= spring, np.minimum(x, LEAF_W - x), r - np.sqrt((x - r) ** 2 + (yy - spring) ** 2))
    edge = np.minimum(edge, y)

    def panel(dist_in):
        # Raised field round a recessed panel with a bevel: dist_in = distance inside the panel's outline.
        return np.where(dist_in < 0, 0.0, -0.012 * smooth(0, 0.028, dist_in) + 0.004 * smooth(0.05, 0.06, dist_in))

    m = 0.11  # margin of the frame
    up_spring = spring
    up_bottom = 1.25
    upper = np.where(yy <= up_spring, np.minimum.reduce([x - m, LEAF_W - m - x, yy - (LEAF_Y0 + up_bottom)]), (r - m) - np.sqrt((x - r) ** 2 + (yy - up_spring) ** 2))
    lower = np.minimum.reduce([x - m, LEAF_W - m - x, y - 0.14, (up_bottom - 0.13) - y])
    hgt = panel(upper) + panel(lower)
    hgt += 0.006 * smooth(0, 0.02, edge)  # rounded outer edge
    # Ring pull on the free side.
    rx, ry = LEAF_W - 0.11, 1.05
    rr = np.sqrt((x - rx) ** 2 + (y - ry) ** 2)
    hgt += np.where(np.abs(rr - 0.035) < 0.007, 0.012 * np.sqrt(np.maximum(0, 1 - ((rr - 0.035) / 0.007) ** 2)), 0)
    hgt += np.where(rr < 0.016, 0.01, 0)
    hgt += 0.00015 * sample(tex["streak"], x * 600, y * 80) + 0.0004 * sample(tex["mid"], x * 160, y * 160)  # cast, slightly hammered
    gy_, gx_ = np.gradient(hgt, 1 / sc)
    n = norm(np.stack([-gx_, gy_, -np.ones_like(hgt)], -1))  # rows go down
    v = np.broadcast_to(np.array([0, 0, -1.0]), n.shape)
    key = np.broadcast_to(KEY_DIR, n.shape)
    pat = np.clip(0.55 + 0.3 * sample(tex["big"], x * 30, y * 30), 0, 1)
    f0 = np.array([0.40, 0.29, 0.16])[None, None, :] * (0.7 + 0.4 * pat[..., None])
    rough = 0.36 + 0.12 * pat
    spec = ggx_spec(n, key, v, rough, f0) * KEY_E * KEY_COL
    amb = f0 * AMB * 1.6
    hdr = spec + amb
    # A faint warm-white rim along the edges, from the light in the gap behind them.
    hdr += (0.05 * np.exp(-np.maximum(edge, 0) / 0.006))[..., None] * L_IN
    rgb = to_srgb(aces(hdr * EXPOSURE)) * 255 + np.random.default_rng(3).random(hdr.shape) - 0.5
    alpha = np.clip(edge * sc + 0.5, 0, 1) * 255
    out = np.dstack([np.clip(rgb, 0, 255), alpha]).astype(np.uint8)
    out[~inside, 3] = 0
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true", help="half size, written to --out (default: a scratch folder)")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    if args.preview:
        out = Path(args.out or "/tmp/gate-preview")
        render(0.5, out, None)
    else:
        render(1.0, Path(args.out) if args.out else ROOT / "public" / "opening", ROOT / "src" / "components" / "common" / "gate-geometry.json")
