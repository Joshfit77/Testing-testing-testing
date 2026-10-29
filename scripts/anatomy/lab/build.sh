#!/usr/bin/env bash
# Builds the rig lab page into .anatomy-lab/ (see lab.ts).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/.anatomy-lab"
mkdir -p "$OUT/anatomy"
"$ROOT/node_modules/.bin/esbuild" "$ROOT/scripts/anatomy/lab/lab.ts" --bundle --format=iife \
  --alias:@="$ROOT/src" --outfile="$OUT/lab.js" --log-level=warning
for f in ecorche.glb ecorche-face.bin ecorche-face.json ecorche-rig.bin ecorche-rig.json; do
  ln -sf "$ROOT/public/anatomy/$f" "$OUT/anatomy/$f"
done
echo '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><canvas width="600" height="800"></canvas><script src="lab.js"></script>' > "$OUT/index.html"
echo "built $OUT"
