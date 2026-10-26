import * as THREE from "three";
import { BIND, type V3 } from "./bind";
import { BONES, type BoneName } from "./muscle-ids";

/** Layout of public/anatomy/athlete.json (written by scripts/anatomy/build-athlete.mts and reweight.mts). */
interface AthleteMeta {
  version: number;
  vertices: number;
  triangles: number;
  layout: Record<string, { offset: number; length: number; type: string }>;
}

const TYPES: Record<string, new (buf: ArrayBuffer, offset: number, length: number) => ArrayBufferView> = {
  Float32Array,
  Uint32Array,
  Uint16Array,
  Uint8Array,
  Int8Array,
};

export interface AthleteGeometry {
  geometry: THREE.BufferGeometry;
  vertices: number;
}

let cached: Promise<AthleteGeometry> | null = null;

/**
 * Loads the athlete mesh once per page. `detail: "mobile"` draws the lighter index buffer (about 45% of the
 * triangles, same vertices, so skinning, glow and shading data are unchanged) where the asset has one.
 */
export function loadAthlete(base = "/anatomy/athlete", detail: "full" | "mobile" = "full"): Promise<AthleteGeometry> {
  cached ??= (async () => {
    const [metaRes, binRes] = await Promise.all([fetch(`${base}.json`), fetch(`${base}.bin`)]);
    if (!metaRes.ok || !binRes.ok) throw new Error("The 3D athlete couldn't be loaded.");
    const meta = (await metaRes.json()) as AthleteMeta;
    const buf = await binRes.arrayBuffer();
    const part = (name: string) => {
      const l = meta.layout[name]!;
      return new TYPES[l.type]!(buf, l.offset, l.length);
    };
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(part("position") as Float32Array, 3));
    const indexName = detail === "mobile" && meta.layout.indexLod1 ? "indexLod1" : "index";
    g.setIndex(new THREE.BufferAttribute(part(indexName) as Uint16Array | Uint32Array, 1));
    g.setAttribute("skinIndex", new THREE.BufferAttribute(part("skinIndex") as Uint8Array, 4));
    g.setAttribute("skinWeight", new THREE.BufferAttribute(part("skinWeight") as Uint8Array, 4, true));
    g.setAttribute("muscleA", new THREE.BufferAttribute(part("muscleA") as Uint8Array, 1));
    g.setAttribute("muscleMix", new THREE.BufferAttribute(part("muscleMix") as Uint8Array, 1, true));
    g.setAttribute("tissue", new THREE.BufferAttribute(part("tissue") as Uint8Array, 1));
    g.setAttribute("fiber", new THREE.BufferAttribute(part("fiber") as Int8Array, 3, true));
    const ao = meta.layout.ao ? (part("ao") as Uint8Array) : new Uint8Array(meta.vertices).fill(255);
    g.setAttribute("ao", new THREE.BufferAttribute(ao, 1, true));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return { geometry: g, vertices: meta.vertices };
  })();
  return cached;
}

/** A bone's frame: origin at its start joint, Y along the bone, X forward, Z = X × Y. */
export interface BoneFrame {
  origin: V3;
  y: V3;
  x: V3;
}

const v3 = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

export function frameMatrix(f: BoneFrame, out = new THREE.Matrix4()): THREE.Matrix4 {
  const y = v3(f.y).normalize();
  const x = v3(f.x).sub(y.clone().multiplyScalar(v3(f.x).dot(y)));
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0).sub(y.clone().multiplyScalar(y.x));
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  out.makeBasis(x, y, z);
  out.setPosition(f.origin[0], f.origin[1], f.origin[2]);
  return out;
}

/** The rest-pose frame of every bone (shared by the mesh's bind matrices and the rig). */
export function bindFrames(): Record<BoneName, BoneFrame> {
  const R = BIND.R;
  const L = BIND.L;
  const fwd: V3 = [1, 0, 0];
  const seg = (a: V3, b: V3, x: V3 = fwd): BoneFrame => ({ origin: a, y: [b[0] - a[0], b[1] - a[1], b[2] - a[2]], x });
  const handStart = (S: typeof R): V3 => {
    const d = [S.hand[0] - S.elbow[0], S.hand[1] - S.elbow[1], S.hand[2] - S.elbow[2]];
    const l = Math.hypot(d[0]!, d[1]!, d[2]!);
    return [S.elbow[0] + (d[0]! / l) * 25, S.elbow[1] + (d[1]! / l) * 25, S.elbow[2] + (d[2]! / l) * 25];
  };
  return {
    pelvis: seg(BIND.pelvis, BIND.mid),
    chest: seg(BIND.mid, BIND.neckBase),
    neck: seg(BIND.neckBase, BIND.neckTop),
    head: seg(BIND.neckTop, BIND.headTop),
    clavR: seg(BIND.neckBase, [BIND.neckBase[0], BIND.neckBase[1] + 10, BIND.neckBase[2]]),
    clavL: seg(BIND.neckBase, [BIND.neckBase[0], BIND.neckBase[1] + 10, BIND.neckBase[2]]),
    upperArmR: seg(R.shoulder, R.elbow),
    foreArmR: seg(R.elbow, R.hand),
    handR: seg(handStart(R), R.hand),
    upperArmL: seg(L.shoulder, L.elbow),
    foreArmL: seg(L.elbow, L.hand),
    handL: seg(handStart(L), L.hand),
    thighR: seg(R.hip, R.knee),
    shinR: seg(R.knee, R.ankle),
    footR: seg(R.ankle, R.ball, [0, -1, 0]),
    thighL: seg(L.hip, L.knee),
    shinL: seg(L.knee, L.ankle),
    footL: seg(L.ankle, L.ball, [0, -1, 0]),
  };
}

/** Bones laid out flat (each bone's matrix is its full world transform), ready for a SkinnedMesh. */
export function makeSkeleton(): { bones: THREE.Bone[]; skeleton: THREE.Skeleton } {
  const frames = bindFrames();
  const bones = BONES.map((name) => {
    const b = new THREE.Bone();
    b.name = name;
    b.matrixAutoUpdate = false;
    frameMatrix(frames[name], b.matrix);
    return b;
  });
  const inverses = BONES.map((name) => frameMatrix(frames[name]).invert());
  return { bones, skeleton: new THREE.Skeleton(bones, inverses) };
}
