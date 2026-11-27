# Agility, mobility and power demonstration fixes

## 2026-11-13: agility, sprint, plyometric, throw, carry and mobility pass (motion data)

Scope: the motion data in `src/lib/exercise-motion/patterns/{agility,floor,locomotion,throws-core-pulls,core}.ts` and
their mapping labels in `src/data/exercise-motions.ts`. The engine (skeleton, timeline, build, render, mount) and the
athlete drawing (`athlete.ts`, `athlete-next.ts`) are unchanged. Every change below was checked frame by frame on
filmstrips and 1x / 0.5x videos rendered with `scripts/exercise-review/render-motion.mjs --style=athlete`. Passing tests
and a clean render do not make an animation anatomically correct; the items under "Needs professional review" are open.

### 5-10-5 pro agility shuttle (`pro-agility-shuttle`) — was wrong, rebuilt

- **Before:** front view; the athlete shuffled sideways facing the camera the whole drill (a shuffle drill, not three
  sprints), turning nothing.
- **After:** side view (the camera in front of the drill, so the athlete runs across the picture), lines at -190, 0,
  190 cm (5 yards shortened to fit, `PRO_AGILITY_LINE`), cones beside each line. Sequence (6.2 s loop; from the first
  movement to crossing the middle line about 3.8 s, close to a fast real 5-10-5): three-point stance straddling the middle line, one hand on the floor; explosive start with a 40-55°
  forward lean; ~3 accelerating steps; braking with the feet landing ahead of the hips and the body sinking; the outside
  foot plants at the line with the other foot a long stride back, hips down to ~49 cm and the hand on the line;
  turn; 10-yard sprint; plant and touch; turn; sprint back through the middle line at speed (>2 m/s on the drawing's
  scale), easing off; fade out and back into the stance. Each run's speed rises as u^1.1 and falls as (1-u)^0.8, so it
  accelerates for most of the run and brakes hard into the plant. Feet are scripted as contacts: a planted foot never
  slides; a foot leaves the floor once the hips have passed it by 24 cm; the swing folds the heel up then drives the
  knee forward. Arms pump opposite the forward foot.
- **Turns:** a side-view figure cannot be drawn mid-turn, so each 180° turn is a brief fade (alpha 0 for ~0.07 s)
  while the athlete is low at the line; the legs and the touching arm blend between the two facings while faded so no
  joint snaps.
- **Tests:** `tests/unit/exercise-agility-drills.test.ts` › "5-10-5 pro agility shuttle" (lateral displacement, three
  lines, three-point start straddling the middle line with a hand down, exactly two direction changes at the outer lines
  during fades and facing the way it runs, hand on each outer line with hips < 56 cm, a foot at the line and the other
  > 45 cm back, sprint through the middle line > 200 cm/s with a forward lean, planted feet still).

### 90/90 hip switch (`90-90-hip-switch`) — was wrong, rebuilt

- **Before:** the feet slid round the mat between the two sides and the back foot floated up beside the chest.
- **After:** posed in 3D (front view from a raised camera, as before). Pelvis fixed on the mat; both ankles fixed wide
  in front (44 cm out, 44 cm forward of each hip). Each knee turns about its own hip-to-ankle line, so it keeps a ~90°
  bend throughout (80-100° checked in 3D), both knees lift and swing over together like windscreen wipers through
  knees-up, and lower onto the mat in the mirror image: one leg turned out (front), the other turned in (back). Hands
  on the mat behind, torso upright. 1.1 s hold each side, 1.6 s switch on a minimum-jerk path (32 samples).
- **Tests:** `tests/unit/exercise-mobility-drills.test.ts` (pelvis and both ankles still on the drawn frames, torso
  upright, both knees cross the picture together and the ends mirror; in 3D: bone lengths kept, both knees 80-100° at
  every sample, both knees on the mat at both ends, knees up in the middle).

### Acceleration sprint, flying sprint, bounding (`locomotion.ts` stride tables)

- **Acceleration sprint — before:** used the top-speed table under a 38° lean: the ankle landed 44 cm ahead of the hips
  on a nearly straight knee (overstriding). **After:** its own `ACCEL` table: touchdown under the hips (ankle 0.3 cm
  ahead) with the knee ahead of the ankle (shin angled forward), longer contact, full extension of the push leg.
- **Flying sprint — before:** late swing reached out on a near-straight knee, touchdown 44 cm ahead. **After:** the
  lower leg is pulled back down before contact; touchdown at 34 cm ahead on a ~31° knee.
- **Bounding — before:** the sprint stride, slightly scaled. **After:** its own `BOUND` table: short stiff contact, full
  push, a split held in the air (lead thigh > 55° forward, push leg trailing behind).
- **Sled push** shares the sprint table, so its touchdown moved slightly closer to the hips too (checked visually; it
  reads the same).
- **Tests:** `tests/unit/exercise-power-drills.test.ts` (touchdown distances, knee bend at touchdown, forward lean,
  bounding split).

### Medicine-ball scoop toss (`medicine-ball-scoop-toss`)

- **Before:** barely bent; the ball started at hip height. **After:** loads in a real squat with the hips back (chest
  leaning toward the viewer, `trunkD` 32°, pelvis 68 cm) and the ball beside the back knee (63 cm), then legs and hips
  drive and the ball is scooped up and across to release above chest height. Test: lowest ball < 70 cm with the hips
  down and back, release > 110 cm.

### Loaded carries at the sides (`farmers-carry`, `suitcase-carry`, `trap-bar-carry`, `strongman-farmers-walk`)

- **Before:** an ordinary walking stride (56 cm steps). **After:** shorter, quicker steps (47 cm, 1.04 s stride) as
  coached for heavy carries; the loaded arms stay straight. Test: step < 52 cm, elbow < 6°.

### Band pass-through (`band-pass-through`)

- **Before:** the band went up and stopped just past overhead, so it never passed through. **After:** front of the
  hips → overhead → on down behind the back to the lower back and back again, arms straight; the wide-grip arms are
  drawn foreshortened (upper arm and forearm) as they point out of the picture. Test: hands overhead, behind and below
  the shoulders by 25 cm, in front of the hips, elbows straight.

### Reviewed, left unchanged

Medicine-ball rotational throw, box jump, broad jump, trap-bar jump, pogo jumps, couch stretch, half-kneeling hip-flexor
stretch, thoracic open book, world's greatest stretch, and the core / conditioning drills in these pattern files
(contact sheets): no clear error at the level the 2D figure can show.

### Remaining concerns

- 5-10-5: in the real drill the athlete's chest faces the camera in the stance and at each line touch (a lateral plant);
  the side-view figure shows the stance and the touches in profile and hides each turn in a fade. Distances are
  shortened about 2.4x, so the strides are short for the sprint mechanics shown. The same hand (the near one) touches
  both lines in the drawing.
- 90/90: the drawing cannot turn the torso, so the chest stays square to the camera; many coaches cue turning the chest
  toward the front shin. The end positions put the front thigh straight out to the side and the back thigh straight
  forward relative to a square pelvis, which needs a lot of hip rotation; real athletes turn the pelvis toward the front
  leg.
- Bounding: the flight is low (the engine's running path limits the rise after push-off to 3 cm); the split reads, the
  height does not.
- Trap-bar jump: the flight is low and the plates cover much of the figure.

### Needs review by a qualified strength coach or physiotherapist

- 5-10-5 pro agility shuttle (start stance, plant mechanics, turn representation).
- 90/90 hip switch (hip rotation ranges in the end positions, pelvis and torso orientation).
- Acceleration and flying sprint stride tables (touchdown position, shin angle, swing mechanics).
- Bounding.
- Medicine-ball scoop toss load depth and trajectory.
