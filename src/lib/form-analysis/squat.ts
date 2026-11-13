/**
 * Squat analyzers (bodyweight and goblet). EXPERIMENTAL and UNVALIDATED.
 *
 * Segmentation signal: knee flexion (180 - hip/knee/ankle angle).
 * Depth: knee angle at the bottom, and the hip keypoint's height relative to the knee keypoint.
 * The hip/knee keypoints are joint-centre estimates, not the hip crease / top of knee that judged
 * depth standards use, so "below knee height" here is a keypoint measurement only.
 */
import { analyzeFrames, type ExerciseDefinition } from "./analyze";
import { confidentKeypoint, flexionDeg, hipBelowKneeRatio, median, round } from "./geometry";
import { bottomOf, formatDeg } from "./observations";
import {
  MIN_KEYPOINT_CONFIDENCE,
  SQUAT_HIP_KNEE_LEVEL_TOLERANCE,
  SQUAT_MAX_TORSO_FROM_VERTICAL_DEG,
  SQUAT_SEGMENTATION,
} from "./thresholds";
import type {
  AnalysisResult,
  AnalyzeOptions,
  HipRelativeToKnee,
  PoseFrame,
  RepMeasurement,
  SquatDepth,
} from "./types";

export function classifyHipRelativeToKnee(hipKneeOffsetRatio: number): HipRelativeToKnee {
  if (hipKneeOffsetRatio > SQUAT_HIP_KNEE_LEVEL_TOLERANCE) return "below";
  if (hipKneeOffsetRatio < -SQUAT_HIP_KNEE_LEVEL_TOLERANCE) return "above";
  return "level";
}

function squatDepthObservations(reps: readonly RepMeasurement<SquatDepth>[]): string[] {
  const out: string[] = [];
  const groups: { key: HipRelativeToKnee; text: string }[] = [
    { key: "below", text: "Hips went below knee height at" },
    { key: "level", text: "Hips reached about knee height at" },
    { key: "above", text: "Hips stayed above knee height at" },
  ];
  for (const { key, text } of groups) {
    const nums = reps.filter((r) => r.depth.hipRelativeToKnee === key).map((r) => r.rep);
    if (nums.length) out.push(`${text} ${bottomOf(nums, reps.length)}.`);
  }
  const angles = reps.map((r) => r.depth.kneeAngleAtBottomDeg);
  if (angles.length === 1) {
    out.push(`Knee angle at the bottom was ${formatDeg(angles[0]!)}.`);
  } else {
    out.push(
      `Knee angle at the bottom ranged from ${formatDeg(Math.min(...angles))} to ${formatDeg(Math.max(...angles))} ` +
        `(median ${formatDeg(median(angles)!)}).`,
    );
  }
  return out;
}

function squatDefinition(exercise: "bodyweight_squat" | "goblet_squat"): ExerciseDefinition<SquatDepth> {
  return {
    exercise,
    drivingJoint: "knee",
    requiredJoints: ["shoulder", "hip", "knee", "ankle"],
    orientation: {
      from: "hip",
      to: "shoulder",
      reference: "vertical",
      maxDeg: SQUAT_MAX_TORSO_FROM_VERTICAL_DEG,
      description: "a squat filmed from the side",
    },
    segmentation: SQUAT_SEGMENTATION,
    signals(frame, side) {
      const hip = confidentKeypoint(frame, side, "hip", MIN_KEYPOINT_CONFIDENCE);
      const knee = confidentKeypoint(frame, side, "knee", MIN_KEYPOINT_CONFIDENCE);
      const ankle = confidentKeypoint(frame, side, "ankle", MIN_KEYPOINT_CONFIDENCE);
      if (!hip || !knee || !ankle) return null;
      const flex = flexionDeg(hip, knee, ankle);
      const offset = hipBelowKneeRatio(hip, knee);
      if (flex === null || offset === null) return null;
      return { flexionDeg: flex, aux: [offset] };
    },
    depth(flexionAtBottom, [offset]) {
      const ratio = offset ?? 0;
      return {
        kneeAngleAtBottomDeg: round(180 - flexionAtBottom, 1),
        hipKneeOffsetRatio: round(ratio, 3),
        hipRelativeToKnee: classifyHipRelativeToKnee(ratio),
      };
    },
    depthObservations: squatDepthObservations,
  };
}

export function analyzeBodyweightSquat(
  frames: readonly PoseFrame[],
  options?: AnalyzeOptions,
): AnalysisResult<SquatDepth> {
  return analyzeFrames(squatDefinition("bodyweight_squat"), frames, options);
}

/**
 * Goblet squat. Uses the same lower-body measurements as the bodyweight squat; the weight held at
 * the chest does not change what is measured. Thresholds are shared until validation says otherwise.
 */
export function analyzeGobletSquat(frames: readonly PoseFrame[], options?: AnalyzeOptions): AnalysisResult<SquatDepth> {
  return analyzeFrames(squatDefinition("goblet_squat"), frames, options);
}
