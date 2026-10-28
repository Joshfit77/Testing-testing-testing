import { mountAthlete, type CameraView } from "../../../src/lib/anatomy3d/player";
import { mountModel, type ModelFace, type ModelSkin } from "../../../src/lib/anatomy3d/model-viewer";
import type { RigMeta } from "../../../src/lib/anatomy3d/body/skeleton";
import { REGION_LABELS, type Region } from "../../../src/lib/anatomy3d/muscle-ids";
import { EXERCISES } from "../../../src/data/exercises";
import { getMotion } from "../../../src/lib/exercise-motion";

declare global {
  interface Window {
    ready?: boolean;
    player?: unknown;
    viewer?: unknown;
    /** Set by the artifact build: the GLB as base64 text parts (artifacts do not serve .glb files). */
    ECORCHE_PARTS?: string[];
    /** The same for the model's skin weights (anatomy/ecorche-skin.bin). */
    SKIN_PARTS?: string[];
    /** The same for the filled-in face (anatomy/ecorche-face.bin). */
    FACE_PARTS?: string[];
    /** The same for the anatomical rig's weights (anatomy/ecorche-rig.bin). */
    RIG_PARTS?: string[];
    BAKE_PARTS?: Record<string, string[]>;
    modelVerified?: boolean;
    exerciseView?: string;
    exerciseSlugs?: string[];
  }
}

/** sha256 of model/ecorche.glb in github.com/Charleeh/ecorche at commit 320805e: the page checks it before showing. */
const ECORCHE_SHA256 = "9744d3dffced835961104447d23a781ad469588289ce322d84d000e0d498326c";

/** The model file's bytes, from the .glb itself or from its base64 parts, with download progress. */
async function fetchModel(onProgress: (f: number) => void): Promise<ArrayBuffer> {
  return fetchBinary("anatomy/ecorche.glb", window.ECORCHE_PARTS, onProgress);
}

/** A binary file, fetched as it is or (artifact builds, which serve no binary types) as base64 text parts. */
async function fetchBinary(url: string, parts: string[] | undefined, onProgress: (f: number) => void): Promise<ArrayBuffer> {
  const read = async (url: string, done: number, share: number) => {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      parts.push(value);
      got += value.length;
      if (total) onProgress(done + (share * got) / total);
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  };
  if (!parts) return (await read(url, 0, 1)).buffer as ArrayBuffer;
  let text = "";
  for (let i = 0; i < parts.length; i++) text += new TextDecoder().decode(await read(parts[i]!, i / parts.length, 1 / parts.length));
  const bin = atob(text.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ?ex=<slug> previews another exercise (for deformation checks); the page layout is written for the back squat.
const ex = EXERCISES.find((e) => e.slug === new URLSearchParams(location.search).get("ex")) ?? EXERCISES.find((e) => e.slug === "back-squat")!;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const fmt = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

const STEPS = [
  { key: "top", title: "Setup", text: "Bar on the upper traps, feet about shoulder width, toes slightly out." },
  { key: "lowering", title: "Descent", text: "Breathe in and brace. Hips back and down, chest up, knees track over the toes." },
  { key: "bottom", title: "Bottom", text: "Thighs at or just below parallel, heels down, core tight." },
  { key: "lifting", title: "Ascent", text: "Drive through the whole foot, stand tall, squeeze the glutes. Breathe out at the top." },
] as const;

/** One finger (or the mouse) turns the figure all the way round; two fingers pinch to zoom (and, in the model view,
 *  drag up or down to move along the body); the wheel zooms too. */
function attachControls(canvas: HTMLCanvasElement, c: { orbit(dYaw: number, dPitch: number): void; zoom(f: number): void; pan?(dh: number): void }) {
  canvas.style.touchAction = "none";
  const touches = new Map<number, { x: number; y: number }>();
  const pair = () => {
    const [a, b] = [...touches.values()];
    return a && b ? { spread: Math.hypot(a.x - b.x, a.y - b.y), midY: (a.y + b.y) / 2 } : null;
  };
  canvas.addEventListener("pointerdown", (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const prev = touches.get(e.pointerId);
    if (!prev) return;
    if (touches.size >= 2) {
      const before = pair();
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const after = pair();
      if (before && after && before.spread > 0 && after.spread > 0) c.zoom(before.spread / after.spread);
      if (before && after && c.pan) c.pan((after.midY - before.midY) / Math.max(1, canvas.clientHeight));
      return;
    }
    c.orbit((e.clientX - prev.x) * 0.008, (e.clientY - prev.y) * 0.004);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const lift = (e: PointerEvent) => touches.delete(e.pointerId);
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    c.zoom(Math.exp(e.deltaY * 0.0012));
  }, { passive: false });
}

/** The original Écorché model in the player: the model itself performing the exercise, with rotation and zoom. */
async function runModel() {
  document.body.classList.add("model-mode", "model-moving");
  // The header is the exercise itself, as everywhere else in the app.
  document.title = ex.name;
  $<HTMLElement>("h1").textContent = ex.name;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const chips = $<HTMLElement>(".chips");
  chips.replaceChildren(
    ...[ex.category, ex.mechanics].filter((x): x is NonNullable<typeof x> => !!x).map((x) => {
      const s = document.createElement("span");
      s.textContent = cap(String(x));
      return s;
    }),
  );
  const canvas = $<HTMLCanvasElement>("#stage");
  canvas.setAttribute("aria-label", `3D anatomical figure performing the ${ex.name}. Drag to turn it, pinch or scroll to zoom.`);
  const box = $<HTMLElement>(".stage-box");
  const loading = $<HTMLElement>(".loading");
  loading.textContent = "Loading model…";
  let viewer;
  try {
    const glb = await fetchModel((f) => (loading.textContent = `Loading model… ${Math.round(f * 100)}%`));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", glb)), (b) => b.toString(16).padStart(2, "0")).join("");
    window.modelVerified = hash === ECORCHE_SHA256;
    $<HTMLElement>(".verify").textContent = window.modelVerified
      ? `File check: identical to the published Écorché file (SHA-256 ${hash.slice(0, 12)}…).`
      : `File check failed: this file differs from the published Écorché file (SHA-256 ${hash.slice(0, 12)}…).`;
    loading.textContent = "Loading movement…";
    const skin: ModelSkin = {
      meta: await (await fetch("anatomy/ecorche-skin.json")).json(),
      data: await fetchBinary("anatomy/ecorche-skin.bin", window.SKIN_PARTS, () => {}),
    };
    const face: ModelFace = {
      meta: await (await fetch("anatomy/ecorche-face.json")).json(),
      data: await fetchBinary("anatomy/ecorche-face.bin", window.FACE_PARTS, () => {}),
    };
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const q = new URLSearchParams(location.search);
    // All gold, in the app's dark gold (owner's request, "keep him gold"); ?look=original shows the file's own red and
    // white.
    const look = q.get("look") === "original" ? "original" : "gold";
    // The anatomical rig (its own equipment, hands on the handles); ?rig=old shows the first rig for comparison.
    const rig: { meta: RigMeta; data: ArrayBuffer; baked?: ArrayBuffer } | undefined =
      q.get("rig") === "old" ? undefined : { meta: await (await fetch("anatomy/ecorche-rig.json")).json(), data: await fetchBinary("anatomy/ecorche-rig.bin", window.RIG_PARTS, () => {}) };
    // The exercise's baked motion when there is one (?live=1 solves every frame instead, as the checks do).
    // (In the artifact the bakes are text parts, listed by exercise; an exercise not listed has none.)
    if (rig && q.get("live") !== "1" && (!window.BAKE_PARTS || window.BAKE_PARTS[ex.slug]))
      rig.baked = await fetchBinary(`anatomy/bake/${ex.slug}.ngb`, window.BAKE_PARTS?.[ex.slug], () => {}).catch(() => undefined);
    viewer = await mountModel(canvas, { glb, face, look, rig, pixelRatio: Math.min(devicePixelRatio || 1, 2), exercise: { ex, skin, hideProps: ["rack"], reducedMotion } });
  } catch (e) {
    loading.textContent = "3D isn't available on this device.";
    console.error(e);
    return;
  }
  window.viewer = viewer;
  // (For the video renderer: the exercise's own camera side.)
  window.exerciseView = getMotion(ex.slug, ex).view;
  window.exerciseSlugs = EXERCISES.map((e) => e.slug);
  const fit = () => viewer.resize(box.clientWidth, box.clientHeight);
  fit();
  new ResizeObserver(fit).observe(box);
  attachControls(canvas, viewer);
  canvas.addEventListener("pointerdown", () => $<HTMLElement>(".hint").classList.add("gone"), { once: true });
  for (const v of ["front", "side", "rear"] as CameraView[]) {
    const b = $<HTMLButtonElement>(`[data-view="${v}"]`);
    b.querySelector("img")!.src = viewer.still({ yaw: { front: 0, side: Math.PI / 2, rear: Math.PI }[v], width: 120, height: 150 });
    b.addEventListener("click", () => {
      viewer.setView(v);
      document.querySelectorAll("[data-view]").forEach((x) => x.classList.toggle("on", x === b));
    });
  }
  // Transport: play and pause, the position in the rep, and the speed.
  const motion = viewer.motion!;
  const T = motion.duration;
  const playBtn = $<HTMLButtonElement>("#play");
  const setPlaying = (on: boolean) => {
    if (on) motion.play();
    else motion.pause();
    playBtn.classList.toggle("paused", !on);
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
  };
  setPlaying(motion.playing);
  playBtn.addEventListener("click", () => setPlaying(!motion.playing));
  const scrub = $<HTMLInputElement>("#scrub");
  scrub.max = String(T);
  scrub.addEventListener("input", () => {
    setPlaying(false);
    motion.seek(Number(scrub.value));
  });
  const modes = document.querySelectorAll<HTMLButtonElement>("[data-speed]");
  modes.forEach((b) =>
    b.addEventListener("click", () => {
      motion.setSpeed(Number(b.dataset.speed));
      modes.forEach((x) => x.classList.toggle("on", x === b));
      setPlaying(true);
    }),
  );
  // Muscle Glow, on unless ?glow=0 (reviews of the movement itself).
  const glowBox = $<HTMLInputElement>("#glow");
  glowBox.checked = new URLSearchParams(location.search).get("glow") !== "0";
  viewer.setGlow(glowBox.checked);
  glowBox.addEventListener("change", () => viewer.setGlow(glowBox.checked));
  const time = $<HTMLElement>("#time");
  motion.onTick((t) => {
    scrub.value = String(t);
    time.textContent = `${fmt(t)} / ${fmt(T)}`;
  });
  loading.remove();
  window.ready = true;
}

(async () => {
  // The model performs the exercise in ?ex= (the squat by default); the old rigged-athlete player only with
  // ?mode=exercise.
  const q = new URLSearchParams(location.search);
  if (q.get("mode") !== "exercise") return runModel();
  const canvas = $<HTMLCanvasElement>("#stage");
  const box = $<HTMLElement>(".stage-box");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let player;
  try {
    // The raw Écorché athlete in its own red-and-white look (the only character).
    player = await mountAthlete(canvas, ex, { hideProps: ["rack"], assetBase: "anatomy/athlete-raw", reducedMotion: reduced, pixelRatio: Math.min(devicePixelRatio || 1, 2) });
  } catch (e) {
    $<HTMLElement>(".loading").textContent = "3D isn't available on this device.";
    console.error(e);
    return;
  }
  window.player = player;
  const fit = () => player.resize(box.clientWidth, box.clientHeight);
  fit();
  new ResizeObserver(fit).observe(box);

  // Muscle lists, from the same map that drives the glow.
  const list = (regions: Region[], el: HTMLElement) => {
    el.innerHTML = "";
    const seen = new Set<string>();
    for (const r of regions) {
      const label = REGION_LABELS[r];
      if (seen.has(label)) continue;
      seen.add(label);
      const li = document.createElement("li");
      li.textContent = label;
      el.append(li);
    }
  };
  list(player.targets.primary, $("#primary"));
  list(player.targets.secondary, $("#secondary"));

  // Step cards with thumbnails rendered from the athlete itself; tap to jump there.
  const T = player.duration;
  const steps = $<HTMLElement>("#steps");
  STEPS.forEach((s, i) => {
    const phase = player.effort.phases[s.key];
    const card = document.createElement("button");
    card.className = "step";
    card.innerHTML = `<img alt="" /><span class="num">${i + 1}</span><span class="txt"><b>${s.title}</b><span>${s.text}</span></span>`;
    card.querySelector("img")!.src = player.snapshot(phase * T, "front", 220, 260);
    card.addEventListener("click", () => {
      player.seek(phase * T);
      setPlaying(false);
    });
    card.dataset.phase = String(phase);
    steps.append(card);
  });
  $<HTMLImageElement>("#diag-front").src = player.diagram("front", 260, 420);
  $<HTMLImageElement>("#diag-back").src = player.diagram("back", 260, 420);

  // Angle thumbnails.
  const top = player.effort.phases.top * T;
  for (const v of ["front", "side", "rear"] as CameraView[]) {
    const b = $<HTMLButtonElement>(`[data-view="${v}"]`);
    b.querySelector("img")!.src = player.snapshot(top + 0.01, v, 120, 150);
    b.addEventListener("click", () => {
      player.setView(v);
      document.querySelectorAll("[data-view]").forEach((x) => x.classList.toggle("on", x === b));
    });
  }

  // Transport.
  const playBtn = $<HTMLButtonElement>("#play");
  const setPlaying = (on: boolean) => {
    if (on) player.play();
    else player.pause();
    playBtn.classList.toggle("paused", !on);
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
  };
  setPlaying(player.playing);
  playBtn.addEventListener("click", () => setPlaying(!player.playing));
  const scrub = $<HTMLInputElement>("#scrub");
  scrub.max = String(T);
  scrub.addEventListener("input", () => {
    setPlaying(false);
    player.seek(Number(scrub.value));
  });
  const modes = document.querySelectorAll<HTMLButtonElement>("[data-speed]");
  modes.forEach((b) =>
    b.addEventListener("click", () => {
      player.setSpeed(Number(b.dataset.speed));
      modes.forEach((x) => x.classList.toggle("on", x === b));
      setPlaying(true);
    }),
  );
  const glow = $<HTMLInputElement>("#glow");
  glow.addEventListener("change", () => player.setGlow(glow.checked));

  attachControls(canvas, player);

  const meter = $<HTMLElement>("#meter");
  const time = $<HTMLElement>("#time");
  const cards = [...steps.children] as HTMLElement[];
  player.onTick((t, e) => {
    scrub.value = String(t);
    time.textContent = `${fmt(t)} / ${fmt(T)}`;
    meter.style.setProperty("--e", e.toFixed(3));
    const ph = t / T;
    let active = 0;
    cards.forEach((c, i) => {
      if (ph >= Number(c.dataset.phase) - 1e-6) active = i;
    });
    cards.forEach((c, i) => c.classList.toggle("on", i === active));
  });
  for (const m of ex.mistakes) {
    const li = document.createElement("li");
    li.textContent = m;
    $("#mistakes").append(li);
  }
  $<HTMLElement>(".loading").remove();
  window.ready = true;
})();
