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
names = sorted(f for f in os.listdir(shots) if f.endswith((".png", ".jpg")) and not f.startswith("sheet-"))
groups: dict[str, list[str]] = {}
for f in names:
    groups.setdefault(f.split("-")[0], []).append(f)

RAMP = " .:-=+*#%@"


def mean(im: Image.Image) -> float:
    return ImageStat.Stat(im).mean[0]


def label(f: str) -> str:
    stamp = re.search(r"-(\d{5})\.(png|jpg)$", f)
    return f"{int(stamp.group(1)) / 1000:.2f}s" if stamp else os.path.splitext(f)[0].split("-", 1)[1]


def ascii_art(im: Image.Image, cols: int = 22) -> list[str]:
    rows = round(cols * im.height / im.width / 2)
    small = im.resize((cols, rows), Image.BILINEAR)
    px = small.load()
    return ["".join(RAMP[min(9, px[x, y] * 10 // 256)] for x in range(cols)) for y in range(rows)]


# Frame types, from the brightness of the whole screen and of the doorway (calibrated on the opening in Chromium and
# in the Simulator): the gate open with its light, the light filling the screen, the welcome page.
def kind(screen: float, door: float) -> str:
    if screen > 200:
        return "light"
    if door > 140 and screen < 100:
        return "gate-open"
    if screen < 40 and door < 120:
        return "welcome"
    return "other"


CHECKS = {
    "0": "fresh launch, left alone",
    "1w": "before Enter Narrow Gate",
    "1": "after Enter Narrow Gate",
}
verdicts: list[str] = []
W = 180
for step, files in groups.items():
    print(f"\n== step {step}: {len(files)} frames   (brightness: screen / doorway / lower third)")
    tiles, grey, kinds = [], {}, []
    for f in files:
        im = Image.open(os.path.join(shots, f)).convert("RGB")
        g = im.convert("L")
        grey[f] = g
        w, h = g.size
        centre = g.crop((int(w * 0.38), int(h * 0.22), int(w * 0.62), int(h * 0.55)))
        lower = g.crop((0, int(h * 0.66), w, h))
        kinds.append(kind(mean(g), mean(centre)))
        print(f"  {label(f):>14}  {mean(g):6.1f} {mean(centre):6.1f} {mean(lower):6.1f}  {kinds[-1]}")
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
    if step in CHECKS:
        frames = [k for f, k in zip(files, kinds) if re.search(r"-\d{5}\.(png|jpg)$", f)] or kinds
        seq = [k for k in frames if k != "other"]
        def after(a: str, b: str) -> bool:
            return a in seq and b in seq[seq.index(a) + 1 :]
        if step == "1w":
            ok = "gate-open" in seq
            want = "the door opened with its light and the button showed"
        elif step == "1":
            ok = "light" in seq and after("light", "welcome") and frames[-1] == "welcome"
            want = "the light fills the screen, then the welcome page"
        else:
            ok = after("gate-open", "light") and after("light", "welcome") and frames[-1] == "welcome"
            want = "the gate opens with its light, the light fills the screen, then the welcome page"
        verdicts.append(f"CHECK {CHECKS[step]}: {'ok' if ok else 'FAILED'} ({want}; seen: {' > '.join(k for i, k in enumerate(seq) if i == 0 or seq[i - 1] != k) or 'nothing'})")
    picks = sorted({round(i * (len(files) - 1) / 5) for i in range(6)}) if len(files) > 6 else range(len(files))
    chosen = [files[i] for i in picks]
    arts = [ascii_art(grey[f]) for f in chosen]
    print("  " + "  ".join(f"{label(f):<22}" for f in chosen))
    for r in range(max(len(a) for a in arts)):
        print("  " + "  ".join((a[r] if r < len(a) else "").ljust(22) for a in arts))

print()
for v in verdicts:
    print(v)
for step, what in CHECKS.items():
    if step not in groups:
        print(f"CHECK {what}: FAILED (no frames)")
        verdicts.append("FAILED")
sys.exit(1 if any("FAILED" in v for v in verdicts) else 0)
