import { fitCamera, renderFrame, type Bounds, type Camera } from "./render";
import { compileMotion, evaluate, motionBounds, type CompiledMotion } from "./timeline";
import type { ExerciseMeta, MotionDef } from "./types";

export interface MountOptions {
  /** Start playing immediately (default true, unless reduced motion is preferred). */
  autoplay?: boolean;
  /** Force reduced motion on/off. Defaults to the viewer's `prefers-reduced-motion` setting. */
  reducedMotion?: boolean;
  /** Playback speed multiplier (default 1). */
  speed?: number;
  /** Render built-in play/pause and speed buttons (default true). */
  controls?: boolean;
  /** Small caption in the top-left corner (default "Animated demo"; pass "" to hide). */
  badge?: string;
  /** Draw a single still frame only (thumbnails). No animation loop, no controls. */
  still?: boolean;
  /** Exercise info used for the pattern-based fallback when the slug has no hand-made motion. */
  meta?: ExerciseMeta;
  /** Override the accessible label. */
  label?: string;
  /** Called when play state or speed changes. */
  onChange?: (state: { playing: boolean; speed: number }) => void;
}

export interface MotionController {
  play(): void;
  pause(): void;
  toggle(): void;
  setSpeed(speed: number): void;
  readonly playing: boolean;
  readonly speed: number;
  readonly motion: MotionDef;
  /** Jump to a phase of the loop (0..1) and redraw (used for previews and screenshots). */
  seek(phase: number): void;
  destroy(): void;
}

const BTN =
  "display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:44px;height:36px;padding:0 10px;border-radius:999px;" +
  "border:1px solid rgba(212,170,60,0.45);background:rgba(10,10,10,0.72);color:#f3d77a;font:600 12px/1 system-ui,sans-serif;cursor:pointer;" +
  "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)";

const PLAY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>';
const PAUSE_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>';

function prefersReducedMotion(): boolean {
  try {
    // OS setting, or an in-app preference exposed as <html data-motion="reduce">.
    if (typeof document !== "undefined" && document.documentElement?.dataset?.motion === "reduce") return true;
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Mount an animated demonstration of a motion definition into `host`.
 * The host should have a size (e.g. an aspect-ratio box); the canvas fills it.
 */
export function mountMotion(host: HTMLElement, def: MotionDef, opts: MountOptions = {}): MotionController {
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;
  const compiled: CompiledMotion = compileMotion(def);
  const bounds: Bounds = motionBounds(compiled);
  const reduced = opts.reducedMotion ?? prefersReducedMotion();
  const still = Boolean(opts.still);
  let playing = !still && (opts.autoplay ?? true) && !reduced;
  let speed = opts.speed ?? 1;
  let clock = (def.stillPhase ?? 0.5) * compiled.duration;
  if (playing) clock = 0;
  let raf = 0;
  let last = 0;
  let visible = true;
  let destroyed = false;
  let cam: Camera | null = null;

  const wrap = doc.createElement("div");
  wrap.style.cssText = "position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;background:#0a0a0a";
  wrap.setAttribute("data-exercise-motion", def.id);
  const canvas = doc.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", opts.label ?? `Animated demonstration. ${def.label}`);
  canvas.setAttribute("data-motion-canvas", "");
  wrap.appendChild(canvas);
  host.appendChild(wrap);
  const ctx = canvas.getContext("2d");

  let playBtn: HTMLButtonElement | null = null;
  let speedBtn: HTMLButtonElement | null = null;
  const badge = opts.badge ?? "Animated demo";
  if (!still && badge) {
    const b = doc.createElement("span");
    b.textContent = badge;
    b.style.cssText =
      "position:absolute;left:10px;top:10px;padding:4px 8px;border-radius:999px;background:rgba(10,10,10,0.6);border:1px solid rgba(212,170,60,0.35);" +
      "color:#e9c869;font:600 10px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;pointer-events:none";
    b.setAttribute("aria-hidden", "true");
    wrap.appendChild(b);
  }
  if (!still && opts.controls !== false) {
    const bar = doc.createElement("div");
    bar.style.cssText = "position:absolute;left:10px;bottom:10px;display:flex;gap:8px";
    playBtn = doc.createElement("button");
    playBtn.type = "button";
    playBtn.style.cssText = BTN;
    speedBtn = doc.createElement("button");
    speedBtn.type = "button";
    speedBtn.style.cssText = BTN;
    playBtn.addEventListener("click", () => ctrl.toggle());
    speedBtn.addEventListener("click", () => ctrl.setSpeed(speed === 1 ? 0.5 : 1));
    bar.append(playBtn, speedBtn);
    wrap.appendChild(bar);
  }

  const syncUi = () => {
    if (playBtn) {
      playBtn.innerHTML = playing ? PAUSE_SVG : PLAY_SVG;
      playBtn.setAttribute("aria-label", playing ? "Pause demonstration" : "Play demonstration");
      playBtn.setAttribute("aria-pressed", String(playing));
    }
    if (speedBtn) {
      speedBtn.textContent = speed === 1 ? "1×" : "0.5×";
      speedBtn.setAttribute("aria-label", `Playback speed ${speed === 1 ? "normal" : "half"}. Switch to ${speed === 1 ? "half" : "normal"} speed`);
    }
    wrap.setAttribute("data-playing", String(playing));
    opts.onChange?.({ playing, speed });
  };

  const resize = () => {
    const r = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    const dpr = Math.min(2.5, win.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    cam = fitCamera(bounds, w, h, dpr, def.mirror);
    draw();
  };

  const draw = () => {
    if (!ctx || !cam) return;
    const frame = evaluate(compiled, clock);
    renderFrame(ctx, frame, cam, { time: clock, floor: def.floor });
  };

  const loop = (now: number) => {
    raf = 0;
    if (!playing || !visible || destroyed) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    clock = (clock + dt * speed) % compiled.duration;
    draw();
    raf = win.requestAnimationFrame(loop);
  };
  const start = () => {
    if (raf || !playing || !visible || destroyed) return;
    last = 0;
    raf = win.requestAnimationFrame(loop);
  };
  const stop = () => {
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
  };

  let ro: ResizeObserver | null = null;
  let io: IntersectionObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => resize());
    ro.observe(host);
  } else win.addEventListener("resize", resize);
  if (!still && typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) start();
      else stop();
    });
    io.observe(wrap);
  }
  const onVis = () => {
    if (doc.hidden) stop();
    else start();
  };
  doc.addEventListener("visibilitychange", onVis);

  const ctrl: MotionController = {
    play() {
      if (still || playing) return;
      playing = true;
      syncUi();
      start();
    },
    pause() {
      if (!playing) return;
      playing = false;
      stop();
      syncUi();
    },
    toggle() {
      if (playing) ctrl.pause();
      else ctrl.play();
    },
    setSpeed(s: number) {
      speed = s > 0 ? s : 1;
      syncUi();
    },
    get playing() {
      return playing;
    },
    get speed() {
      return speed;
    },
    motion: def,
    seek(phase: number) {
      clock = (((phase % 1) + 1) % 1) * compiled.duration;
      draw();
    },
    destroy() {
      destroyed = true;
      stop();
      ro?.disconnect();
      io?.disconnect();
      win.removeEventListener("resize", resize);
      doc.removeEventListener("visibilitychange", onVis);
      wrap.remove();
    },
  };

  syncUi();
  resize();
  start();
  return ctrl;
}
