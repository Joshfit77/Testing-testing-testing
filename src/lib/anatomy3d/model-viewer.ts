import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { CameraView } from "./player";

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
  dispose(): void;
}

const VIEW_YAW: Record<CameraView, number> = { front: 0, side: Math.PI / 2, rear: Math.PI };
const FOV = 30;

export async function mountModel(
  canvas: HTMLCanvasElement,
  /** The GLB file's bytes, as fetched (nothing is changed before it is parsed). */
  opts: { glb: ArrayBuffer; pixelRatio?: number },
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
  const box = new THREE.Box3().setFromObject(model);
  const H = box.max.y - box.min.y;
  const center = box.getCenter(new THREE.Vector3());

  let yaw = 0;
  let pitch = 0.05;
  let zoomK = 1;
  let targetY = center.y;
  let raf = 0;

  // Distance that fits the whole figure (with a margin) in the frame, for the current aspect ratio.
  const fitDistance = (aspect: number) => {
    const half = THREE.MathUtils.degToRad(FOV / 2);
    const byHeight = (H * 0.56) / Math.tan(half);
    const byWidth = ((box.max.x - box.min.x) * 0.62) / (Math.tan(half) * aspect);
    return Math.max(byHeight, byWidth);
  };
  const place = (cam: THREE.PerspectiveCamera, y: number, p: number, dist: number, ty: number) => {
    cam.position.set(center.x + Math.sin(y) * Math.cos(p) * dist, ty + Math.sin(p) * dist, center.z + Math.cos(y) * Math.cos(p) * dist);
    cam.lookAt(center.x, ty, center.z);
  };
  const draw = () => {
    raf = 0;
    place(camera, yaw, pitch, fitDistance(camera.aspect) * zoomK, targetY);
    renderer.render(scene, camera);
  };
  const request = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };

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
      place(shot, o.yaw, 0.05, o.distance !== undefined ? o.distance * H : fitDistance(shot.aspect), o.targetY !== undefined ? box.min.y + o.targetY * H : center.y);
      renderer.render(scene, shot);
      const url = canvas.toDataURL("image/png");
      renderer.setSize(size.x, size.y, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      draw();
      return url;
    },
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
