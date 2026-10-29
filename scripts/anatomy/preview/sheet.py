# Contact sheet: python3 sheet.py <dir> <slug> -> <dir>/<slug>-sheet.jpg (rows: moments; columns: views)
import sys, glob, os
from PIL import Image
d, slug = sys.argv[1], sys.argv[2]
fs = sorted(glob.glob(os.path.join(d, f"{slug}-[0-9]-[0-9].jpg")))
rows = sorted({int(os.path.basename(f).split("-")[-2]) for f in fs})
cols = sorted({int(os.path.basename(f).split("-")[-1][0]) for f in fs})
im0 = Image.open(fs[0]); w, h = im0.size
sheet = Image.new("RGB", (w * len(cols), h * len(rows)))
for f in fs:
    r = int(os.path.basename(f).split("-")[-2]); c = int(os.path.basename(f).split("-")[-1][0])
    sheet.paste(Image.open(f), (c * w, r * h))
sheet.save(os.path.join(d, f"{slug}-sheet.jpg"), quality=85)
