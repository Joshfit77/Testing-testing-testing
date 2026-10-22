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
- **Display:** every image sits in a 2 : 1 box with `object-fit: contain`, centred, so it's shown whole: never
  cropped, stretched or distorted. The sides fade into the frame.
  - **Earned art:** never has a CSS filter on it. The gold glow is a separate layer behind it.
  - **Locked art:** a fixed, mild dim (brightness 0.72, saturation 0.82) plus a lock.
- **Tests:**
  - `tests/unit/badge-artwork.test.ts` checks that all 27 files exist, are 2 : 1 and are at least 190 px tall.
  - `e2e/rank-badges.spec.ts` checks, at 320, 375, 390 and 430 px wide, that every image loads, every box is 2 : 1
    and the same size, the number, art and text share a centre line, no name is cut off, and nothing scrolls sideways.
- **Verses on the list:** an earned rank shows its full BSB verse directly under its row. Locked ranks show the
  reference, a progress bar and the count, and every rank's verse is in its detail view.

> **Rights:** these images came from the owner. Before the app goes to the App Store, confirm that you hold
> commercial rights to them (for example, that they're your own or AI images you generated under terms that
> allow commercial use).

### Image quality: what the posters can and can't give

The posters are phone screenshots. A resampling test (shrink, enlarge back, compare) shows they hold only about
55–65 % of the detail their pixel size suggests, so they were already soft before any cropping. Each badge is
382–582 px wide and 191–291 px tall, with roughly 120–180 px of real vertical detail.

| Where it's shown | Size on screen (390 px phone) | Pixels needed on a 3× iPhone | Result |
|---|---|---|---|
| Badge list | ≈ 135 × 68 pt | ≈ 405 × 203 | About native size: as sharp as the source allows |
| Current-rank card | 112 × 56 pt | 336 × 168 | Native or smaller: as sharp as the source allows |
| Detail view and reveal | up to 300 × 150 pt | 900 × 450 | Enlarged about 2×: visibly soft |

No CSS setting can add detail that isn't in the file. **All 27 need replacing for a crisp App Store release**:

- **Softest, replace first:** the Food set, especially Torch, Spark, Flame and Ember.
- **Also soft:** Faith 1–2 (Seed, Sprout) and Fitness 1 and 9 (Foundation, Conqueror).

### Replacement artwork (production spec)

- **Files:** 27 images with the same names as now (`fitness-01-foundation.webp` … `faith-09-cedar.webp`), one per
  rank, of the same subjects and progression as the posters.
- **Shape and size:** exactly **2 : 1**, ideally **1600 × 800 px** (minimum 1200 × 600). That covers the detail
  view on a 3× iPhone.
- **Composition:** subject centred, inside the middle 80 % of the width (the outer 7 % on each side fades out). No
  rank number, text or poster lines in the image.
- **Background:** transparent, or the same near-black as the app.
- **Format:** lossless WebP or PNG (a WebP over about 300 KB can be lossy at quality 95+).
- **Installing:** put them in `public/badges/` with the same names. Nothing else needs to change, and the unit test
  checks the shape. Don't re-run `crop-posters.py` afterwards, or it will overwrite them.
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
