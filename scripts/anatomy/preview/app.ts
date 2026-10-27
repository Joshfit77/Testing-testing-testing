import { mountAthlete, type CameraView } from "../../../src/lib/anatomy3d/player";
import { REGION_LABELS, type Region } from "../../../src/lib/anatomy3d/muscle-ids";
import { EXERCISES } from "../../../src/data/exercises";

declare global {
  interface Window {
    ready?: boolean;
    player?: unknown;
  }
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

(async () => {
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

  // One finger (or the mouse) turns the athlete all the way round; two fingers pinch to zoom; the wheel zooms too.
  canvas.style.touchAction = "none";
  const touches = new Map<number, { x: number; y: number }>();
  const spread = () => {
    const [a, b] = [...touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  canvas.addEventListener("pointerdown", (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const prev = touches.get(e.pointerId);
    if (!prev) return;
    if (touches.size >= 2) {
      const before = spread();
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const after = spread();
      if (before > 0 && after > 0) player.zoom(before / after);
      return;
    }
    player.orbit((e.clientX - prev.x) * 0.008, (e.clientY - prev.y) * 0.004);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const lift = (e: PointerEvent) => touches.delete(e.pointerId);
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    player.zoom(Math.exp(e.deltaY * 0.0012));
  }, { passive: false });

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
