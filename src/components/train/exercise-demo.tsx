"use client";

import { useEffect, useRef, useState } from "react";
import { Hourglass, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ExerciseMeta } from "@/lib/exercise-motion/types";
import { shownDemoAsset as getDemoAsset } from "@/lib/exercise-demos";
import { demoCaption, demoReadiness } from "@/lib/exercise-demo-readiness";
import { ExerciseDemo25D, ExerciseDemo25DStill } from "./exercise-demo-25d";

/**
 * Exercise demonstrations: one original 2D character, the black-and-gold athlete (src/lib/exercise-motion/athlete.ts),
 * drawn on a canvas for every exercise. What an exercise shows depends on how far its demonstration is
 * (src/lib/exercise-demo-readiness.ts): the moving athlete, still pose frames, or a clearly labelled placeholder. The
 * written steps, cues and mistakes are always shown alongside by the page. A 2.5D clip replaces the athlete only once
 * the owner has approved it (src/lib/exercise-demos.ts).
 */

type MotionModule = typeof import("@/lib/exercise-motion");
type Highlight = ReturnType<MotionModule["highlightFor"]>;

/** The exercise's trained muscles, which glow on the athlete. */
export interface DemoMuscles {
  primary: readonly string[];
  secondary?: readonly string[];
}

// The motion library is loaded on demand so pages that never show a demo don't pay for it.
let modPromise: Promise<MotionModule> | null = null;
const loadMotion = () => (modPromise ??= import("@/lib/exercise-motion"));

/** The glowing muscles: from the caller when it has them, otherwise looked up in the catalog (loaded on demand). */
async function highlightOf(slug: string, m: MotionModule, muscles?: DemoMuscles): Promise<Highlight> {
  if (muscles) return m.highlightFor([...muscles.primary], [...(muscles.secondary ?? [])]);
  const { EXERCISES } = await import("@/data/exercises");
  const e = EXERCISES.find((x) => x.slug === slug);
  return m.highlightFor(e?.primary ?? [], e?.secondary ?? []);
}

export interface ExerciseDemoProps {
  slug: string;
  name: string;
  meta?: Omit<ExerciseMeta, "slug">;
  muscles?: DemoMuscles;
  className?: string;
  /** Show play/pause and speed controls plus the badge (default true). */
  controls?: boolean;
  autoplay?: boolean;
}

/** The exercise's demonstration, as far as it is ready: moving, pose frames, or a labelled placeholder. */
export function ExerciseDemo(props: ExerciseDemoProps) {
  const asset = getDemoAsset(props.slug);
  if (asset) return <ExerciseDemo25D slug={props.slug} name={props.name} asset={asset} className={props.className} controls={props.controls} autoplay={props.autoplay} />;
  const readiness = demoReadiness(props.slug);
  if (readiness === "poses") return <ExercisePoseFrames {...props} />;
  if (readiness === "placeholder") return <DemoPlaceholder name={props.name} className={props.className} />;
  return <ExerciseIllustration {...props} />;
}

/** The moving 2D athlete performing the exercise, looping. */
export function ExerciseIllustration({
  slug,
  name,
  meta,
  muscles,
  className,
  controls = true,
  autoplay = true,
}: ExerciseDemoProps) {
  const host = useRef<HTMLDivElement>(null);
  const metaKey = JSON.stringify(meta ?? {});
  const musclesKey = JSON.stringify(muscles ?? null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let destroyed = false;
    let ctrl: { destroy(): void } | null = null;
    void loadMotion().then(async (m) => {
      const highlight = await highlightOf(slug, m, JSON.parse(musclesKey) ?? undefined);
      if (destroyed || !host.current) return;
      const parsed = JSON.parse(metaKey) as Omit<ExerciseMeta, "slug">;
      ctrl = m.mountExerciseMotion(el, slug, {
        autoplay,
        controls,
        style: "athlete",
        highlight,
        controlsInset: 74,
        badge: controls ? "Animated demo" : "",
        meta: { slug, name, ...parsed },
        label: `Animated demonstration of ${name}. ${m.getMotion(slug, { slug, name, ...parsed }).label}`,
      });
    });
    return () => {
      destroyed = true;
      ctrl?.destroy();
    };
  }, [slug, name, metaKey, musclesKey, controls, autoplay]);
  return (
    <div
      ref={host}
      className={cn("relative overflow-hidden bg-[#0a0a0a]", className)}
      data-testid="exercise-demo"
      data-demo-readiness="animated"
    />
  );
}

/** The two key positions of the movement as still frames: where it starts and the middle of the rep. */
const POSES = [
  { label: "Start", phase: 0 },
  { label: "Mid-rep", phase: 0.5 },
] as const;

/**
 * Still pose frames, for an exercise whose key positions are right but whose movement between them is still being
 * finished. Drawn once with the same athlete, so nothing animates and nothing can mislead mid-movement.
 */
export function ExercisePoseFrames({ slug, name, meta, muscles, className, controls = true }: ExerciseDemoProps) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  const metaKey = JSON.stringify(meta ?? {});
  const musclesKey = JSON.stringify(muscles ?? null);
  useEffect(() => {
    let cancelled = false;
    void loadMotion().then(async (m) => {
      const highlight = await highlightOf(slug, m, JSON.parse(musclesKey) ?? undefined);
      if (cancelled) return;
      POSES.forEach((p, i) => {
        const c = refs.current[i];
        if (!c) return;
        const r = c.getBoundingClientRect();
        m.drawExerciseStill(c, slug, {
          meta: { slug, name, ...(JSON.parse(metaKey) as object) },
          phase: p.phase,
          width: r.width || 160,
          height: r.height || 120,
          style: "athlete",
          highlight,
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [slug, name, metaKey, musclesKey]);
  return (
    <div
      className={cn("relative grid grid-cols-2 gap-px overflow-hidden bg-border", className)}
      data-testid="exercise-demo"
      data-demo-readiness="poses"
      role="group"
      aria-label={`${name}: the start and mid-rep positions, as still frames`}
    >
      {POSES.map((p, i) => (
        <figure key={p.label} className="relative m-0 h-full min-h-0 bg-[#0a0a0a]">
          <canvas
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="block h-full w-full"
            role="img"
            aria-label={`${name}, ${p.label.toLowerCase()} position`}
          />
          <figcaption className="absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-widest text-gold-highlight">
            {p.label}
          </figcaption>
        </figure>
      ))}
      {controls && (
        <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted-foreground" data-testid="pose-frames-badge">
          Pose frames · animation in progress
        </span>
      )}
    </div>
  );
}

/**
 * Shown while an exercise's demonstration is not ready: says so plainly, so nobody mistakes it for a finished one.
 * `compact` is the small version for thumbnails and the workout card.
 */
export function DemoPlaceholder({ name, className, compact = false }: { name: string; className?: string; compact?: boolean }) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-1.5 bg-[#0a0a0a] p-2 text-center", className)}
      data-testid="exercise-demo"
      data-demo-readiness="placeholder"
      role="img"
      aria-label={`${name}: demonstration in progress. Follow the written steps for now.`}
    >
      <Hourglass className={cn("text-gold", compact ? "size-4" : "size-6")} aria-hidden />
      {compact ? (
        <span className="text-[0.625rem] font-semibold uppercase leading-tight tracking-widest text-muted-foreground">Demo soon</span>
      ) : (
        <>
          <span className="text-sm font-semibold text-foreground">Demonstration in progress</span>
          <span className="max-w-[28ch] text-xs text-muted-foreground">Follow the written steps, form cues and common mistakes for now.</span>
        </>
      )}
    </div>
  );
}

/** Small demo that opens a larger one when tapped (workout logger). */
export function ExerciseDemoMini({
  slug,
  name,
  meta,
  muscles,
  className,
  animate = true,
}: {
  slug: string;
  name: string;
  meta?: Omit<ExerciseMeta, "slug">;
  muscles?: DemoMuscles;
  className?: string;
  /** Loop the animation inline (current exercise); otherwise a still that animates when enlarged. */
  animate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const asset = getDemoAsset(slug);
  const readiness = demoReadiness(slug);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
          className
        )}
        aria-label={`Show the ${name} demonstration larger`}
      >
        {readiness === "placeholder" && !asset ? (
          <DemoPlaceholder name={name} compact className="pointer-events-none h-full w-full" />
        ) : animate && (asset || readiness === "animated") ? (
          <ExerciseDemo slug={slug} name={name} meta={meta} muscles={muscles} controls={false} className="pointer-events-none h-full w-full" />
        ) : (
          <ExerciseThumb slug={slug} name={name} meta={meta} muscles={muscles} className="pointer-events-none h-full w-full" />
        )}
        <span
          className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5 text-gold-highlight opacity-80 group-hover:opacity-100"
          aria-hidden
        >
          <Maximize2 className="size-3" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription className="sr-only">Demonstration of {name}</DialogDescription>
          {open ? (
            <ExerciseDemo
              slug={slug}
              name={name}
              meta={meta}
              muscles={muscles}
              className={cn("mt-3 w-full rounded-xl", asset ? "max-h-[60vh]" : "aspect-[4/3]")}
            />
          ) : null}
          <p className="mt-2 text-[0.6875rem] text-muted-foreground">{demoCaption(readiness, Boolean(asset))}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Still thumbnail of an exercise: the athlete's still frame, or the small placeholder while the demo isn't ready. */
export function ExerciseThumb(props: { slug: string; name: string; meta?: Omit<ExerciseMeta, "slug">; muscles?: DemoMuscles; className?: string }) {
  const asset = getDemoAsset(props.slug);
  if (asset) return <ExerciseDemo25DStill name={props.name} asset={asset} className={props.className} />;
  if (demoReadiness(props.slug) === "placeholder") return <DemoPlaceholder name={props.name} compact className={props.className} />;
  return <IllustrationThumb {...props} />;
}

function IllustrationThumb({
  slug,
  name,
  meta,
  muscles,
  className,
}: {
  slug: string;
  name: string;
  meta?: Omit<ExerciseMeta, "slug">;
  muscles?: DemoMuscles;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const metaKey = JSON.stringify(meta ?? {});
  const musclesKey = JSON.stringify(muscles ?? null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let done = false;
    const draw = () => {
      if (done) return;
      done = true;
      void loadMotion().then(async (m) => {
        const highlight = await highlightOf(slug, m, JSON.parse(musclesKey) ?? undefined);
        if (!ref.current) return;
        const r = canvas.getBoundingClientRect();
        m.drawExerciseStill(canvas, slug, {
          meta: { slug, name, ...(JSON.parse(metaKey) as object) },
          width: r.width || 96,
          height: r.height || 72,
          style: "athlete",
          highlight,
        });
      });
    };
    if (typeof IntersectionObserver === "undefined") {
      draw();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        draw();
      }
    });
    io.observe(canvas);
    return () => io.disconnect();
  }, [slug, name, metaKey, musclesKey]);
  return (
    <canvas
      ref={ref}
      className={cn("block bg-[#0a0a0a]", className)}
      role="img"
      aria-label={`${name} demonstration (still)`}
    />
  );
}
