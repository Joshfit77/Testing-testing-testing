"""Check badge master artwork before it goes into the app.

Every master in assets/badge-masters/ is measured against docs/BADGE_ART_SPEC.md and gets PASS, WARN or FAIL.

FAIL (export-masters.py refuses the file):
  - not exactly 2 : 1, or smaller than 1600 x 800;
  - it is a poster crop enlarged. The master is shrunk back to the size of that rank's crop from the owner's
    posters (cut afresh by crop-posters.py, so this still works after new art has replaced public/badges) and
    correlated with it, allowing for a different scale (0.8-1.25x), position, a mirror image and changed
    brightness or contrast. Measured on the current crops: enlargements score 0.99-1.00 (also when sharpened, given
    grain or colour-graded); different paintings of similar subjects score 0.2-0.65. Anything over ENLARGED is
    refused.

WARN (exported, but look at it at 100 % zoom first):
  - little detail above half its size: it looks like an image enlarged 2x or more (DETAIL_DB);
  - weak edges at full size (EDGE_P99);
  - subject off-centre by more than 2 %, its height outside 80-88 % of the canvas, or inside the side (6 %) or
    top / bottom (4 %) margins. The subject is found as the pixels that stand out from the background colour, so
    glow and sparks can make these readings a little larger than the silhouette;
  - an embedded colour profile that isn't sRGB.

No automatic check can tell a good painting from a bad one: the acceptance checklist in the spec still applies.

Run: python3 scripts/badge-art/check_masters.py [--masters DIR] [--json FILE]
"""
import argparse
import importlib.util
import io
import json
from functools import cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageCms, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SLOTS = {
    "fitness": ["foundation", "faithful", "endurance", "disciplined", "refined", "steadfast", "overcomer", "mighty", "conqueror"],
    "food": ["spark", "ember", "flame", "torch", "blaze", "furnace", "forge", "inferno", "phoenix"],
    "faith": ["seed", "sprout", "sapling", "root", "branch", "vine", "fruit", "olive", "cedar"],
}
EXTENSIONS = (".png", ".webp", ".tif", ".tiff")
MIN_MASTER = (1600, 800)
ENLARGED = 0.90  # correlation with the poster crop above which a master is refused as an enlargement
DETAIL_DB = 45.0  # halving and restoring the subject changes it less than this: little real detail at full size
EDGE_P99 = 12.0  # 99th-percentile edge strength (0-255 per pixel) below this: soft at 100 % zoom
SUBJECT_HEIGHT = (0.80, 0.88)
MARGIN_X, MARGIN_Y, CENTRE_TOLERANCE = 0.06, 0.04, 0.02


def slot_names() -> list[str]:
    return [f"{cat}-{i + 1:02d}-{name}" for cat, names in SLOTS.items() for i, name in enumerate(names)]


def find_master(masters: Path, slot: str) -> Path | None:
    for ext in EXTENSIONS:
        p = masters / f"{slot}{ext}"
        if p.exists():
            return p
    return None


@cache
def poster_crops() -> dict[str, Image.Image]:
    """The 27 badges as cut from the owner's posters: what a master must not merely be an enlargement of."""
    spec = importlib.util.spec_from_file_location("crop_posters", Path(__file__).with_name("crop-posters.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return dict(module.poster_crops())


def _lum(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert("L"), dtype=np.float32)


def _correlation(a: np.ndarray, b: np.ndarray) -> float:
    a, b = a - a.mean(), b - b.mean()
    return float((a * b).sum() / max(np.sqrt((a * a).sum() * (b * b).sum()), 1e-6))


def _psnr(a: np.ndarray, b: np.ndarray) -> float:
    mse = float(((a - b) ** 2).mean())
    return 10 * np.log10(255**2 / max(mse, 1e-6))


def _best_shift(a: np.ndarray, b: np.ndarray) -> tuple[int, int]:
    """Translation that best lines b up with a (phase correlation)."""
    fa, fb = np.fft.fft2(a - a.mean()), np.fft.fft2(b - b.mean())
    r = fa * np.conj(fb)
    corr = np.fft.ifft2(r / np.maximum(np.abs(r), 1e-9)).real
    dy, dx = np.unravel_index(int(np.argmax(corr)), corr.shape)
    h, w = a.shape
    return (dy - h if dy > h // 2 else dy), (dx - w if dx > w // 2 else dx)


def similarity_to_poster_crop(master: Image.Image, crop: Image.Image) -> float:
    """Best correlation (-1 to 1) between the master, shrunk to the crop's size, and the crop."""
    blur = ImageFilter.GaussianBlur(1)
    ref = _lum(crop.convert("RGB").filter(blur))
    h, w = ref.shape
    # Shrink once to a little over the largest size tried, so the fine scale search stays fast.
    base = master.convert("RGB").resize((round(w * 1.5), round(h * 1.5)), Image.LANCZOS)
    best = -1.0
    for mirror in (False, True):
        m = base.transpose(Image.FLIP_LEFT_RIGHT) if mirror else base
        for scale in np.arange(0.80, 1.2501, 0.005):
            sw, sh = round(w * scale), round(h * scale)
            small = _lum(m.resize((sw, sh), Image.LANCZOS).filter(blur))
            # Place the scaled master on a canvas the size of the crop, centred, then find the best shift.
            canvas = np.full((h, w), float(np.median(small)), dtype=np.float32)
            ys, xs = max((h - sh) // 2, 0), max((w - sw) // 2, 0)
            cy, cx = max((sh - h) // 2, 0), max((sw - w) // 2, 0)
            ph, pw = min(h, sh), min(w, sw)
            canvas[ys : ys + ph, xs : xs + pw] = small[cy : cy + ph, cx : cx + pw]
            dy, dx = _best_shift(ref, canvas)
            shifted = np.roll(canvas, (dy, dx), axis=(0, 1))
            # Compare only where the shifted master really covers the badge.
            y0, y1 = max(ys + dy, 0), min(ys + ph + dy, h)
            x0, x1 = max(xs + dx, 0), min(xs + pw + dx, w)
            if (y1 - y0) * (x1 - x0) < 0.5 * h * w:
                continue
            best = max(best, _correlation(ref[y0:y1, x0:x1], shifted[y0:y1, x0:x1]))
    return best


def subject_box(img: Image.Image) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    """Pixels that stand out from the background, and their bounding box (ignoring the faintest 0.5 % of rows / columns)."""
    rgba = np.asarray(img.convert("RGBA"), dtype=np.float32)
    rgb, alpha = rgba[..., :3], rgba[..., 3]
    if alpha.min() < 250:
        mask = alpha > 16
    else:
        border = np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3), rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3)])
        bg = np.median(border, axis=0)
        mask = np.abs(rgb - bg).max(axis=2) > 40
    def span(counts: np.ndarray) -> tuple[int, int]:
        c = np.cumsum(counts)
        if c[-1] == 0:
            return 0, len(counts)
        return int(np.searchsorted(c, 0.005 * c[-1])), int(np.searchsorted(c, 0.995 * c[-1])) + 1
    x0, x1 = span(mask.sum(0))
    y0, y1 = span(mask.sum(1))
    return mask, (x0, y0, x1, y1)


def check(path: Path, poster_crop: Image.Image | None) -> dict:
    img = Image.open(path)
    w, h = img.size
    result: dict = {"file": path.name, "size": f"{w}x{h}", "errors": [], "warnings": [], "metrics": {}}
    if abs(w - 2 * h) > 1:
        result["errors"].append(f"{w}x{h} is not 2:1")
    if w < MIN_MASTER[0] or h < MIN_MASTER[1]:
        result["errors"].append(f"{w}x{h} is below the {MIN_MASTER[0]}x{MIN_MASTER[1]} minimum")
    if result["errors"]:
        return result

    icc = img.info.get("icc_profile")
    if icc:
        name = ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(icc))).strip()
        if "srgb" not in name.lower().replace(" ", ""):
            result["warnings"].append(f"colour profile is '{name}', not sRGB")

    m = result["metrics"]
    if poster_crop is not None:
        m["match_with_poster_crop"] = round(similarity_to_poster_crop(img, poster_crop), 3)
        if m["match_with_poster_crop"] > ENLARGED:
            result["errors"].append(
                f"matches the poster crop (correlation {m['match_with_poster_crop']}): this is the old art enlarged, not a new master"
            )

    mask, (x0, y0, x1, y1) = subject_box(img)
    subject = img.convert("RGB").crop((x0, y0, x1, y1))
    sw, sh = subject.size
    halved = subject.resize((max(sw // 2, 1), max(sh // 2, 1)), Image.LANCZOS).resize((sw, sh), Image.LANCZOS)
    m["detail_db"] = round(_psnr(_lum(subject), _lum(halved)), 1)
    lum = _lum(img)
    grad = np.hypot(np.abs(np.diff(lum, axis=1))[:-1], np.abs(np.diff(lum, axis=0))[:, :-1])
    m["edge_p99"] = round(float(np.percentile(grad, 99)), 1)
    if m["detail_db"] > DETAIL_DB:
        result["warnings"].append(f"little detail at full size ({m['detail_db']} dB): looks enlarged 2x or more")
    if m["edge_p99"] < EDGE_P99:
        result["warnings"].append(f"soft edges at 100 % zoom (edge strength {m['edge_p99']})")

    ys, xs = np.nonzero(mask)
    cx, cy = (xs.mean() / w, ys.mean() / h) if len(xs) else (0.5, 0.5)
    m["centre_offset"] = [round(float(cx) - 0.5, 3), round(float(cy) - 0.5, 3)]
    m["subject_height"] = round((y1 - y0) / h, 3)
    m["margins"] = {"left": round(x0 / w, 3), "right": round((w - x1) / w, 3), "top": round(y0 / h, 3), "bottom": round((h - y1) / h, 3)}
    if max(abs(m["centre_offset"][0]), abs(m["centre_offset"][1])) > CENTRE_TOLERANCE:
        result["warnings"].append(f"subject off-centre by {m['centre_offset']} (allowed ±{CENTRE_TOLERANCE})")
    if not SUBJECT_HEIGHT[0] <= m["subject_height"] <= SUBJECT_HEIGHT[1]:
        result["warnings"].append(f"subject height {m['subject_height']:.0%} of the canvas (target 80-88 %)")
    mg = m["margins"]
    if min(mg["left"], mg["right"]) < MARGIN_X or min(mg["top"], mg["bottom"]) < MARGIN_Y:
        result["warnings"].append(f"subject reaches into the margins {mg} (6 % sides, 4 % top and bottom)")
    return result


def status(result: dict) -> str:
    return "FAIL" if result["errors"] else "WARN" if result["warnings"] else "PASS"


def check_all(masters: Path) -> dict[str, dict]:
    results = {}
    for slot in slot_names():
        src = find_master(masters, slot)
        if src:
            results[slot] = check(src, poster_crops()[slot])
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--masters", type=Path, default=ROOT / "assets/badge-masters")
    ap.add_argument("--json", type=Path, help="also write the full results here")
    args = ap.parse_args()
    results = check_all(args.masters)
    for slot, r in results.items():
        m = r["metrics"]
        print(f"{status(r):4}  {slot:24} {r['size']:>10}  " + "  ".join(f"{k}={v}" for k, v in m.items() if k != "margins"))
        for e in r["errors"]:
            print(f"        error: {e}")
        for wn in r["warnings"]:
            print(f"        warning: {wn}")
    missing = [s for s in slot_names() if s not in results]
    counts = {k: sum(status(r) == k for r in results.values()) for k in ("PASS", "WARN", "FAIL")}
    print(f"\n{len(results)} of 27 masters found: {counts['PASS']} pass, {counts['WARN']} with warnings, {counts['FAIL']} refused.")
    if missing:
        print(f"Missing ({len(missing)}): {', '.join(missing)}")
    if args.json:
        args.json.write_text(json.dumps(results, indent=2) + "\n")
    raise SystemExit(1 if counts["FAIL"] else 0)


if __name__ == "__main__":
    main()
