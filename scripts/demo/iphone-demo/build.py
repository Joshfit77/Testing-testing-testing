# Assembles the iPhone demo: screens.json + captures -> out/app.html (page), out/s/*.webp, out/anatomy/* (3D parts).
#   python3 -I build.py <cap dir> <showcase dir> <out dir> [quality]
import sys, os, json, glob, shutil, re
from PIL import Image
cap, show, out = sys.argv[1], sys.argv[2], sys.argv[3]
q = int(sys.argv[4]) if len(sys.argv) > 4 else 88
here = os.path.dirname(os.path.abspath(__file__))
os.makedirs(f"{out}/s", exist_ok=True)
data = json.load(open(f"{cap}/screens.json"))
if not any(s["key"] == "state:opening" for s in data["screens"]) and os.path.exists(f"{cap}/s/s001.png"):
    data["screens"].insert(0, {"id": "s001", "key": "state:opening", "title": "Opening", "h": 844, "file": "s/s001.png", "tab": "hidden", "group": "Welcome", "hot": []})
# Hosting allows 511 files per version: the long date series (calendar days, practice days, workout days, diary dates)
# are kept to a few each; a tap on a dropped one lands on the section's main screen (resolve() strips the query).
MAX_SCREENS = int(os.environ.get("MAX_SCREENS", "488"))
SERIES = [(re.compile(r"^/calendar\?"), 6), (re.compile(r"^/faith/practices\?"), 6), (re.compile(r"^/train/workout\?"), 6), (re.compile(r"^/nutrition\?date"), 4), (re.compile(r"^/nutrition/photo\?"), 3), (re.compile(r"^/train/exercises/[^/]+/history"), 6), (re.compile(r"^/train/programs\?category"), 8), (re.compile(r"^/faith\?theme"), 3), (re.compile(r"^/faith/journal\?filter"), 3), (re.compile(r"^/run/activities/"), 4), (re.compile(r"^/train/history/"), 4), (re.compile(r"^/progress/sleep/log\?"), 2), (re.compile(r"^/nutrition/insights\?end"), 4), (re.compile(r"^/progress/sleep/checkin\?day"), 4)]
seen = {}
kept = []
dropped = []
for s in data["screens"]:
    lim = next((n for r, n in SERIES if r.search(s["key"])), None)
    if lim is not None:
        r = next(r for r, n in SERIES if r.search(s["key"]))
        seen[r] = seen.get(r, 0) + 1
        if seen[r] > lim:
            dropped.append(s); continue
    kept.append(s)
# Still too many: drop exercise pages from the end of the list (the library's later pages), never the five 3D ones.
PRIO = {"/train/exercises/kettlebell-swing", "/train/exercises/dumbbell-curl", "/train/exercises/inverted-row", "/train/exercises/cable-chest-fly", "/train/exercises/sled-push"}
while len(kept) > MAX_SCREENS:
    i = max(i for i, s in enumerate(kept) if s["key"].startswith("/train/exercises/") and s["key"] not in PRIO and s["key"].count("/") == 3)
    dropped.append(kept.pop(i))
data["screens"] = kept
print(f"kept {len(kept)} screens, dropped {len(dropped)} (series beyond their caps and the library's tail)")
json.dump([s["key"] for s in dropped], open(f"{out}/dropped.json", "w"))
# Pictures: lossless PNG capture -> one WebP pass; the tab bar stays PNG (tiny, and its hairline must stay crisp).
sizes = {}
wide = []
for s in data["screens"]:
    src = f"{cap}/{s['file']}"
    im = Image.open(src)
    if im.size[0] != 1170:  # the page overflowed sideways (an app defect, noted in the report); keep the phone's width
        wide.append((s["id"], s["key"], round(im.size[0] / 3)))
        im = im.crop((0, 0, 1170, im.size[1]))
    H = im.size[1]
    LIM = 15000  # WebP allows 16383 px; chunks of 5000 CSS px
    parts = []
    y = 0
    i = 0
    while y < H:
        h = min(LIM, H - y)
        dst = f"{out}/s/{s['id']}{'-' + str(i) if H > LIM else ''}.webp"
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
            im.crop((0, y, 1170, y + h)).convert("RGB").save(dst, "WEBP", quality=q, method=4)
        parts.append([os.path.basename(dst), round(h / 3, 2)])
        sizes[dst] = os.path.getsize(dst)
        y += h
        i += 1
    s["pics"] = parts
for f in glob.glob(f"{cap}/s/nav-*.png"):
    shutil.copy(f, f"{out}/s/")
# Tap counts and a lean DATA.
taps = 0
for s in data["screens"]:
    if s["key"] == "state:opening":  # the opening overlay: a tap anywhere enters (as its Enter button does)
        s["hot"] = [{"x": 0, "y": 0, "w": 390, "h": s["h"], "label": "Enter the narrow gate", "to": "/", "kind": "a"}]
    s.pop("file", None)
    hot = []
    for h in s["hot"]:
        # Targets scrolled off the phone's width (horizontal rows) are clipped to it; those wholly outside are dropped.
        if h["x"] >= 390 or h["x"] + h["w"] <= 0 or h["y"] >= s["h"]:
            continue
        if h["x"] < 0:
            h["w"] += h["x"]; h["x"] = 0
        h["w"] = min(h["w"], 390 - h["x"]); h["h"] = min(h["h"], s["h"] - h["y"])
        if h["w"] < 6 or h["h"] < 6:
            continue
        if h.get("kind") == "live" or h.get("to"):
            taps += 1
        hot.append({k: v for k, v in h.items() if k in ("x", "y", "w", "h", "label", "to", "kind")})
    s["hot"] = hot
data["taps"] = taps
DATA = json.dumps({k: data[k] for k in ("date", "navH", "navHot", "screens", "alias", "taps")}, separators=(",", ":")).replace("</script", "<\\/script")
page = open(f"{here}/viewer.html").read()
# The showcase player: its bundle (built with SHOWCASE_LAZY) and the model parts as text files.
art = open(f"{show}/artifact.html").read()
parts = re.search(r"<script>window\.ECORCHE_PARTS = .*?</script>", art, re.S).group(0)
setup = re.search(r"<script>window\.SHOWCASE = .*?</script>", art, re.S).group(0)
js = open(f"{show}/app.js").read().replace("</script", "<\\/script")
page = page.replace("<script>/*DATA*/</script>", "<script>window.DEMO = " + DATA + ";</script>")
page = page.replace("<script>/*SHOWCASE*/</script>", parts + "\n" + setup.replace("<script>", "<script>window.SHOWCASE_LAZY = true; ") + "\n<script>" + js + "</script>")
open(f"{out}/app.html", "w").write(page)
# The model files next to the page.
os.makedirs(f"{out}/anatomy/bake", exist_ok=True)
files = {}
for f in glob.glob(f"{show}/anatomy/*.txt") + glob.glob(f"{show}/anatomy/*.json") + glob.glob(f"{show}/anatomy/bake/*.txt"):
    rel = os.path.relpath(f, show)
    shutil.copy(f, f"{out}/{rel}")
    files[rel] = os.path.getsize(f)
for f in glob.glob(f"{out}/s/*"):
    files[os.path.relpath(f, out)] = os.path.getsize(f)
# Pictures of screens no longer in the build.
used = {f for s in data["screens"] for f, _ in s["pics"]}
for f in os.listdir(f"{out}/s"):
    if f.endswith(".webp") and f not in used:
        os.remove(f"{out}/s/{f}"); files.pop(f"s/{f}", None)
json.dump(files, open(f"{out}/files.json", "w"), indent=0)
json.dump(wide, open(f"{out}/wide.json", "w"))
if wide: print("pages wider than the phone (cropped):", wide)
tot = sum(files.values())
print(f"screens {len(data['screens'])}, taps {taps}, page {os.path.getsize(out + '/app.html') / 1e6:.1f} MB, pictures {sum(sizes.values()) / 1e6:.1f} MB (avg {sum(sizes.values()) / len(sizes) / 1e3:.0f} KB), 3D {sum(v for k, v in files.items() if k.startswith('anatomy')) / 1e6:.1f} MB, files total {tot / 1e6:.1f} MB")
