# Premium 2D exercise demonstrations (2026-11-10)

Owner direction: 2D only, permanently. No 3D models, now or later. This document covers the audit, the character, the
five priority exercises, the player and screens, the architecture, measured results, what still needs a physical
iPhone, and the plan for the rest of the library. Earlier history (the retired 3D system, the character's development)
is in [`EXERCISE_DEMOS_2D.md`](EXERCISE_DEMOS_2D.md).

Branch: `claude/premium-2d-exercise-animations`, built on the combined PR #9 + PR #10 tree (both open, not merged), so
it stays compatible with both. Not merged into `main`.

## 0. Rebuild of 2026-11-10 (owner review: "blurry, glossy, unnatural; squat awkward")

This section supersedes the look described in §2 and the squat in §3–§4. Scope was deliberately narrow: the shared
athlete, the barbell back squat, the bench press and the dumbbell curl. No exercise was added.

**What caused the softness (investigated, measured)**

| Cause | Before | Now |
|---|---|---|
| Shading and muscle highlights were radial gradients (about 60 soft "blobs" per figure) | soft, airbrushed, glossy | none: every mark is a hard-edged vector shape |
| Canvas pixel density capped at 2x (stepping down to 1.5x) on 3x iPhones | 718 px wide canvas for a 359 pt player | 1077 px (full 3x); steps down once to 2x only if frames run slow |
| Near plates drawn see-through over the lifter through a scratch canvas | murky iron over the head and arms | cutaway: crisp outline rings, nothing translucent |
| Plates had a radial sheen | glossy | flat iron with crisp rings |
| Preview videos sent for review were 640x480 at about 190 kbit/s | soft before the app was even involved | 1080x1080, 60 fps, CRF 12 |

**The athlete (src/lib/exercise-motion/athlete.ts, rewritten painting; same rig)**

- One rigged skeleton with fixed bone lengths (skeleton.ts); the figure is drawn from it every frame, so proportions and
  appearance are identical in every repetition. Deterministic: no video, no generated frames, no images.
- Flat base tone per body part inside a dark contour; one hard-edged shadow plane per segment (two-tone shading);
  ink lines on muscle borders (deltoid, biceps/triceps, pectoral, abdominals, serratus, quadriceps, calf).
- Lighter neutral skin on the black stage so anatomy reads; black shorts and shoes with gold trim; one thin gold rim line.
- Working muscles are flat fills in the muscle's place: gold for primary, steel blue for secondary (same colours as the
  on-screen key). No glow.
- Upper arm and forearm slimmed about 20% (they were wider than anatomy allows next to the torso).

**Back squat (rebuilt; `natural` option in patterns/lower.ts, used by the back squat only)**

| Check | Before | Now |
|---|---|---|
| Torso lean standing | 13° | 8° |
| Depth (hip joint relative to knee joint at the bottom) | level (parallel) | 1.8 cm below |
| Torso lean at the bottom | not re-measured | 33° |
| Bar path | within 3 cm of mid-foot at 3 keyed depths | within 1 cm of mid-foot, solved at 7 depths each way |
| Tempo | 2 s down, 1 s up, 3 keys, abrupt | 2 s down, 0.15 s pause, 1.4 s up, 0.6 s at the top, cosine-eased |
| Knees | linear with depth | travel forward early, then hold while the hips keep sinking |
| Elbows | directly under the bar (arm read as one block) | down and slightly back, forearm and upper arm read apart |
| Heels | down | down |

The squat's **front view was withdrawn**. At the bottom the thighs point at the camera and the flat figure squashes them;
it did not meet the standard of the side view, so the squat is side-only until that foreshortening is drawn properly.
The curl keeps Side and Front. The bench press keeps its side view (motion unchanged from the earlier fix: forearms
within 9° of vertical, J-shaped bar path) with the new athlete and flat equipment.

**Measured in the app (Chromium, iPhone 15 Pro emulation 393x852 at 3x, software rendering, production build)**

| Exercise | Canvas | Frames per second |
|---|---|---|
| Back squat | 1077 x 1122 px | 54 |
| Bench press | 1077 x 1122 px | 47 |
| Dumbbell curl | 1077 x 966 px | 60 |

These are from a sandbox without a GPU. The player now also watches the shown frame rate and drops to 2x if it stays
under about 48 fps. Frame rate on a physical iPhone is still unmeasured.

**Still open**: the squat front view; the other 154 exercises share the new athlete automatically but their movements
were not re-reviewed in this pass (the owner asked for squat, bench and curl first); real-device checks in §8.

## 1. Audit (before this work)

| Area | Finding |
| --- | --- |
| 3D code | **None left.** No `three` / WebGL dependency, no 3D module, page or model file. `tests/unit/exercise-demo-2d.test.ts` already guards this, and `/train/3d` redirects. Nothing to remove. |
| Animation system | One canvas engine, `src/lib/exercise-motion`. Keyframed joint-angle poses (side or front view, with foreshortening), monotone-cubic interpolation, a procedurally drawn athlete (`athlete.ts`), equipment (`props-athlete*.ts`), and a player (`mount.ts`) with play/pause, 0.5×, scrubbing, full screen and off-screen pause. No images or video: everything is drawn, so it works offline. |
| Exercise mapping | All 157 catalog exercises have a hand-made motion (`src/data/exercise-motions.ts`); none fall back to a pattern guess. Mapping is by verified slug. |
| Character | One consistent athlete across the library. Its graphite skin sat on a warm brown stage, so the silhouette barely separated from the background. |
| Muscle highlighting | Primary and secondary muscles used the **same** amber glow (secondary at 0.42 strength), so they could not be told apart. The page listed muscles as plain text, with no key to the colours. |
| Equipment | Barbell plates (45 cm) covered the head and forearms in the bench press and back squat. |
| Biomechanics (measured, see §4) | **Deadlift:** elbows bent 14° all the way through (a 0.5 cm reach shortfall); lockout still leaning 16° forward; hips high at the start. **Bench press:** forearms tilted up to 34° from vertical (elbows flared toward the feet), against the exercise's own cue "forearms vertical". Squat and curl were sound. |
| Views | One camera angle per exercise; no way to see stance, knee tracking or grip width for the squat, deadlift or curl. |
| Screen | The demonstration sat below the milestone and history cards, off the first screen. No replay control. |
| Performance | Drawing cost is pixel fill (gradients), about 15–17 ms per frame at 2.5× density in software rendering (§6). |

## 2. The character

The same athlete as before, refined rather than replaced, so all 157 exercises stay consistent:

- **Build:** muscular, adult proportions on a 180 cm skeleton with fixed limb lengths. Arm 63 cm, thigh and shin
  lengths constant in every exercise. Anatomical shading: deltoids, pecs, abdominals, quads and calves drawn as soft
  form, not outlines.
- **Look:** graphite skin, lifted slightly (`#2c2927` → `#3b3633`) so the form reads on the dark stage, with a gold rim
  light from behind; black shorts with a gold stripe; black trainers. No cartoon features, no stick figure.
- **Stage:** darker (`#080706` at the edges) with a soft warm pool of light behind the figure, so the athlete and its
  rim light stand out and the page's black frames it.
- **Muscle highlighting:** primary movers glow **gold** (`rgb(240,190,90)`); secondary (assisting and stabilising)
  muscles glow **steel blue** (`rgb(126,178,222)`). The glow is attached to the limb segments, so it moves with the
  athlete. One source for both colours: `src/lib/exercise-motion/muscle-colors.ts`, shared by the drawing and the
  on-screen key.

## 3. The five priority exercises

| Exercise | Views | What was wrong | What changed |
| --- | --- | --- | --- |
| Barbell Bench Press | Side | Forearms up to 34° off vertical (elbows drifting toward the feet); plates covering the face | Elbow placed under the bar every frame: forearms within 9° of vertical, upper arm flared out of the picture as far as it needs. 35 cm plates and lighter see-through near plates. J-shaped bar path kept: over the shoulders at lockout, lower chest at the touch. |
| Barbell Back Squat | Side + **Front** | Plates around the head | 35 cm plates; balance point at true mid-foot. Front view added: feet a little wider than the hips, knees tracking out over the toes, same depth and timing as the side view. |
| Conventional Deadlift | Side + **Front** | Bent elbows (14°), forward-leaning lockout (16°), hips high | Straight arms (4°), tall lockout (torso 3°, hips and knees extended, shoulders 9 cm behind the bar), start with shoulders just ahead of the bar (torso 63°, hips above the knees). Front view: hip-width stance, grip just outside the legs. All floor pulls (trap bar, deficit, block) share the fix. |
| Dumbbell Curl | Side + **Front** | — (sound) | Front view added: palms forward, upper arms still, both dumbbells curled to the shoulders. Biceps gold, forearms blue. |
| Medicine-Ball Scoop Toss | Front | — (sound) | Front only: the rotation reads best facing the camera. |

Tempo is unchanged and deliberate. Lifts take about 1 s concentric and 2 s eccentric with short holds; the deadlift
holds 0.5 s at the floor and at lockout. Every loop starts and ends on the same pose, so it repeats seamlessly. 0.5×
plays the same loop at half speed.

**Why a front view only for three of the five:** a front view of a lifter lying on a bench, or of a rotational toss,
teaches less than the side or front view already shown. "Where useful" was applied strictly.

## 4. Measured technique (the numbers behind §3)

From `tests/unit/premium-2d-demos.test.tsx` (96 frames per loop; cm of a 180 cm athlete):

| Check | Standard | Measured |
| --- | --- | --- |
| Deadlift elbows, whole lift | straight | < 6° every frame (4°) |
| Deadlift start | hips above knees, torso 55–67°, shoulders 1–8 cm ahead of the bar | hips +11 cm, 63°, +4 cm |
| Deadlift lockout | torso < 6°, hips < 12°, knees < 8°, shoulders behind the bar | 3°, 7°, 4°, −9 cm |
| Deadlift bar path | over mid-foot | within 4 cm every frame |
| Bench forearms | near vertical | < 12° every frame (max 9°) |
| Bench bar path | over shoulders at lockout, lower chest at the touch | ✓ |
| Squat bar | over mid-foot | within 3 cm every frame |
| Squat depth | hips to knee height | ✓ |
| Squat heels | down | within 1 cm |
| Curl elbows | by the sides; full range | drift < 6 cm; 6° → 140° |
| Front views | feet planted; same depth as the side view | soles move < 2.5 cm; pelvis height within 3 cm |

## 5. Player and screens

- **Exercise page:** the demonstration now leads, right under the title, before the milestone and history cards. The
  picture is taller on phones (5:6 instead of 4:3), so the athlete is larger.
- **Player controls,** each with a 44 px target: Play/Pause, **Replay** (back to the start, then plays), 1× / 0.5×,
  position scrubber, full screen.
- **Side / Front switch:** in its own strip above the picture (nothing covers the athlete). It appears only for
  exercises with a second view, and switching keeps the position in the rep.
- **Muscle key:** under "Target muscles". Primary muscles get a gold dot and secondary muscles a blue dot, matching the
  glow. It says plainly: "The highlight shows where the exercise mainly works; it is an illustration, not a measurement
  of muscle activity." The colour dots are hidden when the page shows a filmed or rendered clip instead of the athlete.
- **Workout (current-set card → Exercise info):** the same player, with the view switch, plus a new **Muscles** tab
  beside Setup / Execution / Mistakes. Opening, switching or closing it never touches the logged sets (tested, §7).
- The small demo dialog on the workout card loads the muscle key from the catalog only when it is opened.
- Unchanged: how-to steps, form cues and common mistakes on the page; the library, program and substitution flows use
  the same component.

## 6. Architecture

```
src/data/exercise-motions.ts       EXERCISE_MOTIONS[slug]       → main MotionDef (side or front), 157 exercises
                                   EXERCISE_MOTION_VIEWS[slug]  → extra views { front: builder } (3 exercises)
src/lib/exercise-motion/
  patterns/*.ts                    movement builders (squat, pull, bench, curl, throws…); keyframes from solvers
  patterns/front-views.ts          front views derived from the side solvers: same lean, pelvis and knee heights,
                                   same timing; legs solved in the frontal plane with planted-foot correction
  timeline.ts / skeleton.ts        interpolation, forward kinematics, IK, bounds
  athlete.ts + muscle-colors.ts    the character and the two-tier glow
  props-athlete*.ts                equipment (barbell plates, see-through near plates, dumbbells, bench, rack…)
  render.ts                        stage, camera fit, layer order
  mount.ts                         the player: controls, view switch, replay, scrubbing, full screen,
                                   off-screen / background pause, DPR cap with adaptive step-down
  index.ts                         getMotion, getMotionViews, mountExerciseMotion, drawExerciseStill
src/components/train/
  exercise-demo.tsx                React wrappers (page player, still, mini + dialog)
  exercise-info-dialog.tsx         workout dialog (with the Muscles tab)
  muscle-key.tsx                   the colour key
```

**Adding an exercise** is one entry in `EXERCISE_MOTIONS` built from a pattern with exercise-specific options (stance,
grip, range, tempo, equipment). Its muscles come from the catalog's `primary` / `secondary`, so the highlight and the key
follow automatically. Adding a front view is one entry in `EXERCISE_MOTION_VIEWS`.

**Rendering technology:** kept Canvas 2D. It already runs the whole library, needs no assets or network, and works
offline. A new framework (WebGL, Lottie, Rive) would add a dependency and asset pipeline without fixing what was wrong
(the motions and the look). Each frame is about 0.1 ms of maths; the rest is painting.

**Performance safeguards added:** the live player caps canvas density at 2× (soft-shaded art looks the same as at 3× on
a phone, at about 36% fewer pixels than the previous 2.5×). If the average draw still exceeds 12 ms, it steps down once
to 1.5× rather than dropping frames (`data-quality="reduced"`). Existing safeguards: the player pauses off-screen and
when the app is in the background, and reduced-motion users get a still frame.

Measured in Chromium at iPhone 15 Pro size (software rendering, no GPU), five seconds of playback per exercise:

| | fps (1× CPU) | slow frames > 33 ms | fps (CPU slowed 4×) | first play | JS heap |
| --- | --- | --- | --- | --- | --- |
| Before the DPR cap | 49–59 | up to 14 | 10–15 | 0.4–0.8 s | 7–10 MB |
| After | 57–60 | 0–3 | 14–18 | 0.4–0.8 s | 7–10 MB |

This browser paints canvas on the CPU, so the 4× numbers are pessimistic; iPhone web views paint canvas on the GPU.
**The real iPhone frame rate has not been measured** (§8).

## 7. Tests

| Suite | Result |
| --- | --- |
| Unit, all (`npm run test:unit`) | **3,524 passed** (186 files), including 23 new in `tests/unit/premium-2d-demos.test.tsx` |
| Existing motion and form tests (`tests/unit/exercise-*.test.ts*`, every catalog exercise: limb lengths, contacts, joint limits, framing) | 1,258 passed |
| Typecheck, lint, production build | pass |
| New browser test `e2e/premium-2d-demos.spec.ts` (production build) | **2 passed**: demo first; Side/Front keeps the rep position; Replay; muscle key; no switch for one-view exercises; back-navigation rebuilds and plays; offline view switch and replay with no requests from the player; workout Muscles tab; logged sets untouched |
| Related browser tests: `exercise-demo-2d`, `exercise-demo`, `current-set-card`, `workout-reliability`, `fast-logging`, `core-flow` | all passed (with the new spec: 12 passed, after one test fix: the offline check now ignores Next.js link prefetches) |

## 8. Needs a physical iPhone (not verified here)

1. Frame rate and battery during playback on an older supported iPhone (iOS 16 minimum) and a current one; whether the
   adaptive step-down ever triggers.
2. Look of the gold and blue glow on an OLED screen at full and low brightness; text and dot legibility in the muscle key.
3. Full screen in the iOS web view (falls back to filling the viewport; check the safe areas).
4. The scrub gesture versus page scrolling on a real touchscreen.
5. Playback pausing when the app goes to the background and resuming on return.

These belong in `docs/release/TESTFLIGHT_ACCEPTANCE.md` area 11 (and area 1 for the workout dialog) when it is run.

## 9. Remaining issues (honest)

- **Owner sign-off:** none of the 157 demonstrations, including these five, is marked owner-approved. These five are
  measured against coaching standards, not reviewed by a coach.
- **Plates in side views** remain realistic in size for the deadlift (they set the bar height) and still cover the
  shins at the start; that is how a deadlift looks from the side.
- **Front views** are a 2D projection: a thigh pointing straight at the camera at the bottom of a squat is very short on
  screen. It is correct, but less striking than a 3/4 view would be.
- **The muscle glow is regional,** not individual muscle heads (e.g. "triceps", not the long head).
- The other 152 exercises got the shared improvements (contrast, two-tier glow, taller frame, replay, DPR cap) and the
  floor-pull fixes, but not this measured review or extra views.

## 10. Roadmap for the full library

1. **Measured review, by how often programs use the exercise.** Write the same kind of biomechanics checks as §4 per
   pattern: hinge, squat, press, pull, carry, lunge, rotation, locomotion. Fix what fails; each fix lands in the shared
   pattern, so variants inherit it (as the deadlift fix did for all floor pulls).
   - Order: the next 20 most-programmed lifts (overhead press, Romanian deadlift, barbell row, pull-up, front squat, lunge,
     hip thrust, dumbbell bench and the rest), then accessories, then drills and mobility.
2. **Extra views where they teach something:** front views for the lunge, split squat, overhead press, lateral raise and
   the row family (back view); side views for front-view-only lifts that need a bar path.
3. **Owner / coach review sheet** for each batch, with the measured table, before marking an exercise approved
   (`src/data/exercise-demo-readiness.json`).
4. **Do not reuse a motion to raise coverage.** An exercise without a correct motion shows the labelled placeholder
   (already supported) until its own motion passes review.
5. **Device pass** (§8) after the first TestFlight build; tune the DPR cap and step-down threshold from real numbers.

## 11. Screenshots and previews

`docs/screenshots/premium-2d-2026-11-10/`:

- **In-app captures at iPhone 15 Pro size:** each priority exercise in side view; the squat, deadlift and curl in front
  view; the muscle key; the workout demo dialog.
- **Filmstrips:** `side-*-strip.webp` and `front-*-strip.webp`, eight evenly spaced moments of one loop.

To regenerate, run `node scripts/exercise-review/render-motion.mjs <slugs> --style=athlete [--view=front]`.

## 12. Library audit and corrections (2026-11-13)

All 218 exercises were audited from their frames and measured motion: see
[`animation/ANIMATION_AUDIT.md`](animation/ANIMATION_AUDIT.md) (and `animation/animation-audit.json`). The athlete's
look was not changed. Corrections were made in the shared patterns: one set of squat mechanics for every squat, a
densely keyed strict press whose head moves out of the bar's way, a pulldown with a straight bar path in front of the
face, a bent-over rear-delt fly seen from the side, an *Above* view for the flat and incline dumbbell flyes
(`MotionDef.viewLabel` names a view in the switch), floor-contact fixes for the bridges and seated hip abduction, and
framing that keeps a side-view barbell's plates inside the picture. Regression checks:
`tests/unit/exercise-motion-biomechanics.test.ts`. The audit lists 64 exercises that still need review by a qualified
strength coach or physiotherapist.
