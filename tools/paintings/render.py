"""Render scenes in parallel: python3 render.py <group> [ids...] [--ref-only] [--size WxH]

Writes out/<group>/<id>.jpg (painting) and out/<group>/<id>-ref.jpg (reference)."""
import sys, os, time, importlib, traceback
from multiprocessing import Pool
import numpy as np

GROUPS = {"foods": "scenes_foods", "fruits": "scenes_fruits", "frames": "scenes_frames", "remedies": "scenes_remedies"}


def job(args):
    group, sid, ref_only, size = args
    try:
        t = time.time()
        mod = importlib.import_module(GROUPS[group])
        from painter import paint, save
        ref = mod.SCENES[sid]()
        os.makedirs(f"out/{group}", exist_ok=True)
        save(ref, f"out/{group}/{sid}-ref.jpg", (500, 375))
        if not ref_only:
            out = paint(ref, seed=hash(sid) % 1000)
            save(out, f"out/{group}/{sid}.jpg", size)
        return f"{sid} {time.time() - t:.0f}s"
    except Exception:
        return f"{sid} FAILED\n{traceback.format_exc()}"


if __name__ == "__main__":
    a = sys.argv[1:]
    group = a[0]
    ref_only = "--ref-only" in a
    size = (640, 480)
    if "--size" in a:
        w, h = a[a.index("--size") + 1].split("x")
        size = (int(w), int(h))
    ids = [x for x in a[1:] if not x.startswith("--") and "x" not in x[:5] or x in []]
    ids = [x for x in a[1:] if not x.startswith("--") and not (a.index(x) > 0 and a[a.index(x) - 1] == "--size")]
    mod = importlib.import_module(GROUPS[group])
    ids = ids or list(mod.SCENES)
    with Pool(4) as p:
        for r in p.imap_unordered(job, [(group, i, ref_only, size) for i in ids]):
            print(r, flush=True)
