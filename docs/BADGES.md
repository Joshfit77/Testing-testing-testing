# Rank badges: Fitness, Food, Faith

Twenty-seven rank badges, nine per category, shown at **My Progress → Badges** above the original 20
achievements (which are unchanged, under "More achievements").

## How ranks are earned

Ranks are worked out from the activity a person has already saved. They're never stored as awards
(`src/lib/domain/ranks.ts`). That means:

- **Nothing is reset or lost.** Existing workouts, food logs and faith activity count from day one, and a rank
  shows the same on every device.
- **No double awards.** Workouts are counted one by one, and food and faith count each day once, however many
  meals, entries or check-offs that day has.
- **No self-awarding.** The only way to earn a rank is to log the activity, and row level security limits that
  to the person's own account.
- **Rest never costs anything.** Everything is a running total, never a streak, so rest days, recovery, illness
  or disability never remove a rank or block one.
- **What Faith counts.** Faith counts the days someone took part: read the 40-day devotional, checked off a daily
  practice or wrote a journal entry. Only dates are read, never journal text. Faith ranks mark participation,
  not spiritual maturity, worth or standing before God, and the detail view says so.

> Note: this reverses the earlier rule that faith activity is never scored (SPEC §12, checklist 12.18), at the
> owner's request. The ranks count days of taking part only.

## Thresholds (proposed — please confirm)

The existing badge thresholds are reused where they exist. The rest are proposals, and every number lives in
`RANKS` in `src/lib/domain/ranks.ts`.

| Rank | Fitness (completed workouts) | Food (days with food logged) | Faith (days taking part) |
|---|---|---|---|
| 1 | Foundation · **1** (existing) | Spark · 1 | Seed · 1 |
| 2 | Faithful · **10** (existing) | Ember · **7** (existing) | Sprout · 7 |
| 3 | Endurance · **25** (existing) | Flame · 14 | Sapling · 14 |
| 4 | Disciplined · **50** (existing) | Torch · **30** (existing) | Root · 30 |
| 5 | Refined · **100** (existing) | Blaze · 60 | Branch · 50 |
| 6 | Steadfast · 150 | Furnace · **100** (existing) | Vine · 80 |
| 7 | Overcomer · 250 | Forge · 180 | Fruit · 120 |
| 8 | Mighty · 400 | Inferno · 270 | Olive · 180 |
| 9 | Conqueror · 600 | Phoenix · 365 | Cedar · 365 |

Roughly, training 3–4 times a week reaches Conqueror in 3–4 years. Logging food most days reaches Phoenix in about a
year. Taking part in Faith most days reaches Cedar in about a year.

## Scripture

Each rank keeps the reference from the design. The detail view and the unlock reveal show the verse in the
**Berean Standard Bible**, taken from the official BSB file (see `docs/SCRIPTURE.md`). The short line under each
name ("Build on the rock.") is a theme, not a quotation.

Overcomer and Conqueror both use Romans 8:37, as in the design. A different verse for Overcomer is a possible
change, such as 1 John 5:4, "everyone born of God overcomes the world".

## Artwork

**In use now:** the artwork from the owner's three original badge posters (Fitness, Food, Faith; 1290 × 2796
screenshots).

- **Source files:** the posters are kept unchanged (lossless) in `scripts/badge-art/posters/`.
- **App files:** `scripts/badge-art/crop-posters.py` writes `public/badges/{category}-{NN}-{name}.webp`, one per rank.
  - **Shape:** every image is exactly **2 : 1**.
  - **Height:** the full row height between the poster's gold rules, at the poster's own pixels. Nothing is resized,
    so nothing is stretched or upscaled.
  - **Centring:** each image is centred on its subject (the weighted centre of the bright, coloured artwork). Before
    this fix the subjects sat 25–50 px off-centre.
  - **Padding:** where centring would run into the rank number or text, the canvas is left transparent instead. This
    applies to Conqueror and Phoenix.
  - **Compression:** saved as lossless WebP, so compression adds no smudging. The earlier files were lossy (quality
    92), and lossy WebP also halves colour detail, which smeared red and blue edges. All 27 total 2.2 MB.
- **Wiring:** `src/components/badges/badge-artwork.ts` maps each rank to its image (`getBadgeArtwork`), and
  `BADGE_IMAGE_OVERRIDES` feeds it to the badge list, the detail view and the unlock reveal.
- **Display:** every image sits in a 2 : 1 box with `object-fit: contain` and `object-position: 50% 50%`, so it's
  shown whole: never cropped, stretched or distorted. Plain `<img>` with the file's real `width`/`height`
  (`badge-artwork-sizes.json`), not Next.js `<Image>`, so no image optimiser recompresses it.
  - **No mask or filter on the art:** the edge fade is built into each file. Earned art has no CSS effect at all,
    and its gold glow is a separate layer behind it. Locked art is dimmed with opacity (0.66) plus a lock.
  - **Never enlarged past its detail:**
    - **List:** the art box stops at 136 pt wide, about each file's own width on a 3× iPhone.
    - **Detail view and reveal:** they stop at `BADGE_MAX_SHARP_WIDTH` (191 pt). That's the most any badge can be
      shown before a 3× screen enlarges it more than 1.5×.
  - **No lingering transforms:** animations end on `transform: none` / `filter: none`, so nothing stays on a
    separate compositing layer once they finish.
- **Tests:**
  - `tests/unit/badge-artwork.test.ts` checks that all 27 files exist, are 2 : 1, at least 190 px tall and lossless
    with alpha, that their real sizes match `badge-artwork-sizes.json`, and that large views stay within 1.5×.
  - `e2e/rank-badges.spec.ts` checks, at 320, 375, 390 and 430 px wide, that every image loads, every box is 2 : 1
    and the same size, no image is enlarged more than 1.1×, the number, art and text share a centre line, no name is
    cut off, and nothing scrolls sideways.
- **Verses on the list:** an earned rank shows its full BSB verse directly under its row. Every row has a progress
  bar (full gold when earned) and its count, and every rank's verse is in its detail view.

> **Rights:** these images came from the owner. Before the app goes to the App Store, confirm that you hold
> commercial rights to them (for example, that they're your own or AI images you generated under terms that
> allow commercial use).

### Image quality: what the posters can and can't give

The posters are phone screenshots. Two tests show what's in them:

- **Resampling test (shrink, enlarge back, compare):** they hold only about 55–65 % of the detail their pixel size
  suggests.
- **8-pixel-block test:** they show no JPEG block artifacts (blockiness 1.01–1.03, where 1.0 means none). The
  smudgy look is the art's own softness, not compression damage that could be undone.

The Food poster has the least fine detail. "Enlarged" below is screen pixels ÷ file pixels on a 3× iPhone; above
1.0 means the screen draws more pixels than the file has.

| Badge | File (px) | Size | List, 390 pt phone | Detail view |
|---|---|---|---|---|
| fitness-01-foundation | 390 × 195 | 63 KB | 1.04× | 1.47× |
| fitness-02-faithful | 400 × 200 | 72 KB | 1.01× | 1.43× |
| fitness-03-endurance | 382 × 191 | 65 KB | 1.06× | 1.50× |
| fitness-04-disciplined | 416 × 208 | 81 KB | 0.97× | 1.38× |
| fitness-05-refined | 440 × 220 | 85 KB | 0.92× | 1.30× |
| fitness-06-steadfast | 446 × 223 | 91 KB | 0.91× | 1.28× |
| fitness-07-overcomer | 428 × 214 | 86 KB | 0.95× | 1.34× |
| fitness-08-mighty | 454 × 227 | 90 KB | 0.89× | 1.26× |
| fitness-09-conqueror | 564 × 282 | 117 KB | 0.72× | 1.02× |
| food-01-spark | 400 × 200 | 55 KB | 1.01× | 1.43× |
| food-02-ember | 404 × 202 | 66 KB | 1.00× | 1.42× |
| food-03-flame | 428 × 214 | 68 KB | 0.95× | 1.34× |
| food-04-torch | 418 × 209 | 57 KB | 0.97× | 1.37× |
| food-05-blaze | 434 × 217 | 78 KB | 0.93× | 1.32× |
| food-06-furnace | 446 × 223 | 83 KB | 0.91× | 1.28× |
| food-07-forge | 426 × 213 | 73 KB | 0.95× | 1.35× |
| food-08-inferno | 454 × 227 | 84 KB | 0.89× | 1.26× |
| food-09-phoenix | 582 × 291 | 126 KB | 0.70× | 0.98× |
| faith-01-seed | 394 × 197 | 62 KB | 1.03× | 1.45× |
| faith-02-sprout | 412 × 206 | 64 KB | 0.98× | 1.39× |
| faith-03-sapling | 424 × 212 | 73 KB | 0.96× | 1.35× |
| faith-04-root | 418 × 209 | 74 KB | 0.97× | 1.37× |
| faith-05-branch | 436 × 218 | 84 KB | 0.93× | 1.31× |
| faith-06-vine | 448 × 224 | 87 KB | 0.90× | 1.28× |
| faith-07-fruit | 426 × 213 | 82 KB | 0.95× | 1.35× |
| faith-08-olive | 456 × 228 | 94 KB | 0.89× | 1.26× |
| faith-09-cedar | 572 × 286 | 141 KB | 0.71× | 1.00× |

Before this fix the detail view drew 300 pt wide, which enlarged the art 1.55–2.36×. The list is now drawn at about
native size: as sharp as these files can be. **No code change can add detail that isn't in the files**, so for a
crisp App Store release **all 27 need replacing**:

- **Softest, replace first:** the Food set (Torch, Spark, Flame and Ember have the least detail).
- **Then:** Seed, Sprout, Foundation and Conqueror.

### Replacement artwork (production spec)

- **Files:** 27 images with the same names as now (`fitness-01-foundation.webp` … `faith-09-cedar.webp`), one per
  rank, of the same subjects and progression as the posters.
- **Shape and size:** exactly **2 : 1**, ideally **1600 × 800 px** (minimum 1200 × 600). That covers the detail
  view on a 3× iPhone.
- **Composition:** subject centred, inside the middle 80 % of the width. No rank number, text or poster lines in
  the image.
- **Edges:** the app applies no CSS fade, so either use a transparent background or fade the outer 7 % of each side
  (and about 10 px top and bottom) to transparent in the file itself.
- **Background:** transparent, or the same near-black as the app.
- **Format:** lossless WebP or PNG (a WebP over about 300 KB can be lossy at quality 95+).
- **Installing:**
  1. Put them in `public/badges/` with the same names.
  2. Update each file's `width`/`height` in `src/components/badges/badge-artwork-sizes.json`. The unit test fails
     until they match, and it checks the shape.
  3. With larger files, the detail view's sharp-size limit (`BADGE_MAX_SHARP_WIDTH`) rises on its own. The list's
     136 pt cap is in `globals.css` (`.rank-art`) and can then be raised too.
  4. Don't re-run `crop-posters.py` afterwards, or it will overwrite them.
- **Don't use AI upscalers on the current crops:** they invent detail (fur, leaves, flames) that changes the art.

The vector drawing described next remains in `badge-art.tsx` as a fallback.

`src/components/badges/badge-art.tsx` draws all 27 badges as original vector artwork. It has no external images,
stays sharp on Retina screens at any size, and its visual language follows the reference:

- **Fitness:** shields with laurel wreaths, rising from carved wood with bronze rivets through bronze, steel, a gold
  lion, blue steel, a purple gem and a royal crown to ruby battle armour. Conqueror is silver-white with a cross,
  crossed swords, gold wings and a gold aura.
- **Food:** fire inside a gold-rimmed medallion: spark, embers, flame, torch, campfire, stone furnace, anvil and
  forge, a spiralling inferno, and a phoenix. From rank 7 the rim gains a gold sunburst.
- **Faith:** a tree in a gold-rimmed medallion: seed, sprout, sapling with roots, glowing root system, branching
  tree, vine with grapes, fruit tree, silver-green olive, and a layered cedar under a golden sky.

**Animation.** It runs only on the badge in focus (the current-rank card, the detail view and the reveal):

- a metal shine sweeps across the Fitness shields;
- flames flicker and embers rise on the Food badges;
- leaves sway and drift on the Faith badges;
- gems and stars twinkle.

The grid stays still to save battery. Locked badges are shown darkened. Reduced motion, either the phone's setting
or the app's own setting, shows still artwork.

**Unlock.** A rank reached in the last week is revealed once per device, with a gold ring burst and its verse.
Rank 9 gets a second ring and a stronger glow. Ranks earned before this update are marked as already seen.
