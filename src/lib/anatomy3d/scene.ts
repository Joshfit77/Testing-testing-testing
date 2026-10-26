import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/**
 * The stage: black studio with warm key, cool-gold rim lights, a dark glossy floor, image-based reflections for the
 * metallic gold, and a bloom pass tuned so only the glowing muscles (and the brightest highlights) bloom.
 */
export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  floor: THREE.Mesh;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export function makeStage(canvas: HTMLCanvasElement, opts: { pixelRatio?: number; bloom?: boolean } = {}): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(opts.pixelRatio ?? (typeof devicePixelRatio === "number" ? devicePixelRatio : 1), 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const backdrop = backdropTexture();
  scene.background = backdrop ?? new THREE.Color("#060504");
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, 1, 10, 3000);

  // Lights: warm key from the front-left, gold rims behind both shoulders, soft fill from below the camera.
  const key = new THREE.DirectionalLight("#fff1d6", 2.0);
  key.position.set(260, 320, -160);
  const rimA = new THREE.DirectionalLight("#ffcf7a", 2.4);
  rimA.position.set(-260, 220, 220);
  const rimB = new THREE.DirectionalLight("#ffd98f", 1.8);
  rimB.position.set(-200, 160, -260);
  const fill = new THREE.HemisphereLight("#3a2c14", "#050403", 0.9);
  // Soft front light so surfaces facing the viewer read clearly.
  const front = new THREE.DirectionalLight("#ffe8c2", 0.9);
  front.position.set(420, 160, 60);
  scene.add(key, rimA, rimB, fill, front);

  // Floor: unlit, warm black under the athlete fading to the background, so it never competes with the gold.
  const tex = floorTexture();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(380, 64), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.2;
  scene.add(floor);

  const root = new THREE.Group();
  scene.add(root);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.42, 0.9);
  if (opts.bloom !== false) composer.addPass(bloom);
  composer.addPass(new OutputPass());

  return {
    renderer,
    scene,
    camera,
    root,
    floor,
    render() {
      composer.render();
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      bloom.resolution.set(width / 2, height / 2);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
    dispose() {
      composer.dispose();
      pmrem.dispose();
      tex.dispose();
      backdrop?.dispose();
      env.dispose();
      renderer.dispose();
    },
  };
}

function floorTexture(): THREE.Texture {
  const size = 256;
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!c) return new THREE.Texture();
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(58,42,16,0.85)");
  grad.addColorStop(0.35, "rgba(24,18,8,0.75)");
  grad.addColorStop(1, "rgba(6,5,4,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A dark gym seen out of focus: warm light columns and a few soft highlights behind the athlete. */
function backdropTexture(): THREE.Texture | null {
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!c) return null;
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#050403";
  g.fillRect(0, 0, 512, 512);
  g.filter = "blur(14px)";
  const columns: [number, number, number][] = [[60, 26, 0.16], [150, 14, 0.1], [355, 18, 0.12], [430, 30, 0.18], [250, 10, 0.06]];
  for (const [x, w, a] of columns) {
    const grad = g.createLinearGradient(0, 40, 0, 380);
    grad.addColorStop(0, `rgba(255,190,90,0)`);
    grad.addColorStop(0.35, `rgba(255,190,90,${a})`);
    grad.addColorStop(1, `rgba(255,170,70,0)`);
    g.fillStyle = grad;
    g.fillRect(x - w / 2, 40, w, 340);
  }
  g.filter = "blur(6px)";
  for (const [x, y, r, a] of [[90, 120, 6, 0.25], [400, 90, 5, 0.2], [455, 200, 4, 0.18], [40, 260, 5, 0.15], [330, 160, 3, 0.15]] as const) {
    g.fillStyle = `rgba(255,200,110,${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.filter = "none";
  const vignette = g.createRadialGradient(256, 230, 60, 256, 256, 380);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.85)");
  g.fillStyle = vignette;
  g.fillRect(0, 0, 512, 512);
  const floor = g.createLinearGradient(0, 360, 0, 512);
  floor.addColorStop(0, "rgba(5,4,3,0)");
  floor.addColorStop(0.3, "rgba(5,4,3,0.9)");
  floor.addColorStop(1, "rgba(3,2,2,1)");
  g.fillStyle = floor;
  g.fillRect(0, 360, 512, 152);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
