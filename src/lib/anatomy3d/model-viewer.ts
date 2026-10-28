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
import { bindModel, type BoundBody } from "./body/bind-model";
import type { RigMeta } from "./body/skeleton";
import { solvePose, type PoseGoals, type SolveReport } from "./body/solve";
import { moveModel3, type Mover3 } from "./motion3d/mover";

/**
 * The raw Écorché model in the exercise player: the GLB file (github.com/Charleeh/ecorche, CC BY-SA 4.0) is loaded as
 * published, with its own meshes, vertex colours and materials, and the file itself is not changed. At runtime the
 * viewer adds: an iris and pupil on the eyes (paintEyes), a face (fillFace), and, for an exercise, skin
 * weights that rig and animate it (moveModel). What is shown is therefore a modified version of the model, shared under
 * CC BY-SA 4.0 (public/anatomy/LICENSE.md). The lighting is the studio used for the reference renders (ACES tone
 * mapping, a room environment, one warm key light and one white rim light).
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
  /**
   * A still picture at the given size and angle, as a data URL (PNG, or JPEG when `jpeg` is set). With `t`, the
   * exercise is posed at that time first, without drawing the page's own view (for rendering videos frame by frame).
   * With `fit`, a still camera framing the whole space the exercise takes over a rep, or, for an exercise that
   * travels, a camera moving with him (videos).
   */
  still(o: { yaw: number; distance?: number; targetY?: number; width: number; height: number; t?: number; jpeg?: boolean; fit?: boolean }): string;
  /** The model's height in its own units (metres). */
  readonly height: number;
  /** Present when an exercise was given: the model itself performing it (see moveModel). */
  readonly motion?: ModelMotion;
  /** Present with `rig` and an exercise: the anatomical rig's mover (solve reports, contacts, equipment). */
  readonly rig3?: Mover3;
  /** Present with `rig` and no exercise: the anatomical skeleton, posed directly from goals (for checks). */
  readonly body?: { bound: BoundBody; pose(goals: PoseGoals): SolveReport };
  dispose(): void;
}

export interface ModelMotion {
  /** How many of the file's meshes were bound to the rig (all of them). */
  readonly skinnedMeshes: number;
  /** The space the exercise takes over a rep (the model's frame, metres): body and the height of the equipment. */
  readonly bounds: THREE.Box3;
  /** True when the exercise travels (a sprint, a walk, a carry): it is followed rather than framed whole. */
  readonly travels: boolean;
  /** The space the body takes over a rep round the pelvis, without the travel. */
  readonly reach: THREE.Box3;
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
/** The face (public/anatomy/ecorche-face.*, scripts/anatomy/build-ecorche-face.mts). */
export interface ModelFace {
  meta: {
    hide: string[];
    layers: { source: string; count: number; offset: number }[];
    /** The face surface over the whole head: its own vertices (file frame), colours, skin weights and triangles. */
    shell?: { vertices: number; triangles: number; offset: number };
  };
  data: ArrayBuffer;
}

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
    /** Colours: the file's own red and white, or all gold in the app's gold (see goldAndBlack). */
    look?: "original" | "gold";
    /** The face: a smooth red surface over the head, red ears, teeth hidden (see fillFace). */
    face?: ModelFace;
    /** The model performing an exercise: the exercise, the file's skin weights, equipment to leave out. */
    exercise?: { ex: PlayerExercise; skin?: ModelSkin; hideProps?: string[]; reducedMotion?: boolean };
    /** The anatomical rig (public/anatomy/ecorche-rig.*): with an exercise, the model performs it on this rig (its
     *  own equipment, hands on the handles); without one, it can be posed from goals. */
    rig?: { meta: RigMeta; data: ArrayBuffer };
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
  if (opts.face) fillFace(model, opts.face);
  if (opts.look === "gold") goldAndBlack(model);
  const box = new THREE.Box3().setFromObject(model);
  const H = box.max.y - box.min.y;
  const center = box.getCenter(new THREE.Vector3());

  let yaw = 0;
  let pitch = 0.05;
  let zoomK = 1;
  // (A little above the middle, so the head clears the top of the frame with the figure this size.)
  const homeY = center.y + 0.025 * H;
  let targetY = homeY;
  let raf = 0;
  // (Redraw requests from the motion: play, seek. Set once `request` exists.)
  let changed = () => {};
  const ex = opts.exercise;
  const moving3 = ex && opts.rig ? moveModel3(scene, model, { ex: ex.ex, rig: opts.rig, reducedMotion: ex.reducedMotion }, () => changed()) : null;
  const moving = moving3 ?? (ex ? moveModel(scene, model, { ...ex, skin: ex.skin! }, () => changed()) : null);
  const bound = !opts.exercise && opts.rig ? bindModel(model, opts.rig) : null;
  if (bound) bound.update();

  // Distance that fits the whole figure (with a margin) in the frame, for the current aspect ratio.
  const half = THREE.MathUtils.degToRad(FOV / 2);
  /** Distance that fits a box (the space an exercise takes) seen from the side `yaw`, or from any side without it. */
  const fitBox = (b: THREE.Box3, aspect: number, yaw?: number) => {
    const s = b.getSize(new THREE.Vector3());
    const across = yaw === undefined ? Math.max(s.x, s.z) : Math.abs(s.x * Math.cos(yaw)) + Math.abs(s.z * Math.sin(yaw));
    const deep = yaw === undefined ? Math.min(s.x, s.z) : Math.abs(s.x * Math.sin(yaw)) + Math.abs(s.z * Math.cos(yaw));
    return Math.max((s.y * 0.52) / Math.tan(half), (across * 0.52) / (Math.tan(half) * aspect)) + deep / 3;
  };
  const fitDistance = (aspect: number) => {
    const byHeight = (H * 0.53) / Math.tan(half);
    const byWidth = ((box.max.x - box.min.x) * 0.58) / (Math.tan(half) * aspect);
    // (An exercise that takes more room across than the standing figure, lying or stepping, is fitted across.)
    const s = moving?.bounds.getSize(new THREE.Vector3());
    const byExercise = s ? (Math.max(s.x, s.z) * 0.55) / (Math.tan(half) * aspect) : 0;
    return Math.max(byHeight, byWidth, byExercise);
  };
  const place = (cam: THREE.PerspectiveCamera, y: number, p: number, dist: number, at: THREE.Vector3) => {
    cam.position.set(at.x + Math.sin(y) * Math.cos(p) * dist, at.y + Math.sin(p) * dist, at.z + Math.cos(y) * Math.cos(p) * dist);
    cam.lookAt(at);
  };
  // While an exercise plays, the camera follows the hips down and up (as the exercise player does), on top of the
  // viewer's own up-and-down offset. Zoomed in, it follows the part of the body it is looking at instead, so a
  // close-up of the face stays on the face as he squats and leans.
  const followY = () => (moving ? moving.followY() - center.y : 0);
  // (Across the floor, the camera centres on the space the exercise takes.)
  if (moving) {
    const c = moving.bounds.getCenter(new THREE.Vector3());
    center.x = c.x;
    center.z = c.z;
  }
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
      targetY = homeY;
      request();
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      draw();
    },
    still(o) {
      if (o.t !== undefined) moving?.poseAt(o.t);
      const size = renderer.getSize(new THREE.Vector2());
      const aspect = camera.aspect;
      const shot = new THREE.PerspectiveCamera(FOV, o.width / o.height, 0.02, 50);
      renderer.setSize(o.width, o.height, false);
      if (o.fit && moving) {
        // (A travelling exercise: a camera moving with him, framing the space his body takes; otherwise the whole rep.)
        const b = moving.travels ? moving.following() : moving.bounds;
        place(shot, o.yaw, 0.05, fitBox(b, shot.aspect, o.yaw), b.getCenter(new THREE.Vector3()));
      }
      else place(shot, o.yaw, 0.05, o.distance !== undefined ? o.distance * H : fitDistance(shot.aspect), new THREE.Vector3(center.x, (o.targetY !== undefined ? box.min.y + o.targetY * H : center.y) + followY(), center.z));
      renderer.render(scene, shot);
      const url = o.jpeg ? canvas.toDataURL("image/jpeg", 0.92) : canvas.toDataURL("image/png");
      renderer.setSize(size.x, size.y, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      if (!moving) draw();
      return url;
    },
    motion: moving?.motion,
    rig3: moving3 ?? undefined,
    body: bound
      ? {
          bound,
          pose(goals) {
            const report: SolveReport = { reach: { wristR: 0, wristL: 0, ankleR: 0, ankleL: 0 }, handTurn: { R: 0, L: 0 }, limits: {} };
            solvePose(bound.sk, goals, report);
            bound.update();
            request();
            return report;
          },
        }
      : undefined,
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
 * Gives him a face (owner's requests), in the model's red, from build-ecorche-face.mts: one smooth surface shrink-wrapped
 * over the head, with openings for the eyes, so the face reads as a face rather than separate muscles; a red layer over
 * the ears (same shape, moved with them); the teeth hidden. The file's own parts are not changed. Everything uses the
 * file's muscle material.
 */
function fillFace(model: THREE.Object3D, face: ModelFace) {
  const parts = new Map<string, THREE.Mesh>();
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) parts.set(o.name, o);
  });
  const muscle = parts.get("Left_frontalis")?.material as THREE.Material | undefined;
  if (!muscle) return;
  for (const name of face.meta.hide) {
    const m = parts.get(name);
    if (m) m.visible = false;
  }
  for (const layer of face.meta.layers) {
    const src = parts.get(layer.source);
    if (!src || src.geometry.getAttribute("position").count !== layer.count) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(face.data.slice(layer.offset, layer.offset + layer.count * 12)), 3));
    const bytes = new Uint8Array(face.data, layer.offset + layer.count * 12, layer.count * 3);
    const col = new Float32Array(layer.count * 3);
    for (let i = 0; i < col.length; i++) col[i] = (bytes[i]! / 255) ** 2;
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(src.geometry.index);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, muscle);
    m.name = `${layer.source} (face)`;
    m.userData.faceFor = src;
    m.position.copy(src.position);
    m.quaternion.copy(src.quaternion);
    m.scale.copy(src.scale);
    src.parent!.add(m);
  }
  // The face: one smooth surface over the head (the eyes show through it), in the file's frame.
  const sh = face.meta.shell;
  if (sh) {
    const n = sh.vertices;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(face.data.slice(sh.offset, sh.offset + n * 12)), 3));
    const bytes = new Uint8Array(face.data, sh.offset + n * 12, n * 3);
    g.setAttribute("color", new THREE.BufferAttribute(Float32Array.from(bytes, (b) => (b / 255) ** 2), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(face.data.slice(sh.offset + n * 23, sh.offset + n * 23 + sh.triangles * 12)), 1));
    g.computeVertexNormals();
    // (Drawn in front of the muscles just under it, where the two are within a hair of each other.)
    const mat = muscle.clone();
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -2;
    const m = new THREE.Mesh(g, mat);
    m.name = "Face";
    m.userData.skin = new Uint8Array(face.data, sh.offset + n * 15, n * 8);
    m.userData.faceShell = true;
    model.add(m);
  }
  model.updateMatrixWorld(true);
}

/**
 * The one addition to the model's look, asked for by the owner: the published eyes are blank white (a sclera and a
 * cornea, no iris), so an iris and a pupil are painted onto each cornea in the shader. The geometry and the file are
 * untouched; only the two corneas get their own copy of the material, which colours the disc around the eye's axis
 * (the line from the eyeball's centre through the cornea) and makes it a little glossier, like a wet eye.
 */
/**
 * All gold, in the app's darker gold (owner's requests: first "all red make gold and the white black", then "make him
 * fully gold but darker gold like the app"). Each fragment's colour in the file says what it is: red is muscle, white
 * is bone, tendon and cartilage. Red becomes the app's gold (#C9A54C), keeping the file's own light and dark (the
 * muscle fibres); white becomes a deeper, satin gold, so the tendons still read. The whites of the eyes are left as
 * they are. Only the materials change; the file's geometry and colours are untouched.
 */
function goldAndBlack(model: THREE.Object3D) {
  const materials = new Set<THREE.MeshStandardMaterial>();
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    // (The eyes keep their own look: the sclera gets its own copy of the material, the cornea already has one.)
    if (/(sclera|cornea)$/i.test(o.name)) {
      if (/sclera$/i.test(o.name)) o.material = (o.material as THREE.Material).clone();
      return;
    }
    materials.add(o.material as THREE.MeshStandardMaterial);
  });
  for (const m of materials) {
    m.metalness = 1;
    m.roughness = 0.32;
    m.color.set("#ffffff");
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          // How white this point is in the file (red muscle: green/red about 0.1; white: about 0.9).
          float white = smoothstep(0.35, 0.7, vColor.g / max(vColor.r, 1e-3));
          // A dark gold (the app's #C9A54C, darker), keeping the file's light and dark; the white parts deeper still.
          float shade = clamp(vColor.r / 0.21, 0.5, 1.15);
          vec3 gold = vec3(0.4, 0.262, 0.06);
          diffuseColor.rgb = mix(gold * shade, gold * 0.62, white);`,
        )
        .replace(
          "#include <metalnessmap_fragment>",
          `#include <metalnessmap_fragment>
          metalnessFactor = mix(0.95, 0.9, white);`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor = mix(0.34, 0.5, white);`,
        );
    };
    m.customProgramCacheKey = () => "gold-and-black";
    m.needsUpdate = true;
  }
}

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
  const layers: THREE.Mesh[] = [];
  model.traverse((m) => {
    if (m instanceof THREE.Mesh) (m.userData.faceFor || m.userData.skin ? layers : meshes).push(m);
  });
  if (meshes.length !== meta.meshes.length) throw new Error(`skin weights are for ${meta.meshes.length} meshes, the file has ${meshes.length}`);
  const bytes = new Uint8Array(data);
  // (A face layer takes the weights of the part it covers: same vertices, same order.)
  const entryOf = new Map(meshes.map((m, i) => [m as THREE.Object3D, meta.meshes[i]!]));
  // (The face surface brings its own weights.)
  [...meshes, ...layers].forEach((m) => {
    const g = m.geometry;
    let own: Uint8Array = m.userData.skin;
    if (!own) {
      const entry = entryOf.get(m.userData.faceFor ?? m)!;
      if (g.getAttribute("position").count !== entry.count) throw new Error(`skin weights do not match ${m.name}`);
      own = bytes.subarray(entry.offset * 8, (entry.offset + entry.count) * 8);
    }
    const ib = new THREE.InterleavedBuffer(own, 8);
    g.setAttribute("skinIndex", new THREE.InterleavedBufferAttribute(ib, 4, 0));
    g.setAttribute("skinWeight", new THREE.InterleavedBufferAttribute(ib, 4, 4, true));
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
    pelvisNow.copy(j.pelvis).applyMatrix4(fromRig);
    nowUp[0]!.addVectors(j.R.ankle, j.L.ankle).multiplyScalar(0.5);
    nowUp[1]!.addVectors(j.R.knee, j.L.knee).multiplyScalar(0.5);
    [j.pelvis, j.mid, j.neck, j.head, j.headTop].forEach((p, k) => nowUp[k + 2]!.copy(p));
    poseBones(j, bones);
    equipment.update(f, j);
    for (const l of listeners) l(t, effort.at(t));
  };
  // The space the exercise takes over a rep (file frame): the joints at 24 moments, with room for the body round them,
  // and the height of the equipment (a bench under a lying exercise, a bar overhead); not its width, so a long bar
  // does not shrink the figure.
  const bounds = new THREE.Box3();
  // (Also the body's own reach round the pelvis, at every moment: an exercise that travels, a sprint or a carry, takes
  // far more room across than the body does, and is better followed than framed whole.)
  const bodyReach = new THREE.Box3();
  const pelvisNow = new THREE.Vector3();
  {
    const q = new THREE.Vector3();
    const pv = new THREE.Vector3();
    const eb = new THREE.Box3();
    for (let i = 0; i < 24; i++) {
      t = (i / 24) * T;
      pose();
      const j = jointsFromFrame(evaluate(motion, t), { centerX, barGrip: barbell ? 26 : null, stance });
      pv.copy(j.pelvis).applyMatrix4(fromRig);
      for (const p of [j.pelvis, j.mid, j.neck, j.head, j.headTop, ...(["R", "L"] as const).flatMap((sd) => [j[sd].shoulder, j[sd].elbow, j[sd].hand, j[sd].hip, j[sd].knee, j[sd].ankle, j[sd].heel, j[sd].toe])]) {
        bounds.expandByPoint(q.copy(p).applyMatrix4(fromRig));
        bodyReach.expandByPoint(q.sub(pv));
      }
      rigSpace.updateMatrixWorld(true);
      eb.setFromObject(equipment.group);
      if (!eb.isEmpty()) bounds.expandByPoint(q.set(bounds.min.x, eb.min.y, bounds.min.z)).expandByPoint(q.set(bounds.max.x, eb.max.y, bounds.max.z));
    }
    bounds.expandByScalar(0.1);
    bodyReach.expandByScalar(0.1);
    t = def.stillPhase !== undefined && o.reducedMotion ? def.stillPhase * T : 0;
  }
  const across = (b: THREE.Box3) => Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  const travels = across(bounds) > across(bodyReach) + 0.6;
  pose();
  const v = new THREE.Vector3();
  return {
    bounds,
    travels,
    /** The space the body takes round the pelvis now, for a camera that follows a travelling exercise. */
    following: () => bodyReach.clone().translate(pelvisNow),
    advance(dt: number) {
      if (playing) t = (((t + dt * speed) % T) + T) % T;
      pose();
    },
    /** The camera's look-at height (file frame) for the current pose: low on the body, following the hips. */
    followY: () => v.set(0, 34 + 0.55 * pelvisY, 0).applyMatrix4(fromRig).y,
    /** Poses the exercise at time `time` without asking for a redraw (stills, video frames). */
    poseAt(time: number) {
      t = ((time % T) + T) % T;
      pose();
    },
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
      bounds,
      travels,
      reach: bodyReach,
      skinnedMeshes: skinned.filter(({ m }) => !m.userData.faceFor && !m.userData.skin).length,
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
