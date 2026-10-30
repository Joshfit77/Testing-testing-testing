# The athlete look for the 2D exercise animations

The existing 2D animation engine (`src/lib/exercise-motion`) now has a second look for its figure: the black-and-gold
muscular athlete of the owner's reference image (`assets/exercise-demos-src/_character/character-reference.png`).
It draws the same skeleton as the classic gold figure, so every exercise keeps its movement; only the body and the
equipment around the bones change. No images or videos: shaped paths drawn on a canvas, about 1.2–2 ms a frame in a
software-rendered browser (phones draw canvases on the GPU).

## Status (2026-10-30): in review on four exercises (second version of the figure)

| | |
| --- | --- |
| Shown with the new look | Barbell Back Squat, Dumbbell Biceps Curl, Seated Cable Row, Easy Zone 2 Run (badge "New athlete look · awaiting approval", with a "Classic look" button to compare) |
| Everything else | The classic gold figure (the fallback; its shading flicker is fixed too) |
| All 157 drawn in the new look | Yes, without errors (every frame of one loop each, headless Chromium); not yet reviewed one by one |
| Physical iPhone | Not tested |

**To approve it for the whole library:** set `ATHLETE_LOOK_FOR_ALL = true` in `src/lib/athlete-look.ts`. To withdraw it,
empty `ATHLETE_LOOK_PREVIEW`.

While the curl is in review, the 2D athlete takes the place of its 2.5D clip everywhere (the clip stays in the
manifest and comes back if the curl leaves the preview list); `scripts/exercise-demos/verify-curl.mjs` applies to the
clip, not to the preview.

## Why the first version flickered, and the fix

Measured, not guessed (60 fps, every frame of one loop of the squat, curl and run):

- **Root cause: a lit-side switch.** Each limb and the torso was shaded with a gradient whose light side was chosen by
  the sign of `dot(limb normal, light)`. When a limb turned through the light direction the sign flipped and the whole
  limb swapped from light to dark in one frame. Counted per loop: squat 8 flips, curl 4, run 4 (classic figure: 4 each).
  A probe at the middle of each limb measured jumps of 63-64 brightness levels on the squat's torso and forearms in a
  single frame.
- **Second cause: per-part edges.** Every body part had its own inner dark band and edge highlight; where parts overlap
  (shoulder over chest, thigh into shorts) those bands slid across each other as the body moved.
- **Fix (second version of `athlete.ts`):** each body region is one silhouette (the union of its parts), painted with a
  flat base colour and then soft light and shadow whose strength is a *continuous* function of how much the surface
  faces the light (no switch anywhere), plus one rim light for the whole body. The classic figure's `shade()` in
  `render.ts` had the same switch and now uses the same continuous rule.
- **Result** (largest one-frame brightness change of a 7×7-pixel patch following the body part): squat torso 53 → 1.5
  levels, squat forearm 56 → 2.5, run torso 14 → 6.6. Frames in which an unusually large patch of the figure changes at
  once ("pops"): squat 8 → 0, curl 0 → 0. The remaining large changes at a fixed probe point are a limb passing in front
  of another (a running leg crossing the other, the curling forearm folding over the upper arm), not shading.

## Second version of the figure

Darker graphite skin (not silver), a deltoid that is part of the arm's outline instead of a separate disc (the
"mechanical joint"), soft three-step depth halos instead of hard outlines, muscle bellies and grooves as soft light and
shade instead of drawn shapes, the gold rim light and amber glow on the trained muscles kept at a fixed strength.

## Motion changes (shared by both looks)

- Keyframes are joined by a time-scaled Hermite curve: speed carries smoothly from a slow phase into a fast one, and a
  keyframe with a pause has zero velocity, so the body eases into and out of the pause instead of snapping.
- Breathing: the chest rises and falls slightly (a whole number of breaths per loop), so held positions are not frozen.
- Follow-through: the head trails the torso by 0.07 s; a runner's forearms trail the upper arms by 0.05 s.
- Running arms: the elbow closes as the arm drives forward (hand up by the chest) and opens on the back swing (hand by
  the hip), 62-122°, instead of a fixed 88° that swung the forearm out in front like a punch.
- Running body path (jog gait: Easy Zone 2 Run, Running Intervals, Run-Walk Intervals): the body moves at an even
  speed on a smooth up-and-down path, lowest at mid-stance and airborne between steps (ballistic), and the support foot
  is held where it landed by leg IK. Before, the hips rose 9 cm while the foot was on the floor and dropped onto every
  step (about 25 g at touchdown); now 6.7 cm of vertical travel, peak 1.3 g, foot slide 1.6 → 0.00 cm a frame. The jog
  table lands with the knee 20° bent and the foot closer under the body (it landed at 14° far in front).

## What changed in the first version

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

- `scripts/exercise-review/verify-athlete-look.mjs`: 50/50 in the real app at iPhone 15 size (Chromium with touch
  emulation): the four exercises play in the new look, tap / scrub / 0.5× / full screen / compare work, the library card
  and the workout screen use it, other exercises keep the classic figure, no page errors.
- Unit tests: `tests/unit/athlete-look.test.ts` (preview list, muscle glow for every muscle named in the catalog) and
  the motion definition tests (joint limits, floor contact, seamless loop) for all 157.
- `scripts/exercise-review/render-motion.mjs --style=athlete` renders any exercise frame by frame for review.

## Known limitations

- It is a 2D side view drawn with vector shapes: a stylised, premium illustration, not a photographic or 3D-scanned
  person. The face is a profile with a closed-mouth expression and no eye detail at phone size.
- Only the four exercises above have been reviewed in this look; the other 153 draw without errors but have not been
  checked one by one.
- Running Intervals and Run-Walk Intervals show a sharper knee bend at each touchdown than the easy run (joint
  acceleration about 10°/frame² against 6); sprints keep their previous body path.
