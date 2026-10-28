import * as THREE from "three";
import { getMotion } from "../../exercise-motion";
import { bindModel, type BoundBody } from "../body/bind-model";
import type { RigMeta } from "../body/skeleton";
import type { SolveReport } from "../body/solve";
import { effortCurve, type EffortCurve } from "../effort";
import type { PlayerExercise } from "../player";
import { makePerformer, type Performer } from "./perform";
import { hasSpec, specFor } from "./specs";

/**
 * The Écorché model performing an exercise on the anatomical rig (body/, motion3d/): binds the file's parts to the
 * skeleton, then each frame the performer poses the skeleton and the equipment. Same controls as the first rig's
 * mover (play, pause, seek, speed, the camera's follow points), so the viewer and the video renderer use either.
 */
export interface Mover3 {
  bound: BoundBody;
  performer: Performer;
  /** True when the exercise has its own spec (equipment and grips); false: lifted motion, free hands, no equipment. */
  converted: boolean;
  bounds: THREE.Box3;
  travels: boolean;
  following(): THREE.Box3;
  advance(dt: number): void;
  followY(): number;
  poseAt(t: number): void;
  bodyShift(y: number): THREE.Vector3;
  /** The last frame's solve report (contacts, limits). */
  report(): SolveReport;
  motion: {
    bounds: THREE.Box3;
    travels: boolean;
    reach: THREE.Box3;
    skinnedMeshes: number;
    duration: number;
    effort: EffortCurve;
    play(): void;
    pause(): void;
    readonly playing: boolean;
    setSpeed(s: number): void;
    seek(t: number): void;
    time(): number;
    onTick(cb: (t: number, e: number) => void): void;
  };
}

export function moveModel3(
  scene: THREE.Scene,
  model: THREE.Object3D,
  o: { ex: PlayerExercise; rig: { meta: RigMeta; data: ArrayBuffer }; reducedMotion?: boolean },
  changed: () => void,
): Mover3 {
  const bound = bindModel(model, o.rig);
  const sk = bound.sk;
  const spec = specFor(o.ex.slug);
  const performer = makePerformer(sk, o.ex.meta ?? { slug: o.ex.slug }, spec);
  const fromRig = bound.fileToRig.clone().invert();
  const rigSpace = new THREE.Group();
  rigSpace.matrixAutoUpdate = false;
  rigSpace.matrix.copy(fromRig);
  rigSpace.add(performer.group);
  scene.add(rigSpace);
  const def = getMotion(o.ex.slug, o.ex.meta);
  const effort = effortCurve(def);
  const T = performer.duration;
  let t = def.stillPhase !== undefined && o.reducedMotion ? def.stillPhase * T : 0;
  let speed = 1;
  let playing = !o.reducedMotion;
  let last: SolveReport = performer.pose(t);
  const listeners: ((t: number, e: number) => void)[] = [];
  const at = (name: string) => sk.pos[sk.i(name)]!;
  // Points up the body for the close-up camera: ankles, knees, pelvis, mid-back, neck, head, top of the head.
  const upPoints = () => {
    const mid = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().add(b).multiplyScalar(0.5);
    const head = at("head");
    const top = sk.point(sk.i("head"), new THREE.Vector3(...(sk.meta.joints.spine.headTop as [number, number, number])));
    return [mid(at("footR"), at("footL")), mid(at("shinR"), at("shinL")), at("pelvis").clone(), at("thorax1").clone(), at("neck").clone(), head.clone(), top];
  };
  sk.reset();
  const restUp = upPoints();
  last = performer.pose(t);
  let nowUp = upPoints();
  const pose = () => {
    last = performer.pose(t);
    bound.update();
    nowUp = upPoints();
    for (const l of listeners) l(t, effort.at(t));
  };
  // The space the exercise takes over a rep (file frame), and the body's own reach round the pelvis.
  const bounds = new THREE.Box3();
  const bodyReach = new THREE.Box3();
  const pelvisNow = new THREE.Vector3();
  {
    const q = new THREE.Vector3();
    const eb = new THREE.Box3();
    for (let i = 0; i < 24; i++) {
      t = (i / 24) * T;
      pose();
      const pv = at("pelvis").clone().applyMatrix4(fromRig);
      for (const p of sk.pos) {
        bounds.expandByPoint(q.copy(p).applyMatrix4(fromRig));
        bodyReach.expandByPoint(q.sub(pv));
      }
      rigSpace.updateMatrixWorld(true);
      eb.setFromObject(performer.group);
      if (!eb.isEmpty()) bounds.expandByPoint(q.set(bounds.min.x, eb.min.y, bounds.min.z)).expandByPoint(q.set(bounds.max.x, eb.max.y, bounds.max.z));
    }
    bounds.expandByScalar(0.12);
    bodyReach.expandByScalar(0.12);
    t = def.stillPhase !== undefined && o.reducedMotion ? def.stillPhase * T : 0;
  }
  const across = (b: THREE.Box3) => Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  const travels = across(bounds) > across(bodyReach) + 0.6;
  pose();
  const v = new THREE.Vector3();
  const motion: Mover3["motion"] = {
    bounds,
    travels,
    reach: bodyReach,
    skinnedMeshes: bound.parts.size,
    duration: T,
    effort,
    play() {
      playing = true;
      changed();
    },
    pause() {
      playing = false;
    },
    get playing() {
      return playing;
    },
    setSpeed(s: number) {
      speed = s;
    },
    seek(time: number) {
      t = ((time % T) + T) % T;
      pose();
      changed();
    },
    time: () => t,
    onTick(cb) {
      listeners.push(cb);
    },
  };
  return {
    bound,
    performer,
    converted: hasSpec(o.ex.slug),
    bounds,
    travels,
    following: () => {
      pelvisNow.copy(at("pelvis")).applyMatrix4(fromRig);
      return bodyReach.clone().translate(pelvisNow);
    },
    advance(dt: number) {
      if (playing) t = (((t + dt * speed) % T) + T) % T;
      pose();
    },
    followY: () => v.set(0, 34 + 0.55 * at("pelvis").y, 0).applyMatrix4(fromRig).y,
    poseAt(time: number) {
      t = ((time % T) + T) % T;
      pose();
    },
    bodyShift(y: number) {
      const r = v.set(0, y, 0).applyMatrix4(bound.fileToRig).y;
      let k = 0;
      while (k < restUp.length - 2 && r > restUp[k + 1]!.y) k++;
      const s = THREE.MathUtils.clamp((r - restUp[k]!.y) / (restUp[k + 1]!.y - restUp[k]!.y), 0, 1);
      const d = (i: number) => nowUp[i]!.clone().sub(restUp[i]!);
      return d(k).lerp(d(k + 1), s).applyMatrix3(new THREE.Matrix3().setFromMatrix4(fromRig));
    },
    report: () => last,
    motion,
  };
}
