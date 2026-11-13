/**
 * Shared analysis pipeline: quality checks -> per-frame signals -> smoothing -> rep segmentation
 * -> per-rep measurements -> neutral observations. Exercise modules supply the signal and depth
 * definitions. EXPERIMENTAL and UNVALIDATED; see docs/pro/FORM_ANALYSIS.md.
 */
import { median, round, smoothByTime } from "./geometry";
import { DISCLAIMER, formatRepList, formatSeconds, plural } from "./observations";
import { assessQuality, type OrientationCheck } from "./quality";
import { segmentReps } from "./segmentation";
import {
  ROM_CHANGE_NOTE_PERCENT,
  SMOOTHING_WINDOW_SECONDS,
  TEMPO_CHANGE_NOTE_RATIO,
  type SegmentationThresholds,
} from "./thresholds";
import type {
  AnalysisResult,
  AnalyzeOptions,
  ExerciseId,
  Joint,
  PoseFrame,
  RepMeasurement,
  Side,
  Tempo,
} from "./types";

export interface FrameSignals {
  /** Flexion of the joint used for rep segmentation, in degrees (0 = straight). */
  flexionDeg: number;
  /** Extra per-frame signals the exercise needs at the bottom of each rep (smoothed the same way). */
  aux: number[];
}

export interface ExerciseDefinition<D> {
  exercise: ExerciseId;
  /** Joint whose flexion drives segmentation, used in wording ("knee", "elbow"). */
  drivingJoint: Joint;
  requiredJoints: readonly Joint[];
  orientation: OrientationCheck;
  segmentation: SegmentationThresholds;
  /** Signals for one frame whose required keypoints are confident; null if geometry is degenerate. */
  signals(frame: PoseFrame, side: Side): FrameSignals | null;
  /** Depth measurement at the bottom of a rep, from the smoothed signals at that frame. */
  depth(flexionAtBottomDeg: number, auxAtBottom: readonly number[]): D;
  /** Exercise-specific neutral observations about depth. */
  depthObservations(reps: readonly RepMeasurement<D>[]): string[];
}

export function analyzeFrames<D>(
  def: ExerciseDefinition<D>,
  frames: readonly PoseFrame[],
  options: AnalyzeOptions = {},
): AnalysisResult<D> {
  const quality = assessQuality({ frames, requiredJoints: def.requiredJoints, orientation: def.orientation });
  const { assessment, side, usable } = quality;

  const base: AnalysisResult<D> = {
    exercise: def.exercise,
    status: "experimental_unvalidated",
    confidence: assessment,
    side,
    repCount: null,
    reps: [],
    partialMovements: 0,
    incompleteMovements: 0,
    medianTempo: null,
    rangeOfMotion: null,
    observations: [],
    disclaimer: DISCLAIMER,
  };

  if (assessment.level === "insufficient" || !side) {
    base.observations.push(`Measurements withheld: ${assessment.reasons.map((r) => r.message).join("; ")}.`);
    return base;
  }

  // Per-frame signals on usable frames only; `frameIndex` maps back to the caller's array.
  const frameIndex: number[] = [];
  const times: number[] = [];
  const flexion: number[] = [];
  const aux: number[][] = [];
  frames.forEach((frame, i) => {
    if (!usable[i]) return;
    const s = frame && def.signals(frame, side);
    if (!s) return;
    frameIndex.push(i);
    times.push(frame.timestampMs);
    flexion.push(s.flexionDeg);
    aux.push(s.aux);
  });

  const windowMs = SMOOTHING_WINDOW_SECONDS * 1000;
  const smoothFlexion = smoothByTime(times, flexion, windowMs);
  const auxCount = aux[0]?.length ?? 0;
  const smoothAux: number[][] = [];
  for (let k = 0; k < auxCount; k++) {
    smoothAux.push(
      smoothByTime(
        times,
        aux.map((a) => a[k]!),
        windowMs,
      ),
    );
  }

  const { movements, incomplete } = segmentReps(smoothFlexion, def.segmentation);
  const repMovements = movements.filter((m) => m.kind === "rep");
  const partial = movements.length - repMovements.length;

  const roms: number[] = [];
  const reps: RepMeasurement<D>[] = repMovements.map((m, k) => {
    const startMs = times[m.start]!;
    const bottomMs = times[m.bottom]!;
    const endMs = times[m.end]!;
    const rom = m.peakFlexionDeg - m.startFlexionDeg;
    const earlier = median(roms);
    roms.push(rom);
    return {
      rep: k + 1,
      startFrame: frameIndex[m.start]!,
      bottomFrame: frameIndex[m.bottom]!,
      endFrame: frameIndex[m.end]!,
      startMs,
      bottomMs,
      endMs,
      tempo: { downSeconds: round((bottomMs - startMs) / 1000, 2), upSeconds: round((endMs - bottomMs) / 1000, 2) },
      rangeOfMotionDeg: round(rom, 1),
      romVsEarlierRepsPercent: earlier && earlier > 0 ? round(((rom - earlier) / earlier) * 100, 1) : null,
      depth: def.depth(
        m.peakFlexionDeg,
        smoothAux.map((series) => series[m.bottom]!),
      ),
    };
  });

  const result: AnalysisResult<D> = {
    ...base,
    repCount: reps.length,
    reps,
    partialMovements: partial,
    incompleteMovements: incomplete,
  };

  const observations: string[] = [];
  if (assessment.level === "reduced") {
    observations.push(
      `Tracking quality was reduced: ${assessment.reasons.map((r) => r.message).join("; ")}. Treat these numbers with extra caution.`,
    );
  }

  if (reps.length === 0) {
    observations.push("No complete reps were detected.");
  } else {
    const medianDown = median(reps.map((r) => r.tempo.downSeconds))!;
    const medianUp = median(reps.map((r) => r.tempo.upSeconds))!;
    result.medianTempo = { downSeconds: round(medianDown, 2), upSeconds: round(medianUp, 2) };
    const medianRom = median(roms)!;
    const baseline = options.baselineRangeOfMotionDeg;
    result.rangeOfMotion = {
      medianDeg: round(medianRom, 1),
      vsBaselinePercent:
        baseline !== undefined && baseline > 0 ? round(((medianRom - baseline) / baseline) * 100, 1) : null,
    };

    observations.push(`Counted ${reps.length} ${plural(reps.length, "rep", "reps")}.`);
    observations.push(...def.depthObservations(reps));
    observations.push(
      `Median tempo: ${formatSeconds(medianDown)} down, ${formatSeconds(medianUp)} up (measured from the ${def.drivingJoint} angle).`,
    );
    observations.push(...tempoChangeObservations(reps));
    observations.push(...romObservations(reps, result.rangeOfMotion.vsBaselinePercent));
  }

  if (partial > 0) {
    observations.push(
      `${partial} ${plural(partial, "movement", "movements")} did not reach the ${def.drivingJoint} bend used to count a rep ` +
        `(${def.segmentation.repMinFlexionDeg}° of flexion) and ${plural(partial, "was", "were")} not counted.`,
    );
  }
  if (incomplete > 0) {
    observations.push(
      `The recording started or ended mid-movement; ${incomplete} ${plural(incomplete, "movement", "movements")} at the edges ` +
        `${plural(incomplete, "was", "were")} not counted.`,
    );
  }

  result.observations = observations;
  return result;
}

function tempoChangeObservations<D>(reps: readonly RepMeasurement<D>[]): string[] {
  const out: string[] = [];
  const phases: { key: keyof Tempo; label: string }[] = [
    { key: "downSeconds", label: "on the way down" },
    { key: "upSeconds", label: "on the way up" },
  ];
  for (const { key, label } of phases) {
    reps.forEach((rep, k) => {
      if (k < 2) return; // need at least two earlier reps for a comparison
      const earlier = median(reps.slice(0, k).map((r) => r.tempo[key]))!;
      if (earlier > 0 && rep.tempo[key] >= earlier * TEMPO_CHANGE_NOTE_RATIO) {
        out.push(
          `Rep ${rep.rep} took ${formatSeconds(rep.tempo[key])} ${label}, compared with a median of ${formatSeconds(earlier)} on earlier reps.`,
        );
      }
    });
  }
  return out;
}

function romObservations<D>(reps: readonly RepMeasurement<D>[], vsBaseline: number | null): string[] {
  const out: string[] = [];
  const smaller = reps.filter((r) => r.romVsEarlierRepsPercent !== null && r.romVsEarlierRepsPercent <= -ROM_CHANGE_NOTE_PERCENT);
  const larger = reps.filter((r) => r.romVsEarlierRepsPercent !== null && r.romVsEarlierRepsPercent >= ROM_CHANGE_NOTE_PERCENT);
  if (smaller.length) {
    out.push(
      `Range of motion on ${formatRepList(smaller.map((r) => r.rep))} was at least ${ROM_CHANGE_NOTE_PERCENT}% smaller than the median of the earlier reps in this set.`,
    );
  }
  if (larger.length) {
    out.push(
      `Range of motion on ${formatRepList(larger.map((r) => r.rep))} was at least ${ROM_CHANGE_NOTE_PERCENT}% larger than the median of the earlier reps in this set.`,
    );
  }
  if (vsBaseline !== null) {
    const direction = vsBaseline < 0 ? "smaller" : "larger";
    out.push(
      Math.abs(vsBaseline) < 1
        ? "Median range of motion was within 1% of the earlier set supplied for comparison."
        : `Median range of motion was ${Math.abs(Math.round(vsBaseline))}% ${direction} than in the earlier set supplied for comparison.`,
    );
  }
  return out;
}
