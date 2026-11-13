/**
 * Rep segmentation on a smoothed joint-flexion signal (0 = straight joint, larger = more bent),
 * using hysteresis so that jitter around a threshold cannot create extra reps.
 *
 *   top zone   : flexion <= topZoneMaxFlexionDeg
 *   leave top  : flexion >  topZoneMaxFlexionDeg + hysteresisMarginDeg   (movement starts)
 *   return     : flexion <= topZoneMaxFlexionDeg                         (movement ends)
 *
 * A movement whose peak reaches repMinFlexionDeg is a rep; a shallower one is "partial".
 * A movement cut off by the start or end of the recording is "incomplete" and not counted.
 * Rep start and end are then refined to where flexion is within REP_BOUNDARY_TOLERANCE_DEG of the
 * lowest flexion in the neighbouring top-zone stretch, so time spent paused at the top is excluded
 * from tempo.
 */
import { REP_BOUNDARY_TOLERANCE_DEG, type SegmentationThresholds } from "./thresholds";

export interface Movement {
  kind: "rep" | "partial";
  /** Indices into the signal array. */
  start: number;
  bottom: number;
  end: number;
  peakFlexionDeg: number;
  startFlexionDeg: number;
}

export interface SegmentationResult {
  movements: Movement[];
  incomplete: number;
}

interface RawExcursion {
  leave: number;
  ret: number;
}

export function segmentReps(signal: readonly number[], thresholds: SegmentationThresholds): SegmentationResult {
  const top = thresholds.topZoneMaxFlexionDeg;
  const leaveAt = top + thresholds.hysteresisMarginDeg;
  const excursions: RawExcursion[] = [];
  let incomplete = 0;

  if (signal.length === 0) return { movements: [], incomplete: 0 };

  // A recording that starts mid-movement: skip until the first return to the top zone.
  let inTop = signal[0]! <= leaveAt;
  let leave = -1;
  let startedMidMovement = !inTop;
  for (let i = 0; i < signal.length; i++) {
    const v = signal[i]!;
    if (inTop) {
      if (v > leaveAt) {
        inTop = false;
        leave = i;
      }
    } else if (v <= top) {
      inTop = true;
      if (startedMidMovement) {
        incomplete++;
        startedMidMovement = false;
      } else {
        excursions.push({ leave, ret: i });
      }
    }
  }
  if (!inTop) incomplete++; // ended mid-movement (or never returned to the top zone)

  const movements: Movement[] = excursions.map((ex, k) => {
    // Top-zone stretches either side of this excursion.
    const beforeFrom = k === 0 ? 0 : excursions[k - 1]!.ret;
    const afterTo = k === excursions.length - 1 ? signal.length - 1 : excursions[k + 1]!.leave;
    const start = lastNearMin(signal, beforeFrom, ex.leave);
    const end = firstNearMin(signal, ex.ret, afterTo);
    let bottom = ex.leave;
    for (let i = ex.leave; i <= ex.ret; i++) if (signal[i]! > signal[bottom]!) bottom = i;
    const peak = signal[bottom]!;
    return {
      kind: peak >= thresholds.repMinFlexionDeg ? "rep" : "partial",
      start,
      bottom,
      end,
      peakFlexionDeg: peak,
      startFlexionDeg: signal[start]!,
    };
  });

  return { movements, incomplete };
}

/** Latest index in [from, to] whose value is within tolerance of the minimum of that range. */
function lastNearMin(signal: readonly number[], from: number, to: number): number {
  let min = Infinity;
  for (let i = from; i <= to; i++) min = Math.min(min, signal[i]!);
  for (let i = to; i >= from; i--) if (signal[i]! <= min + REP_BOUNDARY_TOLERANCE_DEG) return i;
  return from;
}

/** Earliest index in [from, to] whose value is within tolerance of the minimum of that range. */
function firstNearMin(signal: readonly number[], from: number, to: number): number {
  let min = Infinity;
  for (let i = from; i <= to; i++) min = Math.min(min, signal[i]!);
  for (let i = from; i <= to; i++) if (signal[i]! <= min + REP_BOUNDARY_TOLERANCE_DEG) return i;
  return to;
}
