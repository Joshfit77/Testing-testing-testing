/**
 * The five priority 2D demonstrations (bench press, back squat, conventional deadlift, dumbbell curl, medicine-ball
 * scoop toss): measured technique checks, their camera views, the player's view switch and replay, and the muscle key.
 * Numbers are measured on the figure (cm of a ~180 cm athlete, degrees); the thresholds are the coaching standard each
 * check names, with a small allowance for the drawing.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { EXERCISE_MOTION_VIEWS } from "@/data/exercise-motions";
import { getMotion, getMotionViews, highlightFor, mountExerciseMotion } from "@/lib/exercise-motion";
import { PRIMARY_RGB, SECONDARY_RGB } from "@/lib/exercise-motion/muscle-colors";
import { compileMotion, sampleFrames } from "@/lib/exercise-motion/timeline";
import type { ExerciseMeta, Frame, MotionDef } from "@/lib/exercise-motion/types";
import { MuscleKey } from "@/components/train/muscle-key";

const meta = (slug: string): ExerciseMeta => {
  const e = EXERCISES.find((x) => x.slug === slug)!;
  return { slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };
};
const frames = (def: MotionDef, n = 96): Frame[] => sampleFrames(compileMotion(def), n);
const side = (slug: string) => frames(getMotion(slug, meta(slug)));
const front = (slug: string) => frames(getMotionViews(slug, meta(slug)).find((v) => v.view === "front")!.def);
const bar = (f: Frame) => f.props.find((p) => p.def.id === "bar")!.at;
const byHeight = (fr: Frame[], pick: (f: Frame) => number) => [...fr].sort((a, b) => pick(a) - pick(b));
/** Forearm direction from vertical, degrees (0 = vertical). */
const forearmTilt = (f: Frame) => {
  const [hx, hy] = f.pts.handR;
  const [ex, ey] = f.pts.elbowR;
  return Math.abs((Math.atan2(hx - ex, hy - ey) * 180) / Math.PI);
};
/** Mid-foot on this figure (heel −13, ball +11 in the side view). */
const MID_FOOT = -1;

describe("conventional deadlift (side)", () => {
  const fr = side("conventional-deadlift");
  const bottom = byHeight(fr, (f) => bar(f)[1])[0]!;
  const top = byHeight(fr, (f) => -bar(f)[1])[0]!;

  it("keeps the arms straight from the floor to lockout", () => {
    for (const f of fr) expect(f.pose.elR).toBeLessThan(6);
  });

  it("starts with hips above the knees, shoulders just ahead of the bar and a back angle of a conventional pull", () => {
    expect(bottom.pts.pelvis[1]).toBeGreaterThan(bottom.pts.kneeR[1] + 5);
    expect(bottom.pose.trunk).toBeGreaterThan(55);
    expect(bottom.pose.trunk).toBeLessThan(67);
    expect(bottom.pts.shoulder[0] - bar(bottom)[0]).toBeGreaterThan(1);
    expect(bottom.pts.shoulder[0] - bar(bottom)[0]).toBeLessThan(8);
  });

  it("locks out standing tall: torso upright, hips and knees extended, shoulders behind the bar", () => {
    expect(top.pose.trunk).toBeLessThan(6);
    expect(top.pose.hipR).toBeLessThan(12);
    expect(top.pose.kneeR).toBeLessThan(8);
    expect(top.pts.shoulder[0]).toBeLessThan(bar(top)[0]);
  });

  it("moves the bar in a vertical line over mid-foot", () => {
    for (const f of fr) expect(Math.abs(bar(f)[0] - MID_FOOT)).toBeLessThan(4);
  });
});

describe("barbell bench press (side)", () => {
  const fr = side("bench-press");
  const lowest = byHeight(fr, (f) => bar(f)[1])[0]!;
  const highest = byHeight(fr, (f) => -bar(f)[1])[0]!;

  it("keeps the forearms close to vertical under the bar all the way down and up", () => {
    for (const f of fr) expect(forearmTilt(f)).toBeLessThan(12);
  });

  it("touches the lower chest and locks out over the shoulders (a J-shaped bar path)", () => {
    expect(bar(lowest)[0]).toBeGreaterThan(highest.pts.shoulder[0] + 6);
    expect(Math.abs(bar(highest)[0] - highest.pts.shoulder[0])).toBeLessThan(4);
    expect(bar(lowest)[1] - lowest.pts.chest[1]).toBeLessThan(8);
  });
});

describe("barbell back squat (side)", () => {
  const fr = side("back-squat");
  const bottom = byHeight(fr, (f) => f.pts.pelvis[1])[0]!;

  it("keeps the bar over mid-foot", () => {
    for (const f of fr) expect(Math.abs(bar(f)[0] - MID_FOOT)).toBeLessThan(3);
  });

  it("reaches just below parallel: the hips sink under the top of the knees", () => {
    expect(bottom.pts.pelvis[1]).toBeLessThan(bottom.pts.kneeR[1]);
    expect(bottom.pts.pelvis[1]).toBeGreaterThan(bottom.pts.kneeR[1] - 8);
  });

  it("stands tall at the top and leans no more than a high-bar squat does at the bottom", () => {
    const top = byHeight(fr, (f) => -f.pts.pelvis[1])[0]!;
    expect(top.pose.trunk).toBeLessThan(10);
    expect(top.pose.kneeR).toBeLessThan(5);
    expect(bottom.pose.trunk).toBeGreaterThan(25);
    expect(bottom.pose.trunk).toBeLessThan(40);
  });

  it("moves smoothly: the bar never jumps between frames and eases at the top and bottom", () => {
    const dense = frames(getMotion("back-squat", meta("back-squat")), 240);
    const ys = dense.map((f) => bar(f)[1]);
    const steps = ys.map((y, i) => Math.abs(y - ys[(i + 1) % ys.length]!));
    // 240 frames over 4.15 s: under 2 cm a frame is under 1.2 m/s, a controlled squat.
    expect(Math.max(...steps)).toBeLessThan(2);
    // No step is more than 0.35 cm bigger than the one before it: no jerk anywhere in the loop.
    for (let i = 0; i < steps.length; i++) expect(Math.abs(steps[i]! - steps[(i + 1) % steps.length]!)).toBeLessThan(0.35);
  });

  it("keeps the heels down", () => {
    for (const f of fr) expect(Math.abs(f.pts.heelR[1])).toBeLessThan(1);
  });
});

describe("dumbbell curl (side)", () => {
  const fr = side("dumbbell-curl");
  it("keeps the elbows by the sides and curls through a full range", () => {
    for (const f of fr) expect(Math.abs(f.pts.elbowR[0] - f.pts.shoulderR[0])).toBeLessThan(6);
    expect(Math.max(...fr.map((f) => f.pose.elR))).toBeGreaterThan(130);
    expect(Math.min(...fr.map((f) => f.pose.elR))).toBeLessThan(10);
  });

  it("lifts faster than it lowers (a controlled eccentric)", () => {
    const k = getMotion("dumbbell-curl").keyframes;
    expect(k[0]!.dur).toBeLessThan(k[1]!.dur);
  });
});

describe("medicine-ball scoop toss", () => {
  it("is shown from the front (a rotation reads best facing the camera) and the ball leaves the hands", () => {
    const def = getMotion("medicine-ball-scoop-toss");
    expect(def.view).toBe("front");
    const fr = frames(def);
    const ball = (f: Frame) => f.props.find((p) => p.def.kind === "medball")!.at;
    const gap = Math.max(...fr.map((f) => Math.hypot(ball(f)[0] - f.pts.hands[0], ball(f)[1] - f.pts.hands[1])));
    expect(gap).toBeGreaterThan(30);
  });
});

describe("camera views", () => {
  it("offers side and front for the deadlift and curl, and one view for the squat, bench press and scoop toss", () => {
    for (const slug of ["conventional-deadlift", "dumbbell-curl"]) expect(getMotionViews(slug, meta(slug)).map((v) => v.view)).toEqual(["side", "front"]);
    // The squat's front view was withdrawn until it can be drawn to the side view's standard (deep-squat foreshortening).
    for (const slug of ["back-squat", "bench-press"]) expect(getMotionViews(slug, meta(slug)).map((v) => v.view)).toEqual(["side"]);
    expect(getMotionViews("medicine-ball-scoop-toss", meta("medicine-ball-scoop-toss")).map((v) => v.view)).toEqual(["front"]);
  });

  it("every extra view belongs to a catalog exercise and shares its main view's loop length", () => {
    for (const slug of Object.keys(EXERCISE_MOTION_VIEWS)) {
      expect(EXERCISES.some((e) => e.slug === slug)).toBe(true);
      const [main, ...extra] = getMotionViews(slug, meta(slug));
      for (const v of extra) expect(compileMotion(v.def).duration).toBeCloseTo(compileMotion(main!.def).duration, 2);
    }
  });

  it("front views keep both feet planted", () => {
    for (const slug of Object.keys(EXERCISE_MOTION_VIEWS)) {
      const fr = front(slug);
      for (const s of ["L", "R"] as const) {
        const xs = fr.map((f) => f.pts[`sole${s}`][0]);
        const ys = fr.map((f) => f.pts[`sole${s}`][1]);
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(2.5);
        expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2.5);
      }
    }
  });

  it("front views match the side view's depth: same pelvis height at the bottom (within 3 cm)", () => {
    for (const slug of ["conventional-deadlift"]) {
      const lowS = Math.min(...side(slug).map((f) => f.pts.pelvis[1] - Math.min(f.pts.soleL[1], f.pts.soleR[1])));
      const lowF = Math.min(...front(slug).map((f) => f.pts.pelvis[1] - Math.min(f.pts.soleL[1], f.pts.soleR[1])));
      expect(Math.abs(lowS - lowF)).toBeLessThan(3);
    }
  });

  it("the front deadlift grips just outside the legs and finishes standing tall", () => {
    const fr = front("conventional-deadlift");
    for (const f of fr) expect(Math.abs(f.pts.handL[0] - f.pts.handR[0])).toBeGreaterThan(40);
    expect(Math.min(...fr.map((f) => f.pose.trunkD))).toBeLessThan(6);
  });

  it("the front curl brings the dumbbells up toward the shoulders", () => {
    const fr = front("dumbbell-curl");
    const top = byHeight(fr, (f) => -f.pts.handR[1])[0]!;
    expect(top.pts.handR[1]).toBeGreaterThan(top.pts.elbowR[1] + 10);
  });
});

describe("muscle highlighting", () => {
  it("marks primary muscles stronger than secondary ones, and the two colours differ", () => {
    const hl = highlightFor(["quadriceps", "glutes"], ["hamstrings", "core"]);
    expect(hl.quads).toBe(1);
    expect(hl.glutes).toBe(1);
    expect(hl.hamstrings).toBeLessThan(0.7);
    expect(hl.abs).toBeLessThan(0.7);
    expect(PRIMARY_RGB).not.toBe(SECONDARY_RGB);
  });

  it("the muscle key names primary and secondary muscles and says the highlight is not a measurement", () => {
    render(<MuscleKey primary={["chest", "triceps"]} secondary={["front deltoids"]} />);
    expect(screen.getByTestId("muscle-key-primary")).toHaveTextContent("Chest, Triceps");
    expect(screen.getByTestId("muscle-key-secondary")).toHaveTextContent("Front Deltoids");
    expect(screen.getByTestId("muscle-key")).toHaveTextContent(/not a measurement of muscle activity/);
  });
});

describe("player: camera view switch and replay", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  afterEach(() => {
    document.body.innerHTML = "";
  });
  const mount = (slug: string) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    return { host, ctrl: mountExerciseMotion(host, slug, { autoplay: false, meta: meta(slug) }) };
  };

  it("shows Side and Front for the curl, outside the picture, and switching keeps the position in the rep", () => {
    const { host, ctrl } = mount("dumbbell-curl");
    const sw = host.querySelector("[data-motion-views]")!;
    expect(sw).not.toBeNull();
    expect(host.querySelector("[data-motion-stage]")!.querySelector("button")).toBeNull();
    const [sideBtn, frontBtn] = [...sw.querySelectorAll("button")];
    expect(sideBtn!.getAttribute("aria-pressed")).toBe("true");
    ctrl.seek(0.4);
    frontBtn!.click();
    expect(ctrl.view).toBe(1);
    expect(ctrl.motion.view).toBe("front");
    expect(frontBtn!.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector("[data-exercise-motion]")!.getAttribute("data-view")).toBe("front");
    expect(ctrl.phase).toBeCloseTo(0.4, 2);
  });

  it("has no view switch for a one-view exercise", () => {
    const { host } = mount("bench-press");
    expect(host.querySelector("[data-motion-views]")).toBeNull();
  });

  it("Replay goes back to the start of the movement and plays", () => {
    const { host, ctrl } = mount("dumbbell-curl");
    ctrl.seek(0.7);
    host.querySelector<HTMLButtonElement>("[data-motion-replay]")!.click();
    expect(ctrl.playing).toBe(true);
    expect(ctrl.phase).toBeLessThan(0.05);
  });
});
