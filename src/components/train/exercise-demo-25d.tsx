"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/keyboard";
import { demoMoves, type ExerciseDemoAsset } from "@/lib/exercise-demos";

export interface ExerciseDemo25DProps {
  slug: string;
  name: string;
  asset: ExerciseDemoAsset;
  className?: string;
  /** Play/pause, speed and the phase buttons, plus the status badge (default true). */
  controls?: boolean;
  autoplay?: boolean;
}

const STATUS_LABEL: Record<ExerciseDemoAsset["status"], string> = {
  "stand-in": "Stand-in · not the final art",
  review: "New demo · awaiting approval",
  approved: "",
};

/**
 * The premium 2.5D exercise demonstration: a pre-rendered loop of the athlete (poster first, then the muted inline
 * video; the phase stills when there is no loop yet). Honest about its state: a badge names a stand-in or a demo
 * awaiting approval, and a still-only asset says the animation is pending. Reduced motion: the poster, play on tap.
 */
export function ExerciseDemo25D({ slug, name, asset, className, controls = true, autoplay = true }: ExerciseDemo25DProps) {
  const video = useRef<HTMLVideoElement>(null);
  const hasLoop = Boolean(asset.mp4 || asset.webm);
  const reduced = typeof window !== "undefined" && prefersReducedMotion();
  const [playing, setPlaying] = useState(autoplay && !reduced && hasLoop);
  const [speed, setSpeed] = useState(1);
  const [phase, setPhase] = useState(0);
  const [failed, setFailed] = useState(false);
  const [angle, setAngle] = useState(-1); // -1 = the main clip, else an index into asset.angles
  const view = angle >= 0 && asset.angles?.[angle] ? asset.angles[angle] : null;
  const mp4 = view ? view.mp4 : asset.mp4;
  const webm = view ? view.webm : asset.webm;
  const poster = view ? view.poster : asset.poster;

  // The loop: muted and inline (iOS keeps it in place), looping, started here because React does not reliably
  // reflect `muted`, which autoplay requires.
  useEffect(() => {
    const v = video.current;
    if (!v || !hasLoop) return;
    v.muted = true;
    v.playbackRate = speed;
    if (playing) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing, speed, hasLoop, mp4, webm]);

  // Still-only assets with several phases cycle through them slowly (a crossfade, never a warp).
  useEffect(() => {
    if (hasLoop || asset.phases.length < 2 || !playing) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % asset.phases.length), 1400);
    return () => clearInterval(id);
  }, [hasLoop, asset.phases.length, playing]);

  const seek = (i: number) => {
    setPhase(i);
    const t = asset.phases[i]?.t;
    if (hasLoop && video.current && typeof t === "number") {
      video.current.currentTime = t;
      setPlaying(false);
      video.current.pause();
    }
  };

  const ctl = "min-h-9 rounded-md px-2.5 text-xs font-semibold text-foreground/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
  const on = "bg-gold/20 text-gold-highlight";
  const badge = STATUS_LABEL[asset.status];
  const moves = demoMoves(asset);

  return (
    <div data-testid="exercise-demo-25d" data-slug={slug} data-mode={asset.mode} data-status={asset.status} data-playing={playing} className="flex flex-col">
      <div className={cn("relative overflow-hidden bg-[#0a0a0a]", className)}>
        {hasLoop && !failed ? (
          <video
            key={mp4 ?? webm}
            ref={video}
            poster={poster}
            muted
            loop
            playsInline
            preload="metadata"
            width={asset.width}
            height={asset.height}
            className="absolute inset-0 h-full w-full object-contain"
            aria-label={`${name}: pre-rendered demonstration of the movement`}
            onError={() => setFailed(true)}
          >
            {webm && <source src={webm} type="video/webm" />}
            {mp4 && <source src={mp4} type="video/mp4" />}
          </video>
        ) : (
          asset.phases.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.src}
              src={p.src}
              alt={i === phase ? `${name}, ${p.label.toLowerCase()} position` : ""}
              width={asset.width}
              height={asset.height}
              className={cn("absolute inset-0 h-full w-full object-contain transition-opacity duration-500", i === phase ? "opacity-100" : "opacity-0")}
              loading={i === 0 ? "eager" : "lazy"}
              draggable={false}
            />
          ))
        )}
        {!hasLoop && asset.phases.length === 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.poster} alt={`${name}: demonstration still`} width={asset.width} height={asset.height} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        )}
        {controls && badge && (
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-gold-highlight">{badge}</span>
        )}
        {controls && !moves && (
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 text-[0.6875rem] text-foreground/90" role="status">
            Still only: the animated loop for this exercise has not been produced yet.
          </p>
        )}
        {!hasLoop && asset.phases.length > 1 && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-foreground/90">{asset.phases[phase]?.label}</span>
        )}
      </div>
      {controls && moves && (
        <div className="flex flex-wrap items-center gap-1 bg-[#0d0b08] px-2 py-1.5" role="group" aria-label="Demonstration controls">
          <button type="button" onClick={() => setPlaying(!playing)} className={cn(ctl, "inline-flex items-center gap-1")} aria-label={playing ? "Pause" : "Play"} aria-pressed={playing}>
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </button>
          {hasLoop &&
            [0.5, 1].map((s) => (
              <button key={s} type="button" onClick={() => { setSpeed(s); setPlaying(true); }} className={cn(ctl, speed === s && on)} aria-pressed={speed === s}>
                {s}×
              </button>
            ))}
          {asset.angles && asset.angles.length > 0 && (
            <>
              <span className="mx-1 h-4 w-px bg-white/20" aria-hidden />
              <button type="button" onClick={() => setAngle(-1)} className={cn(ctl, angle === -1 && on)} aria-pressed={angle === -1}>
                {asset.mainAngle ?? "Main"}
              </button>
              {asset.angles.map((a, i) => (
                <button key={a.label} type="button" onClick={() => setAngle(i)} className={cn(ctl, angle === i && on)} aria-pressed={angle === i}>
                  {a.label}
                </button>
              ))}
            </>
          )}
          {asset.phases.length > 1 && <span className="mx-1 h-4 w-px bg-white/20" aria-hidden />}
          {asset.phases.length > 1 &&
            asset.phases.map((p, i) => (
              <button key={p.label} type="button" onClick={() => seek(i)} className={cn(ctl, phase === i && !playing && on)} aria-pressed={phase === i && !playing}>
                {p.label}
              </button>
            ))}
          {asset.highlighted.length > 0 && (
            <span className="ml-auto text-[0.6875rem] text-muted-foreground">
              Highlighted: <span className="text-gold-highlight">{asset.highlighted.join(", ")}</span>
            </span>
          )}
        </div>
      )}
      {asset.note && controls && asset.status !== "approved" && <p className="bg-[#0d0b08] px-3 pb-2 text-[0.6875rem] text-muted-foreground">{asset.note}</p>}
    </div>
  );
}

/** The poster still, for lists and the logger's small card. */
export function ExerciseDemo25DStill({ name, asset, className }: { name: string; asset: ExerciseDemoAsset; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.thumb} alt={`${name} demonstration (still)`} width={480} height={360} loading="lazy" className={cn("block h-full w-full object-cover bg-[#0a0a0a]", className)} draggable={false} />;
}
