/**
 * Form-analysis core: tests on SYNTHETIC keypoint data only.
 * Passing these says nothing about accuracy on real camera footage or real pose-model output.
 */
import fs from "node:fs";
import path from "node:path";
import {
  analyzeBodyweightSquat,
  analyzeGobletSquat,
  analyzePushUp,
  classifyHipRelativeToKnee,
  FORM_ANALYSIS_ENABLED,
  formatRepList,
  hipBelowKneeRatio,
  jointAngleDeg,
  segmentReps,
  smoothByTime,
  SQUAT_SEGMENTATION,
  type AnalysisResult,
  type PoseFrame,
} from "@/lib/form-analysis";
import { pushUpFrames, squatFrames } from "./fixtures/pose-fixtures";

const codes = (r: AnalysisResult<unknown>) => r.confidence.reasons.map((x) => x.code);

describe("geometry helpers", () => {
  it("measures interior joint angles", () => {
    expect(jointAngleDeg({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 6);
    expect(jointAngleDeg({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(180, 6);
    expect(jointAngleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
  });

  it("reports hip height relative to knee with y pointing down", () => {
    expect(hipBelowKneeRatio({ x: 0, y: 110 }, { x: 100, y: 100 })).toBeGreaterThan(0); // hip lower
    expect(hipBelowKneeRatio({ x: 0, y: 50 }, { x: 100, y: 100 })).toBeLessThan(0); // hip higher
    expect(classifyHipRelativeToKnee(0.2)).toBe("below");
    expect(classifyHipRelativeToKnee(0.01)).toBe("level");
    expect(classifyHipRelativeToKnee(-0.2)).toBe("above");
  });

  it("smooths by time without shifting a constant signal", () => {
    const t = [0, 33, 66, 100, 133, 166, 200];
    expect(smoothByTime(t, [5, 5, 5, 5, 5, 5, 5], 200)).toEqual([5, 5, 5, 5, 5, 5, 5]);
    const spiky = smoothByTime(t, [0, 0, 0, 30, 0, 0, 0], 200);
    expect(Math.max(...spiky)).toBeLessThan(10);
  });

  it("formats rep lists as ranges", () => {
    expect(formatRepList([3, 4, 5])).toBe("reps 3–5");
    expect(formatRepList([1, 2, 3, 5])).toBe("reps 1–3 and 5");
    expect(formatRepList([4])).toBe("rep 4");
  });
});

describe("rep segmentation", () => {
  it("uses hysteresis so jitter around the top threshold is not counted", () => {
    // Oscillates across topZoneMaxFlexionDeg (25) but never past the leave threshold (35).
    const jitter = Array.from({ length: 60 }, (_, i) => (i % 2 ? 33 : 22));
    expect(segmentReps(jitter, SQUAT_SEGMENTATION).movements).toHaveLength(0);
  });

  it("separates reps, partial movements and movements cut off at the edges", () => {
    const signal = [80, 60, 20, 5, 40, 90, 40, 5, 5, 45, 5, 5, 70, 100];
    const { movements, incomplete } = segmentReps(signal, SQUAT_SEGMENTATION);
    expect(movements.map((m) => m.kind)).toEqual(["rep", "partial"]);
    expect(incomplete).toBe(2);
    expect(movements[0]).toMatchObject({ start: 3, bottom: 5, end: 7 });
  });
});

describe("squat rep counting (synthetic)", () => {
  it("counts clean reps with start < bottom < end", () => {
    const frames = squatFrames({ reps: 5 });
    const r = analyzeBodyweightSquat(frames);
    expect(r.confidence.level).toBe("adequate");
    expect(r.side).toBe("right");
    expect(r.repCount).toBe(5);
    for (const rep of r.reps) {
      expect(rep.startFrame).toBeLessThan(rep.bottomFrame);
      expect(rep.bottomFrame).toBeLessThan(rep.endFrame);
      expect(frames[rep.bottomFrame]!.timestampMs).toBe(rep.bottomMs);
    }
    expect(r.reps[1]!.startFrame).toBeGreaterThan(r.reps[0]!.endFrame);
  });

  it.each([1, 2, 3, 4, 5])("is not inflated by keypoint noise (seed %i)", (seed) => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 6, noisePx: 4, seed }));
    expect(r.repCount).toBe(6);
    expect(r.partialMovements).toBe(0);
  });

  it("does not count shallow partial movements as reps", () => {
    const r = analyzeBodyweightSquat(
      squatFrames({ reps: [{ depthDeg: 110 }, { depthDeg: 110 }, { depthDeg: 45 }, { depthDeg: 110 }], noisePx: 2 }),
    );
    expect(r.repCount).toBe(3);
    expect(r.partialMovements).toBe(1);
    expect(r.observations.some((o) => o.includes("did not reach the knee bend used to count a rep"))).toBe(true);
  });

  it("does not count a movement cut off at the start or end of the recording", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 4, leadInSeconds: 0.2, trimStartSeconds: 0.9, trimEndSeconds: 2 }));
    expect(r.repCount).toBe(2);
    expect(r.incompleteMovements).toBe(2);
  });

  it("counts goblet squats the same way", () => {
    const r = analyzeGobletSquat(squatFrames({ reps: 4, noisePx: 2 }));
    expect(r.exercise).toBe("goblet_squat");
    expect(r.repCount).toBe(4);
  });

  it("reports zero reps when the member only stands", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: [], leadInSeconds: 3 }));
    expect(r.repCount).toBe(0);
    expect(r.observations).toContain("No complete reps were detected.");
  });
});

describe("depth measures (synthetic)", () => {
  it("classifies hip below knee for deep squats", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 3, depthDeg: 150 }));
    expect(r.reps.every((rep) => rep.depth.hipRelativeToKnee === "below")).toBe(true);
    expect(Math.abs(r.reps[0]!.depth.kneeAngleAtBottomDeg - 30)).toBeLessThan(1.5);
    expect(r.observations).toContain("Hips went below knee height at the bottom of all 3 reps.");
  });

  it("classifies hip above knee for shallower squats", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 3, depthDeg: 100 }));
    expect(r.reps.every((rep) => rep.depth.hipRelativeToKnee === "above")).toBe(true);
    expect(Math.abs(r.reps[0]!.depth.kneeAngleAtBottomDeg - 80)).toBeLessThan(1.5);
  });

  it("classifies hip about level with knee within the tolerance band", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 2, depthDeg: 138 }));
    expect(r.reps.every((rep) => rep.depth.hipRelativeToKnee === "level")).toBe(true);
  });

  it("groups reps in neutral observations", () => {
    const reps = [150, 150, 100, 100, 100].map((depthDeg) => ({ depthDeg }));
    const r = analyzeBodyweightSquat(squatFrames({ reps, noisePx: 2 }));
    expect(r.repCount).toBe(5);
    expect(r.observations).toContain("Hips went below knee height at the bottom of reps 1–2.");
    expect(r.observations).toContain("Hips stayed above knee height at the bottom of reps 3–5.");
  });

  it("measures push-up elbow angle at the bottom", () => {
    const reps = [100, 100, 100, 75, 75].map((depthDeg) => ({ depthDeg }));
    const r = analyzePushUp(pushUpFrames({ reps, noisePx: 2 }));
    expect(r.confidence.level).toBe("adequate");
    expect(r.repCount).toBe(5);
    expect(Math.abs(r.reps[0]!.depth.elbowAngleAtBottomDeg - 80)).toBeLessThan(2);
    expect(Math.abs(r.reps[4]!.depth.elbowAngleAtBottomDeg - 105)).toBeLessThan(2);
    expect(r.reps.map((x) => x.depth.reachedReferenceAngle)).toEqual([true, true, true, false, false]);
    expect(r.observations).toContain("Elbow angle reached 90° or less at the bottom of reps 1–3.");
    expect(r.observations).toContain("Elbow angle stayed above 90° at the bottom of reps 4–5.");
  });

  it("does not count shallow push-up dips", () => {
    const reps = [100, 45, 100].map((depthDeg) => ({ depthDeg }));
    const r = analyzePushUp(pushUpFrames({ reps }));
    expect(r.repCount).toBe(2);
    expect(r.partialMovements).toBe(1);
  });
});

describe("tempo (synthetic)", () => {
  it("measures down and up time from timestamps", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 4, downSeconds: 2, upSeconds: 1 }));
    for (const rep of r.reps) {
      expect(Math.abs(rep.tempo.downSeconds - 2)).toBeLessThan(0.3);
      expect(Math.abs(rep.tempo.upSeconds - 1)).toBeLessThan(0.3);
    }
    expect(r.medianTempo!.downSeconds).toBeGreaterThan(r.medianTempo!.upSeconds);
  });

  it("gives similar tempo at different frame rates", () => {
    const a = analyzePushUp(pushUpFrames({ reps: 3, downSeconds: 1.2, upSeconds: 0.8, fps: 30 }));
    const b = analyzePushUp(pushUpFrames({ reps: 3, downSeconds: 1.2, upSeconds: 0.8, fps: 60 }));
    expect(Math.abs(a.medianTempo!.downSeconds - b.medianTempo!.downSeconds)).toBeLessThan(0.1);
    expect(Math.abs(a.medianTempo!.upSeconds - b.medianTempo!.upSeconds)).toBeLessThan(0.1);
  });

  it("notes a rep that is much slower than earlier reps", () => {
    const reps = [{ depthDeg: 110 }, { depthDeg: 110 }, { depthDeg: 110 }, { depthDeg: 110 }, { depthDeg: 110, upSeconds: 3 }];
    const r = analyzeBodyweightSquat(squatFrames({ reps }));
    expect(r.reps[4]!.tempo.upSeconds).toBeGreaterThan(2.5);
    expect(r.observations.some((o) => o.startsWith("Rep 5 took") && o.includes("on the way up"))).toBe(true);
  });
});

describe("range of motion vs own earlier reps (synthetic)", () => {
  it("compares each rep with the median of the earlier reps", () => {
    const reps = [110, 110, 110, 80, 80].map((depthDeg) => ({ depthDeg }));
    const r = analyzeBodyweightSquat(squatFrames({ reps }));
    expect(r.reps[0]!.romVsEarlierRepsPercent).toBeNull();
    expect(Math.abs(r.reps[1]!.romVsEarlierRepsPercent!)).toBeLessThan(3);
    expect(r.reps[3]!.romVsEarlierRepsPercent!).toBeLessThan(-20);
    expect(r.observations).toContain(
      "Range of motion on reps 4–5 was at least 15% smaller than the median of the earlier reps in this set.",
    );
  });

  it("compares with a baseline from an earlier set when supplied", () => {
    const first = analyzeBodyweightSquat(squatFrames({ reps: 3, depthDeg: 120 }));
    const second = analyzeBodyweightSquat(squatFrames({ reps: 3, depthDeg: 90 }), {
      baselineRangeOfMotionDeg: first.rangeOfMotion!.medianDeg,
    });
    expect(second.rangeOfMotion!.vsBaselinePercent!).toBeLessThan(-20);
    expect(second.observations.some((o) => o.includes("smaller than in the earlier set"))).toBe(true);
    expect(first.rangeOfMotion!.vsBaselinePercent).toBeNull();
  });
});

describe("confidence downgrade", () => {
  it("withholds measurements when many frames have low keypoint confidence", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 5, lowConfidence: (i) => i % 5 < 2 }));
    expect(r.confidence.level).toBe("insufficient");
    expect(codes(r)).toContain("low_keypoint_confidence");
    expect(r.repCount).toBeNull();
    expect(r.reps).toEqual([]);
    expect(r.medianTempo).toBeNull();
    expect(r.observations[0]).toMatch(/^Measurements withheld: /);
  });

  it("reduces confidence for a few low-confidence frames but still measures", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 5, lowConfidence: (i) => i % 10 === 0 }));
    expect(r.confidence.level).toBe("reduced");
    expect(codes(r)).toEqual(["low_keypoint_confidence"]);
    expect(r.repCount).toBe(5);
    expect(r.observations[0]).toMatch(/^Tracking quality was reduced/);
  });

  it("treats undetected keypoints like low-confidence ones", () => {
    const frames = squatFrames({ reps: 3 }).map((f, i): PoseFrame => {
      if (i % 3 !== 0) return f;
      const keypoints = { ...f.keypoints };
      delete keypoints.rightAnkle;
      return { ...f, keypoints };
    });
    const r = analyzeBodyweightSquat(frames);
    expect(r.confidence.level).toBe("insufficient");
    expect(codes(r)).toContain("low_keypoint_confidence");
  });

  it("withholds measurements when many frames are missing", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 5, drop: (i) => i % 5 < 2 }));
    expect(r.confidence.level).toBe("insufficient");
    expect(codes(r)).toContain("missing_frames");
    expect(r.repCount).toBeNull();
  });

  it("withholds measurements when a long stretch of frames is missing", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 5, drop: (_i, t) => t > 3000 && t < 4000 }));
    expect(r.confidence.level).toBe("insufficient");
    expect(codes(r)).toContain("missing_frames");
    expect(r.confidence.metrics.longestUsableGapSeconds).toBeGreaterThan(0.9);
  });

  it("reduces confidence for occasional dropped frames", () => {
    const r = analyzePushUp(pushUpFrames({ reps: 4, drop: (i) => i % 10 === 3 }));
    expect(r.confidence.level).toBe("reduced");
    expect(codes(r)).toEqual(["missing_frames"]);
    expect(r.repCount).toBe(4);
  });

  it("withholds measurements at a very low frame rate and reduces confidence at a modest one", () => {
    const slow = analyzeBodyweightSquat(squatFrames({ reps: 4, fps: 8 }));
    expect(slow.confidence.level).toBe("insufficient");
    expect(codes(slow)).toContain("low_frame_rate");
    const modest = analyzeBodyweightSquat(squatFrames({ reps: 4, fps: 15 }));
    expect(modest.confidence.level).toBe("reduced");
    expect(codes(modest)).toEqual(["low_frame_rate"]);
    expect(modest.repCount).toBe(4);
  });

  it("withholds measurements when the camera is not side-on", () => {
    const squat = analyzeBodyweightSquat(squatFrames({ reps: 3, view: "front" }));
    expect(squat.confidence.level).toBe("insufficient");
    expect(codes(squat)).toContain("not_side_view");
    const pushUp = analyzePushUp(pushUpFrames({ reps: 3, view: "front" }));
    expect(codes(pushUp)).toContain("not_side_view");
  });

  it("accepts a side view where both sides happen to be visible", () => {
    const r = analyzeBodyweightSquat(squatFrames({ reps: 3, farSideConfidence: 0.9 }));
    expect(r.confidence.level).toBe("adequate");
    expect(r.confidence.metrics.sideSeparationRatio!).toBeLessThan(0.1);
  });

  it("withholds measurements when body orientation does not match the exercise", () => {
    expect(codes(analyzeBodyweightSquat(pushUpFrames({ reps: 3 })))).toContain("orientation_mismatch");
    expect(codes(analyzePushUp(squatFrames({ reps: 3 })))).toContain("orientation_mismatch");
  });

  it("withholds measurements for too few frames or out-of-order timestamps", () => {
    expect(codes(analyzeBodyweightSquat(squatFrames({ reps: 3 }).slice(0, 5)))).toContain("too_few_frames");
    expect(analyzeBodyweightSquat([]).repCount).toBeNull();
    const shuffled = squatFrames({ reps: 3 });
    [shuffled[10], shuffled[11]] = [shuffled[11]!, shuffled[10]!];
    expect(codes(analyzeBodyweightSquat(shuffled))).toEqual(["timestamps_not_increasing"]);
  });
});

describe("neutral language", () => {
  const BANNED = /good|bad|perfect|correct|wrong|injur|pain|hurt/i;

  function strings(value: unknown, out: string[] = []): string[] {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
    else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
    return out;
  }

  it("never uses judgemental, pain or injury words in any output string", () => {
    const results: AnalysisResult<unknown>[] = [
      analyzeBodyweightSquat(squatFrames({ reps: [150, 150, 100, 100, 45, 80].map((depthDeg) => ({ depthDeg })) })),
      analyzeBodyweightSquat(squatFrames({ reps: 5, lowConfidence: (i) => i % 10 === 0, trimEndSeconds: 1.5 })),
      analyzeBodyweightSquat(squatFrames({ reps: 5, lowConfidence: (i) => i % 2 === 0 })),
      analyzeBodyweightSquat(squatFrames({ reps: 3, view: "front" })),
      analyzeBodyweightSquat(squatFrames({ reps: 3, fps: 8 })),
      analyzeBodyweightSquat(squatFrames({ reps: 3, drop: (_i, t) => t > 2000 && t < 3000 })),
      analyzeBodyweightSquat(pushUpFrames({ reps: 3 })),
      analyzeBodyweightSquat(squatFrames({ reps: [], leadInSeconds: 3 })),
      analyzeGobletSquat(squatFrames({ reps: 3, depthDeg: 138 }), { baselineRangeOfMotionDeg: 200 }),
      analyzePushUp(pushUpFrames({ reps: [100, 100, 100, 75, 45].map((depthDeg) => ({ depthDeg, upSeconds: 2 })) })),
      analyzePushUp(pushUpFrames({ reps: 3, fps: 15 })),
    ];
    const all = results.flatMap((r) => strings(r));
    expect(all.length).toBeGreaterThan(50);
    for (const s of all) expect(s).not.toMatch(BANNED);
    for (const r of results) {
      expect(r.status).toBe("experimental_unvalidated");
      expect(r.disclaimer).toMatch(/not been validated/);
    }
  });
});

describe("not operational", () => {
  const root = path.resolve(__dirname, "../..");

  it("is behind a feature flag that is off", () => {
    expect(FORM_ANALYSIS_ENABLED).toBe(false);
  });

  it("is not imported anywhere under src/app", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && fs.readFileSync(full, "utf8").includes("form-analysis")) {
          offenders.push(full);
        }
      }
    };
    walk(path.join(root, "src/app"));
    expect(offenders).toEqual([]);
  });

  it("marks every threshold constant as an unvalidated placeholder", () => {
    const lines = fs.readFileSync(path.join(root, "src/lib/form-analysis/thresholds.ts"), "utf8").split("\n");
    const exported = lines.flatMap((line, i) => (line.startsWith("export const ") ? [i] : []));
    expect(exported.length).toBeGreaterThan(15);
    for (const i of exported) {
      let j = i - 1;
      while (j >= 0 && !lines[j]!.includes("UNVALIDATED PLACEHOLDER") && !lines[j]!.startsWith("export ")) j--;
      expect(lines[j] ?? "", `comment above: ${lines[i]}`).toContain("UNVALIDATED PLACEHOLDER");
    }
  });
});
