import { fitCamera, renderFrame, type Bounds, type Camera, type FigureStyle } from "./render";
import type { Highlight } from "./athlete";
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
  /** Called when play state, speed or the figure's look changes. */
  onChange?: (state: { playing: boolean; speed: number; style: FigureStyle }) => void;
  /** The figure's look: "classic" (the gold figure, default) or "athlete" (the black-and-gold athlete). */
  style?: FigureStyle;
  /** Athlete look: the trained muscles that glow. */
  highlight?: Highlight;
  /** Show a button that switches between the athlete and the classic look (for reviewing the new look). */
  styleToggle?: boolean;
  /** Keep the figure this many CSS px above the bottom edge, clear of the controls (default 0: they overlap the floor). */
  controlsInset?: number;
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
  /** Where the loop is, 0..1. */
  readonly phase: number;
  setStyle(style: FigureStyle): void;
  readonly style: FigureStyle;
  /** Fill the screen (native full screen where the device has it, otherwise the page's whole viewport) or leave it. */
  toggleFullscreen(): void;
  readonly fullscreen: boolean;
  destroy(): void;
}

const BTN =
  "display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:44px;height:36px;padding:0 10px;border-radius:999px;" +
  "border:1px solid rgba(212,170,60,0.45);background:rgba(10,10,10,0.72);color:#f3d77a;font:600 12px/1 system-ui,sans-serif;cursor:pointer;" +
  "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)";

const PLAY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>';
const PAUSE_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>';
const FULL_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const EXIT_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

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

  let style: FigureStyle = opts.style ?? "classic";
  let fullscreen = false;
  const interactive = !still && opts.controls !== false;

  const wrap = doc.createElement("div");
  const WRAP_CSS = "position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;background:#0a0a0a";
  wrap.style.cssText = WRAP_CSS;
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
  let styleBtn: HTMLButtonElement | null = null;
  let fullBtn: HTMLButtonElement | null = null;
  let bar: HTMLInputElement | null = null;
  let badgeEl: HTMLSpanElement | null = null;
  const badge = opts.badge ?? "Animated demo";
  if (!still && badge) {
    badgeEl = doc.createElement("span");
    badgeEl.textContent = badge;
    badgeEl.style.cssText =
      "position:absolute;left:10px;top:10px;padding:4px 8px;border-radius:999px;background:rgba(10,10,10,0.6);border:1px solid rgba(212,170,60,0.35);" +
      "color:#e9c869;font:600 10px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;pointer-events:none";
    badgeEl.setAttribute("aria-hidden", "true");
    wrap.appendChild(badgeEl);
  }
  if (interactive) {
    // Finger control: tap the picture to play or pause; drag sideways to move through the rep (the picture's width is
    // one loop); up-and-down drags still scroll the page.
    wrap.style.touchAction = "pan-y";
    wrap.tabIndex = 0;
    wrap.setAttribute("aria-roledescription", "exercise animation");
    wrap.setAttribute("aria-label", `${opts.label ?? def.label} Tap to play or pause; drag sideways, or use the arrow keys, to move through the movement.`);
    const pos = doc.createElement("div");
    pos.style.cssText = "position:absolute;left:10px;right:10px;bottom:52px;display:flex";
    bar = doc.createElement("input");
    bar.type = "range";
    bar.min = "0";
    bar.max = "1000";
    bar.step = "1";
    bar.value = "0";
    bar.setAttribute("aria-label", "Position in the movement");
    bar.style.cssText = "width:100%;height:22px;margin:0;accent-color:#d4aa3c;cursor:pointer;background:transparent";
    bar.addEventListener("input", () => {
      if (!bar) return;
      if (playing) ctrl.pause();
      ctrl.seek(Number(bar.value) / 1000);
    });
    pos.appendChild(bar);
    wrap.appendChild(pos);
    const row = doc.createElement("div");
    row.style.cssText = "position:absolute;left:10px;right:10px;bottom:10px;display:flex;gap:8px;align-items:center";
    playBtn = doc.createElement("button");
    playBtn.type = "button";
    playBtn.style.cssText = BTN;
    speedBtn = doc.createElement("button");
    speedBtn.type = "button";
    speedBtn.style.cssText = BTN;
    playBtn.addEventListener("click", () => ctrl.toggle());
    speedBtn.addEventListener("click", () => ctrl.setSpeed(speed === 1 ? 0.5 : 1));
    row.append(playBtn, speedBtn);
    if (opts.styleToggle) {
      styleBtn = doc.createElement("button");
      styleBtn.type = "button";
      styleBtn.style.cssText = BTN;
      styleBtn.addEventListener("click", () => ctrl.setStyle(style === "athlete" ? "classic" : "athlete"));
      row.append(styleBtn);
    }
    fullBtn = doc.createElement("button");
    fullBtn.type = "button";
    fullBtn.style.cssText = BTN + ";margin-left:auto";
    fullBtn.addEventListener("click", () => ctrl.toggleFullscreen());
    row.append(fullBtn);
    wrap.appendChild(row);

    let drag: { id: number; x: number; y: number; t: number; start: number; intent: "" | "scrub" | "scroll" } | null = null;
    wrap.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest("button,input")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), start: clock / compiled.duration, intent: "" };
    });
    wrap.addEventListener("pointermove", (e) => {
      const d = drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.intent) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        d.intent = Math.abs(dx) > Math.abs(dy) ? "scrub" : "scroll";
        if (d.intent === "scroll") {
          drag = null;
          return;
        }
        try {
          wrap.setPointerCapture(e.pointerId);
        } catch {
          // Capture is a nicety: the drag works while the finger stays on the picture.
        }
        wrap.setAttribute("data-scrubbing", "true");
        if (playing) ctrl.pause();
      }
      const w = wrap.getBoundingClientRect().width || 1;
      ctrl.seek(d.start + dx / w);
    });
    const end = (e: PointerEvent) => {
      const d = drag;
      drag = null;
      if (!d || d.id !== e.pointerId) return;
      if (d.intent === "scrub") {
        wrap.setAttribute("data-scrubbing", "false");
      } else if (e.type === "pointerup" && Math.abs(e.clientX - d.x) < 10 && Math.abs(e.clientY - d.y) < 10 && performance.now() - d.t < 450) ctrl.toggle();
    };
    wrap.addEventListener("pointerup", end);
    wrap.addEventListener("pointercancel", end);
    wrap.addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement).closest("button,input")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        ctrl.toggle();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (playing) ctrl.pause();
        ctrl.seek(clock / compiled.duration + (e.key === "ArrowRight" ? 1 : -1) / Math.max(12, Math.round(compiled.duration * 15)));
      } else if (e.key === "Escape" && fullscreen) ctrl.toggleFullscreen();
    });
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
    if (styleBtn) {
      styleBtn.textContent = style === "athlete" ? "Classic look" : "New look";
      styleBtn.setAttribute("aria-label", style === "athlete" ? "Show the classic gold figure" : "Show the new athlete look");
    }
    if (fullBtn) {
      fullBtn.innerHTML = fullscreen ? EXIT_SVG : FULL_SVG;
      fullBtn.setAttribute("aria-label", fullscreen ? "Exit full screen" : "Full screen");
    }
    wrap.setAttribute("data-playing", String(playing));
    wrap.setAttribute("data-speed", String(speed));
    wrap.setAttribute("data-style", style);
    wrap.setAttribute("data-fullscreen", String(fullscreen));
    opts.onChange?.({ playing, speed, style });
  };

  const resize = () => {
    const r = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    const dpr = Math.min(2.5, win.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    cam = fitCamera(bounds, w, h, dpr, def.mirror, interactive ? (opts.controlsInset ?? 0) : 0);
    draw();
  };

  const draw = () => {
    if (!ctx || !cam) return;
    const frame = evaluate(compiled, clock);
    renderFrame(ctx, frame, cam, { time: clock, floor: def.floor, style, highlight: opts.highlight });
    // The position bar follows the picture (unless the bar itself is being dragged).
    if (bar && doc.activeElement !== bar) bar.value = String(Math.round((clock / compiled.duration) * 1000));
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
    ro.observe(wrap);
  } else win.addEventListener("resize", resize);
  if (!still && typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((entries) => {
      visible = fullscreen || entries.some((e) => e.isIntersecting);
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
  // Native full screen ended by the system (Escape, the browser's own control): follow it.
  const onFsChange = () => {
    if (fullscreen && doc.fullscreenElement !== wrap && !wrap.hasAttribute("data-pseudo-fullscreen")) {
      fullscreen = false;
      syncUi();
    }
  };
  doc.addEventListener("fullscreenchange", onFsChange);
  const setPseudo = (on: boolean) => {
    // The page's whole viewport (iPhone Safari and the app's web view have no element full screen).
    if (on) {
      wrap.setAttribute("data-pseudo-fullscreen", "");
      wrap.style.cssText = WRAP_CSS + ";position:fixed;inset:0;width:auto;height:auto;z-index:2147483000;border-radius:0;background:#050505;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    } else {
      wrap.removeAttribute("data-pseudo-fullscreen");
      wrap.style.cssText = WRAP_CSS;
    }
    if (interactive) wrap.style.touchAction = on ? "none" : "pan-y";
  };

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
    get phase() {
      return clock / compiled.duration;
    },
    setStyle(s: FigureStyle) {
      style = s;
      syncUi();
      draw();
    },
    get style() {
      return style;
    },
    toggleFullscreen() {
      if (!fullscreen) {
        fullscreen = true;
        const native = doc.fullscreenEnabled && typeof wrap.requestFullscreen === "function";
        if (native) void wrap.requestFullscreen().catch(() => setPseudo(true));
        else setPseudo(true);
      } else {
        fullscreen = false;
        if (doc.fullscreenElement === wrap) void doc.exitFullscreen().catch(() => {});
        setPseudo(false);
      }
      visible = true;
      syncUi();
      start();
      wrap.focus({ preventScroll: true });
    },
    get fullscreen() {
      return fullscreen;
    },
    destroy() {
      destroyed = true;
      stop();
      if (fullscreen && doc.fullscreenElement === wrap) void doc.exitFullscreen().catch(() => {});
      ro?.disconnect();
      io?.disconnect();
      win.removeEventListener("resize", resize);
      doc.removeEventListener("visibilitychange", onVis);
      doc.removeEventListener("fullscreenchange", onFsChange);
      wrap.remove();
    },
  };

  syncUi();
  resize();
  start();
  return ctrl;
}
