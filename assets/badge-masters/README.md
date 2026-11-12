# Badge master artwork

Put the 27 high-resolution badge masters here, one per rank, named after its slot:

`fitness-01-foundation.png` … `fitness-09-conqueror.png`, `food-01-spark.png` … `food-09-phoenix.png`,
`faith-01-seed.png` … `faith-09-cedar.png` (PNG, WebP or TIFF).

- Exactly **2 : 1**. Target **3840 × 1920**, minimum 1600 × 800.
- Check them with `python3 scripts/badge-art/check_masters.py` (PASS / WARN / FAIL; an enlarged poster crop is
  refused).
- Then run `python3 scripts/badge-art/export-masters.py`, which runs the same check first. It writes the optimised files the app loads
  (`public/badges/<slot>.webp`, 1200 × 600) and updates their sizes. Ranks without a master keep their current art.
- The masters themselves are **not** committed by default (`.gitignore`): 27 masters at 3840 × 1920 are several
  hundred megabytes. Keep them in Git LFS or a shared drive.

The artwork brief is in `docs/BADGE_ART_SPEC.md`.
