#!/usr/bin/env bash
# Builds the stand-alone squat preview page (the 3D athlete player in the reference layout) into .anatomy-preview/.
#   bash scripts/anatomy/preview/build.sh && npx serve .anatomy-preview
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/.anatomy-preview"
mkdir -p "$OUT/anatomy"
"$ROOT/node_modules/.bin/esbuild" "$ROOT/scripts/anatomy/preview/app.ts" --bundle --format=iife --minify \
  --alias:@="$ROOT/src" --outfile="$OUT/app.js" --log-level=warning
# The original Écorché model (the default view) and the rigged athlete built from it (?ex=…, later milestones).
cp "$ROOT/public/anatomy/ecorche.glb" "$ROOT/public/anatomy/athlete-raw.bin" "$ROOT/public/anatomy/athlete-raw.json" "$OUT/anatomy/"
python3 - "$OUT" "$ROOT/scripts/anatomy/preview/page.html" <<'PY'
import sys
out, page = sys.argv[1], sys.argv[2]
js = open(f"{out}/app.js").read().replace("</script", "<\\/script")
body = open(page).read().replace("/*APP*/", js)
# index.html opens on its own (charset and phone viewport); artifact.html is the bare page for the artifact wrapper.
head = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'
open(f"{out}/index.html", "w").write(head + body + "</body></html>")
# Artifacts do not serve .glb files: the artifact gets the same bytes as two base64 text parts, which the page joins and
# checks against the original file's sha256 before showing the model.
import base64, os
glb = base64.b64encode(open(f"{out}/anatomy/ecorche.glb", "rb").read()).decode()
half = len(glb) // 2
names = ["anatomy/ecorche-1.txt", "anatomy/ecorche-2.txt"]
for name, part in zip(names, [glb[:half], glb[half:]]):
    open(f"{out}/{name}", "w").write(part)
parts = "<script>window.ECORCHE_PARTS = " + str(names).replace("'", '"') + ";</script>\n"
open(f"{out}/artifact.html", "w").write(body.replace("<script>", parts + "<script>", 1))
PY
echo "built $OUT/index.html"
