/**
 * Regression tests for three corrected drill demonstrations: the A-skip, the 5-10-5 pro agility shuttle and the 90/90
 * hip switch. They check the movement itself (joint positions at the key moments, foot contact, flight, timing and
 * smoothness) on frames sampled exactly as the player draws them, at normal speed and at the 0.5× speed button
 * (which samples the loop twice as densely). They cannot judge how a pose looks: the review sheets and videos
 * (scripts/exercise-review/render-motion.mjs) are for a person, and none of this has been reviewed by a coach.
 */
import { createHash } from "node:crypto";
import { EXERCISES } from "@/data/exercises";
import { getMotion } from "@/lib/exercise-motion";
import { compileMotion, evaluate } from "@/lib/exercise-motion/timeline";
import type { ExerciseMeta, Frame, MotionDef } from "@/lib/exercise-motion/types";

const metaOf = (slug: string): ExerciseMeta => {
  const e = EXERCISES.find((x) => x.slug === slug);
  if (!e) throw new Error(`unknown exercise ${slug}`);
  return { slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };
};
const motion = (slug: string): MotionDef => getMotion(slug, metaOf(slug));

/** The frames the player draws for one loop: one every 1/fps seconds of screen time at the given playback speed. */
function played(slug: string, speed: number, fps = 60) {
  const def = motion(slug);
  const c = compileMotion(def);
  // The player advances by speed / fps per frame; round to a whole number of frames so the samples tile the loop.
  const n = Math.round((c.duration * fps) / speed);
  const dt = c.duration / n;
  const frames: Frame[] = [];
  for (let k = 0; k < n; k++) frames.push(evaluate(c, k * dt));
  return { def, c, duration: c.duration, dt, n, frames };
}
const SPEEDS = [1, 0.5] as const;

/** A short fingerprint of every landmark, joint angle and prop over one loop (same algorithm as scripts/exercise-review/fingerprint.mjs). */
function fingerprint(slug: string): string {
  const def = motion(slug);
  const c = compileMotion(def);
  const r = (v: number) => Math.round(v * 1e4) / 1e4;
  const h = createHash("sha1");
  for (let k = 0; k < 72; k++) {
    const f = evaluate(c, (k / 72) * c.duration);
    h.update(JSON.stringify([Object.entries(f.pts).map(([n, p]) => [n, r(p[0]), r(p[1])]), Object.entries(f.pose).map(([n, v]) => [n, r(v)]), f.props.map((p) => [p.def.id, r(p.at[0]), r(p.at[1]), p.layer ?? null]), r(f.alpha), r(f.cameraX)]));
  }
  return h.digest("hex").slice(0, 16);
}

/**
 * Exercises that were not part of this correction, and the fingerprint their animation had before it. A change to
 * the shared engine or to the shared lateral-shuffle / gait code that alters any of them fails here.
 */
const UNCHANGED: Record<string, string> = {
  "lateral-shuffle": "ee4e0659affb492a",
  "t-drill": "89dc58eaf87bf36a",
  "three-cone-drill": "55b2785cf5456cd8",
  "reactive-mirror-drill": "c068d982b8b5b0d1",
};

describe("drill corrections do not disturb other exercises", () => {
  it.each(Object.entries(UNCHANGED))("%s animates exactly as before", (slug, expected) => {
    expect(fingerprint(slug)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------------------------------- A-skip

describe("A-skip", () => {
  const FLOOR = 0.6;
  const onFloor = (f: Frame, s: "L" | "R") => Math.min(f.pts[`heel${s}`][1], f.pts[`ball${s}`][1], f.pts[`toe${s}`][1]) < FLOOR;
  const airborne = (f: Frame) => !onFloor(f, "L") && !onFloor(f, "R");
  const g = played("a-skip", 1, 240);

  /** Runs of consecutive frames where `pred` holds (wrapping the loop), as [startIndex, length]. */
  function runs(frames: Frame[], pred: (f: Frame) => boolean): [number, number][] {
    const n = frames.length;
    const start = frames.findIndex((f) => !pred(f));
    if (start < 0) return [[0, n]];
    const out: [number, number][] = [];
    let i = 0;
    while (i < n) {
      const idx = (start + i) % n;
      if (pred(frames[idx]!)) {
        let len = 0;
        while (i + len < n && pred(frames[(start + i + len) % n]!)) len++;
        out.push([idx, len]);
        i += len;
      } else i++;
    }
    return out;
  }
  const peakOf = (s: "L" | "R") => g.frames.reduce((a, b) => (b.seg[`thigh${s}`] > a.seg[`thigh${s}`] ? b : a));
  const peakIdx = (s: "L" | "R") => g.frames.indexOf(peakOf(s));

  it("is a side view of a drill, not a march or a jog", () => {
    expect(g.def.view).toBe("side");
    expect(g.def.label).toMatch(/^Side view\./);
    // A march never leaves the floor and a jog never lifts the thigh much past 60°; an A-skip does both.
    const march = played("standing-march", 1, 240).frames;
    const jog = played("zone-2-run", 1, 240).frames;
    expect(march.every((f) => onFloor(f, "L") || onFloor(f, "R"))).toBe(true);
    expect(Math.max(...jog.map((f) => f.seg.thighR))).toBeLessThan(70);
    expect(runs(g.frames, airborne).length).toBe(2);
    expect(Math.max(...g.frames.map((f) => f.seg.thighR))).toBeGreaterThan(80);
  });

  it("lifts each thigh to about hip height, alternating legs half a loop apart", () => {
    for (const s of ["L", "R"] as const) {
      const p = peakOf(s);
      expect(p.seg[`thigh${s}`], `${s} thigh`).toBeGreaterThan(80);
      expect(p.seg[`thigh${s}`], `${s} thigh`).toBeLessThan(92);
      // The knee itself reaches roughly the height of the hip.
      expect(Math.abs(p.pts[`knee${s}`][1] - p.pts.pelvis[1]), `${s} knee height`).toBeLessThan(8);
    }
    const apart = ((peakIdx("L") - peakIdx("R") + g.n) % g.n) / g.n;
    expect(Math.abs(apart - 0.5)).toBeLessThan(0.02);
  });

  it("holds the raised leg with the knee near 90°, the ankle dorsiflexed and the foot under the knee", () => {
    for (const s of ["L", "R"] as const) {
      const p = peakOf(s);
      expect(p.pose[`knee${s}`]).toBeGreaterThan(88);
      expect(p.pose[`knee${s}`]).toBeLessThan(104);
      expect(p.pose[`ankle${s}`], "dorsiflexed").toBeGreaterThanOrEqual(8);
      expect(p.seg[`foot${s}`], "toes not pointed down").toBeGreaterThan(-5);
      expect(p.pts[`ankle${s}`][1], "foot hangs below the knee").toBeLessThan(p.pts[`knee${s}`][1] - 30);
      expect(Math.abs(p.pts[`ankle${s}`][0] - p.pts[`knee${s}`][0]), "foot under the knee").toBeLessThan(14);
    }
  });

  it("has two brief flight phases with a real ballistic bounce", () => {
    const fl = runs(g.frames, airborne);
    expect(fl.length).toBe(2);
    const stances = runs(g.frames, (f) => !airborne(f));
    for (const [, len] of fl) {
      const secs = len * g.dt;
      expect(secs).toBeGreaterThan(0.1);
      expect(secs).toBeLessThan(0.2);
    }
    // Brief: each flight is shorter than the ground contact before it.
    for (const [, len] of stances) expect(len * g.dt).toBeGreaterThan(0.22);
    const ys = g.frames.map((f) => f.pts.pelvis[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(8);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(16);
    // In the air the pelvis accelerates downward at gravity (980 cm/s²): second difference of its height.
    for (const [start, len] of fl) {
      const acc: number[] = [];
      for (let i = 2; i < len - 2; i++) {
        const a = g.frames[(start + i - 1) % g.n]!.pts.pelvis[1];
        const b = g.frames[(start + i) % g.n]!.pts.pelvis[1];
        const c = g.frames[(start + i + 1) % g.n]!.pts.pelvis[1];
        acc.push((a - 2 * b + c) / (g.dt * g.dt));
      }
      const mean = acc.reduce((x, y) => x + y, 0) / acc.length;
      expect(mean).toBeLessThan(-700);
      expect(mean).toBeGreaterThan(-1300);
    }
  });

  it("strikes down on the ball of the foot under the hips, the foot moving down and back", () => {
    for (const [start] of runs(g.frames, (f) => onFloor(f, "R") || onFloor(f, "L")).filter(([, len]) => len * g.dt > 0.2)) {
      const f0 = g.frames[start]!;
      const s: "L" | "R" = onFloor(f0, "R") && !onFloor(f0, "L") ? "R" : "L";
      // Touchdown frame: the first one with the foot on the floor.
      expect(Math.abs(f0.pts[`ankle${s}`][0] - f0.pts.pelvis[0]), "ankle under the hip").toBeLessThan(6);
      const ahead = f0.pts[`ball${s}`][0] - f0.pts.pelvis[0];
      expect(ahead, "ball just ahead of the hip").toBeGreaterThan(8);
      expect(ahead).toBeLessThan(22);
      expect(f0.pts[`heel${s}`][1] - f0.pts[`ball${s}`][1], "heel up: ball-of-foot contact").toBeGreaterThan(2);
      // 60 ms earlier the foot was higher and further forward of the hip: it is driven down and back.
      const before = g.frames[(start - Math.round(0.06 / g.dt) + g.n) % g.n]!;
      expect(before.pts[`ball${s}`][1] - f0.pts[`ball${s}`][1], "falling onto the ground").toBeGreaterThan(5);
      expect(before.pts[`ball${s}`][0] - before.pts.pelvis[0] - ahead, "moving back relative to the hip").toBeGreaterThan(1);
    }
  });

  it.each(SPEEDS)("keeps the planted foot still on the floor and moves forward steadily at %sx", (speed) => {
    const p = played("a-skip", speed);
    const travel = p.def.travel ?? 0;
    const vs: number[] = [];
    for (let i = 0; i < p.n; i++) {
      const a = p.frames[i]!;
      const b = p.frames[(i + 1) % p.n]!;
      const wrap = i + 1 >= p.n ? travel : 0;
      vs.push((b.pts.pelvis[0] + wrap - a.pts.pelvis[0]) / p.dt / speed); // cm per second of animation time
      for (const s of ["L", "R"] as const) {
        // While the ball of the foot is firmly on the floor (not rolling off it) it must not move.
        if (a.pts[`ball${s}`][1] < 0.25 && b.pts[`ball${s}`][1] < 0.25) {
          const wrapB = b.pts[`ball${s}`][0] + wrap - a.pts[`ball${s}`][0];
          expect(Math.abs(wrapB), `${s} foot slides at frame ${i}`).toBeLessThan(0.5 * speed + 0.1);
        }
      }
    }
    // Forward speed is constant (a skip's body does not stop and start), once the wrap frame is accounted for.
    const mean = vs.reduce((x, y) => x + y, 0) / vs.length;
    for (const v of vs) expect(Math.abs(v - mean) / mean).toBeLessThan(0.04);
  });

  it("swings each arm opposite its leg from the shoulder with elbows near 90°", () => {
    for (const s of ["L", "R"] as const) {
      const o = s === "L" ? "R" : "L";
      const p = peakOf(s);
      // The arm on the side of the raised knee is back, the other forward.
      expect(p.pose[`sh${o}`] - p.pose[`sh${s}`], `${s} knee up`).toBeGreaterThan(70);
      expect(p.pose[`sh${o}`]).toBeGreaterThan(50);
      expect(p.pose[`sh${s}`]).toBeLessThan(-30);
    }
    for (const f of g.frames) {
      for (const s of ["L", "R"] as const) {
        expect(f.pose[`el${s}`]).toBeGreaterThan(80);
        expect(f.pose[`el${s}`]).toBeLessThan(112);
      }
    }
  });

  it("keeps the torso tall and steady with the head level", () => {
    const lean = g.frames.map((f) => f.seg.T1);
    expect(Math.min(...lean)).toBeGreaterThan(2);
    expect(Math.max(...lean)).toBeLessThan(9);
    expect(Math.max(...lean) - Math.min(...lean)).toBeLessThan(2);
    for (const f of g.frames) expect(Math.abs(f.seg.head)).toBeLessThan(8);
  });

  it("the second half of the loop mirrors the first (even rhythm between the legs)", () => {
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * (g.duration / 2);
      const a = evaluate(g.c, t);
      const b = evaluate(g.c, t + g.duration / 2);
      for (const k of ["hip", "knee", "ankle", "sh", "el"] as const) {
        expect(Math.abs(a.pose[`${k}R`] - b.pose[`${k}L`]), `${k} at ${t.toFixed(3)}`).toBeLessThan(0.6);
        expect(Math.abs(a.pose[`${k}L`] - b.pose[`${k}R`]), `${k} at ${t.toFixed(3)}`).toBeLessThan(0.6);
      }
      expect(Math.abs(a.pts.pelvis[1] - b.pts.pelvis[1])).toBeLessThan(0.3);
    }
  });

  it.each(SPEEDS)("moves smoothly frame to frame at %sx (no jumps in the pelvis or any joint)", (speed) => {
    const p = played("a-skip", speed);
    const travel = p.def.travel ?? 0;
    const steps = (get: (f: Frame) => number, wrap = 0) => p.frames.map((f, i) => get(p.frames[(i + 1) % p.n]!) + (i + 1 >= p.n ? wrap : 0) - get(f));
    // A jump is a step far larger than its neighbours; a fast but smooth swing is not.
    const spike = (d: number[]) => Math.max(...d.map((v, i) => Math.abs(v - (d[(i + 1) % d.length]! + d[(i - 1 + d.length) % d.length]!) / 2)));
    const dx = steps((f) => f.pts.pelvis[0], travel);
    const dy = steps((f) => f.pts.pelvis[1]);
    expect(spike(dx), "pelvis x").toBeLessThan(0.3 * speed);
    expect(spike(dy), "pelvis y").toBeLessThan(0.9 * speed);
    expect(Math.max(...dy.map(Math.abs)), "pelvis y step").toBeLessThan(2.5 * speed);
    for (const k of ["hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR", "shL", "shR"] as const) {
      const d = steps((f) => f.pose[k]);
      expect(spike(d), `${k} spike`).toBeLessThan(13 * speed);
      expect(Math.max(...d.map(Math.abs)), `${k} per frame`).toBeLessThan(26 * speed);
    }
  });
});
