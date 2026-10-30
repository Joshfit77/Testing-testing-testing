# The athlete look for the 2D exercise animations

The existing 2D animation engine (`src/lib/exercise-motion`) now has a second look for its figure: the black-and-gold
muscular athlete of the owner's reference image (`assets/exercise-demos-src/_character/character-reference.png`).
It draws the same skeleton as the classic gold figure, so every exercise keeps its movement; only the body and the
equipment around the bones change. No images or videos: shaped paths drawn on a canvas, about 1.2–2 ms a frame in a
software-rendered browser (phones draw canvases on the GPU).

## Status (2026-10-30): in review on three exercises

| | |
| --- | --- |
| Shown with the new look | Barbell Back Squat, Dumbbell Biceps Curl, Seated Cable Row (badge "New athlete look · awaiting approval", with a "Classic look" button to compare) |
| Everything else | The classic gold figure (unchanged, the fallback) |
| All 157 drawn in the new look | Yes, without errors (every frame of one loop each, headless Chromium); not yet reviewed one by one |
| Physical iPhone | Not tested |

**To approve it for the whole library:** set `ATHLETE_LOOK_FOR_ALL = true` in `src/lib/athlete-look.ts`. To withdraw it,
empty `ATHLETE_LOOK_PREVIEW`.

While the curl is in review, the 2D athlete takes the place of its 2.5D clip everywhere (the clip stays in the
manifest and comes back if the curl leaves the preview list); `scripts/exercise-demos/verify-curl.mjs` applies to the
clip, not to the preview.

## What changed

- **Figure** (`athlete.ts`): proportioned, muscular body with shaped deltoids, biceps / triceps, forearms, chest, abs,
  lats, glutes, quads, hamstrings and calves; gripping hands; a head with a face profile, ear and short dark hair; black
  shorts with the gold side stripe; black trainers with a gold midsole line. Dark charcoal skin lit from the front, one
  gold rim light around the whole body, thin gold anatomical lines, and the exercise's primary muscles glowing warm
  gold (secondary muscles softly), from the muscles listed for each exercise in `src/data/exercises.ts`.
- **Equipment** (`props-athlete.ts`): round black dumbbells with gold rims, iron plates and steel bar, rack with
  J-hooks, padded bench, cable tower with its weight stack and pulleys, the seated row's seat rail, footplate under the
  soles and V-handle. A side-view barbell is drawn as a cut-away (plate behind the athlete, bar end in the hands) so the
  plate never hides the lifter. Other equipment keeps its classic drawing.
- **Form fixes** (shared movements, both looks): back squat, elbows down under the bar with forearms near vertical;
  dumbbell curl, the upper arm moves 4° instead of 10° (elbows stay by the sides); seated cable row, a 9° lean at the reach
  and upright at the finish instead of rocking from 18° forward to 4° back.
- **Player** (`mount.ts`, every exercise): tap the picture to play or pause, drag sideways to move through the movement,
  a position bar, 1× / 0.5×, full screen (the device's own where it has one, otherwise the whole viewport), arrow keys
  and Space; the reviewed exercises also get the classic / new look switch.

## Checks

- `scripts/exercise-review/verify-athlete-look.mjs`: 39/39 in the real app at iPhone 15 size (Chromium with touch
  emulation): the three exercises play in the new look, tap / scrub / 0.5× / full screen / compare work, the library card
  and the workout screen use it, other exercises keep the classic figure, no page errors.
- Unit tests: `tests/unit/athlete-look.test.ts` (preview list, muscle glow for every muscle named in the catalog) and
  the motion definition tests (joint limits, floor contact) for all 157.
- `scripts/exercise-review/render-motion.mjs --style=athlete` renders any exercise frame by frame for review.
