# Assembles the iPhone demo: screens.json + captures -> out/app.html (page), out/s/*.webp, out/s/nav-*.png, and the
# opening's pictures and the app's fonts (out/opening, out/fonts). Run engine.mjs first: it writes out/ngf.js.
#   python3 -I build.py <cap dir> <out dir> [quality]
import sys, os, json, glob, shutil, re
from PIL import Image
cap, out = sys.argv[1], sys.argv[2]
q = int(sys.argv[3]) if len(sys.argv) > 3 else 88
here = os.path.dirname(os.path.abspath(__file__))
os.makedirs(f"{out}/s", exist_ok=True)
data = json.load(open(f"{cap}/screens.json"))
PW, PH = data.get("phone", {}).get("w", 390), data.get("phone", {}).get("h", 844)
PX = PW * 3  # pictures are captured at 3x
data["phone"] = {"w": PW, "h": PH}
if not any(s["key"] == "state:opening" for s in data["screens"]) and os.path.exists(f"{cap}/s/s001.png"):
    data["screens"].insert(0, {"id": "s001", "key": "state:opening", "title": "Opening", "h": PH, "file": "s/s001.png", "tab": "hidden", "group": "Welcome", "hot": []})
# Hosting allows 511 files per version: the long date series (calendar days, practice days, workout days, diary dates)
# are kept to a few each; a tap on a dropped one lands on the section's main screen (resolve() strips the query).
MAX_SCREENS = int(os.environ.get("MAX_SCREENS", "488"))
SERIES = [(re.compile(r"^/calendar\?"), 6), (re.compile(r"^/faith/practices\?"), 6), (re.compile(r"^/train/workout\?"), 6), (re.compile(r"^/nutrition\?date"), 2), (re.compile(r"^/nutrition/photo\?"), 3), (re.compile(r"^/train/exercises/[^/]+/history"), 6), (re.compile(r"^/train/programs\?category"), 8), (re.compile(r"^/faith\?theme"), 1), (re.compile(r"^/faith/journal\?filter"), 3), (re.compile(r"^/run/activities/"), 4), (re.compile(r"^/train/history/"), 4), (re.compile(r"^/progress/sleep/log\?"), 2), (re.compile(r"^/nutrition/insights\?end"), 4), (re.compile(r"^/progress/sleep/checkin\?day"), 4), (re.compile(r"^/faith/bible/[^?]+\?v="), 0), (re.compile(r"^/progress/overview\?range"), 2)]
BOOKS_KEPT = {"search", "saved", "history", "genesis", "exodus", "deuteronomy", "joshua", "ruth", "1-samuel", "psalms", "proverbs", "ecclesiastes", "isaiah", "jeremiah", "daniel", "jonah", "matthew", "mark", "luke", "john", "acts", "romans", "1-corinthians", "galatians", "ephesians", "philippians", "hebrews", "james", "1-peter", "1-john", "revelation"}
seen = {}
kept = []
dropped = []
for s in data["screens"]:
    # The Bible's book pages (each a grid of chapter numbers) are kept for the most-read books only.
    bm = re.match(r"^/faith/bible/([^/?]+)$", s["key"])
    if bm and bm.group(1) not in BOOKS_KEPT:
        dropped.append(s); continue
    lim = next((n for r, n in SERIES if r.search(s["key"])), None)
    if lim is not None:
        r = next(r for r, n in SERIES if r.search(s["key"]))
        seen[r] = seen.get(r, 0) + 1
        if seen[r] > lim:
            dropped.append(s); continue
    kept.append(s)
# Still too many: drop exercise pages from the end of the list (the library's later pages), never the five the crawl always captures (its PRIORITY list).
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
    if im.size[0] != PX:  # the page overflowed sideways (an app defect, noted in the report); keep the phone's width
        wide.append((s["id"], s["key"], round(im.size[0] / 3)))
        im = im.crop((0, 0, PX, im.size[1]))
    H = im.size[1]
    LIM = 15000  # WebP allows 16383 px; chunks of 5000 CSS px
    parts = []
    y = 0
    i = 0
    while y < H:
        h = min(LIM, H - y)
        dst = f"{out}/s/{s['id']}{'-' + str(i) if H > LIM else ''}.webp"
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
            im.crop((0, y, PX, y + h)).convert("RGB").save(dst, "WEBP", quality=q, method=4)
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
        s["hot"] = [{"x": 0, "y": 0, "w": PW, "h": s["h"], "label": "Enter the narrow gate", "to": "/", "kind": "a"}]
    s.pop("file", None)
    hot = []
    for h in s["hot"]:
        # Targets scrolled off the phone's width (horizontal rows) are clipped to it; those wholly outside are dropped.
        if h["x"] >= PW or h["x"] + h["w"] <= 0 or h["y"] >= s["h"]:
            continue
        if h["x"] < 0:
            h["w"] += h["x"]; h["x"] = 0
        h["w"] = min(h["w"], PW - h["x"]); h["h"] = min(h["h"], s["h"] - h["y"])
        if h["w"] < 6 or h["h"] < 6:
            continue
        if h.get("to") and h.get("kind") != "live":
            taps += 1
        hot.append({k: v for k, v in h.items() if k in ("x", "y", "w", "h", "label", "to", "kind", "name", "controls")})
    s["hot"] = hot
data["taps"] = taps
DATA = json.dumps({k: data[k] for k in ("date", "phone", "navH", "navHot", "screens", "alias", "taps")}, separators=(",", ":")).replace("</script", "<\\/script")
page = open(f"{here}/viewer.html").read()
page = page.replace("<script>/*DATA*/</script>", "<script>window.DEMO = " + DATA + ";</script>")
# The live parts: the app's 2D exercise engine (engine.mjs) and the opening's own pictures and fonts.
ngf_path = f"{out}/ngf.js"
if not os.path.exists(ngf_path):
    sys.exit("out/ngf.js is missing: run  node scripts/demo/iphone-demo/engine.mjs <out dir>  first")
ngf = open(ngf_path).read()
assert "</script" not in ngf
page = page.replace("<script>/*NGF*/</script>", "<script>" + ngf.rstrip() + "</script>")
root = os.path.abspath(os.path.join(here, "..", "..", ".."))
for sub, src_dir, names in (("opening", "public/opening", ["gate-base.webp", "gate-door.webp", "gate-haze.webp", "gate-light.webp"]),
                            ("fonts", "src/app/fonts", ["inter-latin-wght-normal.woff2", "plus-jakarta-sans-latin-wght-normal.woff2", "lora-latin-wght-normal.woff2", "lora-latin-wght-italic.woff2"])):
    os.makedirs(f"{out}/{sub}", exist_ok=True)
    for n in names:
        shutil.copy(f"{root}/{src_dir}/{n}", f"{out}/{sub}/{n}")
open(f"{out}/app.html", "w").write(page)
files = {}
for f in glob.glob(f"{out}/s/*") + glob.glob(f"{out}/opening/*") + glob.glob(f"{out}/fonts/*"):
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
print(f"screens {len(data['screens'])}, taps {taps}, page {os.path.getsize(out + '/app.html') / 1e6:.1f} MB, pictures {sum(sizes.values()) / 1e6:.1f} MB (avg {sum(sizes.values()) / len(sizes) / 1e3:.0f} KB), files total {tot / 1e6:.1f} MB")
