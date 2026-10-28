# Exercise demonstration quality checklist

Every exercise on the anatomical rig is checked against this list before it can be called passing. Part of it is
automated (`scripts/anatomy/qa/check-motion.mts`); the rest needs a person looking at the review stills and the video.
An exercise passes only when **every** line passes. An animation that runs without errors is not a pass.

Run the automated part:

```
npx tsx scripts/anatomy/qa/check-motion.mts --samples 24 --baked --out <dir> <slug> ...
```

Render the stills and the video for the visual part:

```
bash scripts/anatomy/preview/build.sh
node scripts/anatomy/preview/review-stills.mjs .anatomy-preview <dir> <slug> ...      # 4 moments × front, side, rear
python3 scripts/anatomy/preview/sheet.py <dir> <slug>                                  # contact sheet
SECOND_VIEW=1 node scripts/anatomy/preview/render-videos.mjs .anatomy-preview <dir> <slug> ...
```

The four moments are the start, the quarter, the half and the three-quarter points of the rep. For most exercises
these fall on the start, the midpoint, the end range (deepest flexion or fullest extension) and the return. Where they
do not, the reviewer also looks at the end range in the video.

## 1. Anatomical deformation

| Check | How | Pass |
| --- | --- | --- |
| No spikes, tears or flaps | Automated: share of each muscle's edges that more than double and grow by over 1 cm | Under 2% for every part |
| No collapsed muscles | Automated: share of edges that shrink below a third and by over 1 cm | Under 2% for every part |
| No floating or detached parts | Automated: parts with no other anatomy within ~3 cm of most of their surface | None |
| Muscles stretch evenly, not in one band | Visual, at the end range | No visible band, wing or sheet |
| Shoulders overhead, hips in deep flexion | Visual, close-up at the end range | No flaps at the armpits, no ballooning glutes |

## 2. Hands and grip

| Check | How | Pass |
| --- | --- | --- |
| Hand on its handle all through the rep | Automated: distance from the centre of the grip to the handle's axis | Under 2 cm at every sample |
| Hand turned as the grip requires | Automated: angle between the hand and its grip orientation | Under 25° |
| Grip type right (overhand, underhand, neutral, mixed, palms on a ball) | Visual | As the exercise is coached |
| Fingers wrap the handle, not through it | Automated (equipment-in-body check) and visual | No fingers inside the handle or the plates |
| Forearm and wrist within their range | Automated: joint limits held | No joint held more than 10° past its range |

## 3. Equipment

| Check | How | Pass |
| --- | --- | --- |
| Every piece the exercise uses is there | Automated: the motion's apparatus against the 3D scene | Nothing missing |
| Handles, cables, chains and attachments are drawn | Visual | Every one visible |
| Moving parts move (rower seat and handle, bike levers and cranks, cable to the pulley) | Visual, in the video | Linked and in step with the body |
| Nothing floating, nothing out of place (a bar level, a sled on the floor) | Visual | As in a gym |

## 4. Collisions

| Check | How | Pass |
| --- | --- | --- |
| Equipment does not pass through the body | Automated: depth of the body inside each solid (holding hands excepted) | Under 1.5 cm |
| Body not below the floor | Automated | Under 1.5 cm |
| Planted feet stay on the floor | Automated | Within 2 cm |

## 5. Joint mechanics

| Check | How | Pass |
| --- | --- | --- |
| Elbows and knees bend only about their hinges | Unit test (`tests/unit/anatomy-rig.test.ts`) | Always |
| Bones keep their length | Unit test | Always |
| Shoulder blade moves with the arm (rotates, tilts, stays on the ribs) | Visual, rear view at the end range | No winging |
| Movement reads as the exercise | Visual, by someone who knows the exercise | Yes |
| Genuinely three-dimensional where the exercise is (rotation, multi-plane, equipment-driven) | Visual, from the second angle in the video | Yes |

## 6. Camera views

| Check | How | Pass |
| --- | --- | --- |
| Front, side and rear each show the figure | Review stills pick the side no wall or stack hides | Figure visible in every view |
| Nothing is hidden by the camera angle | Visual | Every view inspected, none skipped |

## 7. Looping

| Check | How | Pass |
| --- | --- | --- |
| No pops within the rep | Automated: any bone's turn between samples that does not spread out when sampled eight times finer | None over 8° |
| No jump where the loop wraps | Automated: seam check; the bake settles its loops before recording | None over 6° |

## 8. Mobile performance

| Check | How | Pass |
| --- | --- | --- |
| Played from a bake, not solved live | The exercise has `public/anatomy/bake/<slug>.ngb` | Present and current |
| Baked playback matches the solve | Automated (`--baked`): hand and equipment between frames | Within 1 cm |
| Playback cost | Measured on a desktop (`playBaked`) | Under 2 ms a frame |
| On a phone | Has to be measured on real hardware | Not yet measured: no physical device has run it |

## Recording a result

For each exercise, record the automated output, the contact sheet, the video and the visual verdict line by line. Use
"pass", "fail" with what fails, or "not checked". Never mark a line passing that was not looked at.
