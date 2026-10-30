"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
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
  const [ended, setEnded] = useState(false);
  const loops = asset.loop !== false;
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
    if (playing) {
      if (v.ended) v.currentTime = 0;
      void v.play().catch(() => setPlaying(false));
    }
    else v.pause();
  }, [playing, speed, hasLoop, mp4, webm]);

  // Load failures can happen before React attaches its handlers (the server-rendered <video> starts loading at once),
  // so check the element when the player mounts, and listen on the <source> elements themselves.
  useEffect(() => {
    const v = video.current;
    if (!v || !hasLoop) return;
    const settle = () => {
      if (v.error || v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) setFailed(true);
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = () => timers.push(setTimeout(settle, 250));
    // A new element reports "no source" for a moment while it starts choosing one; a real failure stays that way.
    if (v.error) setFailed(true);
    else timers.push(setTimeout(settle, 1500));
    const sources = Array.from(v.querySelectorAll("source"));
    sources.forEach((s) => s.addEventListener("error", later));
    v.addEventListener("error", settle);
    return () => {
      timers.forEach(clearTimeout);
      sources.forEach((s) => s.removeEventListener("error", later));
      v.removeEventListener("error", settle);
    };
  }, [hasLoop, mp4, webm]);

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

  const replay = () => {
    const v = video.current;
    if (v) v.currentTime = 0;
    setEnded(false);
    setPlaying(true);
    if (v) void v.play().catch(() => setPlaying(false));
  };
  // The full player takes the clip's own shape (a portrait clip stays portrait), capped to most of the screen's height;
  // a small card (no controls) fills its box and shows the upper body.
  const frameStyle = controls ? { aspectRatio: `${asset.width} / ${asset.height}` } : undefined;

  return (
    <div data-testid="exercise-demo-25d" data-slug={slug} data-mode={asset.mode} data-status={asset.status} data-playing={playing} data-ended={ended} className="flex flex-col">
      <div className={cn("relative overflow-hidden bg-[#0a0a0a]", controls && "mx-auto max-h-[70vh]", className)} style={frameStyle}>
        {hasLoop && !failed ? (
          <video
            key={mp4 ?? webm}
            ref={video}
            poster={poster}
            muted
            loop={loops}
            playsInline
            preload="metadata"
            width={asset.width}
            height={asset.height}
            className={cn("absolute inset-0 h-full w-full", controls ? "object-contain" : "object-cover object-[50%_15%]")}
            aria-label={`${name}: pre-rendered demonstration of the movement`}
            // A browser without H.264 skips the MP4 for the WebM; that is not a failure. Real failures are caught by the
            // effect above (the element's own error, or no playable source left).
            onEnded={() => {
              setPlaying(false);
              setEnded(true);
            }}
            onPlay={() => setEnded(false)}
          >
            {/* The MP4 first: iPhone and desktop browsers play the original file; the WebM serves browsers without H.264. */}
            {mp4 && <source src={mp4} type="video/mp4" />}
            {webm && <source src={webm} type="video/webm" />}
          </video>
        ) : asset.phases.length === 0 ? (
          // No loop (or it failed to play) and no phase stills: the poster, never an empty frame.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={`${name}: demonstration still`} width={asset.width} height={asset.height} className={cn("absolute inset-0 h-full w-full", controls ? "object-contain" : "object-cover object-[50%_15%]")} draggable={false} />
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
        {controls && ended && !loops && (
          <button
            type="button"
            onClick={replay}
            className="absolute inset-0 flex items-center justify-center bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label="Replay the demonstration"
          >
            <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/70 bg-black/70 px-4 text-sm font-semibold text-gold-highlight">
              <RotateCcw className="size-4" aria-hidden /> Replay
            </span>
          </button>
        )}
        {controls && badge && (
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-gold-highlight">{badge}</span>
        )}
        {controls && (!moves || (failed && hasLoop)) && (
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 text-[0.6875rem] text-foreground/90" role="status">
            {failed && hasLoop ? "The video could not be played on this device; showing its still." : "Still only: the animated loop for this exercise has not been produced yet."}
          </p>
        )}
        {!hasLoop && asset.phases.length > 1 && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-foreground/90">{asset.phases[phase]?.label}</span>
        )}
      </div>
      {controls && moves && !(failed && asset.phases.length === 0) && (
        <div className="flex flex-wrap items-center gap-1 bg-[#0d0b08] px-2 py-1.5" role="group" aria-label="Demonstration controls">
          <button type="button" onClick={() => (ended ? replay() : setPlaying(!playing))} className={cn(ctl, "inline-flex items-center gap-1")} aria-label={playing ? "Pause" : ended ? "Replay" : "Play"} aria-pressed={playing}>
            {playing ? <Pause className="size-4" aria-hidden /> : ended ? <RotateCcw className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
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
