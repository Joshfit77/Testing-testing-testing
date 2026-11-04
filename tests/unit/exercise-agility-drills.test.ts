/**
 * Regression tests for the redrawn agility and conditioning drill demonstrations: the lateral shuffle, the reactive
 * mirror drill, the 5-10-5 pro agility shuttle, the T-drill, the three-cone drill, agility-ladder footwork, the
 * lateral bound, the acceleration wall drill, the dumbbell walking lunge and the bear crawl. Each was reviewed as
 * wrong (stepping in place instead of travelling, no ladder, a piked wall drill, a reverse lunge, a crouch for a bear
 * crawl...). These check the movement itself on the frames the player draws; how a pose looks is judged on the review
 * sheets and videos (scripts/exercise-review), not here.
 */
import { EXERCISES } from "@/data/exercises";
import { getMotion } from "@/lib/exercise-motion";
import { BODY } from "@/lib/exercise-motion/skeleton";
import { compileMotion, evaluate } from "@/lib/exercise-motion/timeline";
import type { ExerciseMeta, Frame, MotionDef, Vec } from "@/lib/exercise-motion/types";

const metaOf = (slug: string): ExerciseMeta => {
  const e = EXERCISES.find((x) => x.slug === slug);
  if (!e) throw new Error(`unknown exercise ${slug}`);
  return { slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };
};
function played(slug: string, fps = 60): { def: MotionDef; frames: Frame[] } {
  const def = getMotion(slug, metaOf(slug));
  const c = compileMotion(def);
  const n = Math.round(c.duration * fps);
  return { def, frames: Array.from({ length: n }, (_, k) => evaluate(c, (k / n) * c.duration)) };
}
const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
/** Where a landmark is drawn (a figure drawn in perspective is scaled about the camera's axis). */
const drawn = (f: Frame, p: Vec): Vec => (f.zoom ? [f.zoom.x + (p[0] - f.zoom.x) * f.zoom.s, p[1] * f.zoom.s] : p);
const handDown = (f: Frame, s: "L" | "R") => drawn(f, f.pts[`hand${s}`])[1] - BODY.r.hand * (f.zoom?.s ?? 1);

describe("lateral shuffle", () => {
  const { def, frames } = played("lateral-shuffle");
  it("travels sideways across the frame and back, low, without the feet crossing or clicking", () => {
    expect(def.view).toBe("front");
    expect(range(frames.map((f) => f.pts.pelvis[0]))).toBeGreaterThan(70);
    for (const f of frames) {
      expect(f.pts.soleL[0] - f.pts.soleR[0], "feet apart").toBeGreaterThan(36);
      expect(Math.min(f.pts.soleL[1], f.pts.soleR[1]), "a foot on the floor").toBeLessThan(0.6);
      expect(f.pts.pelvis[1], "hips low").toBeLessThan(80);
      expect(Math.abs(f.seg.T1) + Math.abs(f.pose.spine), "torso upright").toBeLessThan(6);
    }
  });
  it("pushes off the trail foot: each foot leaves the floor in turn, never both at once", () => {
    let lifts = 0;
    for (let i = 1; i < frames.length; i++) {
      const up = (f: Frame, s: "L" | "R") => f.pts[`sole${s}`][1] > 1;
      for (const s of ["L", "R"] as const) if (up(frames[i]!, s) && !up(frames[i - 1]!, s)) lifts++;
    }
    expect(lifts).toBeGreaterThanOrEqual(12);
  });
});

describe("reactive mirror drill", () => {
  const { frames } = played("reactive-mirror-drill");
  it("shuffles both ways, sprints toward the partner and backpedals, never crossing the feet", () => {
    const xs = frames.map((f) => drawn(f, f.pts.pelvis)[0]);
    expect(Math.max(...xs)).toBeGreaterThan(25);
    expect(Math.min(...xs)).toBeLessThan(-15);
    const z = frames.map((f) => f.zoom?.s ?? 1);
    expect(range(z), "comes closer and goes back").toBeGreaterThan(0.15);
    for (const f of frames) expect(f.pts.soleL[0] - f.pts.soleR[0]).toBeGreaterThan(14);
  });
});

describe("5-10-5 pro agility shuttle", () => {
  const { def, frames } = played("pro-agility-shuttle");
  const lines = (def.props ?? []).filter((p) => p.kind === "hurdleLine").map((p) => (p.at as Vec)[0]);
  it("draws three lines and travels to both outer ones", () => {
    expect(lines.sort((a, b) => a - b)).toEqual([-120, 0, 120]);
    expect(Math.min(...frames.map((f) => f.pts.soleR[0]))).toBeLessThan(-120);
    expect(Math.max(...frames.map((f) => f.pts.soleL[0]))).toBeGreaterThan(120);
  });
  it("touches each outer line with the outside hand, hips dropped", () => {
    for (const [s, x] of [
      ["L", 120],
      ["R", -120],
    ] as const) {
      const touch = frames.filter((f) => handDown(f, s) < 2 && Math.abs(f.pts[`hand${s}`][0] - x) < 8);
      expect(touch.length, `hand ${s} on the line at ${x}`).toBeGreaterThan(0);
      for (const f of touch) expect(f.pts.pelvis[1]).toBeLessThan(62);
    }
  });
});

describe("T-drill", () => {
  const { def, frames } = played("t-drill");
  it("sprints toward the viewer and backpedals away (drawn growing, then shrinking)", () => {
    const z = frames.map((f) => f.zoom?.s ?? 1);
    expect(Math.min(...z)).toBeLessThan(0.6);
    expect(Math.max(...z)).toBeGreaterThan(0.9);
  });
  it("touches the middle, left and right cones", () => {
    const cones = (def.props ?? []).filter((p) => p.kind === "cone" && p.layer === "front").map((p) => (p.at as Vec)[0]);
    expect(cones.sort((a, b) => a - b)).toEqual([-120, 0, 120]);
    for (const x of cones) {
      const near = frames.some((f) => (["L", "R"] as const).some((s) => handDown(f, s) < 3 && Math.abs(drawn(f, f.pts[`hand${s}`])[0] - x) < 16));
      expect(near, `cone at ${x}`).toBe(true);
    }
    for (const f of frames) expect(f.pts.soleL[0] - f.pts.soleR[0], "feet never cross").toBeGreaterThan(14);
  });
});

describe("three-cone drill", () => {
  const { def, frames } = played("three-cone-drill");
  it("runs both ways along the line, turns round three times during a fade, and loops round the far cone", () => {
    expect(def.view).toBe("side");
    let flips = 0;
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1]!;
      const b = frames[i]!;
      if ((a.flipX === undefined) !== (b.flipX === undefined)) {
        flips++;
        expect(Math.min(a.alpha, b.alpha), "turns happen while faded").toBeLessThan(0.05);
      }
    }
    // Two line touches, the far cone, and the reset to the start line.
    expect(flips).toBe(4);
    expect(Math.min(...frames.map((f) => f.zoom?.s ?? 1)), "goes away to the third cone").toBeLessThan(0.7);
  });
  it("touches the second line and the start line with the hand, low", () => {
    for (const x of [95, -95]) {
      const touch = frames.filter((f) => handDown(f, "R") < 3 && Math.abs(f.pts.handR[0] - x) < 10);
      expect(touch.length, `line at ${x}`).toBeGreaterThan(0);
    }
  });
  it("keeps planted feet still (outside the turns)", () => {
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1]!;
      const b = frames[i]!;
      if (Math.min(a.alpha, b.alpha) < 0.999 || (a.flipX === undefined) !== (b.flipX === undefined)) continue;
      for (const k of ["heelL", "heelR", "ballL", "ballR"] as const)
        if (a.pts[k][1] < 0.4 && b.pts[k][1] < 0.4) expect(Math.abs(b.pts[k][0] - a.pts[k][0]), `${k} at ${i}`).toBeLessThan(0.5);
    }
  });
});

describe("agility ladder", () => {
  const { def, frames } = played("agility-ladder-drills");
  it("draws a ladder and lands every foot between its rungs, on the balls of the feet", () => {
    const ladder = (def.props ?? []).find((p) => p.kind === "ladder");
    expect(ladder).toBeTruthy();
    const spacing = ladder!.h ?? 45;
    for (const f of frames) {
      for (const s of ["L", "R"] as const) {
        expect(f.pts[`heel${s}`][1], "heel up").toBeGreaterThan(1);
        if (f.pts[`ball${s}`][1] < 0.5) {
          const inBox = (((f.pts[`ball${s}`][0] % spacing) + spacing) % spacing) / spacing;
          expect(inBox, "between the rungs").toBeGreaterThan(0.15);
          expect(inBox).toBeLessThan(0.85);
        }
      }
    }
    expect(def.travel).toBe(2 * spacing);
  });
  it("is quick: at least five foot contacts per second", () => {
    const dur = compileMotion(def).duration;
    let contacts = 0;
    for (let i = 1; i < frames.length; i++) for (const s of ["L", "R"] as const) if (frames[i]!.pts[`ball${s}`][1] < 0.5 && frames[i - 1]!.pts[`ball${s}`][1] >= 0.5) contacts++;
    expect(contacts / dur).toBeGreaterThanOrEqual(4.99);
  });
});

describe("lateral bound", () => {
  const { frames } = played("lateral-bound");
  const onFloor = (f: Frame, s: "L" | "R") => f.pts[`sole${s}`][1] < 1;
  it("lands and sticks on one leg (the other foot off the floor) and is airborne between", () => {
    expect(frames.some((f) => !onFloor(f, "L") && !onFloor(f, "R") && Math.min(f.pts.soleL[1], f.pts.soleR[1]) > 4), "flight").toBe(true);
    for (const s of ["L", "R"] as const) {
      const o = s === "L" ? "R" : "L";
      expect(frames.filter((f) => onFloor(f, s) && f.pts[`sole${o}`][1] > 10).length, `single-leg stick on ${s}`).toBeGreaterThan(20);
    }
    for (const f of frames) expect(onFloor(f, "L") && onFloor(f, "R"), "never both feet down").toBe(false);
  });
  it("swings the arms across the body, not out in a T", () => {
    for (const f of frames) expect(Math.max(f.pose.shL, f.pose.shR)).toBeLessThan(75);
  });
});

describe("acceleration wall drill", () => {
  const { frames } = played("wall-drill");
  it("holds a straight line from head to heel at about 45°, no pike at the hips", () => {
    for (const f of frames) {
      expect(Math.abs(f.seg.T1 - 45)).toBeLessThan(1);
      // The support leg (the lower knee) continues the trunk's line.
      const s = f.pts.kneeL[1] < f.pts.kneeR[1] ? "L" : "R";
      if (f.pts[`ball${s}`][1] < 0.5) expect(Math.abs(f.pose[`hip${s}`]), "support hip straight").toBeLessThan(4);
    }
  });
  it("drives the other knee up with the toes pulled up, hands fixed on the wall", () => {
    const top = frames.reduce((a, b) => (Math.max(b.seg.thighL, b.seg.thighR) > Math.max(a.seg.thighL, a.seg.thighR) ? b : a));
    expect(Math.max(top.seg.thighL, top.seg.thighR), "thigh near level").toBeGreaterThan(65);
    const h0 = frames[0]!.pts.handR;
    for (const f of frames) expect(Math.hypot(f.pts.handR[0] - h0[0], f.pts.handR[1] - h0[1])).toBeLessThan(0.5);
  });
});

describe("dumbbell walking lunge", () => {
  const { def, frames } = played("walking-lunge");
  it("steps forward into each lunge (it travels), back knee just off the floor at the bottom, torso tall", () => {
    expect(def.travel ?? 0).toBeGreaterThan(150);
    const lowest = Math.min(...frames.map((f) => Math.min(f.pts.kneeCapL[1], f.pts.kneeCapR[1])));
    expect(lowest).toBeGreaterThan(1);
    expect(lowest).toBeLessThan(7);
    for (const f of frames) expect(f.seg.T1).toBeLessThan(12);
  });
  it("keeps planted feet still", () => {
    for (let i = 1; i < frames.length; i++)
      for (const k of ["heelL", "heelR", "ballL", "ballR"] as const) {
        const a = frames[i - 1]!.pts[k];
        const b = frames[i]!.pts[k];
        if (a[1] < 0.3 && b[1] < 0.3) expect(Math.abs(b[0] - a[0]), k).toBeLessThan(0.4);
      }
  });
});

describe("bear crawl", () => {
  const { frames } = played("bear-crawl");
  it("crawls on hands and the balls of the feet with the knees hovering an inch or two off the floor", () => {
    for (const f of frames) {
      const knee = Math.min(f.pts.kneeCapL[1], f.pts.kneeCapR[1]);
      expect(knee).toBeGreaterThan(2);
      expect(knee).toBeLessThan(9);
      // Back flat, hips not up in the air: the hips stay below the shoulders.
      expect(f.pts.pelvis[1]).toBeLessThan(f.pts.shoulder[1]);
      expect(Math.min(f.pts.handL[1], f.pts.handR[1]) - BODY.r.hand, "a hand on the floor").toBeLessThan(0.5);
    }
  });
});
