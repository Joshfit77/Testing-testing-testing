# Oil paintings

Every painting on the site (the Foods page frames, the food and fruit pictures, and the remedy
paintings) is made by these scripts: each scene is built as a lit still life, then painted
with layered brush strokes.

    pip install numpy scipy pillow
    cd tools/paintings
    python3 render.py foods            # all foods  -> out/foods/<id>.jpg
    python3 render.py fruits apple     # one fruit  -> out/fruits/apple.jpg
    python3 render.py frames --size 1000x750
    python3 render.py remedies

Copy the results to `images/foods/`, `images/fruits/`, `images/` (the `oil-*.jpg` frames) and
`images/remedies/`, then run `node scripts/build.js`.
