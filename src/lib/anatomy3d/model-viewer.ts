import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { compileMotion, evaluate, getMotion } from "../exercise-motion";
import { setRestJoints, type BindJoints } from "./bind";
import { effortCurve, type EffortCurve } from "./effort";
import { makeEquipment } from "./equipment";
import { gripDelta, gripReach } from "./grip";
import { makeSkeleton } from "./mesh";
import type { CameraView, PlayerExercise } from "./player";
import { jointsFromFrame, poseBones } from "./rig";

/**
 * The raw Écorché model in the exercise player, exactly as published: the GLB file (github.com/Charleeh/ecorche,
 * CC BY-SA 4.0) is loaded as it is, with its own meshes, vertex colours and materials. Nothing is rebuilt, re-coloured,
 * rigged or re-shaped; the player only adds the lights, the camera and the controls. The lighting is the studio used
 * for the reference renders (ACES tone mapping, a room environment, one warm key light and one white rim light).
 *
 * The model's frame: metres, Y up, soles on y = 0, facing +Z.
 */
export interface ModelViewer {
  /** Turns the camera around the model (radians); a full 360° turn is allowed. Pitch is kept between -0.6 and 0.9. */
  orbit(dYaw: number, dPitch: number): void;
  /** Zoom by a factor (below 1 moves closer), e.g. from a pinch or the mouse wheel; kept between 0.15× and 1.6×. */
  zoom(factor: number): void;
  /** Moves the point the camera looks at up or down, as a fraction of the model's height (two-finger drag). */
  pan(dHeight: number): void;
  /** Front, side or rear, at the full-body framing. */
  setView(view: CameraView): void;
  resize(width: number, height: number): void;
  /** One still from any angle, as a PNG data URL (for thumbnails and reviews). Distances are in model heights. */
  still(o: { yaw: number; distance?: number; targetY?: number; width: number; height: number }): string;
  /** The model's height in its own units (metres). */
  readonly height: number;
  /** Present when an exercise was given: the model itself performing it (see moveModel). */
  readonly motion?: ModelMotion;
  dispose(): void;
}

export interface ModelMotion {
  /** How many of the file's meshes were bound to the rig (all of them). */
  readonly skinnedMeshes: number;
  readonly duration: number;
  readonly effort: EffortCurve;
  play(): void;
  pause(): void;
  readonly playing: boolean;
  setSpeed(speed: number): void;
  /** Seconds into the loop. */
  seek(t: number): void;
  time(): number;
  onTick(cb: (t: number, effort: number) => void): void;
}

/** Skin weights for the original file (scripts/anatomy/build-ecorche-skin.mts). */
export interface ModelSkin {
  meta: { toRig: number[][]; bind: BindJoints; vertices: number; meshes: { name: string; offset: number; count: number }[] };
  /** Per vertex: four bone indices, then four weights (bytes). */
  data: ArrayBuffer;
}

// (The side view is turned a little towards the front, as in the exercise player, so a barbell's plates do not hide the body.)
const VIEW_YAW: Record<CameraView, number> = { front: 0, side: Math.PI / 2 - 0.55, rear: Math.PI };
const FOV = 30;

export async function mountModel(
  canvas: HTMLCanvasElement,
  /** The GLB file's bytes, as fetched (nothing is changed before it is parsed). */
  opts: {
    glb: ArrayBuffer;
    pixelRatio?: number;
    /** Iris and pupil on the corneas (default on; see paintEyes). */
    eyes?: boolean;
    /** The model performing an exercise: the exercise, the file's skin weights, equipment to leave out. */
    exercise?: { ex: PlayerExercise; skin: ModelSkin; hideProps?: string[]; reducedMotion?: boolean };
  },
): Promise<ModelViewer> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(opts.pixelRatio ?? (typeof devicePixelRatio === "number" ? devicePixelRatio : 1), 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#060504");
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.6;
  const key = new THREE.DirectionalLight("#fff4e8", 2.6);
  key.position.set(-2, 3, 2.6);
  const rim = new THREE.DirectionalLight("#ffffff", 1.4);
  rim.position.set(2, 2, -2.5);
  scene.add(key, rim);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.02, 50);

  const gltf = await new GLTFLoader().parseAsync(opts.glb, "");
  const model = gltf.scene;
  scene.add(model);
  model.updateMatrixWorld(true);
  if (opts.eyes !== false) paintEyes(model);
  const box = new THREE.Box3().setFromObject(model);
  const H = box.max.y - box.min.y;
  const center = box.getCenter(new THREE.Vector3());

  let yaw = 0;
  let pitch = 0.05;
  let zoomK = 1;
  let targetY = center.y;
  let raf = 0;
  // (Redraw requests from the motion: play, seek. Set once `request` exists.)
  let changed = () => {};
  const moving = opts.exercise ? moveModel(scene, model, opts.exercise, () => changed()) : null;

  // Distance that fits the whole figure (with a margin) in the frame, for the current aspect ratio.
  const fitDistance = (aspect: number) => {
    const half = THREE.MathUtils.degToRad(FOV / 2);
    const byHeight = (H * 0.56) / Math.tan(half);
    const byWidth = ((box.max.x - box.min.x) * 0.62) / (Math.tan(half) * aspect);
    return Math.max(byHeight, byWidth);
  };
  const place = (cam: THREE.PerspectiveCamera, y: number, p: number, dist: number, at: THREE.Vector3) => {
    cam.position.set(at.x + Math.sin(y) * Math.cos(p) * dist, at.y + Math.sin(p) * dist, at.z + Math.cos(y) * Math.cos(p) * dist);
    cam.lookAt(at);
  };
  // While an exercise plays, the camera follows the hips down and up (as the exercise player does), on top of the
  // viewer's own up-and-down offset. Zoomed in, it follows the part of the body it is looking at instead, so a
  // close-up of the face stays on the face as he squats and leans.
  const followY = () => (moving ? moving.followY() - center.y : 0);
  const at = new THREE.Vector3();
  const lookAt = () => {
    at.set(center.x, targetY + followY(), center.z);
    if (!moving) return at;
    const close = THREE.MathUtils.clamp((0.85 - zoomK) / 0.45, 0, 1);
    if (close === 0) return at;
    const s = moving.bodyShift(targetY);
    return at.lerp(s.set(center.x + s.x, targetY + s.y, center.z + s.z), close);
  };
  const draw = () => {
    raf = 0;
    place(camera, yaw, pitch, fitDistance(camera.aspect) * zoomK, lookAt());
    renderer.render(scene, camera);
  };
  // While the exercise plays, a frame loop; when it is paused (or there is none), frames only on request.
  // (The first frame after a start only sets the clock: a frame's timestamp can be a little earlier than the moment the
  // loop was asked for, which made a negative step.)
  let last = -1;
  const loop = (now: number) => {
    moving!.advance(last < 0 ? 0 : Math.max(0, Math.min(0.1, (now - last) / 1000)));
    last = now;
    draw();
    if (moving!.motion.playing) raf = requestAnimationFrame(loop);
  };
  const request = () => {
    if (raf) return;
    last = -1;
    raf = requestAnimationFrame(moving?.motion.playing ? loop : draw);
  };
  changed = () => {
    if (raf && moving?.motion.playing) return;
    cancelAnimationFrame(raf);
    raf = 0;
    request();
  };
  if (moving) request();

  const viewer: ModelViewer = {
    height: H,
    orbit(dYaw, dPitch) {
      yaw -= dYaw;
      pitch = Math.max(-0.6, Math.min(0.9, pitch + dPitch));
      request();
    },
    zoom(f) {
      zoomK = Math.max(0.15, Math.min(1.6, zoomK * f));
      request();
    },
    pan(dh) {
      targetY = Math.max(box.min.y + 0.05 * H, Math.min(box.max.y - 0.05 * H, targetY + dh * H));
      request();
    },
    setView(v) {
      yaw = VIEW_YAW[v];
      pitch = 0.05;
      zoomK = 1;
      targetY = center.y;
      request();
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      draw();
    },
    still(o) {
      const size = renderer.getSize(new THREE.Vector2());
      const aspect = camera.aspect;
      const shot = new THREE.PerspectiveCamera(FOV, o.width / o.height, 0.02, 50);
      renderer.setSize(o.width, o.height, false);
      place(shot, o.yaw, 0.05, o.distance !== undefined ? o.distance * H : fitDistance(shot.aspect), new THREE.Vector3(center.x, (o.targetY !== undefined ? box.min.y + o.targetY * H : center.y) + followY(), center.z));
      renderer.render(scene, shot);
      const url = canvas.toDataURL("image/png");
      renderer.setSize(size.x, size.y, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      if (!moving) draw();
      return url;
    },
    motion: moving?.motion,
    dispose() {
      cancelAnimationFrame(raf);
      model.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        for (const m of [o.material].flat() as THREE.Material[]) m.dispose();
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
  return viewer;
}

/**
 * The one addition to the model's look, asked for by the owner: the published eyes are blank white (a sclera and a
 * cornea, no iris), so an iris and a pupil are painted onto each cornea in the shader. The geometry and the file are
 * untouched; only the two corneas get their own copy of the material, which colours the disc around the eye's axis
 * (the line from the eyeball's centre through the cornea) and makes it a little glossier, like a wet eye.
 */
function paintEyes(model: THREE.Object3D) {
  const meshes = new Map<string, THREE.Mesh>();
  model.traverse((o) => {
    if (o instanceof THREE.Mesh && /^(Left|Right)[ _](cornea|sclera)$/.test(o.name)) meshes.set(o.name.replace("_", " "), o);
  });
  for (const side of ["Left", "Right"]) {
    const cornea = meshes.get(`${side} cornea`), sclera = meshes.get(`${side} sclera`);
    if (!cornea || !sclera) continue;
    // Eye centre and axis in world space, then in the cornea's own (vertex) space.
    const eyeCenter = new THREE.Box3().setFromObject(sclera).getCenter(new THREE.Vector3());
    const corneaCenter = new THREE.Box3().setFromObject(cornea).getCenter(new THREE.Vector3());
    const toLocal = cornea.matrixWorld.clone().invert();
    const c = eyeCenter.clone().applyMatrix4(toLocal);
    const a = corneaCenter.clone().applyMatrix4(toLocal).sub(c).normalize();
    // The cornea's radius around that axis (its rim), so the iris is sized from the eye itself.
    const pos = cornea.geometry.getAttribute("position");
    const v = new THREE.Vector3();
    let rim = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).sub(c);
      rim = Math.max(rim, v.clone().addScaledVector(a, -v.dot(a)).length());
    }
    // Two directions across the iris, for the radial fibres.
    const u = new THREE.Vector3(0, 1, 0).cross(a).normalize();
    const w = a.clone().cross(u);
    const mat = (cornea.material as THREE.MeshStandardMaterial).clone();
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        eyeC: { value: c },
        eyeA: { value: a },
        eyeU: { value: u },
        eyeW: { value: w },
        eyeR: { value: rim },
      });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vEyeP;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvEyeP = position;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vEyeP;\nuniform vec3 eyeC, eyeA, eyeU, eyeW;\nuniform float eyeR;\nfloat eyeIris = 0.0;")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            vec3 d = vEyeP - eyeC;
            vec3 across = d - dot(d, eyeA) * eyeA;
            float r = length(across) / eyeR;
            float ang = atan(dot(across, eyeW), dot(across, eyeU));
            // Iris: warm brown, lighter round the pupil, fine radial fibres, a dark ring at its edge.
            float fib = 0.5 + 0.5 * sin(ang * 47.0 + 3.0 * sin(ang * 13.0)) * sin(ang * 29.0 + 1.7);
            vec3 inner = vec3(0.20, 0.115, 0.055), outer = vec3(0.085, 0.05, 0.025);
            vec3 iris = mix(inner, outer, smoothstep(0.30, 0.74, r)) * (0.78 + 0.34 * fib);
            iris *= 1.0 - 0.65 * smoothstep(0.66, 0.78, r);
            vec3 col = mix(iris, vec3(0.012), 1.0 - smoothstep(0.26, 0.29, r));
            eyeIris = 1.0 - smoothstep(0.78, 0.82, r);
            diffuseColor.rgb = mix(diffuseColor.rgb, col, eyeIris);
          }`,
        )
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, eyeIris);");
    };
    mat.customProgramCacheKey = () => "ngf-ecorche-eye";
    cornea.material = mat;
  }
}

/**
 * The original model performing an exercise. Each of the file's meshes becomes a skinned mesh with the same geometry
 * and material, bound to the exercise rig with the file's own skin weights (detached bind: the rig lives in its own
 * frame, centimetres facing +X, and the bind matrix carries each mesh from the file's frame into it). The motion comes
 * from the app's exercise engine, as in the exercise player; equipment is placed in the rig's frame.
 */
function moveModel(
  scene: THREE.Scene,
  model: THREE.Object3D,
  o: { ex: PlayerExercise; skin: ModelSkin; hideProps?: string[]; reducedMotion?: boolean },
  changed: () => void,
) {
  const { meta, data } = o.skin;
  const r = meta.toRig;
  const [a, b, c] = [r[0]!, r[1]!, r[2]!];
  const toRig = new THREE.Matrix4().set(a[0]!, a[1]!, a[2]!, a[3]!, b[0]!, b[1]!, b[2]!, b[3]!, c[0]!, c[1]!, c[2]!, c[3]!, 0, 0, 0, 1);
  const fromRig = toRig.clone().invert();
  const rigToFile = new THREE.Matrix3().setFromMatrix4(fromRig);
  setRestJoints(meta.bind);
  const { bones, skeleton } = makeSkeleton();
  for (const b of bones) b.matrixWorld.copy(b.matrix);

  // Swap each mesh for a skinned one, in place (same parent, transform, geometry and material).
  const meshes: THREE.Mesh[] = [];
  model.traverse((m) => {
    if (m instanceof THREE.Mesh) meshes.push(m);
  });
  if (meshes.length !== meta.meshes.length) throw new Error(`skin weights are for ${meta.meshes.length} meshes, the file has ${meshes.length}`);
  const bytes = new Uint8Array(data);
  meshes.forEach((m, i) => {
    const entry = meta.meshes[i]!;
    const g = m.geometry;
    if (g.getAttribute("position").count !== entry.count) throw new Error(`skin weights do not match ${m.name}`);
    const ib = new THREE.InterleavedBuffer(bytes.subarray(entry.offset * 8, (entry.offset + entry.count) * 8), 8);
    g.setAttribute("skinIndex", new THREE.InterleavedBufferAttribute(ib, 4, 0));
    g.setAttribute("skinWeight", new THREE.InterleavedBufferAttribute(ib, 4, 4, true));
    const sm = new THREE.SkinnedMesh(g, m.material);
    sm.name = m.name;
    sm.position.copy(m.position);
    sm.quaternion.copy(m.quaternion);
    sm.scale.copy(m.scale);
    sm.frustumCulled = false;
    sm.bindMode = THREE.DetachedBindMode;
    m.parent!.add(sm);
    m.parent!.remove(m);
  });
  model.updateMatrixWorld(true);
  const skinned: { m: THREE.SkinnedMesh; toRigM: THREE.Matrix4; rigPos: THREE.BufferAttribute }[] = [];
  model.traverse((m) => {
    if (!(m instanceof THREE.SkinnedMesh)) return;
    const toRigM = toRig.clone().multiply(m.matrixWorld);
    m.bind(skeleton, toRigM);
    const p = m.geometry.getAttribute("position");
    const rigPos = new THREE.BufferAttribute(new Float32Array(p.count * 3), 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(toRigM);
      rigPos.setXYZ(i, v.x, v.y, v.z);
    }
    skinned.push({ m, toRigM, rigPos });
  });
  // The grip (fingers rolled round the bar), as a morph target on every mesh the hands carry: worked out in the rig's
  // frame over the whole hand, then carried back into each mesh's own frame.
  const attrs = (m: THREE.SkinnedMesh) => ({ si: m.geometry.getAttribute("skinIndex") as THREE.InterleavedBufferAttribute, sw: m.geometry.getAttribute("skinWeight") as THREE.InterleavedBufferAttribute });
  const reach = gripReach(skinned.map(({ m, rigPos }) => ({ pos: rigPos, ...attrs(m) })));
  const gripMeshes: THREE.SkinnedMesh[] = [];
  for (const { m, toRigM, rigPos } of skinned) {
    const { si, sw } = attrs(m);
    const d = gripDelta(rigPos, si, sw, reach);
    if (!d.some((x) => x !== 0)) continue;
    const back = new THREE.Matrix3().setFromMatrix4(toRigM.clone().invert());
    const v = new THREE.Vector3();
    for (let i = 0; i < d.length; i += 3) {
      v.set(d[i]!, d[i + 1]!, d[i + 2]!).applyMatrix3(back);
      d.set([v.x, v.y, v.z], i);
    }
    m.geometry.morphAttributes.position = [new THREE.BufferAttribute(d, 3)];
    m.geometry.morphTargetsRelative = true;
    m.updateMorphTargets();
    gripMeshes.push(m);
  }

  // The motion and the equipment, as in the exercise player.
  const def = getMotion(o.ex.slug, o.ex.meta);
  const motion = compileMotion(def);
  const first = evaluate(motion, 0);
  const centerX = first.pts.pelvis[0];
  const barbell = first.props.some((p) => p.def.kind === "barbell");
  const stance = o.ex.pattern === "squat" && first.view === "side" ? { halfWidth: 17, toeOut: 22 } : null;
  const GRIPPED = new Set(["barbell", "dumbbell", "kettlebell", "pullupBar", "trapBar", "farmerHandle", "landmine", "cable", "battleRope", "jumpRope", "yoke", "dipBars"]);
  const grip = first.props.some((p) => GRIPPED.has(p.def.kind)) ? 1 : 0;
  for (const m of gripMeshes) m.morphTargetInfluences![0] = grip;
  const rigSpace = new THREE.Group();
  rigSpace.matrixAutoUpdate = false;
  rigSpace.matrix.copy(fromRig);
  const equipment = makeEquipment(first.props.map((p) => p.def).filter((d) => !o.hideProps?.includes(d.kind)), first.view, centerX);
  rigSpace.add(equipment.group);
  scene.add(rigSpace);
  const effort = effortCurve(def);
  const T = motion.duration;
  let t = def.stillPhase !== undefined && o.reducedMotion ? def.stillPhase * T : 0;
  let speed = 1;
  let playing = !o.reducedMotion;
  let pelvisY = 92;
  // Points up the body (rig frame, cm) at rest and in the current pose: ankles, knees, pelvis, chest, neck, head.
  const B = meta.bind;
  const mid = (a: readonly number[], b: readonly number[]) => new THREE.Vector3(a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!).multiplyScalar(0.5);
  const at = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);
  const restUp = [mid(B.R.ankle, B.L.ankle), mid(B.R.knee, B.L.knee), at(B.pelvis), at(B.mid), at(B.neckBase), at(B.head), at(B.headTop)];
  const nowUp = restUp.map((p) => p.clone());
  const listeners: ((t: number, e: number) => void)[] = [];
  const pose = () => {
    const f = evaluate(motion, t);
    const j = jointsFromFrame(f, { centerX, barGrip: barbell ? 26 : null, stance });
    pelvisY = j.pelvis.y;
    nowUp[0]!.addVectors(j.R.ankle, j.L.ankle).multiplyScalar(0.5);
    nowUp[1]!.addVectors(j.R.knee, j.L.knee).multiplyScalar(0.5);
    [j.pelvis, j.mid, j.neck, j.head, j.headTop].forEach((p, k) => nowUp[k + 2]!.copy(p));
    poseBones(j, bones);
    equipment.update(f, j);
    for (const l of listeners) l(t, effort.at(t));
  };
  pose();
  const v = new THREE.Vector3();
  return {
    advance(dt: number) {
      if (playing) t = (((t + dt * speed) % T) + T) % T;
      pose();
    },
    /** The camera's look-at height (file frame) for the current pose: low on the body, following the hips. */
    followY: () => v.set(0, 34 + 0.55 * pelvisY, 0).applyMatrix4(fromRig).y,
    /** How far the part of the body at height `y` at rest (file frame) has moved in the current pose (file frame), so
     * a close-up stays on it. */
    bodyShift(y: number) {
      const r = v.set(0, y, 0).applyMatrix4(toRig).y;
      let k = 0;
      while (k < restUp.length - 2 && r > restUp[k + 1]!.y) k++;
      const s = THREE.MathUtils.clamp((r - restUp[k]!.y) / (restUp[k + 1]!.y - restUp[k]!.y), 0, 1);
      const d = (i: number) => nowUp[i]!.clone().sub(restUp[i]!);
      return d(k).lerp(d(k + 1), s).applyMatrix3(rigToFile);
    },
    motion: {
      skinnedMeshes: skinned.length,
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
      onTick(cb: (t: number, e: number) => void) {
        listeners.push(cb);
      },
    } satisfies ModelMotion,
  };
}
