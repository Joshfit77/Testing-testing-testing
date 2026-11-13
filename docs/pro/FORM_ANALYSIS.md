# Form analysis: design and limits (not operational)

Status: **not operational and not shipped.** A pure measurement core now exists for development (see
"Development status" below), tested only on synthetic data. There is no camera capture, no pose model, no UI and no
validation. This document is the plan, the reasons the feature is not built, and where development stands.

## What it would do

The member records a set with the phone camera. The app gives feedback on a small number of checks it can measure
reliably, for a few lifts only, and says plainly what it can't judge.

## Why it is not built yet

1. **Accuracy needs evidence.** Pose estimation (MediaPipe, Apple Vision) gives joint positions, not form quality. Each
   check (squat depth, knee travel, bar path, back angle) needs thresholds validated against lifts a qualified coach
   has rated. That dataset doesn't exist yet.
2. **Safety.** Wrong "good form" feedback on a heavy lift can cause injury. Shipping an unvalidated judge would break the
   rule not to present unverified functionality as verified.
3. **Device testing.** Camera angle, lighting, clothing and frame rate vary; this can only be tested on real phones.
4. **Privacy.** Video of members' bodies must stay on the device or be handled with explicit consent and retention rules.

## Proposed first version (when approved)

* On-device only (no video upload), via Apple Vision on iOS and ML Kit Pose on Android.
* Three lifts: bodyweight squat, goblet squat, push-up. Side view, phone at hip height.
* Measured, shown as numbers with a confidence level: depth (hip below or above knee), rep count, tempo, range of
  motion compared with the member's own earlier sets.
* No "good" or "bad" grade; no pain or injury advice. "If something hurts, stop."
* Labelled "Experimental" until a coach has reviewed results on at least 50 recorded sets per lift.

## What is needed from the owner

Approval to collect review footage (with consent) for validation, a coach to rate it, and a decision on Pro placement.

## Development status

Last updated: 2026-11-13. Feature flag `FORM_ANALYSIS_ENABLED = false` (`src/lib/form-analysis/index.ts`). Nothing
under `src/app` imports the module (a unit test checks this), so members cannot reach it.

### What exists

A device-independent, pure TypeScript measurement core in `src/lib/form-analysis/`, with no new dependencies and no
network access:

* `types.ts`: pose-frame model. Timestamped 2D keypoints with confidence for shoulders, elbows, wrists, hips, knees and
  ankles (both sides). Image coordinates, y down, same unit on both axes; adapters for Apple Vision / ML Kit / MediaPipe
  must convert to this.
* `geometry.ts`: joint angle, flexion, segment angle from vertical/horizontal, hip-vs-knee height ratio, median,
  time-based moving average.
* `quality.ts`: input-quality checks that set a confidence level (`adequate`, `reduced`, `insufficient`): keypoint
  confidence, dropped frames (timestamp gaps), longest stretch without a usable frame, frame rate, side view (left/right
  joint separation relative to torso length) and body orientation for the exercise. At `insufficient`, measurements are
  withheld (`repCount: null`, no reps) and the reason is stated. The level describes input quality only, never accuracy.
* `segmentation.ts`: rep segmentation on the smoothed knee (squat) or elbow (push-up) flexion signal, with hysteresis.
  Separates counted reps, partial movements (did not reach the counting threshold) and movements cut off by the start or
  end of the recording. Each rep has start, bottom and end frame indices.
* `squat.ts` (bodyweight and goblet squat) and `push-up.ts`: per rep, tempo (down/up seconds from timestamps), range of
  motion and its change against the median of the member's earlier reps in the set (and against an optional baseline
  from an earlier set), and depth: knee angle and hip above/level/below knee height for squats; elbow angle at the bottom
  for push-ups. Observations are neutral sentences ("Hips stayed above knee height at the bottom of reps 3–5."). There
  is no grade, no "good/bad", no pain or injury advice, and every result carries `status: "experimental_unvalidated"` and
  a disclaimer.
* `thresholds.ts`: every threshold is a named constant marked **UNVALIDATED PLACEHOLDER** (a test enforces the comment).
  They were chosen by reasoning about synthetic data, not measured.
* `tests/unit/form-analysis.test.ts` with `tests/unit/fixtures/pose-fixtures.ts`: a programmatic stick-figure generator
  (squat and push-up, configurable depth, tempo, noise, dropped frames, low-confidence frames, frame rate, front/side
  view, trimmed start/end) and tests for rep counting with noise and partial reps, depth classification, tempo, range of
  motion, confidence downgrade, neutral wording, the flag and the absence of `src/app` imports.

**Passing tests on synthetic data says nothing about accuracy on real people, real phones or real pose-model output.**
The generator produces idealised geometry and Gaussian jitter; real estimators have systematic errors (occlusion, loose
clothing, the far limb swapping sides, lens distortion, camera tilt) that none of these tests model.

### What does not exist

* Camera capture or video recording of any kind.
* An on-device pose model or the native bridges (Apple Vision on iOS, ML Kit Pose on Android) and the adapters that
  would convert their output to `PoseFrame`.
* Testing on real devices (angles, lighting, clothing, frame rates, thermal throttling).
* Validation against coach-rated footage. No threshold has been checked against a real lift.
* Any UI, Pro placement, consent flow, or retention rules for footage.

### Known limitations of the core

* 2D side view only. Out-of-plane movement (knees travelling inwards, rotation) is invisible to it.
* Hip and knee keypoints are joint-centre estimates, not the hip crease and top of the knee used by judged depth
  standards, so "below knee height" here is a keypoint measurement, not a depth ruling.
* The camera is assumed level; a tilted phone shifts the hip-vs-knee comparison.
* Tempo is measured from the joint angle leaving and returning to within a few degrees of the top position, so it reads
  slightly shorter than a stopwatch would.
* The goblet squat uses the bodyweight squat's measurements and thresholds unchanged.

### Next steps (in order, each needs owner approval where noted)

1. Owner approval to collect review footage with written consent and retention rules (on-device or explicitly
   consented storage only).
2. Native spike, not exposed to members: Apple Vision body pose (iOS) and ML Kit Pose (Android) in a debug-only build,
   with adapters to `PoseFrame` and unit tests for the coordinate conversion (Vision y-flip, normalised-to-pixel
   scaling).
3. Record at least 50 sets per lift (bodyweight squat, goblet squat, push-up) on several phones, side view, phone at hip
   height, across lighting and clothing; include deliberately shallow, partial and cut-off sets.
4. A qualified coach rates each set (rep count, depth per rep) blind to the app's output.
5. Compare the core's output with the ratings; re-derive every constant in `thresholds.ts` from that data, keep a
   held-out set, and record agreement rates per measurement in this document. Replace the "UNVALIDATED PLACEHOLDER"
   comments only for constants that have been validated.
6. Device testing: frame rate, battery and heat during a set; behaviour when the member leaves the frame.
7. Only then design a UI labelled "Experimental", with the wording rules above, and ask the owner to decide on Pro
   placement and whether to flip `FORM_ANALYSIS_ENABLED`.
