"""Build the hand-off pack for whoever paints or generates the 27 badge masters.

The pack is a zip with:
  README.txt                  what to deliver and how it will be checked
  BADGE_ART_SPEC.md           the full brief (docs/BADGE_ART_SPEC.md)
  prompts.csv                 one row per badge: slot, category, rank, name, subject, ready-to-use prompt
  references/<slot>.png       the badge as cut from the owner's poster, at its own size: the design to match
                              (identity, colours, composition). Low resolution: a reference, never a base to enlarge.
  references/fitness-09-conqueror-original-cross.png
                              the Conqueror badge before its cross was made smaller, to show the full wings
  references/posters/*.webp   the owner's three original posters, unchanged

The subjects come from the tables in docs/BADGE_ART_SPEC.md, so the brief stays the one source.

Run: python3 scripts/badge-art/make-handoff-pack.py [--out FILE]   (default: badge-art-handoff.zip in the current folder)
"""
import argparse
import csv
import importlib.util
import io
import re
import zipfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SPEC = ROOT / "docs/BADGE_ART_SPEC.md"
ACCENT = {
    "fitness": "polished gold and metal",
    "food": "glowing orange-red fire",
    "faith": "warm sunlit green-gold",
}
NEGATIVE = "text, letters, numbers, watermark, signature, frame, border, user interface, blur, low resolution, compression artefacts, cropped or off-centre subject"
README = """Narrow Gate Fitness: 27 badge master artworks

Deliver 27 images, one per row of prompts.csv:
  - named <slot>.png (for example fitness-01-foundation.png), PNG, sRGB;
  - exactly 2:1, 3840 x 1920 px (1600 x 800 is the absolute minimum);
  - the same subject, colours and identity as references/<slot>.png, redrawn at full resolution;
  - subject centred, 80-88 % of the height, 6 % clear at the sides and 4 % at the top and bottom;
  - no text, numbers, frames or watermarks; commercial rights confirmed.

The reference images are small phone screenshots. Use them for the design only. Do NOT enlarge or
"AI-upscale" them: every master is compared automatically with these references, and an enlargement of one
is refused, however it has been sharpened, grained, re-coloured, moved or mirrored.

Conqueror (fitness-09): the cross must be about 25-30 % smaller than in the original poster
(references/fitness-09-conqueror-original-cross.png), as already shown in references/fitness-09-conqueror.png,
with the silver-white wings kept fully visible.

Full brief, style rules and acceptance checklist: BADGE_ART_SPEC.md.
"""


def load_module(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def briefs() -> list[dict]:
    """Slot, name and subject for each badge, from the brief's tables."""
    rows = re.findall(r"^\| ((fitness|food|faith)-(\d\d)-[a-z]+) \| ([^|]+) \| (.+) \|$", SPEC.read_text(), re.M)
    out = []
    for slot, category, rank, name, subject in rows:
        subject = re.sub(r"\*\*(.+?)\*\*", r"\1", subject.strip())
        prompt = (
            f"Premium fantasy achievement badge illustration, {subject[0].lower() + subject[1:]} Centred, symmetrical "
            f"composition, painterly yet crisp with fine detail, {ACCENT[category]}, soft key light from the upper "
            f"left, deep near-black background (#0B0A07), no text, no numbers, no frame, wide 2:1 format, subject "
            f"filling about 85 % of the height, clear margins at the sides."
        )
        out.append({"slot": slot, "category": category, "rank": int(rank), "name": name.strip(), "subject": subject, "prompt": prompt, "negative_prompt": NEGATIVE})
    return out


def png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("badge-art-handoff.zip"))
    args = ap.parse_args()

    rows = briefs()
    if len(rows) != 27:
        raise SystemExit(f"Expected 27 badges in {SPEC.name}, found {len(rows)}")
    crops = load_module("check_masters", "check_masters.py").poster_crops()
    crop_posters = load_module("crop_posters", "crop-posters.py")

    original_conqueror = dict(crop_posters.poster_crops(smaller_cross=False))["fitness-09-conqueror"]

    csv_buf = io.StringIO()
    writer = csv.DictWriter(csv_buf, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("README.txt", README)
        z.write(SPEC, "BADGE_ART_SPEC.md")
        z.writestr("prompts.csv", csv_buf.getvalue())
        for row in rows:
            z.writestr(f"references/{row['slot']}.png", png(crops[row["slot"]]))
        z.writestr("references/fitness-09-conqueror-original-cross.png", png(original_conqueror))
        for poster in sorted(crop_posters.SRC.glob("*.webp")):
            z.write(poster, f"references/posters/{poster.name}")
    print(f"Wrote {args.out} ({args.out.stat().st_size // 1024} KB): {len(rows)} prompts and references.")


if __name__ == "__main__":
    main()
