/**
 * Input-quality checks. These decide whether there is enough clean data to measure anything;
 * they say nothing about the lift itself. All limits come from thresholds.ts and are
 * UNVALIDATED PLACEHOLDERS.
 */
import {
  angleFromHorizontalDeg,
  angleFromVerticalDeg,
  confidentKeypoint,
  distance,
  median,
  round,
} from "./geometry";
import {
  ADEQUATE_FRAME_RATE_FPS,
  DROPPED_FRAME_GAP_FACTOR,
  LOW_CONFIDENCE_INSUFFICIENT_FRACTION,
  LOW_CONFIDENCE_REDUCED_FRACTION,
  MIN_FRAME_RATE_FPS,
  MIN_KEYPOINT_CONFIDENCE,
  MIN_USABLE_FRAMES,
  MISSING_FRAMES_INSUFFICIENT_FRACTION,
  MISSING_FRAMES_REDUCED_FRACTION,
  SIDE_VIEW_MAX_SEPARATION_RATIO,
  SIDE_VIEW_MIN_FRAMES,
  USABLE_GAP_INSUFFICIENT_SECONDS,
  USABLE_GAP_REDUCED_SECONDS,
} from "./thresholds";
import type {
  ConfidenceAssessment,
  ConfidenceLevel,
  Joint,
  PoseFrame,
  QualityMetrics,
  QualityReason,
  Side,
} from "./types";

export interface OrientationCheck {
  from: Joint;
  to: Joint;
  reference: "vertical" | "horizontal";
  maxDeg: number;
  /** e.g. "a squat filmed from the side" */
  description: string;
}

export interface QualityInput {
  frames: readonly PoseFrame[];
  requiredJoints: readonly Joint[];
  orientation: OrientationCheck;
}

export interface QualityOutput {
  assessment: ConfidenceAssessment;
  side: Side | null;
  /** usable[i] is true when frame i has every required joint on `side` above the confidence floor. */
  usable: boolean[];
}

const SIDES: readonly Side[] = ["left", "right"];
const LEVEL_RANK: Record<ConfidenceLevel, number> = { adequate: 0, reduced: 1, insufficient: 2 };

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function isUsable(frame: PoseFrame, side: Side, joints: readonly Joint[]): boolean {
  return joints.every((j) => confidentKeypoint(frame, side, j, MIN_KEYPOINT_CONFIDENCE) !== null);
}

/** Picks the side whose required joints are most consistently detected (the side facing the camera). */
export function chooseSide(frames: readonly PoseFrame[], joints: readonly Joint[]): Side | null {
  let best: Side | null = null;
  let bestScore = 0;
  for (const side of SIDES) {
    let score = 0;
    for (const frame of frames) {
      let minConf = 1;
      for (const j of joints) {
        const kp = confidentKeypoint(frame, side, j, 0);
        minConf = Math.min(minConf, kp ? kp.confidence : 0);
      }
      score += minConf;
    }
    if (score > bestScore) {
      best = side;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Left-right separation of shoulders (and hips) relative to torso length. Close to 0 when filmed
 * side-on; near or above 1 when the member faces the camera. Only frames where both sides are
 * confidently visible contribute: side-on, the far side is usually occluded, which is expected.
 */
function sideSeparationRatio(frames: readonly PoseFrame[], usable: readonly boolean[], side: Side): number | null {
  const pairs: Joint[] = ["shoulder", "hip"];
  const medians: number[] = [];
  for (const joint of pairs) {
    const ratios: number[] = [];
    frames.forEach((frame, i) => {
      if (!usable[i]) return;
      const l = confidentKeypoint(frame, "left", joint, MIN_KEYPOINT_CONFIDENCE);
      const r = confidentKeypoint(frame, "right", joint, MIN_KEYPOINT_CONFIDENCE);
      const s = confidentKeypoint(frame, side, "shoulder", MIN_KEYPOINT_CONFIDENCE);
      const h = confidentKeypoint(frame, side, "hip", MIN_KEYPOINT_CONFIDENCE);
      if (!l || !r || !s || !h) return;
      const torso = distance(s, h);
      if (torso > 0) ratios.push(distance(l, r) / torso);
    });
    if (ratios.length >= SIDE_VIEW_MIN_FRAMES) medians.push(median(ratios)!);
  }
  return medians.length ? Math.max(...medians) : null;
}

function orientationAngle(
  frames: readonly PoseFrame[],
  usable: readonly boolean[],
  side: Side,
  check: OrientationCheck,
): number | null {
  const angles: number[] = [];
  frames.forEach((frame, i) => {
    if (!usable[i]) return;
    const a = confidentKeypoint(frame, side, check.from, MIN_KEYPOINT_CONFIDENCE);
    const b = confidentKeypoint(frame, side, check.to, MIN_KEYPOINT_CONFIDENCE);
    if (!a || !b) return;
    const angle = check.reference === "vertical" ? angleFromVerticalDeg(a, b) : angleFromHorizontalDeg(a, b);
    if (angle !== null) angles.push(angle);
  });
  return median(angles);
}

export function assessQuality(input: QualityInput): QualityOutput {
  const { frames, requiredJoints, orientation } = input;
  const n = frames.length;
  const reasons: QualityReason[] = [];
  const metrics: QualityMetrics = {
    framesReceived: n,
    framesExpected: n,
    frameRateFps: null,
    missingFrameFraction: 0,
    lowConfidenceFrameFraction: 0,
    longestUsableGapSeconds: 0,
    sideSeparationRatio: null,
    orientationAngleDeg: null,
  };
  const finish = (side: Side | null, usable: boolean[]): QualityOutput => {
    const level = reasons.reduce<ConfidenceLevel>(
      (worst, r) => (LEVEL_RANK[r.level] > LEVEL_RANK[worst] ? r.level : worst),
      "adequate",
    );
    return { assessment: { level, reasons, metrics }, side, usable };
  };

  if (n < 2) {
    reasons.push({ code: "too_few_frames", level: "insufficient", message: `only ${n} frame(s) were received` });
    return finish(null, frames.map(() => false));
  }

  for (let i = 1; i < n; i++) {
    if (!(frames[i]!.timestampMs > frames[i - 1]!.timestampMs)) {
      reasons.push({
        code: "timestamps_not_increasing",
        level: "insufficient",
        message: "frame timestamps were not in increasing order",
      });
      return finish(null, frames.map(() => false));
    }
  }

  // Frame rate and dropped frames, from timestamps.
  const intervals: number[] = [];
  for (let i = 1; i < n; i++) intervals.push(frames[i]!.timestampMs - frames[i - 1]!.timestampMs);
  const medianInterval = median(intervals)!;
  const fps = 1000 / medianInterval;
  metrics.frameRateFps = round(fps, 1);
  let missing = 0;
  for (const dt of intervals) {
    if (dt > medianInterval * DROPPED_FRAME_GAP_FACTOR) missing += Math.round(dt / medianInterval) - 1;
  }
  metrics.framesExpected = n + missing;
  metrics.missingFrameFraction = round(missing / (n + missing), 3);

  // Keypoint confidence on the measured side.
  const side = chooseSide(frames, requiredJoints);
  const usable = frames.map((f) => (side ? isUsable(f, side, requiredJoints) : false));
  const usableCount = usable.filter(Boolean).length;
  metrics.lowConfidenceFrameFraction = round((n - usableCount) / n, 3);

  let longestGap = 0;
  let lastUsableMs: number | null = null;
  frames.forEach((f, i) => {
    if (!usable[i]) return;
    if (lastUsableMs !== null) longestGap = Math.max(longestGap, f.timestampMs - lastUsableMs);
    lastUsableMs = f.timestampMs;
  });
  metrics.longestUsableGapSeconds = round(longestGap / 1000, 2);

  if (fps < MIN_FRAME_RATE_FPS) {
    reasons.push({
      code: "low_frame_rate",
      level: "insufficient",
      message: `the frame rate was about ${Math.round(fps)} fps; at least ${MIN_FRAME_RATE_FPS} fps is needed`,
    });
  } else if (fps < ADEQUATE_FRAME_RATE_FPS) {
    reasons.push({
      code: "low_frame_rate",
      level: "reduced",
      message: `the frame rate was about ${Math.round(fps)} fps, below ${ADEQUATE_FRAME_RATE_FPS} fps`,
    });
  }

  const missingFraction = metrics.missingFrameFraction;
  if (missingFraction > MISSING_FRAMES_INSUFFICIENT_FRACTION || longestGap / 1000 > USABLE_GAP_INSUFFICIENT_SECONDS) {
    reasons.push({
      code: "missing_frames",
      level: "insufficient",
      message:
        missingFraction > MISSING_FRAMES_INSUFFICIENT_FRACTION
          ? `about ${pct(missingFraction)} of expected frames were missing`
          : `there was a ${metrics.longestUsableGapSeconds} s stretch without a usable frame`,
    });
  } else if (missingFraction > MISSING_FRAMES_REDUCED_FRACTION || longestGap / 1000 > USABLE_GAP_REDUCED_SECONDS) {
    reasons.push({
      code: "missing_frames",
      level: "reduced",
      message:
        missingFraction > MISSING_FRAMES_REDUCED_FRACTION
          ? `about ${pct(missingFraction)} of expected frames were missing`
          : `there was a ${metrics.longestUsableGapSeconds} s stretch without a usable frame`,
    });
  }

  const lowFraction = metrics.lowConfidenceFrameFraction;
  const lowMessage = `in ${pct(lowFraction)} of frames a needed joint was not detected or had confidence below ${MIN_KEYPOINT_CONFIDENCE}`;
  if (lowFraction > LOW_CONFIDENCE_INSUFFICIENT_FRACTION) {
    reasons.push({ code: "low_keypoint_confidence", level: "insufficient", message: lowMessage });
  } else if (lowFraction > LOW_CONFIDENCE_REDUCED_FRACTION) {
    reasons.push({ code: "low_keypoint_confidence", level: "reduced", message: lowMessage });
  }

  if (usableCount < MIN_USABLE_FRAMES) {
    reasons.push({
      code: "too_few_frames",
      level: "insufficient",
      message: `only ${usableCount} usable frame(s); at least ${MIN_USABLE_FRAMES} are needed`,
    });
  }

  if (side && usableCount > 0) {
    const separation = sideSeparationRatio(frames, usable, side);
    metrics.sideSeparationRatio = separation === null ? null : round(separation, 2);
    if (separation !== null && separation > SIDE_VIEW_MAX_SEPARATION_RATIO) {
      reasons.push({
        code: "not_side_view",
        level: "insufficient",
        message: `the camera does not appear to be side-on (left and right joints were ${round(separation, 2)} torso-lengths apart)`,
      });
    }

    const angle = orientationAngle(frames, usable, side, orientation);
    metrics.orientationAngleDeg = angle === null ? null : round(angle, 1);
    if (angle !== null && angle > orientation.maxDeg) {
      reasons.push({
        code: "orientation_mismatch",
        level: "insufficient",
        message: `the body position does not match ${orientation.description} (${orientation.from}-${orientation.to} line ${Math.round(angle)}° from ${orientation.reference})`,
      });
    }
  }

  return finish(side, usable);
}
