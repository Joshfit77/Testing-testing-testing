# Exercise demonstration review

A full visual review of the animated exercise figures: every catalog exercise, six phases of its loop
(start, early, middle, deepest/peak, return, end), all with the same camera.

| | Count |
|---|---|
| Exercises inspected | **157** (the whole catalog; each has a hand-made motion) |
| Corrected | **13** |
| Correct as drawn, no change | 144 |
| Flagged for review by a qualified coach (not changed, or limited by the drawing style) | 6 |

The other 144 exercises render pixel-identical before and after these changes. The engine changes are additive, so
nothing else moved.

Before/after sheets of the corrected exercises: [before-after-1.jpg](before-after-1.jpg) and
[before-after-2.jpg](before-after-2.jpg).

## How to reproduce

```sh
node scripts/exercise-review/contact-sheets.mjs out/sheets             # whole catalog, 8 exercises per sheet
node scripts/exercise-review/contact-sheets.mjs out/zoom --w=330 --per=4 --only=sumo-deadlift,pull-up
```

This needs the bundled Chromium from Playwright. Tests can't judge how a pose looks, so the sheets are there for a
person to inspect. `tests/unit/exercise-form.test.ts` then locks in each correction.

## Corrected (13)

Ordered by risk: the first ones taught the wrong movement or showed impossible contact.

| Exercise | What was wrong | Now |
|---|---|---|
| Sumo Deadlift | Side view almost identical to the conventional deadlift. | **Front view**: feet more than twice shoulder width apart, toes out, knees pushed out over the toes, hands inside the knees at shoulder width, plates outside the feet. The torso is more upright than the conventional pull (≈54° vs ≈68° from upright at the floor) and the hips and shoulders rise together. |
| Sit-to-Stand (Chair Squat) | Never reached the chair: it hovered 12 cm above the seat with the torso near horizontal, like a hinge. | Sits back until it touches the seat, torso ≈24° from upright. Then "nose over toes" to ≈42°, and stands. |
| Barbell Box Squat | Stopped 5.5 cm above the box. | Sits back onto the box (contact within 1.5 cm), then drives up. |
| Child's Pose | The body floated; knees and shins were off the floor and the torso pitched past horizontal. | Knees, shins, forehead and hands are on the floor, with the hips back on the heels. |
| World's Greatest Stretch | The "hand on the floor" stopped 19 cm above it, and the reaching arm pointed forward instead of up. | Torso low over the front thigh. One hand flat inside the front foot, the inside elbow drops toward the instep, then the arm points at the ceiling. |
| Atlas Stone Load | The platform was 70 cm away, so the stone travelled at arm's length (not possible with a heavy stone). | Stone starts between the feet. It is lapped, hugged high on the chest, then rolled onto a platform just past the toes. |
| Sandbag Load to Platform | Same as the atlas stone. | Same correction. |
| Sandbag to Shoulder | The bag sat on top of the head. | The bag rests on the shoulder and is drawn behind the head, with both hands steadying it. |
| Pull-Up | The chin never cleared the bar, and an angle-blend swing made the rep look like a kip. | Chin clearly over the bar at the top. The elbows follow their real path, so the body rises and lowers without swinging. |
| Chin-Up | Same as the pull-up. | Same, with the elbows travelling in front (underhand grip). |
| Band-Assisted Pull-Up | Same as the pull-up. | Same. |
| Leg Press | The back pad was hidden inside the torso, so the lifter looked unsupported, and the rail ran under the seat. | The back pad lies along the lifter's back and the rail sits under the sled, in front of the seat. |
| Barbell Hip Thrust | At the top the head tipped back in line with the torso. | Chin stays tucked with the eyes forward (the usual coaching cue). |

Engine changes these needed (all additive):

- a `trunkD` pose field (a torso leaning toward the camera in the front view);
- a front-view barbell;
- a per-keyframe drawing layer for equipment (for the sandbag behind the head);
- an explicit back-pad angle for the leg press.

## Flagged for a qualified coach (6)

These are not wrong enough to change without a professional's judgement, or the stylised 2D figure limits what can be
shown.

1. **Thoracic Open Book**: drawn from above (side-lying, knees stacked). At a glance it can read as a quadruped
   drill. The label says "View from above", but a coach may prefer a different camera.
2. **Conventional Deadlift**: the start torso is ≈68° from upright (fairly hip-high). That follows from this figure's
   arm, torso and thigh lengths with the bar over mid-foot. It is within the normal range, but on the flatter side.
3. **Sumo Deadlift (corrected)**: ≈54° from upright at the floor, for the same proportions reason. A coach may want it
   more upright.
4. **Barbell Front Squat**: in the side view the plates hide the face and the high elbows. The torso angle is right
   (≈18° at depth vs ≈36° for the back squat), but the rack position itself can't be seen.
5. **Pull-Up vs Chin-Up**: grip direction can't be shown on this figure (there are no hands with fingers). The
   difference is shown through the elbow path and named in the label.
6. **Parallel Bar Dip**: the bars are drawn as a simple frame. Depth (upper arm about level) and forward lean look
   right, but shoulder position at the bottom deserves a coach's look for people with shoulder history.

## What the instructions say

All 157 exercises have specific step-by-step instructions, cues and common mistakes. None are generic placeholders.
The only repeated lines are short closing steps such as "Return slowly." The corrected animations were checked
against their instructions. For example, the chair squat's "lightly touch the seat… lean slightly forward and stand"
is why the seat-off lean is ≈42°, not a deep hinge.

## Regression tests (`tests/unit/exercise-form.test.ts`)

- **Contact with equipment and the floor:** chair and box contact; child's pose floor contact; the floor hand in the
  world's greatest stretch; platform distance and holding the object close; the sandbag on the shoulder; chin over the
  bar and no swing; leg-press back pad; hip-thrust bench and chin.
  All 13 of these fail on the previous code and pass now.
- **Variations stay distinct:**
  - sumo is a wide-stance front view, conventional is a side view;
  - incline vs flat press angle;
  - front squat more upright than back squat;
  - Bulgarian rear foot stays on the bench;
  - the kettlebell swing is a hinge (knees < 40°), not a squat;
  - RDL soft knees vs conventional bent knees.
- **Every exercise:** limbs never stretch beyond their real length; the figure fills at least 55% of a 4:3 frame; the
  accessible label names the camera view.

These are stylised illustrations of technique. They are not a substitute for coaching, and they make no claim that
any form is safe for a particular person.
