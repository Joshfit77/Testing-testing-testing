import * as THREE from "three";
import { BIND, type V3 } from "./bind";
import { BONES } from "./muscle-ids";

/**
 * A "grip" morph target: the fingers roll forward around a bar-sized cylinder, so the athlete can hold a barbell,
 * dumbbell or pull-up bar. Each point of a finger beyond the knuckles is mapped onto an arc of radius `curl`, which
 * keeps the finger's length and thickness while wrapping it (about 200° for a full grip).
 */
export function addGripMorph(geometry: THREE.BufferGeometry, curl = 2.6): void {
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const si = geometry.getAttribute("skinIndex") as THREE.BufferAttribute;
  const sw = geometry.getAttribute("skinWeight") as THREE.BufferAttribute;
  const delta = new Float32Array(pos.count * 3);
  const hands = (["R", "L"] as const).map((s) => {
    const J = BIND[s];
    const wrist = v(J.wrist);
    const dir = wrist.clone().sub(v(J.elbow)).normalize();
    const palm = new THREE.Vector3(1, 0, 0).addScaledVector(dir, -dir.x).normalize(); // palms face forward at rest
    return { bone: BONES.indexOf(`hand${s}`), wrist, dir, palm, axis: new THREE.Vector3().crossVectors(dir, palm).normalize(), reach: 0 };
  });
  const p = new THREE.Vector3();
  const owner = new Int8Array(pos.count).fill(-1);
  const handW = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    for (let k = 0; k < 4; k++) {
      const h = hands.findIndex((x) => x.bone === si.getComponent(i, k));
      const w = sw.getComponent(i, k);
      if (h >= 0 && w > handW[i]!) {
        owner[i] = h;
        handW[i] = w;
      }
    }
    if (owner[i]! >= 0) {
      const hd = hands[owner[i]!]!;
      hd.reach = Math.max(hd.reach, p.fromBufferAttribute(pos, i).sub(hd.wrist).dot(hd.dir));
    }
  }
  const q = new THREE.Quaternion();
  const o = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    if (owner[i]! < 0) continue;
    const hd = hands[owner[i]!]!;
    const knuckle = hd.reach * 0.52;
    p.fromBufferAttribute(pos, i).sub(hd.wrist);
    const along = p.dot(hd.dir);
    const s = along - knuckle;
    if (s <= 0) continue;
    const phi = s / curl;
    o.copy(p).addScaledVector(hd.dir, -along); // offset from the hand's centre line
    q.setFromAxisAngle(hd.axis, phi);
    o.applyQuaternion(q);
    const target = hd.dir.clone().multiplyScalar(knuckle + curl * Math.sin(phi)).addScaledVector(hd.palm, curl * (1 - Math.cos(phi))).add(o);
    const w = Math.min(1, handW[i]! * 1.3);
    delta[i * 3] = (target.x - p.x) * w;
    delta[i * 3 + 1] = (target.y - p.y) * w;
    delta[i * 3 + 2] = (target.z - p.z) * w;
  }
  geometry.morphAttributes.position = [new THREE.BufferAttribute(delta, 3)];
  geometry.morphTargetsRelative = true;
}

const v = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
