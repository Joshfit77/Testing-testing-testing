"""contact-sheet.py SHOTS_DIR — summarises the simulator screenshots from film.py and OpeningOnSimulatorTests:
- one contact sheet per step (sheet-<step>.jpg, kept in the artifact);
- a table of each frame's average brightness (0 black – 255 white) for the whole screen, the doorway (centre) and
  the lower third (verse and button): the door opening lights the centre, the move into the light turns the whole
  screen near-white, the welcome page is dark with a small bright doorway;
- a coarse text rendering of a few frames per step, so the log alone shows what was on screen."""
import os
import re
import sys
from PIL import Image, ImageDraw, ImageStat

shots = sys.argv[1]
names = sorted(f for f in os.listdir(shots) if f.endswith(".png"))
groups: dict[str, list[str]] = {}
for f in names:
    groups.setdefault(f.split("-")[0], []).append(f)

RAMP = " .:-=+*#%@"


def mean(im: Image.Image) -> float:
    return ImageStat.Stat(im).mean[0]


def label(f: str) -> str:
    stamp = re.search(r"-(\d{5})\.png$", f)
    return f"{int(stamp.group(1)) / 1000:.2f}s" if stamp else f.removesuffix(".png").split("-", 1)[1]


def ascii_art(im: Image.Image, cols: int = 22) -> list[str]:
    rows = round(cols * im.height / im.width / 2)
    small = im.resize((cols, rows), Image.BILINEAR)
    px = small.load()
    return ["".join(RAMP[min(9, px[x, y] * 10 // 256)] for x in range(cols)) for y in range(rows)]


W = 180
for step, files in groups.items():
    print(f"\n== step {step}: {len(files)} frames   (brightness: screen / doorway / lower third)")
    tiles, grey = [], {}
    for f in files:
        im = Image.open(os.path.join(shots, f)).convert("RGB")
        g = im.convert("L")
        grey[f] = g
        w, h = g.size
        centre = g.crop((int(w * 0.38), int(h * 0.22), int(w * 0.62), int(h * 0.55)))
        lower = g.crop((0, int(h * 0.66), w, h))
        print(f"  {label(f):>14}  {mean(g):6.1f} {mean(centre):6.1f} {mean(lower):6.1f}")
        tiles.append((im.resize((W, round(im.height * W / im.width)), Image.LANCZOS), label(f)))
    cols = min(10, len(tiles))
    rows = (len(tiles) + cols - 1) // cols
    th = max(t.height for t, _ in tiles) + 18
    sheet = Image.new("RGB", (cols * (W + 4), rows * th), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for i, (t, text) in enumerate(tiles):
        x, y = (i % cols) * (W + 4), (i // cols) * th
        d.text((x + 3, y + 3), text, fill=(230, 200, 120))
        sheet.paste(t, (x, y + 18))
    sheet.save(os.path.join(shots, f"sheet-{step}.jpg"), quality=85)
    picks = sorted({round(i * (len(files) - 1) / 5) for i in range(6)}) if len(files) > 6 else range(len(files))
    chosen = [files[i] for i in picks]
    arts = [ascii_art(grey[f]) for f in chosen]
    print("  " + "  ".join(f"{label(f):<22}" for f in chosen))
    for r in range(max(len(a) for a in arts)):
        print("  " + "  ".join((a[r] if r < len(a) else "").ljust(22) for a in arts))
