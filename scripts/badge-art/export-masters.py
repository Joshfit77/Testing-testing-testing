"""Export the 27 badge master artworks to the optimised files the app loads.

Masters live in assets/badge-masters/ (kept out of the app bundle and, by default, out of git: 27 masters at
3840 x 1920 are hundreds of megabytes; store them in Git LFS or a shared drive). Each master must be named after
its rank slot and be exactly 2 : 1, at least 1600 x 800 (target 3840 x 1920):

    assets/badge-masters/fitness-01-foundation.png  ...  faith-09-cedar.png   (PNG, WebP or TIFF)

For every master found, this writes public/badges/<slot>.webp at MOBILE_WIDTH x MOBILE_WIDTH/2 (high-quality
WebP, alpha kept if the master has it) and updates src/components/badges/badge-artwork-sizes.json, which drives
the <img> sizes and the detail view's sharp-size limit. Ranks without a master keep their current file, so masters
can be added one at a time. Nothing is ever enlarged: a master smaller than MOBILE_WIDTH is refused.

Run: python3 scripts/badge-art/export-masters.py [--masters DIR] [--out DIR] [--sizes FILE]
"""
import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MOBILE_WIDTH = 1200  # 600 CSS px of art at 2x, 400 at 3x: more than the badge detail view ever shows
MIN_MASTER = (1600, 800)
QUALITY = 90  # visually lossless for painted art at this size; ~150-300 KB per badge
SLOTS = {
    "fitness": ["foundation", "faithful", "endurance", "disciplined", "refined", "steadfast", "overcomer", "mighty", "conqueror"],
    "food": ["spark", "ember", "flame", "torch", "blaze", "furnace", "forge", "inferno", "phoenix"],
    "faith": ["seed", "sprout", "sapling", "root", "branch", "vine", "fruit", "olive", "cedar"],
}
EXTENSIONS = (".png", ".webp", ".tif", ".tiff")


def slot_names() -> list[str]:
    return [f"{cat}-{i + 1:02d}-{name}" for cat, names in SLOTS.items() for i, name in enumerate(names)]


def find_master(masters: Path, slot: str) -> Path | None:
    for ext in EXTENSIONS:
        p = masters / f"{slot}{ext}"
        if p.exists():
            return p
    return None


def export(masters: Path, out: Path, sizes_file: Path) -> list[str]:
    sizes = json.loads(sizes_file.read_text()) if sizes_file.exists() else {}
    problems: list[str] = []
    done = 0
    for slot in slot_names():
        src = find_master(masters, slot)
        if not src:
            continue
        img = Image.open(src)
        w, h = img.size
        if abs(w - 2 * h) > 1:
            problems.append(f"{src.name}: {w}x{h} is not 2:1")
            continue
        if w < MIN_MASTER[0] or h < MIN_MASTER[1]:
            problems.append(f"{src.name}: {w}x{h} is below the {MIN_MASTER[0]}x{MIN_MASTER[1]} minimum")
            continue
        has_alpha = img.mode in ("RGBA", "LA") or "transparency" in img.info
        img = img.convert("RGBA" if has_alpha else "RGB")
        mobile = img.resize((MOBILE_WIDTH, MOBILE_WIDTH // 2), Image.LANCZOS)
        out.mkdir(parents=True, exist_ok=True)
        dest = out / f"{slot}.webp"
        mobile.save(dest, "WEBP", quality=QUALITY, method=6, alpha_quality=100)
        sizes[f"/badges/{slot}.webp"] = {"width": mobile.width, "height": mobile.height}
        done += 1
        print(f"{slot:28} {w}x{h} -> {mobile.width}x{mobile.height}  {dest.stat().st_size // 1024} KB")
    sizes_file.write_text(json.dumps(sizes, indent=2) + "\n")
    missing = [s for s in slot_names() if not find_master(masters, s)]
    print(f"\nExported {done} of 27. Without a master yet ({len(missing)}): {', '.join(missing) or 'none'}")
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--masters", type=Path, default=ROOT / "assets/badge-masters")
    ap.add_argument("--out", type=Path, default=ROOT / "public/badges")
    ap.add_argument("--sizes", type=Path, default=ROOT / "src/components/badges/badge-artwork-sizes.json")
    args = ap.parse_args()
    problems = export(args.masters, args.out, args.sizes)
    if problems:
        print("\nRefused:\n  " + "\n  ".join(problems))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
