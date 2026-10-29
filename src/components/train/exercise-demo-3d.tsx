"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExerciseMeta } from "@/lib/exercise-motion/types";
import type { CameraView } from "@/lib/anatomy3d/player";
import type { ModelViewer } from "@/lib/anatomy3d/model-viewer";
import { ExerciseDemo } from "./exercise-demo";

type Phase = "loading" | "ready" | "fallback";

/** Whether this browser can draw WebGL at all (checked before the model is downloaded). */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export interface ExerciseDemo3DProps {
  slug: string;
  name: string;
  meta?: Omit<ExerciseMeta, "slug">;
  className?: string;
  /** Play/pause, speed, the three views and Muscle Glow (default true). */
  controls?: boolean;
  autoplay?: boolean;
}

const VIEWS: { key: CameraView; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "side", label: "Side" },
  { key: "rear", label: "Rear" },
];

/**
 * The 3D anatomical figure performing an exercise (src/lib/anatomy3d), for the exercises in src/lib/anatomy3d/in-app.ts.
 *
 * The animated illustration (ExerciseDemo) is shown while the model downloads, stays when WebGL or the model's files
 * are not available, and can be chosen in the player; the figure is never the only demonstration.
 */
export function ExerciseDemo3D({
  slug,
  name,
  meta,
  className,
  controls = true,
  autoplay = true,
}: ExerciseDemo3DProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<ModelViewer | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  /** The athlete chose the illustration over the figure. */
  const [illustration, setIllustration] = useState(false);
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<CameraView | null>(null);
  const [glow, setGlow] = useState(true);
  // (The mount is asynchronous: it applies whatever the controls say by the time the model is ready.)
  const wanted = useRef({ playing, speed, glow });
  wanted.current = { playing, speed, glow };

  useEffect(() => {
    if (illustration) return;
    const el = canvas.current;
    const host = box.current;
    if (!el || !host) return;
    if (!webglAvailable()) {
      setNote(
        "3D isn't available on this device, so here is the illustration."
      );
      setPhase("fallback");
      return;
    }
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    setPhase("loading");
    setProgress(0);
    setNote(null);
    (async () => {
      const [{ mountAppModel }, { attachControls }] = await Promise.all([
        import("@/lib/anatomy3d/app-player"),
        import("@/lib/anatomy3d/controls"),
      ]);
      if (cancelled) return;
      const v = await mountAppModel(el, slug, {
        onProgress: (f) => {
          if (!cancelled) setProgress(f);
        },
        reducedMotion:
          typeof matchMedia === "function" &&
          matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      if (cancelled) {
        v.dispose();
        return;
      }
      viewer.current = v;
      const fit = () => v.resize(host.clientWidth, host.clientHeight);
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(host);
      const detach = attachControls(el, v);
      v.setGlow(wanted.current.glow);
      v.motion?.setSpeed(wanted.current.speed);
      if (!wanted.current.playing) v.motion?.pause();
      // (Nothing is drawn while the tab is hidden or the app is in the background.)
      const onVisibility = () => {
        if (document.hidden) v.motion?.pause();
        else if (wanted.current.playing) v.motion?.play();
      };
      document.addEventListener("visibilitychange", onVisibility);
      cleanup = () => {
        document.removeEventListener("visibilitychange", onVisibility);
        ro.disconnect();
        detach();
        v.dispose();
        viewer.current = null;
      };
      setPhase("ready");
    })().catch((e: unknown) => {
      if (cancelled) return;
      console.error(e);
      setNote("The 3D figure couldn't be loaded, so here is the illustration.");
      setPhase("fallback");
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [slug, illustration]);

  const ready = phase === "ready" && !illustration;
  const showIllustration = illustration || phase !== "ready";
  const togglePlay = () => {
    const m = viewer.current?.motion;
    const next = !playing;
    setPlaying(next);
    if (next) m?.play();
    else m?.pause();
  };
  const choose = (v: CameraView) => {
    setView(v);
    viewer.current?.setView(v);
  };
  const chooseSpeed = (s: number) => {
    setSpeed(s);
    viewer.current?.motion?.setSpeed(s);
    if (!playing) {
      setPlaying(true);
      viewer.current?.motion?.play();
    }
  };
  const toggleGlow = () => {
    setGlow(!glow);
    viewer.current?.setGlow(!glow);
  };
  const ctl =
    "min-h-9 rounded-md px-2.5 text-xs font-semibold text-foreground/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
  const on = "bg-gold/20 text-gold-highlight";

  return (
    <div
      data-testid="exercise-demo-3d"
      data-phase={illustration ? "illustration" : phase}
      className="flex flex-col"
    >
      <div
        ref={box}
        className={cn("relative overflow-hidden bg-[#060504]", className)}
      >
        <canvas
          ref={canvas}
          className={cn(
            "absolute inset-0 h-full w-full",
            !ready && "invisible"
          )}
          aria-label={`3D anatomical figure performing the ${name}. Drag to turn it, pinch or scroll to zoom.`}
          role="img"
        />
        {showIllustration && (
          <ExerciseDemo
            slug={slug}
            name={name}
            meta={meta}
            controls={controls && phase !== "loading"}
            autoplay={autoplay}
            className="absolute inset-0 h-full w-full"
          />
        )}
        {!illustration && phase === "loading" && (
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 text-[0.6875rem] text-foreground/90"
            role="status"
            aria-live="polite"
          >
            Loading the 3D figure · {Math.round(progress * 100)}%
            <div
              className="mt-1 h-1 w-full overflow-hidden rounded bg-white/15"
              aria-hidden
            >
              <div
                className="h-full bg-gold transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        )}
        {phase === "fallback" && note && (
          <p
            className="absolute inset-x-0 top-0 bg-black/70 px-3 py-1.5 text-[0.6875rem] text-foreground/90"
            role="status"
          >
            {note}
          </p>
        )}
        {ready && controls && (
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-gold-highlight">
            3D anatomical demo · preview
          </span>
        )}
        {phase !== "fallback" && controls && (
          <button
            type="button"
            onClick={() => setIllustration(!illustration)}
            className="absolute right-2 top-2 min-h-8 rounded-md bg-black/60 px-2 text-[0.6875rem] font-semibold text-foreground/90 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-pressed={illustration}
          >
            {illustration ? "Show the 3D figure" : "Show the illustration"}
          </button>
        )}
      </div>
      {ready && controls && (
        <div
          className="flex flex-wrap items-center gap-1 bg-[#0d0b08] px-2 py-1.5"
          role="group"
          aria-label="3D demonstration controls"
        >
          <button
            type="button"
            onClick={togglePlay}
            className={cn(ctl, "inline-flex items-center gap-1")}
            aria-label={playing ? "Pause" : "Play"}
            aria-pressed={playing}
          >
            {playing ? (
              <Pause className="size-4" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}
          </button>
          {[0.5, 1].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => chooseSpeed(s)}
              className={cn(ctl, speed === s && on)}
              aria-pressed={speed === s}
            >
              {s}×
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/20" aria-hidden />
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => choose(v.key)}
              className={cn(ctl, view === v.key && on)}
              aria-pressed={view === v.key}
            >
              {v.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/20" aria-hidden />
          <button
            type="button"
            onClick={toggleGlow}
            className={cn(ctl, glow && on)}
            aria-pressed={glow}
            aria-label="Muscle Glow"
          >
            Glow
          </button>
        </div>
      )}
    </div>
  );
}
