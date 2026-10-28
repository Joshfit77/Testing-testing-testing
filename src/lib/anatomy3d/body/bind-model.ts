import * as THREE from "three";
import { applyDualQuaternionSkinning } from "./dqs";
import { attachCorrectives, Correctives, type CorrectiveMeta } from "./correctives";
import { Skeleton3, type RigMeta } from "./skeleton";

/**
 * Binds the loaded Écorché model to the anatomical skeleton: every part of the file becomes a skinned mesh (same
 * geometry, material, place in the scene) with the rig's weights (public/anatomy/ecorche-rig.*), skinned with dual
 * quaternions, or linearly for the muscles the rig marks so. Face layers take their source part's weights; the face
 * surface takes its own block.
 */
export interface BoundBody {
  sk: Skeleton3;
  bones: THREE.Bone[];
  skeleton: THREE.Skeleton;
  /** Writes the skeleton's current pose to the meshes. */
  update(): void;
  /** The file's parts, as skinned meshes, by name. */
  parts: Map<string, THREE.SkinnedMesh>;
  /** The rig frame from the file frame. */
  fileToRig: THREE.Matrix4;
  /** The pose-space corrective shapes, when given (public/anatomy/ecorche-correctives.*). */
  correctives: Correctives | null;
}

export interface RigFiles {
  meta: RigMeta;
  data: ArrayBuffer;
  /** Corrective shapes for the shoulders and hips (body/correctives.ts); without them the skinning alone. */
  correctives?: { meta: CorrectiveMeta; data: ArrayBuffer };
}

export function bindModel(model: THREE.Object3D, rig: RigFiles): BoundBody {
  const sk = new Skeleton3(rig.meta);
  const { bones, skeleton } = sk.makeThree();
  const fileToRig = sk.fileToRig();
  const bytes = new Uint8Array(rig.data);
  model.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  const extra: THREE.Mesh[] = [];
  model.traverse((m) => {
    if (m instanceof THREE.Mesh) (m.userData.faceFor || m.userData.faceShell ? extra : meshes).push(m);
  });
  if (meshes.length !== rig.meta.meshes.length) throw new Error(`rig weights are for ${rig.meta.meshes.length} parts, the file has ${meshes.length}`);
  const entryOf = new Map(meshes.map((m, i) => [m as THREE.Object3D, rig.meta.meshes[i]!]));
  const indexOf = new Map(meshes.map((m, i) => [m as THREE.Object3D, i]));
  /** The rig's parts as skinned meshes, in the rig's order (the correctives name them by index). */
  const rigMeshes: (THREE.SkinnedMesh | null)[] = meshes.map(() => null);
  const skinned: THREE.SkinnedMesh[] = [];
  const parts = new Map<string, THREE.SkinnedMesh>();
  const materials = new Set<THREE.Material>();
  for (const m of [...meshes, ...extra]) {
    const g = m.geometry;
    let own: Uint8Array;
    if (m.userData.faceShell) {
      const f = rig.meta.face;
      if (!f || g.getAttribute("position").count !== f.count) throw new Error("rig weights do not match the face surface");
      own = bytes.subarray(f.offset * 8, (f.offset + f.count) * 8);
    } else {
      const entry = entryOf.get(m.userData.faceFor ?? m)!;
      if (g.getAttribute("position").count !== entry.count) throw new Error(`rig weights do not match ${m.name}`);
      own = bytes.subarray(entry.offset * 8, (entry.offset + entry.count) * 8);
    }
    const ib = new THREE.InterleavedBuffer(own, 8);
    g.setAttribute("skinIndex", new THREE.InterleavedBufferAttribute(ib, 4, 0));
    g.setAttribute("skinWeight", new THREE.InterleavedBufferAttribute(ib, 4, 4, true));
    // Linear (1) or dual-quaternion (0) blending, per vertex (all of a part alike).
    const linear = !m.userData.faceShell && entryOf.get(m.userData.faceFor ?? m)!.linear ? 255 : 0;
    g.setAttribute("skinLinear", new THREE.BufferAttribute(new Uint8Array(g.getAttribute("position").count).fill(linear), 1, true));
    const sm = new THREE.SkinnedMesh(g, m.material);
    sm.name = m.name;
    sm.position.copy(m.position);
    sm.quaternion.copy(m.quaternion);
    sm.scale.copy(m.scale);
    sm.frustumCulled = false;
    sm.visible = m.visible;
    sm.userData = m.userData;
    sm.bindMode = THREE.DetachedBindMode;
    m.parent!.add(sm);
    m.parent!.remove(m);
    for (const mat of [sm.material].flat()) materials.add(mat);
    skinned.push(sm);
    if (!m.userData.faceFor && !m.userData.faceShell) {
      parts.set(m.name, sm);
      rigMeshes[indexOf.get(m)!] = sm;
    }
  }
  model.updateMatrixWorld(true);
  model.traverse((m) => {
    if (m instanceof THREE.SkinnedMesh) m.bind(skeleton, fileToRig.clone().multiply(m.matrixWorld));
  });
  for (const mat of materials) applyDualQuaternionSkinning(mat);
  let correctives: Correctives | null = null;
  if (rig.correctives) {
    correctives = new Correctives(rig.correctives.meta, rig.correctives.data);
    attachCorrectives(correctives, skinned, rigMeshes, materials);
  }
  return {
    sk,
    bones,
    skeleton,
    parts,
    fileToRig,
    correctives,
    update() {
      sk.write(bones);
      correctives?.update(sk);
    },
  };
}
