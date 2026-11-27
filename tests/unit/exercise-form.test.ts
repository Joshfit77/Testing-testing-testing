/**
 * Form checks for the animated exercise demonstrations: contact with equipment and the floor, the features that make
 * one variation different from another, limb lengths and framing. These guard the corrections from the full visual
 * review (docs/exercise-review/REVIEW.md); they can't judge everything a coach would, so the contact sheets
 * (scripts/exercise-review/contact-sheets.mjs) remain the way to inspect the drawings themselves.
 */
import { EXERCISES } from "@/data/exercises";
import { getMotion } from "@/lib/exercise-motion";
import { BODY } from "@/lib/exercise-motion/skeleton";
import { compileMotion, motionBounds, sampleFrames } from "@/lib/exercise-motion/timeline";
import type { ExerciseMeta, Frame, Landmark, MotionDef, Vec } from "@/lib/exercise-motion/types";

const metaOf = (slug: string): ExerciseMeta => {
  const e = EXERCISES.find((x) => x.slug === slug);
  if (!e) throw new Error(`unknown exercise ${slug}`);
  return { slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };
};
const motion = (slug: string): MotionDef => getMotion(slug, metaOf(slug));
const frames = (slug: string, n = 48): Frame[] => sampleFrames(compileMotion(motion(slug)), n);
const lowest = (fr: Frame[], lm: Landmark = "pelvis") => fr.reduce((a, b) => (b.pts[lm][1] < a.pts[lm][1] ? b : a));
const highest = (fr: Frame[], lm: Landmark) => fr.reduce((a, b) => (b.pts[lm][1] > a.pts[lm][1] ? b : a));
const prop = (f: Frame, id: string) => {
  const p = f.props.find((x) => x.def.id === id);
  if (!p) throw new Error(`no prop ${id}`);
  return p;
};
const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const span = (f: Frame, a: Landmark, b: Landmark) => Math.abs(f.pts[a][0] - f.pts[b][0]);

describe("exercise form: corrected demonstrations", () => {
  it("a sumo deadlift is shown from the front with a wide stance — it no longer looks like a conventional deadlift", () => {
    const sumo = motion("sumo-deadlift");
    expect(sumo.view).toBe("front");
    expect(motion("conventional-deadlift").view).toBe("side");
    const fr = frames("sumo-deadlift");
    for (const f of fr) {
      // Feet more than twice shoulder width apart, plates outside the feet.
      expect(span(f, "soleL", "soleR")).toBeGreaterThan(2 * span(f, "shoulderL", "shoulderR"));
      expect(prop(f, "bar").def.variant).toBe("front");
      expect(64).toBeGreaterThan(Math.abs(f.pts.soleL[0] - prop(f, "bar").at[0]) + 8);
    }
    const bottom = lowest(fr, "hands");
    expect(bottom.pts.hands[1]).toBeCloseTo(22.5, 0); // bar on the floor
    expect(span(bottom, "handL", "handR")).toBeLessThan(span(bottom, "kneeL", "kneeR")); // hands inside the knees
    expect(span(bottom, "kneeL", "kneeR")).toBeGreaterThanOrEqual(span(bottom, "soleL", "soleR") - 2); // knees out over the toes
    // Torso more upright at the floor than the conventional pull.
    const conv = lowest(frames("conventional-deadlift"), "hands");
    expect(bottom.pose.trunkD).toBeLessThan(conv.pose.trunk - 8);
    const top = highest(fr, "hands");
    expect(top.pose.trunkD).toBeLessThan(3); // locked out tall
  });

  it("sit-to-stand sits onto the chair, then leans forward to stand", () => {
    const fr = frames("box-squat-to-chair");
    const f = lowest(fr, "butt");
    const chair = prop(f, "chair");
    expect(Math.abs(f.pts.butt[1] - chair.at[1])).toBeLessThan(1.5);
    expect(f.pts.butt[0]).toBeGreaterThan(chair.at[0] - 42);
    expect(f.pts.butt[0]).toBeLessThan(chair.at[0]);
    expect(f.pose.trunk).toBeLessThan(35);
    // Seat-off lean before standing, but not a hinge to horizontal.
    const lean = Math.max(...fr.map((x) => x.pose.trunk));
    expect(lean).toBeGreaterThan(35);
    expect(lean).toBeLessThan(55);
  });

  it("the barbell box squat sits back onto the box", () => {
    const f = lowest(frames("box-squat"), "butt");
    const box = prop(f, "box");
    expect(Math.abs(f.pts.butt[1] - (box.def.h ?? 0))).toBeLessThan(1.5);
    expect(Math.abs(f.pts.butt[0] - box.at[0])).toBeLessThan((box.def.w ?? 0) / 2);
  });

  it("child's pose rests the knees, shins, forehead and hands on the floor with the hips back on the heels", () => {
    for (const f of frames("childs-pose", 12)) {
      expect(f.pts.kneeCapR[1]).toBeLessThan(1.5);
      expect(f.pts.ankleR[1]).toBeLessThan(BODY.r.ankle + 4); // shin flat, ankle resting on the pointed foot
      expect(f.pts.foreheadFront[1]).toBeLessThan(5);
      for (const s of ["L", "R"] as const) expect(f.pts[`hand${s}`][1] - BODY.r.hand).toBeLessThan(1.5);
      expect(f.pts.pelvis[1] - f.pts.heelR[1]).toBeLessThan(BODY.r.thighTop);
    }
  });

  it("world's greatest stretch keeps one hand on the floor inside the front foot and reaches the other to the ceiling", () => {
    const fr = frames("worlds-greatest-stretch");
    for (const f of fr) {
      expect(f.pts.handL[1] - BODY.r.hand).toBeLessThan(1.5);
      expect(Math.abs(f.pts.handL[0] - f.pts.soleR[0])).toBeLessThan(12);
    }
    const reach = highest(fr, "handR");
    expect(reach.pts.handR[1] - reach.pts.shoulder[1]).toBeGreaterThan(55);
    expect(Math.abs(reach.pts.handR[0] - reach.pts.shoulder[0])).toBeLessThan(8);
    const elbowDown = lowest(fr, "elbowR");
    expect(elbowDown.pts.elbowR[1]).toBeLessThan(40); // inside elbow drops toward the instep
  });

  it.each(["atlas-stone-load", "sandbag-load-over-bar"])("%s: the platform is just past the toes and the object stays against the body until it lands", (slug) => {
    const fr = frames(slug, 60);
    for (const f of fr) {
      const plat = prop(f, "plat");
      const edge = plat.at[0] - (plat.def.w ?? 0) / 2;
      expect(edge).toBeGreaterThan(f.pts.toeR[0] + 2);
      expect(edge - f.pts.toeR[0]).toBeLessThan(35);
      const obj = prop(f, "obj");
      const r = slug === "atlas-stone-load" ? (obj.def.size ?? 23) : 14;
      const onPlatform = Math.abs(obj.at[1] - ((plat.def.h ?? 0) + r)) < 1.5 && obj.at[0] > edge;
      const lifted = obj.at[1] > r + 2;
      if (!lifted || onPlatform || f.alpha < 0.99) continue;
      const near = Math.min(...(["chest", "belly", "thighR", "kneeR", "hands"] as const).map((k) => dist(obj.at, f.pts[k])));
      expect(near - r, `${slug} object held away from the body`).toBeLessThan(8);
    }
  });

  it("sandbag to shoulder lands the bag on the shoulder, drawn behind the head", () => {
    const fr = frames("sandbag-to-shoulder", 60);
    const top = highest(fr.filter((f) => prop(f, "obj").layer === "mid"), "shoulder");
    const bag = prop(top, "obj");
    expect(Math.abs(bag.at[0] - top.pts.shoulder[0])).toBeLessThan(12);
    expect(bag.at[1] - top.pts.shoulder[1]).toBeGreaterThan(0);
    expect(bag.at[1] - top.pts.shoulder[1]).toBeLessThan(14);
  });

  it.each(["pull-up", "chin-up", "band-assisted-pull-up"])("%s: the chin clears the bar at the top and the body doesn't swing", (slug) => {
    const fr = frames(slug, 60);
    const bar = prop(fr[0]!, "bar").at;
    const top = highest(fr, "head");
    const chin = top.pts.head[1] - BODY.headR * 0.8;
    expect(chin).toBeGreaterThan(bar[1]);
    const xs = fr.map((f) => f.pts.pelvis[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(25);
    // Up once and down once per rep.
    let turns = 0;
    let prev = 0;
    for (let i = 1; i < fr.length; i++) {
      const d = fr[i]!.pts.shoulder[1] - fr[i - 1]!.pts.shoulder[1];
      if (Math.abs(d) < 0.3) continue;
      if (prev && Math.sign(d) !== Math.sign(prev)) turns++;
      prev = d;
    }
    expect(turns).toBeLessThanOrEqual(2);
  });

  it("leg press: the back pad lies along the lifter's back", () => {
    for (const f of frames("leg-press", 12)) {
      const m = prop(f, "m");
      const back = (Math.atan2(f.pts.upperBack[0] - f.pts.butt[0], f.pts.upperBack[1] - f.pts.butt[1]) * 180) / Math.PI;
      expect(Math.abs((m.def.angle ?? 0) - back)).toBeLessThan(6);
      expect(dist(m.at, f.pts.butt)).toBeLessThan(2);
    }
  });

  it("barbell hip thrust: upper back on the bench and chin tucked at the top", () => {
    const fr = frames("hip-thrust");
    const top = highest(fr, "pelvis");
    expect(top.pose.neck).toBeGreaterThan(35);
    for (const f of fr) expect(Math.abs(f.pts.upperBack[1] - (prop(f, "bench").at[1] + 2))).toBeLessThan(1);
  });
});

describe("exercise form: variations stay distinct", () => {
  it("incline press is on an incline, flat press is flat", () => {
    const flat = lowest(frames("dumbbell-bench-press"), "hands");
    const incline = lowest(frames("incline-dumbbell-press"), "hands");
    expect(Math.abs(flat.pose.trunk + 90)).toBeLessThan(3);
    expect(incline.pose.trunk - flat.pose.trunk).toBeGreaterThan(25);
  });

  it("front squat keeps a more upright torso than the back squat", () => {
    expect(lowest(frames("front-squat")).pose.trunk).toBeLessThan(lowest(frames("back-squat")).pose.trunk - 10);
  });

  it("Bulgarian split squat keeps the rear foot up on the bench", () => {
    for (const f of frames("bulgarian-split-squat")) expect(Math.min(f.pts.toeL[1], f.pts.ballL[1])).toBeGreaterThan(30);
  });

  it("kettlebell swing is a hip hinge, not a squat", () => {
    const fr = frames("kettlebell-swing");
    expect(Math.max(...fr.map((f) => f.pose.trunk))).toBeGreaterThan(55);
    expect(Math.max(...fr.map((f) => f.pose.kneeR))).toBeLessThan(40);
  });

  it("Romanian deadlift keeps soft knees; a conventional deadlift starts with bent knees", () => {
    expect(Math.max(...frames("romanian-deadlift").map((f) => f.pose.kneeR))).toBeLessThan(30);
    expect(Math.max(...frames("conventional-deadlift").map((f) => f.pose.kneeR))).toBeGreaterThan(60);
  });
});

describe("exercise form: every catalog exercise", () => {
  const LEN = 0.6;
  it.each(EXERCISES.map((e) => e.slug))("%s: limbs never stretch longer than the body", (slug) => {
    const def = motion(slug);
    for (const f of sampleFrames(compileMotion(def), 24)) {
      for (const s of ["L", "R"] as const) {
        const sh = def.view === "front" ? f.pts[`shoulder${s}`] : f.pts.shoulder;
        expect(dist(sh, f.pts[`elbow${s}`])).toBeLessThan(BODY.upperArm + LEN);
        expect(dist(f.pts[`elbow${s}`], f.pts[`hand${s}`])).toBeLessThan(BODY.forearm + LEN);
        expect(dist(f.pts[`knee${s}`], f.pts[`ankle${s}`])).toBeLessThan(BODY.shin + LEN);
      }
    }
  });

  it.each(EXERCISES.map((e) => e.slug))("%s: the figure fills the frame and the label names the view", (slug) => {
    const def = motion(slug);
    const c = compileMotion(def);
    const b = motionBounds(c);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const f of sampleFrames(c, 24)) {
      for (const p of Object.values(f.pts)) {
        x0 = Math.min(x0, p[0] - f.cameraX);
        x1 = Math.max(x1, p[0] - f.cameraX);
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
      }
    }
    // In a 4:3 player, the figure's larger extent covers at least half the frame (no tiny figure lost among equipment).
    const scale = Math.min(4 / (b.x1 - b.x0), 3 / (b.y1 - b.y0));
    expect(Math.max(((x1 - x0) * scale) / 4, ((y1 - y0) * scale) / 3)).toBeGreaterThan(0.55);
    expect(def.label).toMatch(def.view === "front" ? /^Front view\./ : /^(Side view|View from above)\./);
  });
});
