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

**In use now:** the owner's painted badge artwork. `public/badges/{fitness,food,faith}-{1-9}.webp` are 512 × 512 WebP
images with transparent, feathered edges. They were cut from the owner's three badge reference screenshots
(1290 × 2796) by `scripts/badge-art/crop-fitness.py and crop-food-faith.py`, about 28 KB each and 830 KB in total. The app shows them
through `BADGE_IMAGE_OVERRIDES`:

- **Badge in focus:** a slow gold glow and a light sweep. Both stop under reduced motion.
- **Locked badges:** shown in muted grey.
- **Offline edition:** embeds the same images.

> **Rights:** these images came from the owner. Before the app goes to the App Store, confirm that you hold
> commercial rights to them (for example, that they're your own or AI images you generated under terms that
> allow commercial use).

**Sharpness:** the cut-outs are about 230 px from the screenshots, upscaled to 512 px. They look sharp in the grid
but slightly soft in the large detail view. For full sharpness, supply the original artwork, ideally 1024 px per
badge (see "Commissioned painted artwork" below), and re-run the script or drop the files into `public/badges/`.

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

### Commissioned painted artwork (optional)

The reference image is painted and photo-real, which hand-built vector art can't fully match. The supplied image
is also too small to use: about 100 px per badge, on a solid background. To use painted art:

- **Files:** 27 images, one per rank, named `fitness-1.webp` … `fitness-9.webp`, `food-1.webp` … `food-9.webp`
  and `faith-1.webp` … `faith-9.webp`.
- **Size:** 1024 × 1024 px, square, transparent background (WebP with alpha, or PNG). The badge should fill the
  central 90% and be centred on the same baseline.
- **Style:** one artist or one consistent model and style across all 27, matte black-and-gold mood, the
  descriptions above, no text or numbers in the art, no watermark, and full commercial rights (original or
  properly licensed).
- **Installing them:** put the files in `public/badges/` and list them in `BADGE_IMAGE_OVERRIDES` in
  `badge-art.tsx`. The screen then shows the images instead of the vector art.
- **What changes with images:** the vector animations (shine, flicker, sway) only apply to the vector art, so
  painted images get the glow and unlock reveal but stay still otherwise.
