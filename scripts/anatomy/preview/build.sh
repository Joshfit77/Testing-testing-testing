#!/usr/bin/env bash
# Builds the stand-alone squat preview page (the 3D athlete player in the reference layout) into .anatomy-preview/.
#   bash scripts/anatomy/preview/build.sh && npx serve .anatomy-preview
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/.anatomy-preview"
mkdir -p "$OUT/anatomy"
"$ROOT/node_modules/.bin/esbuild" "$ROOT/scripts/anatomy/preview/app.ts" --bundle --format=iife --minify \
  --alias:@="$ROOT/src" --outfile="$OUT/app.js" --log-level=warning
cp "$ROOT/public/anatomy/athlete.bin" "$ROOT/public/anatomy/athlete.json" "$OUT/anatomy/"
# The Écorché-based evaluation build, when present (?asset=athlete-eco).
if [ -f "$ROOT/public/anatomy/athlete-eco.bin" ]; then cp "$ROOT/public/anatomy/athlete-eco.bin" "$ROOT/public/anatomy/athlete-eco.json" "$OUT/anatomy/"; fi
python3 - "$OUT" "$ROOT/scripts/anatomy/preview/page.html" <<'PY'
import sys
out, page = sys.argv[1], sys.argv[2]
js = open(f"{out}/app.js").read().replace("</script", "<\\/script")
open(f"{out}/index.html", "w").write(open(page).read().replace("/*APP*/", js))
PY
echo "built $OUT/index.html"
