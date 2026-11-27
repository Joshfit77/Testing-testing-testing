/**
 * Push-up analyzer. EXPERIMENTAL and UNVALIDATED.
 *
 * Segmentation signal: elbow flexion (180 - shoulder/elbow/wrist angle).
 * Depth: elbow angle at the bottom, grouped against a reference angle that is an unvalidated
 * placeholder, used only to group reps in the wording.
 */
import { analyzeFrames, type ExerciseDefinition } from "./analyze";
import { confidentKeypoint, flexionDeg, median, round } from "./geometry";
import { bottomOf, formatDeg } from "./observations";
import {
  MIN_KEYPOINT_CONFIDENCE,
  PUSH_UP_MAX_BODY_FROM_HORIZONTAL_DEG,
  PUSH_UP_REFERENCE_ELBOW_ANGLE_DEG,
  PUSH_UP_SEGMENTATION,
} from "./thresholds";
import type { AnalysisResult, AnalyzeOptions, PoseFrame, PushUpDepth, RepMeasurement } from "./types";

function pushUpDepthObservations(reps: readonly RepMeasurement<PushUpDepth>[]): string[] {
  const out: string[] = [];
  const ref = formatDeg(PUSH_UP_REFERENCE_ELBOW_ANGLE_DEG);
  const reached = reps.filter((r) => r.depth.reachedReferenceAngle).map((r) => r.rep);
  const above = reps.filter((r) => !r.depth.reachedReferenceAngle).map((r) => r.rep);
  if (reached.length) out.push(`Elbow angle reached ${ref} or less at ${bottomOf(reached, reps.length)}.`);
  if (above.length) out.push(`Elbow angle stayed above ${ref} at ${bottomOf(above, reps.length)}.`);
  const angles = reps.map((r) => r.depth.elbowAngleAtBottomDeg);
  if (angles.length === 1) {
    out.push(`Elbow angle at the bottom was ${formatDeg(angles[0]!)}.`);
  } else {
    out.push(
      `Elbow angle at the bottom ranged from ${formatDeg(Math.min(...angles))} to ${formatDeg(Math.max(...angles))} ` +
        `(median ${formatDeg(median(angles)!)}).`,
    );
  }
  return out;
}

const PUSH_UP: ExerciseDefinition<PushUpDepth> = {
  exercise: "push_up",
  drivingJoint: "elbow",
  requiredJoints: ["shoulder", "elbow", "wrist", "hip"],
  orientation: {
    from: "hip",
    to: "shoulder",
    reference: "horizontal",
    maxDeg: PUSH_UP_MAX_BODY_FROM_HORIZONTAL_DEG,
    description: "a push-up filmed from the side",
  },
  segmentation: PUSH_UP_SEGMENTATION,
  signals(frame, side) {
    const shoulder = confidentKeypoint(frame, side, "shoulder", MIN_KEYPOINT_CONFIDENCE);
    const elbow = confidentKeypoint(frame, side, "elbow", MIN_KEYPOINT_CONFIDENCE);
    const wrist = confidentKeypoint(frame, side, "wrist", MIN_KEYPOINT_CONFIDENCE);
    if (!shoulder || !elbow || !wrist) return null;
    const flex = flexionDeg(shoulder, elbow, wrist);
    return flex === null ? null : { flexionDeg: flex, aux: [] };
  },
  depth(flexionAtBottom) {
    const angle = 180 - flexionAtBottom;
    return {
      elbowAngleAtBottomDeg: round(angle, 1),
      reachedReferenceAngle: angle <= PUSH_UP_REFERENCE_ELBOW_ANGLE_DEG,
      referenceAngleDeg: PUSH_UP_REFERENCE_ELBOW_ANGLE_DEG,
    };
  },
  depthObservations: pushUpDepthObservations,
};

export function analyzePushUp(frames: readonly PoseFrame[], options?: AnalyzeOptions): AnalysisResult<PushUpDepth> {
  return analyzeFrames(PUSH_UP, frames, options);
}
