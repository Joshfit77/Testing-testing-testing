"""Self-test for the badge master pipeline (check_masters.py + export-masters.py), using made-up masters.

Nothing here is badge art: the "new master" is a drawn test pattern, and the "enlargements" are the poster crops
blown up, only to prove they are refused. Everything is written to a temporary folder; the app's files are not
touched.

Run: python3 scripts/badge-art/test_badge_pipeline.py
"""
import importlib.util
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from check_masters import check, poster_crops, status  # noqa: E402

spec = importlib.util.spec_from_file_location("export_masters", HERE / "export-masters.py")
export_masters = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export_masters)


def pattern(dx: int = 0, height: float = 0.84) -> Image.Image:
    """A crisp, finely detailed test pattern on the app's background colour."""
    w, h = 3840, 1920
    img = Image.new("RGB", (w, h), (11, 10, 7))
    d = ImageDraw.Draw(img)
    r, cx, cy = int(h * height / 2), w // 2 + dx, h // 2
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(150, 110, 40))
    for k in range(0, 360, 3):
        a = np.radians(k)
        d.line((cx, cy, cx + r * np.cos(a), cy + r * np.sin(a)), fill=(230, 190, 90), width=2)
    for rr in range(20, r, 24):
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=(90, 60, 20), width=3)
    return img


def main():
    crops = poster_crops()
    rng = np.random.default_rng(1)
    with tempfile.TemporaryDirectory() as tmp:
        masters, out, sizes = Path(tmp, "masters"), Path(tmp, "out"), Path(tmp, "sizes.json")
        masters.mkdir()
        # Enlargements of the poster crops, disguised in the usual ways: all must be refused.
        crops["fitness-01-foundation"].resize((3840, 1920), Image.BICUBIC).save(masters / "fitness-01-foundation.png")
        sharpened = crops["fitness-02-faithful"].resize((3840, 1920), Image.LANCZOS).filter(ImageFilter.UnsharpMask(4, 200, 0))
        grained = np.clip(np.asarray(sharpened, np.float32) + rng.normal(0, 8, (1920, 3840, 1)), 0, 255).astype(np.uint8)
        graded = ImageEnhance.Contrast(ImageEnhance.Brightness(Image.fromarray(grained)).enhance(1.3)).enhance(0.7)
        graded.save(masters / "fitness-02-faithful.png")
        conqueror = crops["fitness-09-conqueror"].transpose(Image.FLIP_LEFT_RIGHT)
        moved = Image.new("RGB", conqueror.size, (11, 10, 7))
        moved.paste(conqueror.resize((int(conqueror.width * 0.9), int(conqueror.height * 0.9)), Image.LANCZOS), (36, 8))
        moved.resize((3840, 1920), Image.BICUBIC).save(masters / "fitness-09-conqueror.png")
        # Wrong shape and too small.
        Image.new("RGB", (3000, 1920)).save(masters / "faith-09-cedar.png")
        Image.new("RGB", (1200, 600)).save(masters / "faith-08-olive.png")
        # A genuine (made-up) high-resolution master, centred and in proportion; and one off-centre and too tall.
        pattern().save(masters / "food-09-phoenix.png")
        pattern(dx=300, height=0.95).save(masters / "faith-01-seed.png")

        results = {p.stem: check(p, crops[p.stem]) for p in masters.iterdir()}
        expect = {
            "fitness-01-foundation": "FAIL",
            "fitness-02-faithful": "FAIL",
            "fitness-09-conqueror": "FAIL",
            "faith-09-cedar": "FAIL",
            "faith-08-olive": "FAIL",
            "food-09-phoenix": "PASS",
            "faith-01-seed": "WARN",
        }
        failures = [f"{slot}: expected {want}, got {status(results[slot])} {results[slot]}" for slot, want in expect.items() if status(results[slot]) != want]
        for slot in ("fitness-01-foundation", "fitness-02-faithful", "fitness-09-conqueror"):
            if not any("enlarged" in e for e in results[slot]["errors"]):
                failures.append(f"{slot}: not identified as an enlargement")

        # Export twice: the second run must accept the same masters again (it compares with the posters, not with
        # the files the first run wrote).
        for run in (1, 2):
            problems = export_masters.export(masters, out, sizes)
            exported = sorted(p.stem for p in out.glob("*.webp") if not p.stem.endswith("-sm"))
            small = sorted(p.stem for p in out.glob("*-sm.webp"))
            if small != ["faith-01-seed-sm", "food-09-phoenix-sm"]:
                failures.append(f"export run {run} wrote small copies {small}")
            if exported != ["faith-01-seed", "food-09-phoenix"]:
                failures.append(f"export run {run} wrote {exported}")
            if len(problems) != 5:
                failures.append(f"export run {run} refused {len(problems)} masters, expected 5: {problems}")
        if Image.open(out / "food-09-phoenix.webp").size != (1200, 600):
            failures.append("exported size is not 1200x600")
        if json.loads(sizes.read_text()).get("/badges/food-09-phoenix.webp") != {"width": 1200, "height": 600}:
            failures.append("sizes file not updated")
        if json.loads(sizes.read_text()).get("/badges/food-09-phoenix-sm.webp") != {"width": 600, "height": 300}:
            failures.append("small copy missing from the sizes file")

    if failures:
        print("FAILED:\n  " + "\n  ".join(failures))
        raise SystemExit(1)
    print("Badge pipeline self-test passed: 5 bad masters refused (3 disguised enlargements), 1 warned, 1 accepted; export repeatable.")


if __name__ == "__main__":
    main()
