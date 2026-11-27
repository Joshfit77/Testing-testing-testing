/**
 * Pose-frame model for the experimental form-analysis core.
 *
 * NOT OPERATIONAL. Nothing produces these frames yet: there is no camera capture and no pose
 * model in the app. A future on-device estimator (Apple Vision, ML Kit Pose or MediaPipe) would be
 * adapted to this shape. See docs/pro/FORM_ANALYSIS.md.
 *
 * Coordinate convention (adapters must convert to it):
 *   - 2D image coordinates, origin top-left, x to the right, y DOWN (larger y = lower in the image).
 *     Apple Vision uses a bottom-left origin, so its y must be flipped.
 *   - Both axes in the same unit (e.g. pixels). Normalised coordinates that are scaled separately
 *     by image width and height (MediaPipe, Vision) must be multiplied back by width/height,
 *     otherwise angles are distorted.
 *   - Confidence in [0, 1]. A keypoint the model did not detect is simply absent.
 */

export const KEYPOINT_NAMES = [
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
] as const;

export type KeypointName = (typeof KEYPOINT_NAMES)[number];

/** Body side; the analyzers assume a side-on camera and measure the side nearest the camera. */
export type Side = "left" | "right";

/** Joint names without the side prefix. */
export type Joint = "shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle";

export interface Point {
  x: number;
  y: number;
}

export interface Keypoint extends Point {
  /** Detector confidence in [0, 1]. */
  confidence: number;
}

export interface PoseFrame {
  /** Capture time in milliseconds. Must be strictly increasing across a recording. */
  timestampMs: number;
  /** Detected keypoints. Undetected keypoints are omitted. */
  keypoints: Partial<Record<KeypointName, Keypoint>>;
}

export type ExerciseId = "bodyweight_squat" | "goblet_squat" | "push_up";

/**
 * Quality of the INPUT data (tracking), not of the lift and not of the measurement's accuracy.
 * "adequate" only means none of the input checks tripped; it is not a claim that the numbers are
 * accurate, because no threshold here has been validated on real footage.
 */
export type ConfidenceLevel = "adequate" | "reduced" | "insufficient";

export type QualityReasonCode =
  | "too_few_frames"
  | "timestamps_not_increasing"
  | "low_frame_rate"
  | "missing_frames"
  | "low_keypoint_confidence"
  | "not_side_view"
  | "orientation_mismatch";

export interface QualityReason {
  code: QualityReasonCode;
  level: Exclude<ConfidenceLevel, "adequate">;
  /** Neutral, plain-language description of the input problem. */
  message: string;
}

export interface QualityMetrics {
  framesReceived: number;
  framesExpected: number;
  /** Median frame rate in frames per second, or null when it cannot be computed. */
  frameRateFps: number | null;
  /** Fraction of expected frames absent from the recording (timestamp gaps). */
  missingFrameFraction: number;
  /** Fraction of received frames where a required keypoint was absent or below the confidence floor. */
  lowConfidenceFrameFraction: number;
  /** Longest stretch without a usable frame, in seconds. */
  longestUsableGapSeconds: number;
  /** Median left/right separation of shoulders or hips divided by torso length; null if not measurable. */
  sideSeparationRatio: number | null;
  /** Median body-segment angle used for the orientation check, in degrees; null if not measurable. */
  orientationAngleDeg: number | null;
}

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  reasons: QualityReason[];
  metrics: QualityMetrics;
}

export interface Tempo {
  /** Seconds from leaving the top position to the bottom frame. */
  downSeconds: number;
  /** Seconds from the bottom frame back to the top position. */
  upSeconds: number;
}

export interface RepMeasurement<D> {
  /** 1-based rep number within the set. */
  rep: number;
  /** Indices into the input frames array. */
  startFrame: number;
  bottomFrame: number;
  endFrame: number;
  startMs: number;
  bottomMs: number;
  endMs: number;
  tempo: Tempo;
  /** Joint flexion travelled from the start position to the bottom, in degrees. */
  rangeOfMotionDeg: number;
  /**
   * Percentage difference between this rep's range of motion and the median of the earlier reps
   * in the same set (negative = smaller). Null for the first rep.
   */
  romVsEarlierRepsPercent: number | null;
  depth: D;
}

export type HipRelativeToKnee = "below" | "level" | "above";

export interface SquatDepth {
  /** Interior knee angle (hip-knee-ankle) at the bottom frame; 180 = straight leg. */
  kneeAngleAtBottomDeg: number;
  /**
   * Vertical hip-minus-knee offset at the bottom divided by thigh length.
   * Positive = hip lower than the knee in the image.
   */
  hipKneeOffsetRatio: number;
  hipRelativeToKnee: HipRelativeToKnee;
}

export interface PushUpDepth {
  /** Interior elbow angle (shoulder-elbow-wrist) at the bottom frame; 180 = straight arm. */
  elbowAngleAtBottomDeg: number;
  /** Whether the elbow angle reached the (unvalidated) reference angle. */
  reachedReferenceAngle: boolean;
  referenceAngleDeg: number;
}

export interface AnalysisResult<D> {
  exercise: ExerciseId;
  /** Always this literal: the output is experimental and unvalidated. */
  status: "experimental_unvalidated";
  confidence: ConfidenceAssessment;
  /** Body side that was measured, or null when no side could be measured. */
  side: Side | null;
  /** Number of counted reps; null when measurements are withheld (insufficient input). */
  repCount: number | null;
  reps: RepMeasurement<D>[];
  /** Movements that left the top position but did not reach the rep-counting threshold. */
  partialMovements: number;
  /** Movements cut off by the start or end of the recording; not counted. */
  incompleteMovements: number;
  /** Median tempo across counted reps; null when there are no reps or measurements are withheld. */
  medianTempo: Tempo | null;
  rangeOfMotion: {
    medianDeg: number;
    /** Percentage difference from a baseline the caller supplied from an earlier set; null if none. */
    vsBaselinePercent: number | null;
  } | null;
  /** Neutral, measurement-only sentences. Never a grade, never pain or injury advice. */
  observations: string[];
  disclaimer: string;
}

export interface AnalyzeOptions {
  /**
   * Median range of motion (degrees) from one of the member's earlier sets of the same exercise,
   * e.g. `result.rangeOfMotion.medianDeg` from a previous analysis.
   */
  baselineRangeOfMotionDeg?: number;
}
