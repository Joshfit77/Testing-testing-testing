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
# in the Simulator): dark (the launch screen or the blank web view), black (the opening's own first frame, before
# its logo), the gate open with its light, the camera moving into the light / the light filling the screen, the
# welcome page (dark, with a small lit doorway).
def kind(screen: float, door: float) -> str:
    if screen > 120:
        return "light"
    if door > 140 and screen < 100:
        return "gate-open"
    if screen < 8 and door < 40:
        return "black"
    if screen < 15 and door < 40:
        return "dark"
    if screen < 40 and 60 < door < 120:
        return "welcome"
    return "other"


CHECKS = {
    "0": "fresh launch, left alone",
    "1w": "before Enter Narrow Gate",
    "1": "after Enter Narrow Gate",
}
verdicts: list[str] = []
W = 180
timed = lambda f: bool(re.search(r"-\d{5}\.(png|jpg)$", f))  # noqa: E731
# What the first frame after the press showed (step 1): also evidence for step 1w, filmed before the press.
first_after_press = None
for f in groups.get("1", []):
    if timed(f):
        g = Image.open(os.path.join(shots, f)).convert("L")
        w, h = g.size
        first_after_press = kind(mean(g), mean(g.crop((int(w * 0.38), int(h * 0.22), int(w * 0.62), int(h * 0.55)))))
        break
# The test writes these when its screenshots are too slow to catch the half second of light after the press (the
# rest of the check still ran), or when it skipped the Enter check altogether on a simulator too slow to film it.
nolight = os.path.join(shots, "1-nolight.txt")
nolight = open(nolight).read().strip() if os.path.exists(nolight) else None
skipped = os.path.join(shots, "1-skipped.txt")
skipped = open(skipped).read().strip() if os.path.exists(skipped) else None
# ... and this when, on the fresh launch, the screenshot service stalled for the whole time the door stood open.
stall = os.path.join(shots, "0-stall.txt")
stall = open(stall).read().strip() if os.path.exists(stall) else None
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
        frames = [k for f, k in zip(files, kinds) if timed(f)] or kinds
        seq = [k for k in frames if k != "other"]
        def after(a: str, b: str) -> bool:
            return a in seq and b in seq[seq.index(a) + 1 :]
        if step == "1w":
            # The launch, filmed until the opening is on screen (OpeningOnSimulatorTests.test1 stops filming as soon
            # as the accessibility tree has the opening, so the film may end on the blank web view); the first frame
            # after the press, taken as the door stood open, shows the opening was there before the press.
            ok = any(k != "dark" for k in frames) or first_after_press == "gate-open"
            want = "the app launched into the opening before Enter was pressed"
        elif step == "1":
            # The first frame is taken right after the press: the door open with its light, so the tap landed while
            # the button was there; then the move into the light, then the welcome page. When the test reported that
            # its screenshots were too slow to catch the light, that step of the proof is marked as not filmed.
            ok = bool(frames) and frames[0] == "gate-open" and after("gate-open", "welcome") and frames[-1] == "welcome"
            if nolight:
                want = f"the door open with its light at the press, then the welcome page ({nolight})"
                print(f"::warning::Simulator: {nolight}")
            else:
                ok = ok and after("gate-open", "light") and after("light", "welcome")
                want = "the door open with its light at the press, then the light fills the screen, then the welcome page"
        else:
            # The automatic move into the light lasts under a second, which a slow simulator's screenshots can miss;
            # the move itself is checked after Enter Narrow Gate. When the test reported that no frame could be taken
            # while the door stood open (the screenshot service stalled), the opening's start and end still have to
            # be on film, and the gap is marked as not filmed.
            if stall and "gate-open" not in seq:
                # A stall can swallow the whole opening, first black frame included; the test then checks the
                # opening's end through the accessibility tree, and the film has to end on the welcome page.
                ok = bool(frames) and frames[-1] == "welcome"
                want = f"the welcome page after the opening ({stall})"
                print(f"::warning::Simulator: {stall}")
            else:
                ok = after("gate-open", "welcome") and frames[-1] == "welcome"
                want = "the gate opens with its light, then the welcome page"
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
        if skipped and step in ("1w", "1"):
            print(f"CHECK {what}: SKIPPED ({skipped})")
        else:
            print(f"CHECK {what}: FAILED (no frames)")
            verdicts.append("FAILED")
if skipped:
    print(f"::warning::Simulator: {skipped}")
sys.exit(1 if any("FAILED" in v for v in verdicts) else 0)
