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
screenshots), with the Conqueror cross made smaller.

- **Source files:** the posters are kept unchanged (lossless) in `scripts/badge-art/posters/`.
- **App files:** `scripts/badge-art/crop-posters.py` writes `public/badges/{category}-{NN}-{name}.webp`, one per rank.
  - **Shape:** every image is exactly **2 : 1**.
  - **Tight, consistent framing:** each crop is 92 % of its poster row's height, centred on the badge's subject
    horizontally and vertically (the weighted centre of the bright, coloured artwork). So every badge fills its
    tile the same way, rank 9 included. Before, rank 9 crops were larger and padded with empty space (Conqueror
    33 px, Phoenix 70 px), so those badges looked smaller.
  - **Never enlarged when cut:** crops are at the poster's own pixels.
  - **Crisp, opaque edges:** before, every file faded to transparent over 7 % of each side and 10 px top and
    bottom, which read as haze around every badge. The app now frames each tile itself (rounded corners and a faint
    gold edge drawn over the image).
  - **Mild sharpening:** an unsharp mask (radius 1 px, 60 %) raises edge contrast a little. **It adds no detail:**
    the posters' own detail is the limit (see below).
  - **Lossless WebP:** no compression smudging. All 27 total 2.0 MB.
- **Conqueror's cross:** `scripts/badge-art/edit_conqueror.py` makes it **30 % smaller** and sits it inside the
  shield, keeping the shield, laurels and silver wings. The cross is painted into the poster, so CSS couldn't do
  this; it's a classical raster edit (no AI generation or upscaling):
  1. the cross is lifted out along its measured outline;
  2. the area it covered is refilled: smoothly across the shield's dark field, and on the bright rim and
     laurels by mirroring the texture beside the gap (the badge is mirror-symmetric);
  3. the cross is put back at 70 % with a soft glow.
  
  Seen closely, the strip of rim where the old cross top was is smoother than the painting around it. For a
  perfect result the artist should paint the smaller cross in (see the checklist below).
- **Wiring:** `src/components/badges/badge-artwork.ts` maps each rank to its image (`getBadgeArtwork`), and
  `BADGE_IMAGE_OVERRIDES` feeds it to the badge list, the detail view and the unlock reveal.
- **Display:** every image sits in a 2 : 1 tile with `object-fit: contain`, so it's shown whole: never cropped,
  stretched or distorted. Plain `<img>` with the file's real `width`/`height` (`badge-artwork-sizes.json`), not
  Next.js `<Image>`, so no image optimiser recompresses it.
  - **No mask or filter on the art:** the tile's corners and gold edge are a rounded image corner and an overlay
    line. Earned art has no CSS effect, and its gold glow is a separate layer behind it. Locked art is dimmed only
    slightly (opacity 0.85, was 0.66) so the ladder stays bright; the lock badge marks it.
  - **Never enlarged much past its detail:**
    - **List:** the tile stops at 136 pt wide.
    - **Detail view and reveal:** they stop at `BADGE_MAX_SHARP_WIDTH` (176 pt). That's the most any badge can be
      shown before a 3× screen enlarges it more than 1.5×.
  - **No lingering transforms:** animations end on `transform: none` / `filter: none`.
- **Offline edition:** `standalone/index.html` embeds the same images and tile styling.
- **Tests:**
  - `tests/unit/badge-artwork.test.ts` checks that all 27 files exist, are 2 : 1, at least 175 px tall and lossless
    and fully opaque (no baked-in fades or padding), that their real sizes match `badge-artwork-sizes.json`, and
    that large views stay within 1.5×.
  - `e2e/rank-badges.spec.ts` checks, at 320, 360, 375, 390 and 430 px wide, that every image loads, every tile is
    2 : 1 and the same size, no image is enlarged more than 1.1× (on the test phone's 2.6× screen), the number, art
    and text share a centre line, no name is cut off, and nothing scrolls sideways.
- **Not yet tested on a physical iPhone:** all checks ran in a browser emulating 3× iPhone screens.

> **Rights:** these images came from the owner. Before the app goes to the App Store, confirm that you hold
> commercial rights to them (for example, that they're your own or AI images you generated under terms that
> allow commercial use).

### The badge reference pack (October 2026)

The owner's reference pack contains three "original" posters at **709 × 1536** (JPEG). They show a newer, more
compact design: each badge is a neat shield or medallion with space around it, and Conqueror's cross already
sits small inside its shield.

- **Same identity:** the names, verses and subjects are the same.
- **Too small to use as source art:** each badge in those posters is only about 180 px wide (less than half the
  ~400 px of the posters in use) and JPEG-compressed, so cropping from them would make every badge visibly
  blurrier.
- **What the app took from them:** the tighter framing, the cleaner edges and the smaller Conqueror cross. The
  mockup (`05_improved_visual_target.png`) was used only as a visual target, not as art.
- **If you prefer that compact design:** the full-resolution originals of those posters (or the individual
  badge files) are needed. Even a full-size iPhone screenshot of them would be about 1179 px wide.

### Image quality: what the posters can and can't give

The posters are phone screenshots. Two tests show what's in them:

- **Resampling test (shrink, enlarge back, compare):** they hold only about 55–65 % of the detail their pixel size
  suggests.
- **8-pixel-block test:** they show no JPEG block artifacts (blockiness 1.01–1.03, where 1.0 means none). The
  smudgy look is the art's own softness, not compression damage that could be undone.

**Code causes of blur (fixed):**

- the faded edges baked into each file;
- uneven framing and padding on rank 9;
- strong dimming of locked art;
- earlier: the detail view enlarging art up to 2.36× and lossy WebP (fixed before).

**Art causes (can't be fixed in code):** the posters' own softness. "Enlarged" below is screen pixels ÷ file
pixels on a 3× iPhone; above 1.0 means the screen draws more pixels than the file has. The tighter crops make each
subject bigger on screen, at the cost of up to 1.16× enlargement in the list on the widest phones.

| Badge | File (px) | Size | List, 136 pt tile | Detail view (176 pt) | Replacement art |
|---|---|---|---|---|---|
| fitness-01-foundation | 358 × 179 | 59 KB | 1.14× | 1.47× | Needed, first |
| fitness-02-faithful | 368 × 184 | 67 KB | 1.11× | 1.43× | Needed |
| fitness-03-endurance | 352 × 176 | 62 KB | 1.16× | 1.50× | Needed |
| fitness-04-disciplined | 382 × 191 | 77 KB | 1.07× | 1.38× | Needed |
| fitness-05-refined | 404 × 202 | 81 KB | 1.01× | 1.31× | Needed |
| fitness-06-steadfast | 410 × 205 | 85 KB | 1.00× | 1.29× | Needed |
| fitness-07-overcomer | 394 × 197 | 80 KB | 1.04× | 1.34× | Needed |
| fitness-08-mighty | 418 × 209 | 84 KB | 0.98× | 1.26× | Needed |
| fitness-09-conqueror | 518 × 259 | 118 KB | 0.79× | 1.02× | Needed, first (cross edited in code) |
| food-01-spark | 368 × 184 | 53 KB | 1.11× | 1.43× | Needed, first |
| food-02-ember | 372 × 186 | 62 KB | 1.10× | 1.42× | Needed, first |
| food-03-flame | 394 × 197 | 64 KB | 1.04× | 1.34× | Needed, first |
| food-04-torch | 384 × 192 | 51 KB | 1.06× | 1.38× | Needed, first |
| food-05-blaze | 400 × 200 | 73 KB | 1.02× | 1.32× | Needed |
| food-06-furnace | 410 × 205 | 79 KB | 1.00× | 1.29× | Needed |
| food-07-forge | 392 × 196 | 67 KB | 1.04× | 1.35× | Needed |
| food-08-inferno | 418 × 209 | 78 KB | 0.98× | 1.26× | Needed |
| food-09-phoenix | 514 × 257 | 114 KB | 0.79× | 1.03× | Needed |
| faith-01-seed | 362 × 181 | 57 KB | 1.13× | 1.46× | Needed, first |
| faith-02-sprout | 380 × 190 | 61 KB | 1.07× | 1.39× | Needed, first |
| faith-03-sapling | 390 × 195 | 69 KB | 1.05× | 1.35× | Needed |
| faith-04-root | 384 × 192 | 70 KB | 1.06× | 1.38× | Needed |
| faith-05-branch | 402 × 201 | 80 KB | 1.01× | 1.31× | Needed |
| faith-06-vine | 412 × 206 | 82 KB | 0.99× | 1.28× | Needed |
| faith-07-fruit | 392 × 196 | 77 KB | 1.04× | 1.35× | Needed |
| faith-08-olive | 420 × 210 | 89 KB | 0.97× | 1.26× | Needed |
| faith-09-cedar | 526 × 263 | 135 KB | 0.78× | 1.00× | Needed |

**For a crisp App Store release all 27 need replacement art.** No code change can add detail that isn't in the
files.

- **Softest, replace first:** the Food set (Torch, Spark, Flame and Ember have the least detail).
- **Then:** Seed, Sprout, Foundation and Conqueror (Conqueror also to get a hand-painted smaller cross).

### True high-resolution artwork (not done yet)

No genuine 3840 × 1920 artwork exists yet, and none of the current files has been enlarged to pretend otherwise.

- **The brief:** `docs/BADGE_ART_SPEC.md` has the generation spec for all 27 masters: identity, composition, per-badge subjects, a prompt template and an acceptance checklist.
- **Installing:** masters go in `assets/badge-masters/` (kept out of git by default). Then `python3 scripts/badge-art/export-masters.py` writes the 1200 × 600 app files and updates their sizes, rank by rank.

### Animations

Only the badge in focus animates: the current-rank card, the detail view of an earned rank, and the unlock reveal.
The list never does.

- **Fitness:** a gold glow, a metallic sheen and gem sparkles.
- **Food:** flickering firelight and rising embers.
- **Faith:** soft sun rays and drifting light motes.

The reveal's rings take the category's colour. Rank 9 adds a second ring, and Cedar a burst of sun rays. All of it
is off under reduced motion (the phone's setting or the app's own).

### Replacement artwork: per-rank slots and checklist

Each rank has a fixed slot in `public/badges/`. A replacement with the same file name and a 2 : 1 shape drops
straight in.

| Fitness | Food | Faith |
|---|---|---|
| `fitness-01-foundation.webp` | `food-01-spark.webp` | `faith-01-seed.webp` |
| `fitness-02-faithful.webp` | `food-02-ember.webp` | `faith-02-sprout.webp` |
| `fitness-03-endurance.webp` | `food-03-flame.webp` | `faith-03-sapling.webp` |
| `fitness-04-disciplined.webp` | `food-04-torch.webp` | `faith-04-root.webp` |
| `fitness-05-refined.webp` | `food-05-blaze.webp` | `faith-05-branch.webp` |
| `fitness-06-steadfast.webp` | `food-06-furnace.webp` | `faith-06-vine.webp` |
| `fitness-07-overcomer.webp` | `food-07-forge.webp` | `faith-07-fruit.webp` |
| `fitness-08-mighty.webp` | `food-08-inferno.webp` | `faith-08-olive.webp` |
| `fitness-09-conqueror.webp` (smaller cross, keep the silver wings) | `food-09-phoenix.webp` | `faith-09-cedar.webp` |

Checklist for the artist:

- [ ] Same subject, colours and progression as the posters. Keep the existing identity; don't redesign it.
- [ ] Exactly **2 : 1**, ideally **1600 × 800 px** (minimum 1200 × 600). That covers the detail view on a 3× iPhone.
- [ ] Subject centred, filling about 90 % of the height. No rank number, text or poster lines.
- [ ] Opaque near-black background (#0b0a07 or the poster's black) with art reaching the edges like the current
      crops. The app adds the rounded corners and gold edge, so don't add a frame or fade.
- [ ] Lossless WebP or PNG (a WebP over about 300 KB can be lossy at quality 95+).
- [ ] **Installing:**
  1. Put them in `public/badges/` with the same names.
  2. Update each file's `width`/`height` in `src/components/badges/badge-artwork-sizes.json`. The unit test fails
     until they match.
  3. Larger files raise the detail view's sharp-size limit (`BADGE_MAX_SHARP_WIDTH`) on their own. The list's
     136 pt cap is in `globals.css` (`.rank-art`).
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
