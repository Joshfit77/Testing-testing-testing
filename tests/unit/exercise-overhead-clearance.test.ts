/**
 * Equipment must never pass through the head (fixed 2026-11-20). Push press, log press, the axle clean and press and the
 * strict log press used to drive the bar or log through the face (by up to 20 cm), and the power clean brought the jaw
 * into the bar as it was lowered. These check every frame the player draws (60 fps, and 120 fps for the 0.5× button)
 * of every upright exercise that holds a bar, axle or log in front of the face, plus the push press's own mechanics.
 * They cannot judge technique; no coach has reviewed these demonstrations.
 */
import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { getMotion, getMotionViews } from "@/lib/exercise-motion";
import { PRESS_IMPLEMENT_R } from "@/lib/exercise-motion/patterns/upper";
import { BODY } from "@/lib/exercise-motion/skeleton";
import { compileMotion, sampleFrames } from "@/lib/exercise-motion/timeline";
import type { ExerciseMeta, Frame, MotionDef, PropDef, Vec } from "@/lib/exercise-motion/types";

const meta = (slug: string): ExerciseMeta => {
  const e = EXERCISES.find((x) => x.slug === slug)!;
  return { slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };
};
const frames = (d: MotionDef, fps = 60): Frame[] => {
  const c = compileMotion(d);
  return sampleFrames(c, Math.max(2, Math.round(c.duration * fps)));
};
/** The bar, axle or log held in the hands, if the motion has one. */
const implementOf = (d: MotionDef): PropDef | undefined =>
  d.props?.find((p) => (p.kind === "barbell" || p.kind === "log") && !Array.isArray(p.at) && (p.at as { lm?: string }).lm === "hands");
const radius = (p: PropDef) => (p.kind === "log" ? PRESS_IMPLEMENT_R("log") : p.variant === "axle" ? PRESS_IMPLEMENT_R("axle") : PRESS_IMPLEMENT_R("barbell"));
const at = (f: Frame, p: PropDef): Vec => f.props.find((q) => q.def.id === p.id)!.at;
/** Near edge of the implement in front of the forehead, the head's centre line and the crown, within its reach (cm). */
const boxClear = (f: Frame, b: Vec, r: number) => {
  let w = Infinity;
  for (const q of [f.pts.foreheadFront, f.pts.head, f.pts.headTop]) if (Math.abs(q[1] - b[1]) < r + 9) w = Math.min(w, b[0] - r - q[0]);
  return w;
};
/** Gap between the implement and the whole head (a circle of the head's radius, chin and jaw included). */
const headClear = (f: Frame, b: Vec, r: number) => Math.hypot(b[0] - f.pts.head[0], b[1] - f.pts.head[1]) - r - BODY.headR;
const upright = (f: Frame) => f.pts.head[1] > 120;

const OVERHEAD = EXERCISES.flatMap((e) =>
  getMotionViews(e.slug, meta(e.slug))
    .filter((v) => v.view === "side" && implementOf(v.def))
    .map((v) => ({ slug: e.slug, def: v.def, imp: implementOf(v.def)! })),
);

describe("no bar, axle or log passes through the head", () => {
  it("covers the presses and cleans this guards", () => {
    const slugs = new Set(OVERHEAD.map((o) => o.slug));
    for (const s of ["overhead-press", "push-press", "log-press", "strict-log-press", "axle-clean-and-press", "power-clean", "seated-barbell-shoulder-press"]) expect(slugs.has(s), s).toBe(true);
  });

  it("every upright frame keeps the implement in front of the face and clear of the whole head", () => {
    const bad: string[] = [];
    for (const { slug, def, imp } of OVERHEAD) {
      const r = radius(imp);
      for (const f of [...frames(def), ...frames(def, 120)].filter(upright)) {
        const b = at(f, imp);
        const box = boxClear(f, b, r);
        const head = headClear(f, b, r);
        // A log is round: the head-circle gap is its true clearance. A bar is thin: it must also stay in front of the face.
        if ((imp.kind !== "log" && box < 0.25) || head < 1.4) bad.push(`${slug}: box ${box.toFixed(1)} cm, head ${head.toFixed(1)} cm at bar (${b[0].toFixed(0)}, ${b[1].toFixed(0)})`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("the push press keeps the bar at least 3 cm in front of the face, up and down (it went 5 cm through it)", () => {
    const def = getMotion("push-press", meta("push-press"));
    for (const f of frames(def, 120)) expect(boxClear(f, at(f, implementOf(def)!), 2)).toBeGreaterThan(3);
  });
});

describe("push press mechanics", () => {
  const def = getMotion("push-press", meta("push-press"));
  const fr = frames(def);
  const bar = (f: Frame) => at(f, implementOf(def)!);
  const standing = fr[0]!;

  it("dips about 6–12 cm at the knees with the bar on the shoulders, torso upright, heels down", () => {
    const low = fr.reduce((a, f) => (f.pts.shoulder[1] < a.pts.shoulder[1] ? f : a));
    const drop = standing.pts.shoulder[1] - low.pts.shoulder[1];
    expect(drop).toBeGreaterThan(6);
    expect(drop).toBeLessThan(12);
    expect(Math.abs(low.pose.trunk)).toBeLessThan(8);
    expect(bar(low)[1]).toBeLessThan(low.pts.shoulder[1] + 10);
    for (const f of fr) expect(Math.abs(f.pts.heelR[1]), "heel on the floor").toBeLessThan(1.5);
  });

  it("locks out with straight arms over mid-foot and the head back under the bar", () => {
    const top = fr.reduce((a, f) => (bar(f)[1] > bar(a)[1] ? f : a));
    expect(top.pose.elR).toBeLessThan(15);
    expect(Math.abs(bar(top)[0] - -1)).toBeLessThan(6);
    expect(Math.abs(top.pose.neck)).toBeLessThan(4);
  });

  it("the drive is quick and the lowering controlled; the loop closes without a jump", () => {
    const c = compileMotion(def);
    const topY = Math.max(...fr.map((f) => bar(f)[1]));
    const tTop = fr.findIndex((f) => bar(f)[1] > topY - 1) / fr.length;
    const tDip = fr.indexOf(fr.reduce((a, f) => (f.pts.shoulder[1] < a.pts.shoulder[1] ? f : a))) / fr.length;
    // From the bottom of the dip to lockout in about a second (a strict press takes about 1.1 s from the shoulders).
    expect((tTop - tDip) * c.duration).toBeLessThan(1.3);
    const last = fr[fr.length - 1]!;
    expect(Math.hypot(bar(last)[0] - bar(standing)[0], bar(last)[1] - bar(standing)[1])).toBeLessThan(1.5);
    let step = 0;
    for (let i = 0; i < fr.length; i++) step = Math.max(step, Math.hypot(bar(fr[(i + 1) % fr.length]!)[0] - bar(fr[i]!)[0], bar(fr[(i + 1) % fr.length]!)[1] - bar(fr[i]!)[1]));
    expect(step, "bar travel per frame at 60 fps (cm)").toBeLessThan(6);
  });
});

describe("log press", () => {
  for (const slug of ["log-press", "strict-log-press"]) {
    it(`${slug}: the log rests on the upper chest, well in front of the body, its top below the eyes`, () => {
      const def = getMotion(slug, meta(slug));
      const fr = frames(def);
      const log = implementOf(def)!;
      // The rack: the log at its lowest while at chest height (within 1 cm of it), standing.
      const chest = fr.filter((f) => upright(f) && at(f, log)[1] > f.pts.shoulder[1] - 10);
      const low = Math.min(...chest.map((f) => at(f, log)[1]));
      const racked = chest.filter((f) => at(f, log)[1] < low + 1);
      expect(racked.length).toBeGreaterThan(5);
      for (const f of racked) {
        expect(at(f, log)[0] - f.pts.shoulder[0], "log forward of the shoulder").toBeGreaterThan(14);
        expect(at(f, log)[1] + 15, "top of the log below the line of the eyes").toBeLessThan(f.pts.head[1]);
      }
    });
  }
});
