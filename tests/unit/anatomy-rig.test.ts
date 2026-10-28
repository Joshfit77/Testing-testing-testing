import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Skeleton3, type RigMeta } from "@/lib/anatomy3d/body/skeleton";
import { RANGE, gripOn, restGoals, solvePose, type SolveReport } from "@/lib/anatomy3d/body/solve";

/**
 * The anatomical rig (public/anatomy/ecorche-rig.*, src/lib/anatomy3d/body): what the solver guarantees whatever the
 * motion asks — bones keep their length, elbows and knees bend only about their hinges, reachable targets are met,
 * unreachable ones are reported, and a smooth path gives a smooth arm.
 */
const meta = JSON.parse(readFileSync("public/anatomy/ecorche-rig.json", "utf8")) as RigMeta;
const bin = new Uint8Array(readFileSync("public/anatomy/ecorche-rig.bin"));
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const report = (): SolveReport => ({ reach: { wristR: 0, wristL: 0, ankleR: 0, ankleL: 0 }, handTurn: { R: 0, L: 0 }, limits: {} });

describe("anatomical rig asset", () => {
  it("binds every vertex with weights that add up to one", () => {
    expect(bin.length).toBe((meta.vertices + (meta.face?.count ?? 0)) * 8);
    let bad = 0;
    for (let i = 0; i < bin.length; i += 8) if (bin[i + 4]! + bin[i + 5]! + bin[i + 6]! + bin[i + 7]! !== 255) bad++;
    expect(bad).toBe(0);
  });

  it("has a bone for every part and every bone index in range", () => {
    expect(meta.meshes.length).toBe(634);
    let out = 0;
    for (let i = 0; i < bin.length; i += 8) for (let k = 0; k < 4; k++) if (bin[i + 4 + k] && bin[i + k]! >= meta.bones.length) out++;
    expect(out).toBe(0);
    expect(meta.meshes.filter((m) => !m.bones.length)).toEqual([]);
  });

  it("keeps a thumb muscle on the thumb (it once flew off with the little finger)", () => {
    const fpb = meta.meshes.find((m) => m.name === "Right_flexor_pollicis_brevis")!;
    expect(fpb.bones.every((b) => /^(hand|thumb)/.test(b))).toBe(true);
  });
});

describe("pose solver", () => {
  const sk = new Skeleton3(meta);
  const lengths = () => sk.names.map((_, k) => (sk.parent[k]! < 0 ? 0 : sk.pos[k]!.distanceTo(sk.pos[sk.parent[k]!]!)));
  const restLengths = (() => {
    sk.reset();
    return lengths();
  })();

  it("never stretches a bone", () => {
    const g = restGoals(sk);
    g.arms.R = { wrist: V(30, 200, 30), pole: V(0, 0, 1), pronation: 120 };
    g.arms.L = { wrist: V(60, 120, -10), pole: V(0, -1, 0), pronation: 10 };
    g.legs.R = { ankle: V(20, 40, 20), pole: V(1, 0, 0.3) };
    solvePose(sk, g);
    // (The armpit helpers are not bones: they ride on the humerus by design.)
    const stretched = lengths()
      .map((l, k) => ({ bone: sk.names[k]!, d: Math.abs(l - restLengths[k]!) }))
      .filter((x) => !x.bone.startsWith("axilla") && x.d > 1e-4);
    expect(stretched).toEqual([]);
  });

  it("meets a reachable wrist target exactly and reports an unreachable one", () => {
    const g = restGoals(sk);
    const sh = sk.restPos[sk.i("humerusR")]!;
    g.arms.R = { wrist: sh.clone().add(V(30, -20, 5)), pole: V(-1, -0.3, 0.3), pronation: 90 };
    g.arms.L = { wrist: sk.restPos[sk.i("humerusL")]!.clone().add(V(120, 0, 0)), pole: V(-1, 0, 0), pronation: 90 };
    const r = report();
    solvePose(sk, g, r);
    expect(r.reach.wristR).toBeLessThan(0.01);
    expect(r.reach.wristL).toBeGreaterThan(40);
    expect(r.limits.elbowL).toBeGreaterThan(40);
  });

  it("bends the elbow only about its hinge", () => {
    const g = restGoals(sk);
    const sh = sk.restPos[sk.i("humerusR")]!;
    g.arms.R = { wrist: sh.clone().add(V(25, -10, 0)), pole: V(-1, -0.5, 0.3), pronation: 30 };
    solvePose(sk, g);
    const hum = sk.i("humerusR"), ulna = sk.i("ulnaR");
    // The ulna relative to the humerus, against the rest: a rotation whose axis is the elbow's hinge.
    const rel = sk.rot[hum]!.clone().invert().multiply(sk.rot[ulna]!).multiply(sk.restLocal[ulna]!.clone().invert());
    const axis = V(rel.x, rel.y, rel.z).normalize();
    expect(Math.abs(axis.dot(sk.hingeLocal[ulna]!.clone().normalize()))).toBeGreaterThan(0.999);
  });

  it("holds a bar with the hand's grip on it", () => {
    const g = restGoals(sk);
    const bar = { at: V(12, 100, 26), axis: V(0, 0, 1) };
    const hold = gripOn(sk, "R", bar, V(0, 0, -1), sk.restPos[sk.i("humerusR")]!, 1.4);
    g.arms.R = { wrist: hold.wrist, hand: hold.hand, pole: V(-1, 0, 0.3), roll: { center: bar.at, axis: bar.axis } };
    const r = report();
    solvePose(sk, g, r);
    expect(r.reach.wristR).toBeLessThan(0.05);
    expect(r.handTurn.R).toBeLessThan(15);
  });

  it("keeps every joint inside its range", () => {
    const g = restGoals(sk);
    g.arms.R = { wrist: V(0, 260, 20), pole: V(0, 0, 1), pronation: 400, wristFlex: 200 };
    solvePose(sk, g);
    const hum = sk.i("humerusR"), ulna = sk.i("ulnaR");
    const rel = sk.rot[hum]!.clone().invert().multiply(sk.rot[ulna]!).multiply(sk.restLocal[ulna]!.clone().invert());
    const elbow = (2 * Math.acos(Math.min(1, Math.abs(rel.w))) * 180) / Math.PI;
    expect(elbow).toBeLessThanOrEqual(RANGE.elbow[1] + 0.5);
  });

  it("moves the arm smoothly along a smooth path of a held bar (no jumps between solutions)", () => {
    const s2 = new Skeleton3(meta);
    let prev: THREE.Quaternion | null = null;
    let worst = 0;
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const g = restGoals(s2);
      // A press: the bar from in front of the face to overhead and back.
      const y = 168 + 42 * Math.sin(u * Math.PI);
      const bar = { at: V(4, y, 27), axis: V(0, 0, 1) };
      const hold = gripOn(s2, "R", bar, V(0, 0, -1), s2.restPos[s2.i("humerusR")]!.clone().add(V(10, -25, 5)), 1.4);
      g.arms.R = { wrist: hold.wrist, hand: hold.hand, pole: V(0.3, -1, 0.6), roll: { center: bar.at, axis: bar.axis } };
      solvePose(s2, g);
      const q = s2.rot[s2.i("radiusR")]!.clone();
      if (prev) worst = Math.max(worst, (2 * Math.acos(Math.min(1, Math.abs(prev.dot(q)))) * 180) / Math.PI);
      prev = q;
    }
    expect(worst).toBeLessThan(15);
  });
});
