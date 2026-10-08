import sys, glob
from PIL import Image, ImageDraw
group, suffix, out = sys.argv[1], sys.argv[2], sys.argv[3]
files = sorted(f for f in glob.glob(f"out/{group}/*{suffix}.jpg") if (suffix or "-ref" not in f))
cols = 5; tw, th = 300, 225
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * (th + 18)), (30, 30, 30))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((tw, th))
    x, y = (i % cols) * tw, (i // cols) * (th + 18)
    sheet.paste(im, (x, y))
    d.text((x + 4, y + th + 3), f.split("/")[-1], fill=(230, 230, 230))
sheet.save(out)
print(len(files))
