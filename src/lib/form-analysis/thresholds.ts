/**
 * Every number in this file is an UNVALIDATED PLACEHOLDER.
 *
 * They were chosen by reasoning about synthetic data, not measured against footage that a
 * qualified coach has rated. Per docs/pro/FORM_ANALYSIS.md, each must be re-derived from
 * coach-rated recordings (at least 50 sets per lift, filmed on real phones) before any of this is
 * shown to members. Do not tune them to make tests pass; tune them against real rated footage.
 */

// ---------------------------------------------------------------------------------------------
// Input quality (shared by all exercises). UNVALIDATED PLACEHOLDERS pending coach-rated footage.
// ---------------------------------------------------------------------------------------------

/** UNVALIDATED PLACEHOLDER. Keypoints below this detector confidence are treated as not seen. */
export const MIN_KEYPOINT_CONFIDENCE = 0.5;

/** UNVALIDATED PLACEHOLDER. Fewer usable frames than this and nothing is measured. */
export const MIN_USABLE_FRAMES = 15;

/** UNVALIDATED PLACEHOLDER. Below this frame rate, measurements are withheld. */
export const MIN_FRAME_RATE_FPS = 12;

/** UNVALIDATED PLACEHOLDER. Below this frame rate (but above the minimum), confidence is reduced. */
export const ADEQUATE_FRAME_RATE_FPS = 24;

/** UNVALIDATED PLACEHOLDER. A timestamp gap larger than this multiple of the median interval counts as dropped frames. */
export const DROPPED_FRAME_GAP_FACTOR = 1.5;

/** UNVALIDATED PLACEHOLDER. Fraction of expected frames missing above which confidence is reduced. */
export const MISSING_FRAMES_REDUCED_FRACTION = 0.05;

/** UNVALIDATED PLACEHOLDER. Fraction of expected frames missing above which measurements are withheld. */
export const MISSING_FRAMES_INSUFFICIENT_FRACTION = 0.25;

/** UNVALIDATED PLACEHOLDER. Fraction of low-confidence frames above which confidence is reduced. */
export const LOW_CONFIDENCE_REDUCED_FRACTION = 0.05;

/** UNVALIDATED PLACEHOLDER. Fraction of low-confidence frames above which measurements are withheld. */
export const LOW_CONFIDENCE_INSUFFICIENT_FRACTION = 0.25;

/** UNVALIDATED PLACEHOLDER. A stretch without usable frames longer than this (s) reduces confidence. */
export const USABLE_GAP_REDUCED_SECONDS = 0.25;

/** UNVALIDATED PLACEHOLDER. A stretch without usable frames longer than this (s) withholds measurements (a rep bottom could be hidden). */
export const USABLE_GAP_INSUFFICIENT_SECONDS = 0.5;

/**
 * UNVALIDATED PLACEHOLDER. Side-view check: median left-right separation of the shoulders (or
 * hips), divided by torso length. Side-on, both shoulders project close together; facing the
 * camera they are about a torso-length apart.
 */
export const SIDE_VIEW_MAX_SEPARATION_RATIO = 0.35;

/** UNVALIDATED PLACEHOLDER. Frames with both sides confidently visible needed before the side-view check is applied. */
export const SIDE_VIEW_MIN_FRAMES = 5;

// ---------------------------------------------------------------------------------------------
// Signal processing and rep segmentation. UNVALIDATED PLACEHOLDERS pending coach-rated footage.
// ---------------------------------------------------------------------------------------------

/** UNVALIDATED PLACEHOLDER. Width of the centred moving-average window applied to joint signals (s). */
export const SMOOTHING_WINDOW_SECONDS = 0.2;

/** UNVALIDATED PLACEHOLDER. Rep start/end are placed where flexion is within this many degrees of the top position. */
export const REP_BOUNDARY_TOLERANCE_DEG = 3;

/** UNVALIDATED PLACEHOLDER. Rep range of motion change (%) vs earlier reps that produces an observation. */
export const ROM_CHANGE_NOTE_PERCENT = 15;

/** UNVALIDATED PLACEHOLDER. Ratio of a rep's phase duration to the earlier-rep median that produces an observation. */
export const TEMPO_CHANGE_NOTE_RATIO = 1.5;

export interface SegmentationThresholds {
  /** Flexion at or below which the joint is in the top (start/finish) zone. */
  topZoneMaxFlexionDeg: number;
  /** Extra flexion beyond the top zone needed to register that a movement has started (hysteresis). */
  hysteresisMarginDeg: number;
  /** Peak flexion a movement must reach to count as a rep; shallower movements are "partial". */
  repMinFlexionDeg: number;
}

// ---------------------------------------------------------------------------------------------
// Squat (bodyweight and goblet). UNVALIDATED PLACEHOLDERS pending coach-rated footage.
// The goblet squat currently shares the bodyweight values; they may diverge after validation.
// ---------------------------------------------------------------------------------------------

/** UNVALIDATED PLACEHOLDER. Knee-flexion thresholds for squat rep segmentation (flexion = 180 - knee angle). */
export const SQUAT_SEGMENTATION: SegmentationThresholds = {
  topZoneMaxFlexionDeg: 25,
  hysteresisMarginDeg: 10,
  repMinFlexionDeg: 60,
};

/**
 * UNVALIDATED PLACEHOLDER. Hip and knee keypoints within this fraction of thigh length vertically
 * are reported as "level". Keypoint hip/knee centres are not the hip crease / top of knee used by
 * judged depth standards, so this is a measurement, not a depth ruling.
 */
export const SQUAT_HIP_KNEE_LEVEL_TOLERANCE = 0.05;

/** UNVALIDATED PLACEHOLDER. Median torso angle from vertical above which the footage is not treated as a squat. */
export const SQUAT_MAX_TORSO_FROM_VERTICAL_DEG = 55;

// ---------------------------------------------------------------------------------------------
// Push-up. UNVALIDATED PLACEHOLDERS pending coach-rated footage.
// ---------------------------------------------------------------------------------------------

/** UNVALIDATED PLACEHOLDER. Elbow-flexion thresholds for push-up rep segmentation (flexion = 180 - elbow angle). */
export const PUSH_UP_SEGMENTATION: SegmentationThresholds = {
  topZoneMaxFlexionDeg: 30,
  hysteresisMarginDeg: 10,
  repMinFlexionDeg: 55,
};

/** UNVALIDATED PLACEHOLDER. Reference elbow angle at the bottom used only to group reps in observations. */
export const PUSH_UP_REFERENCE_ELBOW_ANGLE_DEG = 90;

/** UNVALIDATED PLACEHOLDER. Median shoulder-hip line angle from horizontal above which the footage is not treated as a push-up. */
export const PUSH_UP_MAX_BODY_FROM_HORIZONTAL_DEG = 40;
