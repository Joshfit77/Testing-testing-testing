/**
 * Rig lab: the Écorché model on the anatomical rig, posed from goals, for checking deformation and the solver.
 *   bash scripts/anatomy/lab/build.sh && node scripts/anatomy/lab/run.mjs <out dir> [pose ...]
 */
import * as THREE from "three";
import { mountModel, type ModelFace } from "../../../src/lib/anatomy3d/model-viewer";
import type { RigMeta } from "../../../src/lib/anatomy3d/body/skeleton";
import { gripOn, restGoals, type PoseGoals } from "../../../src/lib/anatomy3d/body/solve";

declare global {
  interface Window {
    lab?: unknown;
    ready?: boolean;
  }
}

const bin = async (u: string) => (await fetch(u)).arrayBuffer();
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

(async () => {
  const canvas = document.querySelector("canvas")!;
  const glb = await bin("anatomy/ecorche.glb");
  const face: ModelFace = { meta: await (await fetch("anatomy/ecorche-face.json")).json(), data: await bin("anatomy/ecorche-face.bin") };
  const rig = { meta: (await (await fetch("anatomy/ecorche-rig.json")).json()) as RigMeta, data: await bin("anatomy/ecorche-rig.bin") };
  const look = new URLSearchParams(location.search).get("look") === "gold" ? "gold" : "original";
  const viewer = await mountModel(canvas, { glb, face, look, rig, pixelRatio: 1 });
  viewer.resize(600, 800);
  const body = viewer.body!;
  const sk = body.bound.sk;
  const J = rig.meta.joints;
  const rotY = (deg: number) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), (deg * Math.PI) / 180);
  const rotZ = (deg: number) => new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), (deg * Math.PI) / 180);
  void rotY;
  const sh = (s: "R" | "L") => V(...J[s].shoulder);

  // Named test poses.
  const poses: Record<string, () => PoseGoals> = {
    rest: () => restGoals(sk),
    overhead: () => {
      const g = restGoals(sk);
      for (const s of ["R", "L"] as const) {
        const sign = s === "R" ? 1 : -1;
        const bar = { at: V(-1, 212, 0), axis: V(0, 0, 1) };
        const grip = gripOn(sk, s, { at: bar.at.clone().setZ(sign * 26), axis: bar.axis }, V(0, 0, -sign), sh(s), 1.4);
        g.arms[s] = { wrist: grip.wrist, hand: grip.hand, pole: V(0, 0, sign), grip: { kind: "wrap", radius: 1.4 } };
      }
      return g;
    },
    lateral: () => {
      const g = restGoals(sk);
      for (const s of ["R", "L"] as const) {
        const sign = s === "R" ? 1 : -1;
        g.arms[s] = { wrist: V(3, 146, sign * 72), pole: V(-0.3, 1, 0), pronation: 100, grip: { kind: "wrap", radius: 1.6 } };
      }
      return g;
    },
    front: () => {
      const g = restGoals(sk);
      for (const s of ["R", "L"] as const) {
        const sign = s === "R" ? 1 : -1;
        g.arms[s] = { wrist: V(56, 146, sign * 20), pole: V(0, -1, sign * 0.4), pronation: 150, grip: { kind: "wrap", radius: 1.6 } };
      }
      return g;
    },
    curl: () => {
      const g = restGoals(sk);
      for (const s of ["R", "L"] as const) {
        const sign = s === "R" ? 1 : -1;
        g.arms[s] = { wrist: V(12, 140, sign * 24), pole: V(-1, -0.3, 0), pronation: 0, grip: { kind: "wrap", radius: 1.6 } };
      }
      return g;
    },
    hammer: () => {
      const g = restGoals(sk);
      for (const s of ["R", "L"] as const) {
        const sign = s === "R" ? 1 : -1;
        g.arms[s] = { wrist: V(12, 140, sign * 24), pole: V(-1, -0.3, 0), pronation: 90, grip: { kind: "wrap", radius: 1.6 } };
      }
      return g;
    },
    reachAcross: () => {
      const g = restGoals(sk);
      g.arms.R = { wrist: V(40, 150, -30), pole: V(0, -1, 0.5), pronation: 120, grip: { kind: "fist" } };
      g.arms.L = { wrist: V(-30, 100, -32), pole: V(0, 0, -1), pronation: 60 };
      return g;
    },
    squat: () => {
      const g = restGoals(sk);
      g.pelvis.pos.set(-22, 55, 0);
      g.pelvis.rot = rotZ(-18).multiply(sk.restRot[sk.i("pelvis")]!);
      g.chest = rotZ(-38).multiply(sk.restRot[sk.i("thorax2")]!);
      g.head = rotZ(-10).multiply(sk.restRot[sk.i("head")]!);
      for (const s of ["R", "L"] as const) {
        const sign = s === "R" ? 1 : -1;
        g.legs[s] = { ankle: V(0, 6.9, sign * 16), pole: V(1, 0, sign * 0.5) };
        g.arms[s] = { wrist: V(40, 112, sign * 22), pole: V(-0.4, -1, sign * 0.4), pronation: 150, grip: { kind: "relaxed" } };
      }
      return g;
    },
    deadlift: () => {
      const g = restGoals(sk);
      for (const s of ["R", "L"] as const) {
        const sign = s === "R" ? 1 : -1;
        const grip = gripOn(sk, s, { at: V(9, 76, sign * 24), axis: V(0, 0, 1) }, V(0, 0, -sign), sh(s), 1.4);
        g.arms[s] = { wrist: grip.wrist, hand: grip.hand, pole: V(-1, 0, sign * 0.3), grip: { kind: "wrap", radius: 1.4 } };
      }
      return g;
    },
  };
  window.lab = {
    poses: Object.keys(poses),
    pose(name: string) {
      return body.pose(poses[name]!());
    },
    still(yaw: number, w = 600, h = 800) {
      return viewer.still({ yaw, width: w, height: h });
    },
    /** Tints the parts whose names match (debugging which part is which); "" clears. */
    tint(re: string, color = "#22ff44") {
      for (const [name, m] of body.bound.parts) {
        const on = re && new RegExp(re, "i").test(name);
        if (on) {
          if (!m.userData.origMat) m.userData.origMat = m.material;
          const mat = (m.userData.origMat as THREE.MeshStandardMaterial).clone();
          mat.vertexColors = false;
          mat.color.set(color);
          mat.onBeforeCompile = (m.userData.origMat as THREE.Material).onBeforeCompile;
          mat.customProgramCacheKey = (m.userData.origMat as THREE.Material).customProgramCacheKey;
          m.material = mat;
        } else if (m.userData.origMat && !re) m.material = m.userData.origMat;
      }
    },
    hide(re: string) {
      for (const [name, m] of body.bound.parts) {
        m.userData.wasVisible ??= m.visible;
        m.visible = (m.userData.wasVisible as boolean) && !(re && new RegExp(re, "i").test(name));
      }
    },
    closeup(yaw: number, y: number, dist: number, w = 600, h = 600) {
      return viewer.still({ yaw, width: w, height: h, distance: dist, targetY: y });
    },
  };
  window.ready = true;
})();
