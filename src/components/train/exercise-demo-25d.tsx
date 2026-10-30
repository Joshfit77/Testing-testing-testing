"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Expand, Maximize2, Pause, Play, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/keyboard";
import { demoMoves, scrubFrameSrc, type DemoScrub, type DemoSlow, type ExerciseDemoAsset } from "@/lib/exercise-demos";
import { dragIntent, frameIndex, frameTime, isTap, nextView, scrubFraction, swipeStep, type DragIntent } from "@/lib/demo-gestures";

/** Where a player is: the enlarged view opens at the same point and hands it back when it closes. */
export interface DemoPlayerState {
  /** Position in the rep, 0..1. */
  fraction: number;
  slow: boolean;
  view: number;
  playing: boolean;
}

export interface ExerciseDemo25DProps {
  slug: string;
  name: string;
  asset: ExerciseDemoAsset;
  className?: string;
  /** The controls (play/pause, replay, Normal/0.5×, phases, enlarge), the finger gestures and the status badge (default true). */
  controls?: boolean;
  autoplay?: boolean;
  /** Open at this point (the enlarged view starts where the inline player was). */
  initial?: DemoPlayerState;
  /** The enlarged view: sized to the screen, with native full screen where the device has it. */
  expanded?: boolean;
  /** Set by the player to a function that reads its state (the enlarged view hands its state back on close). */
  stateRef?: MutableRefObject<(() => DemoPlayerState) | null>;
}

const STATUS_LABEL: Record<ExerciseDemoAsset["status"], string> = {
  "stand-in": "Stand-in · not the final art",
  review: "New demo · awaiting approval",
  approved: "",
};

interface View {
  label: string;
  poster: string;
  mp4?: string;
  webm?: string;
  durationMs?: number;
  slow?: DemoSlow;
  scrub?: DemoScrub;
}

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * The premium 2.5D exercise demonstration: a pre-rendered clip of the athlete (poster first, then the muted inline
 * video; the phase stills when there is no clip yet). Interactive by finger: tap to play or pause, drag sideways to move
 * through the rep frame by frame, Normal and 0.5× (a real half-speed file), replay, enlarge (and native full screen
 * where the device has it), and a swipeable view bar when an exercise has more than one camera view. The clips are
 * filmed from a fixed camera and say so; nothing pretends to rotate. Honest about its state: a badge names a stand-in
 * or a demo awaiting approval. Reduced motion: the poster, play on tap.
 */
export function ExerciseDemo25D({ slug, name, asset, className, controls = true, autoplay = true, initial, expanded = false, stateRef }: ExerciseDemo25DProps) {
  const video = useRef<HTMLVideoElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const scrubImg = useRef<HTMLImageElement>(null);
  const snap = useRef<HTMLCanvasElement>(null);
  const hasLoop = Boolean(asset.mp4 || asset.webm);
  const reduced = typeof window !== "undefined" && prefersReducedMotion();
  const [playing, setPlaying] = useState(initial ? initial.playing : autoplay && !reduced && hasLoop);
  const [slow, setSlow] = useState(initial?.slow ?? false);
  const [view, setView] = useState(initial?.view ?? 0);
  const [phase, setPhase] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [snapShown, setSnapShown] = useState(false);
  const [enlarged, setEnlarged] = useState<DemoPlayerState | null>(null);
  const [nativeFs, setNativeFs] = useState(false);
  const loops = asset.loop !== false;
  const views: View[] = [{ label: asset.mainAngle ?? "Main", poster: asset.poster, mp4: asset.mp4, webm: asset.webm, durationMs: asset.durationMs, slow: asset.slow, scrub: asset.scrub }, ...(asset.angles ?? [])];
  const main = views[0] as View;
  const cur = views[view] ?? main;
  const hasSlowFile = (w: View) => Boolean(w.slow?.mp4 || w.slow?.webm);
  const slowFile = slow && hasSlowFile(cur);
  const mp4 = slowFile ? cur.slow?.mp4 : cur.mp4;
  const webm = slowFile ? cur.slow?.webm : cur.webm;
  const poster = cur.poster;
  // Without a 0.5× file (older builds) the normal clip plays at half rate: the same frames either way.
  const rate = slow && !slowFile ? 0.5 : 1;
  const repSeconds = (cur.durationMs ?? asset.durationMs ?? 0) / 1000;
  const interactive = controls && hasLoop && !failed;

  const pendingFraction = useRef<number | null>(initial ? initial.fraction : null);
  const fractionNow = useRef(initial?.fraction ?? 0);
  const scrubbingRef = useRef(false);
  const frames = useRef<{ base: string; imgs: HTMLImageElement[] } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; start: number; intent: DragIntent; width: number } | null>(null);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const swiped = useRef(false);
  const endTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seekRaf = useRef(0);
  const expandState = useRef<(() => DemoPlayerState) | null>(null);

  const currentFraction = () => {
    const v = video.current;
    if (v && v.duration > 0) return Math.min(v.currentTime / v.duration, 0.999);
    return fractionNow.current;
  };
  const syncRange = (f = currentFraction()) => {
    const r = range.current;
    if (!r) return;
    r.value = String(Math.round(f * 1000));
    r.setAttribute("aria-valuetext", `${(f * repSeconds).toFixed(1)} of ${repSeconds.toFixed(1)} seconds`);
  };

  // The clip: muted and inline (iOS keeps it in place), started here because React does not reliably reflect `muted`,
  // which autoplay requires.
  useEffect(() => {
    const v = video.current;
    if (!v || !hasLoop || failed) return;
    v.muted = true;
    v.defaultPlaybackRate = rate;
    v.playbackRate = rate;
    if (playing) {
      if (v.ended) v.currentTime = 0;
      void v.play().catch(() => setPlaying(false));
    } else v.pause();
  }, [playing, rate, hasLoop, failed, mp4, webm]);

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
    // Metadata that arrived before hydration: apply a pending position now.
    if (v.readyState >= 1) applyPending();
    return () => {
      timers.forEach(clearTimeout);
      sources.forEach((s) => s.removeEventListener("error", later));
      v.removeEventListener("error", settle);
    };
  }, [hasLoop, mp4, webm]);

  // The position bar follows the clip while it plays (written straight to the input, no re-render per frame).
  useEffect(() => {
    if (!interactive) return;
    let id = 0;
    const tick = () => {
      if (!scrubbingRef.current) syncRange();
      id = requestAnimationFrame(tick);
    };
    if (playing) id = requestAnimationFrame(tick);
    else syncRange();
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncRange reads refs and the clip's length only
  }, [playing, interactive, mp4, webm]);

  // A copied frame covers a source switch (speed or view); it goes once the new clip has reached the same point.
  useEffect(() => {
    if (!snapShown) return;
    const id = setTimeout(() => setSnapShown(false), 2500);
    return () => clearTimeout(id);
  }, [snapShown]);

  useEffect(() => {
    if (!expanded) return;
    const v = video.current as FullscreenVideo | null;
    setNativeFs(Boolean(document.fullscreenEnabled || typeof v?.webkitEnterFullscreen === "function"));
  }, [expanded, mp4, webm]);

  // Still-only assets with several phases cycle through them slowly (a crossfade, never a warp).
  useEffect(() => {
    if (hasLoop || asset.phases.length < 2 || !playing) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % asset.phases.length), 1400);
    return () => clearInterval(id);
  }, [hasLoop, asset.phases.length, playing]);

  const readState = (): DemoPlayerState => ({ fraction: currentFraction(), slow, view, playing });
  useEffect(() => {
    if (!stateRef) return;
    stateRef.current = readState;
    return () => {
      stateRef.current = null;
    };
  });

  function applyPending() {
    const v = video.current;
    const f = pendingFraction.current;
    if (!v || f === null || !(v.duration > 0)) return;
    pendingFraction.current = null;
    v.currentTime = Math.min(v.duration - 0.01, f * v.duration);
  }

  const srcFor = (s: boolean, vi: number) => {
    const w = views[vi] ?? main;
    return s && hasSlowFile(w) ? w.slow?.mp4 ?? w.slow?.webm : w.mp4 ?? w.webm;
  };
  /** Change speed or view without losing the place in the rep: copy the frame on screen, switch, seek, uncover. */
  const switchSource = (s: boolean, vi: number) => {
    if (srcFor(s, vi) === (mp4 ?? webm)) return;
    const v = video.current;
    pendingFraction.current = currentFraction();
    const c = snap.current;
    if (v && c && v.readyState >= 2 && v.videoWidth > 0) {
      try {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext("2d")?.drawImage(v, 0, 0);
        setSnapShown(true);
      } catch {
        // A frame that cannot be copied: the poster shows for a moment instead.
      }
    }
  };
  const changeSpeed = (s: boolean) => {
    switchSource(s, view);
    setSlow(s);
    setEnded(false);
    setPlaying(true);
  };
  const changeView = (vi: number) => {
    if (vi === view) return;
    switchSource(slow, vi);
    setView(vi);
    setEnded(false);
  };

  // A phase button stays lit only while the clip rests where that button put it.
  const leavePhase = () => hasLoop && setPhase(-1);
  const replay = () => {
    leavePhase();
    const v = video.current;
    if (v) v.currentTime = 0;
    fractionNow.current = 0;
    setEnded(false);
    setPlaying(true);
    if (v) void v.play().catch(() => setPlaying(false));
  };
  const togglePlay = () => {
    if (ended) return replay();
    leavePhase();
    setPlaying((p) => !p);
  };

  const seek = (i: number) => {
    setPhase(i);
    const t = asset.phases[i]?.t;
    const v = video.current;
    if (hasLoop && v && typeof t === "number") {
      setPlaying(false);
      v.pause();
      const f = repSeconds > 0 ? t / repSeconds : 0;
      if (v.duration > 0) v.currentTime = Math.min(v.duration - 0.01, f * v.duration);
      else pendingFraction.current = f;
    }
  };

  // ---- Scrubbing: the finger moves through the rep. Small preloaded frames follow the finger (no waiting on the
  // decoder); until they have loaded, the video itself seeks. On release the video lands on the same frame.
  const ensureFrames = () => {
    const sc = cur.scrub;
    if (!sc || frames.current?.base === sc.base) return;
    frames.current = {
      base: sc.base,
      imgs: Array.from({ length: sc.count }, (_, i) => {
        const im = new Image();
        im.decoding = "async";
        im.src = scrubFrameSrc(sc, i);
        return im;
      }),
    };
  };
  const beginScrub = () => {
    ensureFrames();
    leavePhase();
    scrubbingRef.current = true;
    setScrubbing(true);
    setPlaying(false);
    setEnded(false);
    video.current?.pause();
  };
  const seekVideo = (f: number) => {
    cancelAnimationFrame(seekRaf.current);
    seekRaf.current = requestAnimationFrame(() => {
      const v = video.current;
      if (v && v.duration > 0) v.currentTime = Math.min(v.duration - 0.01, f * v.duration);
    });
  };
  const scrubTo = (f: number) => {
    fractionNow.current = f;
    syncRange(f);
    const sc = cur.scrub;
    const fr = frames.current;
    const img = scrubImg.current;
    const i = sc ? frameIndex(f, sc.count) : -1;
    const frame = sc && fr && fr.base === sc.base ? fr.imgs[i] : undefined;
    if (frame?.complete && frame.naturalWidth > 0 && img) {
      img.src = frame.src;
      img.dataset.frame = String(i);
      img.hidden = false;
    } else {
      if (img) img.hidden = true;
      seekVideo(f);
    }
  };
  const endScrub = () => {
    clearTimeout(endTimer.current);
    scrubbingRef.current = false;
    setScrubbing(false);
    const v = video.current;
    const sc = cur.scrub;
    const f = fractionNow.current;
    if (v && v.duration > 0) {
      cancelAnimationFrame(seekRaf.current);
      // The overlay goes in onSeeked, once the video shows the frame the finger stopped on.
      v.currentTime = sc ? frameTime(frameIndex(f, sc.count), sc.count, v.duration) : Math.min(v.duration - 0.01, f * v.duration);
    } else if (scrubImg.current) scrubImg.current.hidden = true;
  };
  const step = (dir: number) => {
    const v = video.current;
    if (!v || !(v.duration > 0)) return;
    const n = cur.scrub?.count ?? Math.max(1, Math.round(repSeconds * 30));
    leavePhase();
    setPlaying(false);
    setEnded(false);
    v.pause();
    let i = frameIndex(currentFraction(), n) + dir;
    i = loops ? ((i % n) + n) % n : Math.min(Math.max(i, 0), n - 1);
    fractionNow.current = i / n;
    v.currentTime = frameTime(i, n, v.duration);
    syncRange(i / n);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || (e.pointerType === "mouse" && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), start: currentFraction(), intent: "undecided", width: e.currentTarget.clientWidth };
    ensureFrames();
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (d.intent === "undecided") {
      d.intent = dragIntent(dx, e.clientY - d.y);
      if (d.intent === "scroll") {
        drag.current = null;
        return;
      }
      if (d.intent === "scrub") {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Capture is a nicety: the drag still works while the finger stays on the picture.
        }
        beginScrub();
      }
    }
    if (d.intent === "scrub") scrubTo(scrubFraction(d.start, dx, d.width, loops));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (d.intent === "scrub") endScrub();
    else if (isTap(e.clientX - d.x, e.clientY - d.y, performance.now() - d.t)) togglePlay();
  };
  const onPointerCancel = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.intent === "scrub") endScrub();
  };
  const onSurfaceKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      step(e.key === "ArrowRight" ? 1 : -1);
    }
  };

  const openEnlarged = () => {
    const st = readState();
    setPlaying(false);
    video.current?.pause();
    setEnlarged(st);
  };
  const closeEnlarged = () => {
    const st = expandState.current?.() ?? enlarged;
    setEnlarged(null);
    if (!st) return;
    if (srcFor(st.slow, st.view) !== (mp4 ?? webm)) pendingFraction.current = st.fraction;
    else {
      const v = video.current;
      if (v && v.duration > 0) v.currentTime = Math.min(v.duration - 0.01, st.fraction * v.duration);
    }
    setSlow(st.slow);
    setView(st.view);
    setPlaying(st.playing);
  };
  const goFullscreen = () => {
    const el = surface.current;
    const v = video.current as FullscreenVideo | null;
    if (document.fullscreenEnabled && el?.requestFullscreen) void el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    else v?.webkitEnterFullscreen?.();
  };

  const ctl = "min-h-9 rounded-md px-2.5 text-xs font-semibold text-foreground/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
  const on = "bg-gold/20 text-gold-highlight";
  const badge = STATUS_LABEL[asset.status];
  const moves = demoMoves(asset);
  const fit = controls ? "object-contain" : "object-cover object-[50%_15%]";
  // The full player takes the clip's own shape (a portrait clip stays portrait), capped to most of the screen's height;
  // a small card (no controls) fills its box and shows the upper body. Enlarged, it is as big as the screen allows.
  const frameStyle = controls
    ? { aspectRatio: `${asset.width} / ${asset.height}`, ...(expanded ? { width: `min(100%, calc((100dvh - 8.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * ${asset.width} / ${asset.height}))` } : {}) }
    : undefined;

  return (
    <div
      data-testid="exercise-demo-25d"
      data-slug={slug}
      data-mode={asset.mode}
      data-status={asset.status}
      data-playing={playing}
      data-ended={ended}
      data-speed={slow ? "0.5" : "1"}
      data-view={view}
      data-scrubbing={scrubbing}
      data-expanded={expanded}
      className="flex flex-col"
    >
      <div
        ref={surface}
        className={cn("relative overflow-hidden bg-[#0a0a0a]", controls && "mx-auto max-h-[70vh]", expanded && "max-h-none", interactive && "cursor-grab select-none [-webkit-touch-callout:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold", scrubbing && "cursor-grabbing", className)}
        style={{ ...frameStyle, ...(interactive ? { touchAction: expanded ? "none" : "pan-y" } : {}) }}
        {...(interactive
          ? {
              role: "group",
              tabIndex: 0,
              "aria-roledescription": "exercise video",
              "aria-label": `${name} demonstration. Tap to play or pause; drag sideways, or use the arrow keys, to move through the repetition.`,
              onPointerDown,
              onPointerMove,
              onPointerUp,
              onPointerCancel,
              onKeyDown: onSurfaceKey,
            }
          : {})}
      >
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
            className={cn("pointer-events-none absolute inset-0 h-full w-full", fit)}
            aria-label={`${name}: pre-rendered demonstration of the movement`}
            // A browser without H.264 skips the MP4 for the WebM; that is not a failure. Real failures are caught by the
            // effect above (the element's own error, or no playable source left).
            onLoadedMetadata={() => {
              const v = video.current;
              if (v) {
                v.defaultPlaybackRate = rate;
                v.playbackRate = rate;
              }
              applyPending();
              syncRange();
            }}
            onSeeked={() => {
              if (!scrubbingRef.current && scrubImg.current) scrubImg.current.hidden = true;
              setSnapShown(false);
              if (!scrubbingRef.current) syncRange();
            }}
            onEnded={() => {
              setPlaying(false);
              setEnded(true);
            }}
            onPlay={() => setEnded(false)}
          >
            {/* The MP4 first: iPhone and desktop browsers play it; the WebM serves browsers without H.264. */}
            {mp4 && <source src={mp4} type="video/mp4" />}
            {webm && <source src={webm} type="video/webm" />}
          </video>
        ) : asset.phases.length === 0 ? (
          // No loop (or it failed to play) and no phase stills: the poster, never an empty frame.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={`${name}: demonstration still`} width={asset.width} height={asset.height} className={cn("absolute inset-0 h-full w-full", fit)} draggable={false} />
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
        {interactive && (
          <>
            {/* The frame under the finger while scrubbing; shown and hidden directly, not by React. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={scrubImg} alt="" aria-hidden hidden data-testid="demo-scrub-frame" className={cn("pointer-events-none absolute inset-0 h-full w-full", fit)} draggable={false} />
            <canvas ref={snap} aria-hidden hidden={!snapShown} className={cn("pointer-events-none absolute inset-0 h-full w-full", fit)} />
          </>
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
        {interactive && !playing && !ended && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-foreground/90">
            {scrubbing ? "Scrubbing" : "Paused · tap to play"}
          </span>
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
      {interactive && (
        <div className="bg-[#0d0b08] px-3 pt-2">
          <input
            ref={range}
            type="range"
            min={0}
            max={1000}
            step={1}
            defaultValue={Math.round((initial?.fraction ?? 0) * 1000)}
            aria-label="Position in the repetition"
            className="block h-7 w-full cursor-pointer accent-[var(--gold)]"
            onChange={(e) => {
              if (!scrubbingRef.current) beginScrub();
              scrubTo(Number(e.currentTarget.value) / 1000);
              clearTimeout(endTimer.current);
              endTimer.current = setTimeout(endScrub, 200);
            }}
          />
        </div>
      )}
      {interactive && views.length > 1 && (
        <div
          className="flex items-center justify-center gap-1 bg-[#0d0b08] px-2 pt-1"
          role="group"
          aria-label="Camera view: swipe here or tap a view"
          style={{ touchAction: "pan-y" }}
          onPointerDown={(e) => {
            swipe.current = { x: e.clientX, y: e.clientY, t: performance.now() };
            swiped.current = false;
          }}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const dir = swipeStep(e.clientX - s.x, e.clientY - s.y, performance.now() - s.t);
            if (dir) {
              swiped.current = true;
              changeView(nextView(view, dir, views.length));
            }
          }}
          data-testid="demo-view-bar"
        >
          <button type="button" onClick={() => changeView(nextView(view, -1, views.length))} className={ctl} aria-label="Previous camera view">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          {views.map((w, i) => (
            <button
              key={w.label}
              type="button"
              onClick={() => {
                if (swiped.current) return;
                changeView(i);
              }}
              className={cn(ctl, view === i && on)}
              aria-pressed={view === i}
            >
              {w.label}
            </button>
          ))}
          <button type="button" onClick={() => changeView(nextView(view, 1, views.length))} className={ctl} aria-label="Next camera view">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
      {controls && moves && !(failed && asset.phases.length === 0) && (
        <div className="flex flex-wrap items-center gap-1 bg-[#0d0b08] px-2 py-1.5" role="group" aria-label="Demonstration controls">
          <button type="button" onClick={togglePlay} className={cn(ctl, "inline-flex items-center gap-1")} aria-label={playing ? "Pause" : ended ? "Replay" : "Play"} aria-pressed={playing}>
            {playing ? <Pause className="size-4" aria-hidden /> : ended ? <RotateCcw className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </button>
          {hasLoop && (
            <button type="button" onClick={replay} className={cn(ctl, "inline-flex items-center")} aria-label="Replay from the start">
              <RotateCcw className="size-4" aria-hidden />
            </button>
          )}
          {hasLoop && (
            <span className="mx-1 inline-flex rounded-md border border-white/10" role="group" aria-label="Speed">
              <button type="button" onClick={() => changeSpeed(false)} className={cn(ctl, !slow && on)} aria-pressed={!slow}>
                Normal
              </button>
              <button type="button" onClick={() => changeSpeed(true)} className={cn(ctl, slow && on)} aria-pressed={slow}>
                0.5×
              </button>
            </span>
          )}
          {asset.phases.length > 1 &&
            asset.phases.map((p, i) => (
              <button key={p.label} type="button" onClick={() => seek(i)} className={cn(ctl, phase === i && !playing && on)} aria-pressed={phase === i && !playing}>
                {p.label}
              </button>
            ))}
          {interactive && !expanded && (
            <button type="button" onClick={openEnlarged} className={cn(ctl, "ml-auto inline-flex items-center")} aria-label="Enlarge">
              <Maximize2 className="size-4" aria-hidden />
            </button>
          )}
          {interactive && expanded && nativeFs && (
            <button type="button" onClick={goFullscreen} className={cn(ctl, "ml-auto inline-flex items-center")} aria-label="Full screen" title="Full screen">
              <Expand className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
      {controls && !expanded && (interactive || asset.highlighted.length > 0) && (
        <p className="bg-[#0d0b08] px-3 pb-2 text-[0.6875rem] leading-snug text-muted-foreground">
          {interactive && (
            <>
              Tap the picture to play or pause; drag sideways to move through the rep.{" "}
              {views.length > 1 ? `${views.length} camera views: swipe the view bar to change.` : "One fixed camera view (it does not rotate)."}{" "}
            </>
          )}
          {asset.highlighted.length > 0 && (
            <>
              Highlighted: <span className="text-gold-highlight">{asset.highlighted.join(", ")}</span>
            </>
          )}
        </p>
      )}
      {asset.note && controls && !expanded && asset.status !== "approved" && <p className="bg-[#0d0b08] px-3 pb-2 text-[0.6875rem] text-muted-foreground">{asset.note}</p>}
      {controls && !expanded && interactive && (
        <Dialog open={enlarged !== null} onOpenChange={(o) => !o && closeEnlarged()}>
          <DialogContent className="left-0 top-0 h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 justify-center gap-1 overflow-y-auto rounded-none border-0 bg-black p-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
            <DialogTitle className="px-4 pr-14 pt-2 text-base">{name}</DialogTitle>
            <DialogDescription className="sr-only">Enlarged demonstration of {name}. Tap to play or pause; drag sideways to move through the repetition.</DialogDescription>
            {enlarged && <ExerciseDemo25D slug={slug} name={name} asset={asset} expanded initial={enlarged} stateRef={expandState} />}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** The poster still, for lists and the logger's small card. */
export function ExerciseDemo25DStill({ name, asset, className }: { name: string; asset: ExerciseDemoAsset; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.thumb} alt={`${name} demonstration (still)`} width={480} height={360} loading="lazy" className={cn("block h-full w-full object-cover bg-[#0a0a0a]", className)} draggable={false} />;
}
