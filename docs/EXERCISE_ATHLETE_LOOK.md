# The athlete look for the 2D exercise animations

The existing 2D animation engine (`src/lib/exercise-motion`) has a second look for its figure: the black-and-gold
muscular athlete of the owner's reference image (`assets/exercise-demos-src/_character/character-reference.png`).
It draws the same skeleton as the classic gold figure, so every exercise keeps its movement; only the body and the
equipment around the bones change. No images or videos: shaped paths drawn on a canvas, about 1.2–2 ms a frame in a
software-rendered browser (phones draw canvases on the GPU).

## Status (2026-11-01): third version, in review on five exercises

| | |
| --- | --- |
| Shown with the new look | Barbell Back Squat, Dumbbell Biceps Curl, Seated Cable Row, Easy Zone 2 Run, Running Intervals (badge "New athlete look · awaiting approval", with a "Classic look" button to compare) |
| Everything else | The classic gold figure (the fallback, unchanged as a look) |
| `ATHLETE_LOOK_FOR_ALL` | `false`: not switched on for the library (owner's decision) |
| All 157 drawn in the new look | Yes, every frame of one loop each, headless Chromium; frame-stability audit below |
| Physical iPhone | Not tested |

**To approve it for the whole library:** set `ATHLETE_LOOK_FOR_ALL = true` in `src/lib/athlete-look.ts`. To withdraw it,
empty `ATHLETE_LOOK_PREVIEW`.

## Third version (this round)

### One camera for the body and the equipment

The figure is seen from 15° off the side (`CAMERA_YAW` in `skeleton.ts`). Each point is shifted sideways by its depth
(`yawShift`): the near arm and leg slightly one way, the far ones the other, and every piece of equipment held in the
hands by the same rule (`propShift`). The motion data, the classic look and the front-view exercises are unchanged.
Nothing is drawn at an angle the body is not also drawn at.

### The bar on the back squat (back, pause and tempo squat)

Version 2 drew the bar obliquely so that it seemed to reach the hands (rejected: an unrealistic angle used to fake the
grip). Now the bar sits across the upper back at the traps and is drawn in the same 15° camera as the body
(`barAcross` in `props-athlete.ts`): the near half and its two plates in front of the shoulder, the far half and its
plates behind the head, smaller and in shadow. Both hands are on the bar through the whole repetition (inverse
kinematics to the bar, elbows below and behind it), checked frame by frame in `exercise-motion-quality.test.ts`. The
same drawing is used by all 21 side-view barbell exercises; front-view barbells have their own (`barFront`).

### Anatomy

Fuller rounded deltoids with an insertion groove, thicker biceps (the belly grows as the elbow bends) and triceps
(flattens), forearms with the brachioradialis and flexor mass, wider lats and V-taper, traps, pecs with a lower border,
three rows of abdominals, serratus and obliques, quads with the vastus medialis teardrop, hamstrings, glutes and calves
(gastrocnemius and soleus). Proportions are fixed: every bone keeps its length in every frame (tested). Shading is
graphite with a gold rim and amber glow on the trained muscles only, at fixed strength. The front view has a neutral
face and trainer-style shoes.

### Movement (shared by both looks, all 157)

- Keyframes are joined by a monotone cubic curve with time-scaled tangents: joints pass through mid-movement keyframes
  without stopping and never overshoot; "spline" keyframes (dense gait tables) keep Catmull-Rom tangents.
- Limb targets placed by inverse kinematics (`ikSpline`), the body's placement (`rootSpline`) and equipment moved by
  keyframes follow the same curve. In straight lines they started at full speed and stopped dead at each keyframe; a
  press arrived at lockout at speed and the elbow snapped straight.
- Soft reach (`SOFT_REACH` 0.99): a limb approaching full extension slows into it instead of locking in one frame.
- Flight (`air` keyframes, `flightPath` in `timeline.ts`): from the last supported keyframe to the first one after,
  the pelvis follows one smooth path that leaves at the push's real speed and lands at the speed the landing absorbs.
  Box, broad and trap-bar jumps, pogo hops, the burpee jump and lateral bounds have an accelerating push, a take-off
  keyframe and a touchdown keyframe.
- Running: jogs, sprints and bounding share the ballistic body path (lowest at mid-stance, airborne between steps) with
  the support foot held where it landed. Sprints used to drop about 20 cm onto each step and bounce off in one frame.
- Floor contact: a hand or foot dipping into the floor is corrected from the first hundredth of a centimetre (a 0.5 cm
  dead band made the whole body drop half a centimetre in one frame, e.g. child's pose).
- Equipment that changes drawing layer (the atlas stone from between the legs to the hug) dissolves between the two
  layers over about eight frames instead of switching in one; hugged objects are drawn in front of the torso and behind
  the near arm wrapped round them.
- Push press family, medicine-ball slam and scoop toss: no full-speed start after a pause and no dead stop at release
  or lockout; the wall drill switches legs over 0.12 s with the hands pinned to the wall.
- Kept from version 2: breathing, the head trailing the torso by 0.07 s, runners' arms.

## Checks

Tests (all in the normal unit run):

- `tests/unit/exercise-motions.test.ts`: joint limits for all 157 with no per-exercise exemptions. The old
  `allowLimits` switch is gone; out-of-plane arms are checked on their real 3D angles (`armAngles3D`: elbow flexion,
  shoulder elevation, how far the arm goes behind the body), so a foreshortened arm no longer needs widened ranges.
- `tests/unit/exercise-motion-quality.test.ts`, on the frames the player draws (60 fps):
  - no joint moves faster than 25° a frame (12° for lifts, mobility, core and stretches);
  - the body never changes speed abruptly (pelvis, 2.5 cm/frame², 0.75 for slow categories). On the previous commit
    this failed for 15 exercises (sprints 9.75, pogo 7.6, broad jump 6.9, lateral bound 6.5, trap-bar jump 6.2, box
    jump 5.5, bounding 5.5, burpee and sprawl about 4.7, the push presses 2.5);
  - equipment never covers or uncovers a limb in one frame (failed before for the atlas stone and both sandbag loads);
  - the loop closes without a jump; planted feet stay planted; runners' support foot does not slide and no foot goes
    below the floor (jogs, sprints, bounding);
  - a dumbbell, kettlebell, barbell or plate held in a hand stays in that hand;
  - back, pause and tempo squat: bar on the traps, both hands on the bar, elbows below and behind it, bar over the
    foot, depth and lockout reached;
  - dumbbell curl: upper arm still, full elbow range; every bone keeps its length.
- `tests/unit/athlete-look.test.ts`: the preview list and the muscle glow mapping.

Frame-stability audit (rendered, not tested in CI): every exercise drawn at 30 fps and compared frame to frame for
flashes, brightness jumps and highlight jumps. Version 3 before this round's fixes: 16 flagged. Now 10, all checked by
eye: box and broad jump (the deliberate fade between loops), shadowboxing and heavy bag (a punch), the wall drill (the
leg switch), sprawl, running intervals and band neck training (a few dozen gold outline pixels changing with the
motion), and the atlas stone and sandbag over the bar (the stone moving across the frame; its layer switch is now a
dissolve).

Scripts: `scripts/exercise-review/render-motion.mjs --style=athlete` renders any exercise (and an older checkout with
`--root`) for review; `scripts/exercise-review/verify-athlete-look.mjs` checks the preview in the real app at iPhone
size.

## History

- Version 1: first anatomical figure and equipment; shading flickered (a lit-side switch).
- Version 2: continuous shading (squat torso flicker 53 → 1.5 brightness levels), union silhouettes, the jog's
  ballistic body path, form fixes for the squat, curl and cable row, the player's tap / scrub / 0.5× / full screen.
- Version 3: this document.

## Known limitations

- A 2D drawing seen from one camera: a stylised, premium illustration, not a photographic or 3D-scanned person.
- The back squat is a side view only; there is no front view of it in the 2D engine.
- In the bench press the near plate sits close to the face, as it does from this camera.
- Front-view shoulders are still somewhat rounder than in the reference.
- The take-off of a jump has a quick trunk reversal (the trunk stops extending and starts folding for the tuck within
  a frame); the body's path through the air is smooth.
- Sprawl, burpee and the agility drills are at the edge of the body-speed limit (about 2.3–2.5 cm/frame²): hard
  changes of direction, but steeper than a real athlete's.
- Only the five exercises above are shown in the new look; the other 152 pass the automated checks and the
  frame-stability audit but have not each been approved by eye.
- Nothing has been tried on a physical iPhone.
