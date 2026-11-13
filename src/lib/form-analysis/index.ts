/**
 * Form analysis: device-independent measurement core. NOT OPERATIONAL.
 *
 * This module turns a time series of 2D pose keypoints into rep counts, depth, tempo and range of
 * motion, with an input-quality confidence level. Nothing in the app produces pose frames yet (no
 * camera capture, no pose model), every threshold is an unvalidated placeholder, and the only tests
 * run on synthetic data. Do not wire this into any member-facing screen. See
 * docs/pro/FORM_ANALYSIS.md ("Development status").
 */

/**
 * Feature flag. Must stay false until: an on-device pose estimator is integrated, the thresholds are
 * validated against coach-rated footage (at least 50 sets per lift), device testing is done, and the
 * owner approves. Nothing under src/app imports this module; flipping the flag alone exposes nothing.
 */
export const FORM_ANALYSIS_ENABLED = false;

export { analyzeBodyweightSquat, analyzeGobletSquat, classifyHipRelativeToKnee } from "./squat";
export { analyzePushUp } from "./push-up";
export { assessQuality, chooseSide } from "./quality";
export { segmentReps } from "./segmentation";
export {
  angleFromHorizontalDeg,
  angleFromVerticalDeg,
  distance,
  flexionDeg,
  hipBelowKneeRatio,
  jointAngleDeg,
  keypointName,
  median,
  midpoint,
  smoothByTime,
} from "./geometry";
export { DISCLAIMER, formatRepList } from "./observations";
export * from "./thresholds";
export * from "./types";
