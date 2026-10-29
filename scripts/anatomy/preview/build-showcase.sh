#!/usr/bin/env bash
# Builds the 3D exercise showcase page (scripts/anatomy/preview/showcase.html + showcase.ts) into OUT (default
# .anatomy-showcase/): index.html opens on its own; artifact.html is the bare page for the artifact wrapper, with the
# binary files as base64 text parts. SHOWCASE="slug slug …" picks the exercises (default: the five the owner named);
# STATUS_JSON=<file from library-status.mts --json> embeds each exercise's status.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="${OUT:-$ROOT/.anatomy-showcase}"
SHOWCASE="${SHOWCASE:-kettlebell-swing dumbbell-curl inverted-row cable-chest-fly sled-push}"
mkdir -p "$OUT/anatomy/bake"
"$ROOT/node_modules/.bin/esbuild" "$ROOT/scripts/anatomy/preview/showcase.ts" --bundle --format=iife --minify \
  --alias:@="$ROOT/src" --outfile="$OUT/app.js" --log-level=warning
cp "$ROOT/public/anatomy/ecorche.glb" "$ROOT/public/anatomy/ecorche-face.bin" "$ROOT/public/anatomy/ecorche-face.json" \
  "$ROOT/public/anatomy/ecorche-rig.bin" "$ROOT/public/anatomy/ecorche-rig.json" "$OUT/anatomy/"
cp "$ROOT"/public/anatomy/ecorche-correctives.* "$OUT/anatomy/" 2>/dev/null || true
for slug in $SHOWCASE; do cp "$ROOT/public/anatomy/bake/$slug.ngb" "$OUT/anatomy/bake/" 2>/dev/null || echo "no bake for $slug"; done
python3 - "$OUT" "$ROOT/scripts/anatomy/preview/showcase.html" "$SHOWCASE" "${STATUS_JSON:-}" <<'PY'
import sys, base64, os, glob, json
out, page, slugs, status_json = sys.argv[1], sys.argv[2], sys.argv[3].split(), sys.argv[4]
js = open(f"{out}/app.js").read().replace("</script", "<\\/script")
status = {}
if status_json and os.path.exists(status_json):
    st = json.load(open(status_json))
    for r in st.get("rows", []):
        if r.get("slug") in slugs:
            status[r["slug"]] = {k: r.get(k) for k in ("result", "qa", "eye", "owner", "inApp")}
setup = "<script>window.SHOWCASE = " + json.dumps(slugs) + "; window.STATUS = " + json.dumps(status) + ";</script>\n"
body = open(page).read().replace("<script>/*APP*/</script>", setup + "<script>" + js + "</script>")
head = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'
open(f"{out}/index.html", "w").write(head + body + "</body></html>")
glb = base64.b64encode(open(f"{out}/anatomy/ecorche.glb", "rb").read()).decode()
half = len(glb) // 2
names = ["anatomy/ecorche-1.txt", "anatomy/ecorche-2.txt"]
for name, part in zip(names, [glb[:half], glb[half:]]):
    open(f"{out}/{name}", "w").write(part)
for n in ["face", "rig"]:
    open(f"{out}/anatomy/ecorche-{n}.txt", "w").write(base64.b64encode(open(f"{out}/anatomy/ecorche-{n}.bin", "rb").read()).decode())
corr = os.path.exists(f"{out}/anatomy/ecorche-correctives.bin")
if corr:
    open(f"{out}/anatomy/ecorche-correctives.txt", "w").write(base64.b64encode(open(f"{out}/anatomy/ecorche-correctives.bin", "rb").read()).decode())
bakes = {}
for f in sorted(glob.glob(f"{out}/anatomy/bake/*.ngb")):
    slug = os.path.basename(f)[:-4]
    open(f"{out}/anatomy/bake/{slug}.txt", "w").write(base64.b64encode(open(f, "rb").read()).decode())
    bakes[slug] = [f"anatomy/bake/{slug}.txt"]
parts = "<script>window.ECORCHE_PARTS = " + json.dumps(names) + '; window.FACE_PARTS = ["anatomy/ecorche-face.txt"]; window.RIG_PARTS = ["anatomy/ecorche-rig.txt"]; ' + ('window.CORR_PARTS = ["anatomy/ecorche-correctives.txt"]; ' if corr else '') + 'window.BAKE_PARTS = ' + json.dumps(bakes) + ';</script>\n'
open(f"{out}/artifact.html", "w").write(body.replace("<script>", parts + "<script>", 1))
PY
echo "built $OUT/index.html"
