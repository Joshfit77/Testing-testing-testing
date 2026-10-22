# Badge artwork brief: 27 high-resolution masters

**Status (2026-10-22): no genuine high-resolution artwork exists yet.**

- **In use now:** the art the app uses is cut from the owner's three poster screenshots. Each badge is 352–526 px
  wide (`docs/BADGES.md` has the per-image table).
- **Not 4K, and not made 4K:** none of it is 4K, and none of it has been enlarged to look 4K. Enlarging those crops
  would only make bigger blurry files.
- **Why it hasn't been made here:** no image-generation tool was available in the development environment.
- **What's still needed:** an artist or an image-generation service must produce the 27 masters described below.
- **Already ready for them:**
  - the hand-off pack for the artist or service (below);
  - the folder (`assets/badge-masters/`) and the export to mobile files (`scripts/badge-art/export-masters.py`);
  - an automatic check (`scripts/badge-art/check_masters.py`) that refuses an enlarged poster crop;
  - the app. Drop the files in and run the export.

## Hand-off pack

`python3 scripts/badge-art/make-handoff-pack.py --out badge-art-handoff.zip` builds a zip (about 10 MB) to send to
the artist or image service:

- `README.txt`: what to deliver;
- this brief;
- `prompts.csv`: one ready-to-use prompt per badge, with a negative prompt, built from the tables below;
- `references/<slot>.png`: each badge as cut from the posters (the design to match, not a base to enlarge);
- `references/fitness-09-conqueror-original-cross.png`: Conqueror before its cross was made smaller;
- `references/posters/`: the three original posters.

## Automatic checks on delivery

`python3 scripts/badge-art/check_masters.py` (also run by the export) gives each master PASS, WARN or FAIL.

| Result | Meaning |
|---|---|
| **FAIL** (not exported) | Not 2 : 1, smaller than 1600 × 800, or an enlargement of that badge's poster crop. Each master is shrunk back and correlated with its crop, allowing for scale, position, mirroring and colour changes. Enlargements of the current crops score 0.99–1.00, even when sharpened, grained or colour-graded; different paintings of similar subjects score 0.2–0.65. Above 0.90 is refused. |
| **WARN** (exported; look at it at 100 % zoom) | Little real detail at full size (it behaves like an image enlarged 2× or more); soft edges; subject more than 2 % off-centre, outside 80–88 % of the height, or in the margins; a colour profile other than sRGB. Glow and sparks can make the centring readings slightly larger than the silhouette. |

No automatic check can judge whether a painting is good, so the checklist below still applies.
`python3 scripts/badge-art/test_badge_pipeline.py` proves the checks and the export on made-up test images
(about 2 minutes).

## Deliverables

| | Master | App file (made by the export script) |
|---|---|---|
| Size | **3840 × 1920 px** (minimum 1600 × 800), exactly 2 : 1 | 1200 × 600 px |
| Format | PNG (lossless), sRGB | WebP, quality 90, about 150–300 KB |
| Background | Opaque near-black (#0B0A07) to match the app, or transparent | Kept as delivered |
| Where | `assets/badge-masters/<slot>.png` (Git LFS or shared drive) | `public/badges/<slot>.webp` |
| Names | `fitness-01-foundation` … `faith-09-cedar` (table below) | same |

- **Rights:** confirm commercial rights to every image (your own work, a commissioned artist with a licence, or an
  AI service whose terms allow commercial use).
- **Keep the masters:** the mobile files are made from them and can be re-exported at any size later.

## One look for all 27 (so the set is cohesive)

- **Identity:** keep the existing design. Same subjects, colours and rank progression as the owner's posters; this
  is a higher-resolution redraw, not a redesign.
- **Style:** premium fantasy achievement art.
  - Painterly but crisp, with fine detail visible at 100 % zoom (engraving, feather barbs, leaf veins, ember sparks).
  - No soft "AI blur", no text, no numbers, no frames, no rank badges or UI.
- **Composition (the app centres and frames the tile itself):**
  - Subject centred horizontally and vertically: the visual centre of mass within 2 % of the canvas centre.
  - Subject height **80–88 % of the canvas height** for every badge; rank 9 is not bigger than rank 1.
  - Keep **6 % clear** on the left and right and **4 %** top and bottom. Glow and sparks may extend into it; the
    subject's silhouette may not.
  - Laurels or wreath elements frame the subject symmetrically where the design has them.
- **Light:**
  - A soft key light from the upper left, consistent across the set.
  - Each category keeps its own accent glow: gold for Fitness, orange-red fire for Food, warm sunlit green-gold for
    Faith.
  - Glows fall off to the background colour well inside the canvas edge, so tiles don't show hard glow cut-offs.
- **Progression:** each category becomes visibly richer from rank 1 to 9 (material, glow, detail, drama), and rank 9
  is the most majestic.

## The 27 badges

### Fitness: strength and discipline (warrior shields with laurels; materials rise from wood to silver-white)

| Slot | Name | Subject |
|---|---|---|
| fitness-01-foundation | Foundation | Carved dark-wood hexagonal shield with bronze rivets; a green two-leaf sprout growing from soil at its centre; small green leafy vines either side. |
| fitness-02-faithful | Faithful | Bronze-gold Corinthian warrior helmet, front view, on a wooden shield with a bronze rim; golden laurel leaves; warm sparks. |
| fitness-03-endurance | Endurance | Blue-silver steel shield showing snow-capped mountain peaks; icy silver laurels; cool blue light. |
| fitness-04-disciplined | Disciplined | Golden roaring lion's head, front-facing, in a gold shield; flowing golden mane; golden laurels; warm light. |
| fitness-05-refined | Refined | Polished steel anvil with a blue flame rising from it, in an ice-blue crystal shield frame; blue crystal laurels. |
| fitness-06-steadfast | Steadfast | Brilliant faceted sapphire-blue diamond on a blue-violet shield; blue and purple crystal laurels; radiant light. |
| fitness-07-overcomer | Overcomer | Jewelled golden crown on a purple shield; violet light; purple laurels. |
| fitness-08-mighty | Mighty | Red-and-silver warrior helmet with a crest, on a crimson shield; red flame-like laurels. |
| fitness-09-conqueror | Conqueror | Silver-white shield with a white-silver cross; large silver-white feathered wings spreading to both sides; silver laurels; fine gold rim accents; soft white glow. **The cross is about 25–30 % smaller than in the original poster** (the app's current art already shows this size): its height about 55–60 % of the shield's inner height, centred, with clear space between it and the rim. Keep the wings fully visible. |

### Food: fuel and nourishment (fire that grows from a spark to a phoenix)

| Slot | Name | Subject |
|---|---|---|
| food-01-spark | Spark | A single bright starburst spark just above a small bed of dark coals. |
| food-02-ember | Ember | Glowing embers and coals with small flickering flames. |
| food-03-flame | Flame | A steady campfire flame rising from coals. |
| food-04-torch | Torch | A single carved torch held upright, with a bright flame. |
| food-05-blaze | Blaze | Crossed logs in a strong, tall blaze. |
| food-06-furnace | Furnace | A stone-arch furnace with fire roaring inside. |
| food-07-forge | Forge | A blacksmith's anvil before a forge fire, with showering sparks. |
| food-08-inferno | Inferno | A swirling vortex of intense fire. |
| food-09-phoenix | Phoenix | A majestic fiery phoenix rising, wings spread wide, trailing flame: the most dramatic badge in the set. |

### Faith: growth and fruitfulness (biblical tree imagery that matures)

| Slot | Name | Subject |
|---|---|---|
| faith-01-seed | Seed | A single seed resting on rich soil, softly lit. |
| faith-02-sprout | Sprout | A young two-leaf sprout rising from soil. |
| faith-03-sapling | Sapling | A small young tree with fresh leaves and visible roots. |
| faith-04-root | Root | A deep, glowing root system spreading underground beneath a small trunk. |
| faith-05-branch | Branch | A twisting trunk reaching out into leafy branches. |
| faith-06-vine | Vine | A grapevine with a twisting trunk and broad leaves. |
| faith-07-fruit | Fruit | A tree heavy with red fruit among green leaves. |
| faith-08-olive | Olive | An olive tree with silver-green leaves and green olives, warm light. |
| faith-09-cedar | Cedar | A majestic cedar of Lebanon on a rocky mountainside under a golden sky: complete, strong and peaceful. |

## Prompt template (for an image-generation service)

> Premium fantasy achievement badge illustration, **[subject from the table]**, centred, symmetrical composition,
> painterly yet crisp with fine detail, **[category accent: polished gold and metal / glowing orange-red fire /
> warm sunlit green-gold]**, soft key light from the upper left, deep near-black background (#0B0A07), no text,
> no numbers, no frame, wide 2:1 format, subject filling about 85 % of the height, clear margins at the sides.

- **Size:** generate at the service's highest native size in 2 : 1.
- **Upscaling:** if it can't produce 3840 × 1920 natively, upscaling must be done by the artist or service *as part
  of producing the master*, and the master must hold up at 100 % zoom. Never upscale the current poster crops.
- **Iterate per category:** settle rank 1 and rank 9 first, then fill in 2–8 so the progression is even.

## Acceptance checklist (per badge)

- [ ] 2 : 1, at least 1600 × 800 (target 3840 × 1920), sRGB.
- [ ] Sharp at 100 % zoom; no smeared or "plastic" areas. Edges stay crisp at 50 %.
- [ ] Subject centred (within 2 %), 80–88 % of the height, side margins respected; matches its neighbours' scale.
- [ ] Same subject, colours and identity as the poster version; Conqueror's cross is about 25–30 % smaller.
- [ ] No text, numbers, frames or watermarks.
- [ ] Commercial rights confirmed.
- [ ] `check_masters.py` reports PASS, or WARN with each warning reviewed at 100 % zoom.
- [ ] After `export-masters.py`:
  - [ ] `npx vitest run tests/unit/badge-artwork.test.ts` passes (2 : 1, sizes match, file size);
  - [ ] `e2e/rank-badges.spec.ts` passes at 320, 360, 375, 390 and 430 px;
  - [ ] the badge looks right on a real iPhone.
