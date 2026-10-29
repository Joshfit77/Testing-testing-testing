# 3D anatomical exercise demonstrations

Status (2026-10-28): **experimental; not approved by the owner.** The app's exercise demonstrations are the animated
illustrations (`src/lib/exercise-motion`). The 3D figure performs **18 of the 157 exercises** with a motion of its own;
**one** of them (the kettlebell swing) is wired into the app on the branch `claude/3d-in-workout`, behind the
allowlist in `src/lib/anatomy3d/in-app.ts`, with the illustration kept as the fallback. The other 139 exercises have no
3D motion. The 143 proposed additional exercises in [EXERCISES_300.md](EXERCISES_300.md) do not exist in the app at
all. [LIBRARY_STATUS.md](LIBRARY_STATUS.md), generated from the code, says where every exercise stands (motion, bake,
automated QA, visual review, owner approval, PASS / FAIL / NOT TESTED); [QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md)
says what a pass means.

## The model

`public/anatomy/ecorche.glb` is the original Écorché file (github.com/Charleeh/ecorche, CC BY-SA 4.0; sha256
`9744d3df…326c`, checked by the preview page), loaded as it is: 634 parts, each bone, muscle and tendon its own mesh
with its own vertex colours. Additions, all at run time and all in the viewer (`src/lib/anatomy3d/model-viewer.ts`):

- an iris and a pupil painted on the blank corneas (`paintEyes`);
- a face: the head's skin surface from BodyParts3D, fitted to this skull, cut along the jaw (`public/anatomy/ecorche-face.*`,
  built by `scripts/anatomy/build-ecorche-face.mts`; the parts under it are hidden);
- the look: all dark gold in the app's gold (`goldAndBlack`; the owner's "keep him gold"); `?look=original` in the preview
  shows the file's own red and white.

[LICENSING_CHECK.md](LICENSING_CHECK.md) records the licence obligations (CC BY-SA 4.0 for the modified model, the
credit shown in the player). [ECORCHE_RAW.md](ECORCHE_RAW.md) describes the earlier rigged copy of the model
(`public/anatomy/athlete-raw.*`), kept for comparison only (`?mode=exercise` in the preview).

## How it moves

| Step | Where | What |
| --- | --- | --- |
| **Rig** | `scripts/anatomy/build-ecorche-rig.mts` → `public/anatomy/ecorche-rig.json`, `.bin` | 79 bones measured from the model's own skeleton (spine in four, clavicle and scapula per side, humerus, ulna and radius for pronation, fingers, feet) plus blend helpers at the shoulders, hips, knees and elbows. Skin weights per vertex of every part: bones rigid to one rig bone; muscles by distance to the bones they lie on, spread by bone heat (Baran & Popović 2007); muscles that span a joint far from its centre (lats, pectorals, teres, deltoid, infraspinatus, coracobrachialis, the deep hip rotators, the adductors) in a `LOOSE` set that is skinned linearly. |
| **Skinning** | `src/lib/anatomy3d/body/bind-model.ts`, `body/dqs.ts` | Dual-quaternion skinning in the shader for every part, linear for the `LOOSE` set; the same skinning on the CPU in the QA. |
| **Corrective shapes** | `body/correctives.ts`; `scripts/anatomy/build-ecorche-correctives.mts` → `public/anatomy/ecorche-correctives.json`, `.bin` | Pose-space corrections for the shoulders (lats, teres major) and hips (adductor magnus, longus, minimus): at sample poses from the exercises themselves the muscle is relaxed by delta mush only where its edges fold, the difference is taken back to the rest pose through the vertex's own skinning, reduced to four shapes per region and blended by the joint's turn (radial basis, exact at the samples, zero far from them). Added before skinning in the vertex shader and on the CPU in the QA; `?correctives=0` in the preview and `--no-correctives` in the QA show the skinning alone. |
| **Solver** | `src/lib/anatomy3d/body/solve.ts`, `body/skeleton.ts` | Poses the skeleton from goals (pelvis, trunk, head, each wrist and ankle with its orientation, elbow and knee poles, finger closure): analytic IK on the real bone geometry, hinges about measured axes, pronation by the radius within range, wrist and ankle limits, the scapula and clavicle following the arm, the trunk's bend shared over the spine, and a hip flexed past its range tilting the pelvis back instead (`pelvisForHips`). Reports what it could not meet. |
| **Motions** | `src/lib/anatomy3d/motion3d/specs.ts` (18 specs), `perform.ts`, `lift.ts`, `apparatus.ts` | A spec says what equipment the exercise uses and how (which handle each hand holds, with which grip, where the equipment is each frame) and anything the 2D motion cannot say (a turning trunk, a ball that leaves the hands). The body's goals come from the reviewed 2D motion lifted into 3D, or from the spec's own 3D keyframes. An exercise without a spec gets `FALLBACK` (hands free, no equipment): a placeholder, not a demonstration. |
| **Equipment** | `src/lib/anatomy3d/motion3d/apparatus.ts`, `equipment.ts` | Barbell, dumbbells, kettlebell, cable towers with handles and cables, rower (seat on its rail, handle on its chain), air bike (levers and cranks), sled, medicine ball, bench, rack (hidden in the app). |
| **Bakes** | `scripts/anatomy/bake-motions.mts` → `public/anatomy/bake/<slug>.ngb`, `index.json`; `motion3d/bake.ts` | Every spec'd exercise solved offline, frame by frame, and stored (NGB1: bones as Int16, equipment as Float32), so a phone interpolates between poses instead of solving (18–21 ms a frame on a desktop live). `bake-motions.mts [slug …]` re-bakes; a solver or spec change invalidates the bakes. |
| **Playback** | `src/lib/anatomy3d/motion3d/mover.ts`, `model-viewer.ts` (`mountModel`) | Plays the bake when there is one, solves live otherwise; the camera frames the whole rep or follows an exercise that travels. |
| **Muscle Glow** | `model-viewer.ts` (`muscleGlow`, `setGlow`), `muscle-ids.ts`, `muscle-map.ts`, `effort.ts` | Every part is labelled with its muscle region from its name (`regionOf`, `muscleId`, left and right apart). Each tick the exercise's primary and secondary muscles (`muscleTargets`, the same map as the app's muscle lists) are lit with the rep's effort curve (`effortCurve`: primary muscles brighter, secondary softer). A shader patch lights the parts whose id is glowing, on top of the gold look and the skinning; only a part's red muscle belly glows, its white tendon stays unlit. `setGlow(on)` switches it; `?glow=0` in the preview renders the movement without it; the in-app player has a Muscle Glow button. |

## In the app (branch `claude/3d-in-workout`)

| Piece | Where |
| --- | --- |
| Which exercises show the figure (one, the kettlebell swing, pending the owner's approval) | `src/lib/anatomy3d/in-app.ts` (`IN_APP_3D`, `has3dDemo`) |
| Loading the model, face, rig and bake from `/anatomy` and mounting the viewer; files kept once fetched | `src/lib/anatomy3d/app-player.ts` (`mountAppModel`) |
| Touch and mouse controls (one finger turns, pinch zooms, two fingers move along the body, wheel zooms) | `src/lib/anatomy3d/controls.ts` (`attachControls`; the preview uses the same) |
| The player: progress while loading, play/pause, 0.5× and 1×, front/side/rear, Muscle Glow, "Show the illustration"; the illustration while loading and when WebGL or the files are missing | `src/components/train/exercise-demo-3d.tsx` (`ExerciseDemo3D`) |
| Where it appears: the demonstration dialog on the workout screen's exercise card, and the exercise page | `src/components/train/exercise-demo.tsx` (`ExerciseDemoMini`), `src/app/(app)/train/exercises/[slug]/page.tsx` |
| Checks | `tests/unit/anatomy-in-app.test.ts`; `e2e/exercise-demo-3d.spec.ts` (software WebGL, `playwright.config.ts`) |

First load downloads about 21 MB (model 14.3 MB, rig 4.4 MB, face 2.7 MB, the bake under 0.2 MB); the browser's
HTTP cache and the page keep them afterwards. three.js and the viewer are in a chunk loaded only when a 3D
demonstration opens. Nothing has been measured on a physical phone yet.

## Checking a motion

```bash
npx tsx scripts/anatomy/bake-motions.mts [slug …]                                  # bake (all specs when none given)
npx tsx scripts/anatomy/qa/check-motion.mts --samples 24 --baked --out <dir> <slug> …   # automated checks (table + json)
OUT=<dir> bash scripts/anatomy/preview/build.sh                                     # the preview page (index.html, artifact.html)
CHROMIUM_PATH=… SECOND_VIEW=1 node scripts/anatomy/preview/render-videos.mjs <dir> <videos> [slug …]   # two reps, two angles
node scripts/anatomy/preview/review-stills.mjs <dir> <out> <slug> …; python3 scripts/anatomy/preview/sheet.py <out> <slug>
npx tsx scripts/anatomy/library-status.mts --qa <qa logs dir>                        # regenerates LIBRARY_STATUS.md
```

The preview page shows one exercise at a time (`?ex=<slug>`, or `#<slug>` where a query cannot be given; a picker lists
the exercises with a 3D motion); `?live=1` solves every frame instead of playing the bake; `?rig=old` shows the first
rig. The automated checks (`check-motion.mts`: contacts, joint limits, pops and the loop seam, stretch and collapse
per part, collisions, missing equipment) are necessary, not sufficient: the visual review in the checklist decides, and
the owner's approval is recorded in `docs/anatomy3d/review.json`, which `library-status.mts` reads.

## Known failures (see LIBRARY_STATUS.md for the current list)

- **Overhead shoulder**: the push press folded at the armpit at lockout (teres major and lats stretched past 2%). The
  corrective shapes (`body/correctives.ts`, built by `scripts/anatomy/build-ecorche-correctives.mts` from the
  exercises' own poses: the lats and teres major relaxed where their edges fold, blended by the joint's turn) bring the
  push press under the limit. The overhead triceps extension (arm straight up, elbow bent behind the head) is beyond
  them: the teres major is stretched between its attachments and no relaxation shortens it, the teres minor collapses,
  and the wrists are held at their limit; the correction is pinned to zero at those poses so it does not make them
  worse. It stays a FAIL.
- **Deep hip flexion**: the hip limit, the pelvis tilt and the hip corrective shapes (adductor magnus, longus,
  minimus) brought the adductors under the limit at the rowing catch and the sumo pull; the gracilis still stretches
  and pulls away from the thigh (relaxing it made it worse, so it keeps its skinning). Rowing stays a FAIL.
- Everything else that fails or is unchecked is listed per exercise in LIBRARY_STATUS.md with the measured reason.

## Rebuilding the files

Needs the Écorché file (checked in as `public/anatomy/ecorche.glb`) and, for the face, the BodyParts3D STL folder
(not checked in; `git clone --filter=blob:none https://github.com/Kevin-Mattheus-Moerman/BodyParts3D`).

```bash
npx tsx scripts/anatomy/build-ecorche-rig.mts                                      # ecorche-rig.json / .bin
npx tsx scripts/anatomy/build-ecorche-face.mts <BodyParts3D_data>                  # ecorche-face.json / .bin
npx tsx scripts/anatomy/bake-motions.mts                                           # every bake
npx tsx scripts/anatomy/build-ecorche-correctives.mts                              # ecorche-correctives.json / .bin
```

`public/anatomy/ecorche-skin.*` (the first rig's weights, `build-ecorche-skin.mts`) and `athlete-raw.*` are kept for
the preview's comparison modes only; the app does not load them.
