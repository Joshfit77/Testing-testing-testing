# Form analysis: design and limits (not built)

Status: **not built and not shipped.** This is the plan and the reasons it was not built in this round.

## What it would do

The member records a set with the phone camera. The app gives feedback on a small number of checks it can measure
reliably, for a few lifts only, and says plainly what it can't judge.

## Why it was not built now

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
