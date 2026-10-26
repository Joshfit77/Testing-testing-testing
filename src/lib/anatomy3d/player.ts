import * as THREE from "three";
import { compileMotion, evaluate, getMotion } from "../exercise-motion";
import type { ExerciseMeta } from "../exercise-motion/types";
import { effortCurve, type EffortCurve } from "./effort";
import { makeEquipment, type EquipmentSet } from "./equipment";
import { addGripMorph } from "./grip";
import { makeAthleteMaterial } from "./material";
import { loadAthlete, makeSkeleton } from "./mesh";
import { muscleId, type Region } from "./muscle-ids";
import { muscleTargets, type MuscleTargets } from "./muscle-map";
import { jointsFromFrame, poseBones } from "./rig";
import { makeStage, type Stage } from "./scene";

/**
 * The 3D exercise player: the gold anatomical athlete performing an exercise from the keyframed motion library,
 * with the worked muscles glowing in time with each rep.
 */
export type CameraView = "front" | "side" | "rear";

export interface PlayerExercise {
  slug: string;
  name: string;
  pattern: string;
  primary: string[];
  secondary: string[];
  meta?: ExerciseMeta;
}

export interface AthletePlayer {
  readonly duration: number;
  readonly targets: MuscleTargets;
  readonly effort: EffortCurve;
  play(): void;
  pause(): void;
  readonly playing: boolean;
  setSpeed(speed: number): void;
  /** Seconds into the loop. */
  seek(t: number): void;
  time(): number;
  setView(view: CameraView): void;
  /** Extra orbit around the athlete (radians), e.g. from dragging. */
  orbit(dYaw: number, dPitch: number): void;
  setGlow(on: boolean): void;
  resize(width: number, height: number): void;
  /** Renders one still (for step thumbnails and the angle buttons) and returns it as a data URL. */
  snapshot(t: number, view: CameraView, width: number, height: number): string;
  /** A still of the athlete standing in the rest pose (no equipment), from any angle, for reviews and diagrams. */
  restStill(o: { yaw: number; distance: number; targetY: number; width: number; height: number; effort?: number; fov?: number }): string;
  /** The athlete standing in the anatomical pose, front or back, with the worked muscles lit (the muscle diagram). */
  diagram(side: "front" | "back", width: number, height: number): string;
  onTick(cb: (t: number, effort: number) => void): void;
  dispose(): void;
}

const VIEW_YAW: Record<CameraView, number> = { front: -0.42, side: -Math.PI / 2 + 0.62, rear: Math.PI + 0.38 };

export async function mountAthlete(
  canvas: HTMLCanvasElement,
  ex: PlayerExercise,
  opts: { assetBase?: string; reducedMotion?: boolean; pixelRatio?: number; hideProps?: string[]; framing?: { distance?: number; targetY?: number } } = {},
): Promise<AthletePlayer> {
  const stage: Stage = makeStage(canvas, { pixelRatio: opts.pixelRatio });
  const { geometry } = await loadAthlete(opts.assetBase);
  const mat = makeAthleteMaterial();
  const { bones, skeleton } = makeSkeleton();
  if (!geometry.morphAttributes.position) addGripMorph(geometry);
  const mesh = new THREE.SkinnedMesh(geometry, mat.material);
  mesh.updateMorphTargets();
  mesh.frustumCulled = false;
  for (const b of bones) mesh.add(b);
  mesh.bind(skeleton, new THREE.Matrix4());
  stage.root.add(mesh);

  const def = getMotion(ex.slug, ex.meta);
  const motion = compileMotion(def);
  const first = evaluate(motion, 0);
  const centerX = first.pts.pelvis[0];
  const barbell = first.props.some((p) => p.def.kind === "barbell");
  const GRIPPED = new Set(["barbell", "dumbbell", "kettlebell", "pullupBar", "trapBar", "farmerHandle", "landmine", "cable", "battleRope", "jumpRope", "yoke", "dipBars"]);
  const grip = first.props.some((p) => GRIPPED.has(p.def.kind)) ? 1 : 0;
  mesh.morphTargetInfluences![0] = grip;
  const equipment: EquipmentSet = makeEquipment(
    first.props.map((p) => p.def).filter((d) => !opts.hideProps?.includes(d.kind)),
    first.view,
    centerX,
  );
  stage.root.add(equipment.group);
  // Side-view motions are authored facing +X; front-view motions face the camera, which is +X too.
  if (first.view === "front") mesh.rotation.y = 0;

  const targets = muscleTargets(ex);
  const effort = effortCurve(def);
  const T = motion.duration;

  let t = def.stillPhase !== undefined && opts.reducedMotion ? def.stillPhase * T : 0;
  let speed = 1;
  let playing = !opts.reducedMotion;
  let glowOn = true;
  let view: CameraView = "front";
  let yawExtra = 0;
  let pitch = 0.08;
  let last = performance.now();
  let raf = 0;
  const listeners: ((t: number, e: number) => void)[] = [];

  const applyGlow = (e: number) => {
    mat.glow.fill(0);
    if (!glowOn) return;
    for (const [r, w] of Object.entries(targets.weights) as [Region, number][]) {
      // Primary muscles swing from a soft ember to full gold; secondary muscles stay softer.
      const g = w >= 0.99 ? 0.08 + 1.05 * e : w * (0.05 + 0.7 * e);
      mat.glow[muscleId(r, 0)] = g;
      mat.glow[muscleId(r, 1)] = g;
    }
  };
  const placeCamera = (cam: THREE.PerspectiveCamera, v: CameraView, aspect: number) => {
    const yaw = VIEW_YAW[v] + (cam === stage.camera ? yawExtra : 0);
    const p = cam === stage.camera ? pitch : 0.08;
    const base = opts.framing?.distance ?? 340;
    const dist = aspect < 0.8 ? base * 1.3 : base;
    // Follow the hips a little so the whole athlete stays in frame as they squat or lie down.
    const target = new THREE.Vector3(0, opts.framing?.targetY ?? 34 + 0.55 * pelvisY, 0);
    cam.position.set(Math.cos(yaw) * Math.cos(p) * dist, target.y + Math.sin(p) * dist + 6, Math.sin(yaw) * Math.cos(p) * dist);
    cam.lookAt(target);
  };
  let pelvisY = 92;
  const poseAt = (time: number) => {
    const f = evaluate(motion, time);
    const j = jointsFromFrame(f, { centerX, barGrip: barbell ? 26 : null });
    pelvisY = j.pelvis.y;
    poseBones(j, bones);
    equipment.update(f, j);
    return f;
  };
  const draw = () => {
    poseAt(t);
    applyGlow(effort.at(t));
    placeCamera(stage.camera, view, stage.camera.aspect);
    stage.render();
    for (const l of listeners) l(t, effort.at(t));
  };
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) t = (t + dt * speed) % T;
    draw();
    raf = requestAnimationFrame(loop);
  };
  // Pause rendering while the canvas is off screen.
  let visible = true;
  const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    if (visible && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    } else if (!visible && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }) : null;
  io?.observe(canvas);
  raf = requestAnimationFrame(loop);

  return {
    duration: T,
    targets,
    effort,
    play() {
      playing = true;
    },
    pause() {
      playing = false;
    },
    get playing() {
      return playing;
    },
    setSpeed(s) {
      speed = s;
    },
    seek(time) {
      t = ((time % T) + T) % T;
      if (!visible || !raf) draw();
    },
    time: () => t,
    setView(v) {
      view = v;
      yawExtra = 0;
      pitch = 0.08;
    },
    orbit(dy, dp) {
      yawExtra += dy;
      pitch = Math.max(-0.15, Math.min(0.7, pitch + dp));
    },
    setGlow(on) {
      glowOn = on;
    },
    resize(w, h) {
      stage.resize(w, h);
    },
    snapshot(time, v, w, h) {
      const size = new THREE.Vector2();
      stage.renderer.getSize(size);
      const aspect = stage.camera.aspect;
      stage.resize(w, h);
      poseAt(time);
      applyGlow(effort.at(time));
      placeCamera(stage.camera, v, w / h);
      const saveYaw = yawExtra;
      stage.render();
      const url = canvas.toDataURL("image/jpeg", 0.85);
      yawExtra = saveYaw;
      stage.resize(size.x, size.y);
      stage.camera.aspect = aspect;
      stage.camera.updateProjectionMatrix();
      draw();
      return url;
    },
    restStill(o) {
      const size = new THREE.Vector2();
      stage.renderer.getSize(size);
      const aspect = stage.camera.aspect;
      const fov = stage.camera.fov;
      const bind = makeSkeleton().bones;
      bones.forEach((b, i) => {
        b.matrix.copy(bind[i]!.matrix);
        b.matrixWorld.copy(b.matrix);
      });
      equipment.group.visible = false;
      mesh.morphTargetInfluences![0] = 0;
      const glowWas = glowOn;
      glowOn = o.effort !== undefined;
      applyGlow(o.effort ?? 0);
      stage.resize(o.width, o.height);
      stage.camera.fov = o.fov ?? 30;
      stage.camera.updateProjectionMatrix();
      stage.camera.position.set(Math.cos(o.yaw) * o.distance, o.targetY + 4, Math.sin(o.yaw) * o.distance);
      stage.camera.lookAt(0, o.targetY, 0);
      stage.render();
      const url = canvas.toDataURL("image/png");
      glowOn = glowWas;
      equipment.group.visible = true;
      mesh.morphTargetInfluences![0] = grip;
      stage.resize(size.x, size.y);
      stage.camera.aspect = aspect;
      stage.camera.fov = fov;
      stage.camera.updateProjectionMatrix();
      draw();
      return url;
    },
    diagram(side, w, h) {
      const size = new THREE.Vector2();
      stage.renderer.getSize(size);
      const aspect = stage.camera.aspect;
      const bind = makeSkeleton().bones;
      bones.forEach((b, i) => {
        b.matrix.copy(bind[i]!.matrix);
        b.matrixWorld.copy(b.matrix);
      });
      equipment.group.visible = false;
      stage.floor.visible = false;
      mesh.morphTargetInfluences![0] = 0;
      applyGlow(1);
      stage.resize(w, h);
      const yaw = side === "front" ? 0 : Math.PI;
      stage.camera.position.set(Math.cos(yaw) * 560, 96, Math.sin(yaw) * 560);
      stage.camera.lookAt(0, 92, 0);
      stage.render();
      const url = canvas.toDataURL("image/jpeg", 0.88);
      equipment.group.visible = true;
      stage.floor.visible = true;
      mesh.morphTargetInfluences![0] = grip;
      stage.resize(size.x, size.y);
      stage.camera.aspect = aspect;
      stage.camera.updateProjectionMatrix();
      draw();
      return url;
    },
    onTick(cb) {
      listeners.push(cb);
    },
    dispose() {
      cancelAnimationFrame(raf);
      io?.disconnect();
      equipment.dispose();
      geometry.dispose();
      mat.material.dispose();
      stage.dispose();
    },
  };
}
