"""contact-sheet.py SHOTS_DIR — lays out the simulator screenshots from OpeningOnSimulatorTests as one sheet per test
step, prints each frame's average brightness (0 black – 255 white: the move into the light should approach white),
and prints each sheet as base64 between markers so it can be read back from the job log."""
import base64
import io
import os
import re
import sys
from PIL import Image, ImageDraw, ImageStat

shots = sys.argv[1]
names = sorted(f for f in os.listdir(shots) if f.endswith(".png"))
groups: dict[str, list[str]] = {}
for f in names:
    groups.setdefault(f.split("-")[0], []).append(f)

W = 180
for step, files in groups.items():
    tiles = []
    print(f"\n{step}: {len(files)} frames")
    for f in files:
        im = Image.open(os.path.join(shots, f)).convert("RGB")
        brightness = ImageStat.Stat(im.convert("L")).mean[0]
        stamp = re.search(r"-(\d{5})\.png$", f)
        label = f"{int(stamp.group(1)) / 1000:.2f}s" if stamp else f.removesuffix(".png").split("-", 1)[1]
        print(f"  {f:28s} brightness {brightness:6.1f}")
        tiles.append((im.resize((W, round(im.height * W / im.width)), Image.LANCZOS), f"{label}  {brightness:.0f}"))
    cols = min(10, len(tiles))
    rows = (len(tiles) + cols - 1) // cols
    h = max(t.height for t, _ in tiles) + 18
    sheet = Image.new("RGB", (cols * (W + 4), rows * h), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for i, (t, label) in enumerate(tiles):
        x, y = (i % cols) * (W + 4), (i // cols) * h
        d.text((x + 3, y + 3), label, fill=(230, 200, 120))
        sheet.paste(t, (x, y + 18))
    sheet.save(os.path.join(shots, f"sheet-{step}.jpg"), quality=80)
    buf = io.BytesIO()
    sheet.save(buf, "JPEG", quality=62)
    data = base64.b64encode(buf.getvalue()).decode()
    print(f"=====BEGIN SHEET {step} ({len(data)} chars)=====")
    for i in range(0, len(data), 4000):
        print(data[i : i + 4000])
    print(f"=====END SHEET {step}=====")
