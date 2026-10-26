import { BONES, NO_MUSCLE, REGION_COUNT, type BoneName } from "../../src/lib/anatomy3d/muscle-ids";

/**
 * Skin weights for the athlete. Each vertex first belongs to its nearest bone (distance scaled by the bone's flesh
 * radius, so the side of the chest belongs to the chest, not the arm hanging next to it). Near a joint, the weight
 * then blends between the two bones by how far along the child bone the vertex lies, which bends joints like a hinge
 * with a soft crease (the glutes stay half on the pelvis, half on the thigh, so they round out in a squat).
 */
type V3 = [number, number, number];
export interface BindPose {
  pelvis: V3;
  mid: V3;
  neckBase: V3;
  neckTop: V3;
  headTop: V3;
  R: Record<"shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle" | "heel" | "toe", V3>;
  L: Record<"shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle" | "heel" | "toe", V3>;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Marks a vertex as free (no forced bone) in `forced`. */
export const NO_BONE = 255;

export function computeWeights(
  pos: Float32Array,
  idx: ArrayLike<number>,
  label: Uint8Array,
  B: BindPose,
  /** Optional bone index per vertex that overrides the computed weights (e.g. rigid bones). */
  forced?: Uint8Array,
): { skinIndex: Uint8Array; skinWeight: Uint8Array } {
  const NV = pos.length / 3;
  const NB = BONES.length;
  type Seg = { bone: BoneName; a: V3; b: V3; r: number; side: 0 | 1 | -1 };
  const segs: Seg[] = [
    { bone: "pelvis", a: B.pelvis, b: B.mid, r: 13, side: -1 },
    { bone: "chest", a: B.mid, b: B.neckBase, r: 14, side: -1 },
    { bone: "neck", a: B.neckBase, b: B.neckTop, r: 6, side: -1 },
    { bone: "head", a: B.neckTop, b: B.headTop, r: 9, side: -1 },
    ...(["R", "L"] as const).flatMap((s): Seg[] => {
      const J = B[s];
      const side = s === "R" ? 0 : 1;
      const fd = norm(sub(J.wrist, J.elbow));
      return [
        { bone: `upperArm${s}`, a: J.shoulder, b: J.elbow, r: 5.6, side },
        { bone: `foreArm${s}`, a: J.elbow, b: J.wrist, r: 4.4, side },
        { bone: `hand${s}`, a: J.wrist, b: add(J.wrist, mul(fd, 17)), r: 3.2, side },
        { bone: `thigh${s}`, a: J.hip, b: J.knee, r: 8.5, side },
        { bone: `shin${s}`, a: J.knee, b: J.ankle, r: 5.6, side },
        { bone: `foot${s}`, a: J.heel, b: J.toe, r: 4.2, side },
      ];
    }),
  ];
  const segDist = (p: V3, s: Seg) => {
    const ab = sub(s.b, s.a);
    const t = Math.max(0, Math.min(1, dot(sub(p, s.a), ab) / dot(ab, ab)));
    return len(sub(p, add(s.a, mul(ab, t))));
  };
  // Joints: parent, child, centre, the child's direction, blend range along it (cm), and reach from the centre.
  type Joint = { parent: BoneName; child: BoneName; c: V3; dir: V3; r0: number; r1: number; reach: number };
  const joints: Joint[] = [
    { parent: "pelvis", child: "chest", c: B.mid, dir: norm(sub(B.neckBase, B.mid)), r0: -7, r1: 7, reach: 40 },
    { parent: "chest", child: "neck", c: B.neckBase, dir: norm(sub(B.neckTop, B.neckBase)), r0: -2, r1: 3, reach: 14 },
    { parent: "neck", child: "head", c: B.neckTop, dir: norm(sub(B.headTop, B.neckTop)), r0: -1.5, r1: 2.5, reach: 14 },
    ...(["R", "L"] as const).flatMap((s): Joint[] => {
      const J = B[s];
      return [
        { parent: "chest", child: `upperArm${s}`, c: J.shoulder, dir: norm(sub(J.elbow, J.shoulder)), r0: -5, r1: 6, reach: 16 },
        { parent: `upperArm${s}`, child: `foreArm${s}`, c: J.elbow, dir: norm(sub(J.wrist, J.elbow)), r0: -3.5, r1: 3.5, reach: 11 },
        { parent: `foreArm${s}`, child: `hand${s}`, c: J.wrist, dir: norm(sub(J.wrist, J.elbow)), r0: -1.5, r1: 2, reach: 8 },
        { parent: "pelvis", child: `thigh${s}`, c: J.hip, dir: norm(sub(J.knee, J.hip)), r0: -4, r1: 10, reach: 24 },
        { parent: `thigh${s}`, child: `shin${s}`, c: J.knee, dir: norm(sub(J.ankle, J.knee)), r0: -4.5, r1: 4.5, reach: 13 },
        { parent: `shin${s}`, child: `foot${s}`, c: J.ankle, dir: [0, -1, 0], r0: -0.5, r1: 4, reach: 12 },
      ];
    }),
  ];
  const W = new Float32Array(NV * NB);
  const bi = (b: BoneName) => BONES.indexOf(b);
  for (let n = 0; n < NV; n++) {
    const p: V3 = [pos[n * 3]!, pos[n * 3 + 1]!, pos[n * 3 + 2]!];
    const l = label[n]!;
    const vs = l !== NO_MUSCLE ? (l >= REGION_COUNT ? 1 : 0) : Math.abs(p[2]) < 2.5 ? -1 : p[2] > 0 ? 0 : 1;
    if (forced && forced[n]! !== NO_BONE) {
      W[n * NB + forced[n]!] = 1;
      continue;
    }
    let best: Seg | null = null, bestD = Infinity;
    for (const s of segs) {
      if (s.side !== -1 && vs !== -1 && s.side !== vs) continue;
      if (s.side !== -1 && vs === -1 && (s.side === 0) !== p[2] > 0) continue;
      const d = segDist(p, s) / s.r;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    let primary = best!.bone;
    // Hands and fingers belong to the hand, however close they hang to the thigh.
    for (const sd of ["R", "L"] as const) {
      const J = B[sd];
      const fd = norm(sub(J.wrist, J.elbow));
      const along = dot(sub(p, J.wrist), fd);
      const off = len(sub(sub(p, J.wrist), mul(fd, along)));
      if (along > -1 && along < 24 && off < 13 && (sd === "R") === p[2] > 0) primary = `hand${sd}`;
    }
    // The face and jaw hang in front of and below the top of the neck: they move with the head.
    if ((p[1] > B.neckTop[1] - 8 && p[0] > B.neckTop[0] + 3.5 && Math.abs(p[2]) < 9) || p[1] > B.neckTop[1] + 1.5) {
      W[n * NB + bi("head")] = 1;
      continue;
    }
    // The nearest joint that involves this bone decides the blend.
    let joint: Joint | null = null, jd = Infinity;
    for (const j of joints) {
      if (j.parent !== primary && j.child !== primary) continue;
      const d = len(sub(p, j.c));
      if (d < j.reach && d < jd) {
        jd = d;
        joint = j;
      }
    }
    if (!joint) {
      W[n * NB + bi(primary)] = 1;
      continue;
    }
    const t = dot(sub(p, joint.c), joint.dir);
    const wc = smoothstep(joint.r0, joint.r1, t);
    W[n * NB + bi(joint.child)]! += wc;
    W[n * NB + bi(joint.parent)]! += 1 - wc;
  }
  // Smooth over the surface so creases stay soft.
  const nb: number[][] = Array.from({ length: NV }, () => []);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]!, b = idx[i + 1]!, c = idx[i + 2]!;
    nb[a]!.push(b, c);
    nb[b]!.push(a, c);
    nb[c]!.push(a, b);
  }
  for (let it = 0; it < 4; it++) {
    const next = new Float32Array(W.length);
    for (let n = 0; n < NV; n++) {
      const ns = nb[n]!;
      for (let k = 0; k < NB; k++) {
        let s = W[n * NB + k]! * 2;
        for (const m of ns) s += W[m * NB + k]! / ns.length;
        next[n * NB + k] = s / 3;
      }
    }
    W.set(next);
  }
  const skinIndex = new Uint8Array(NV * 4);
  const skinWeight = new Uint8Array(NV * 4);
  for (let n = 0; n < NV; n++) {
    const row = Array.from(W.subarray(n * NB, (n + 1) * NB)).map((w, k) => [w, k] as [number, number]);
    row.sort((a, b) => b[0] - a[0]);
    const top = row.slice(0, 4);
    const sum = top.reduce((s, [w]) => s + w, 0) || 1;
    let acc = 0;
    top.forEach(([w, k], i) => {
      skinIndex[n * 4 + i] = k;
      const q = i === 3 ? 255 - acc : Math.round((w / sum) * 255);
      skinWeight[n * 4 + i] = Math.max(0, q);
      acc += q;
    });
  }
  return { skinIndex, skinWeight };
}
