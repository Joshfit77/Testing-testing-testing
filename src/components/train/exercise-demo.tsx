"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ExerciseMeta } from "@/lib/exercise-motion/types";
import { getDemoAsset } from "@/lib/exercise-demos";
import { ExerciseDemo25D, ExerciseDemo25DStill } from "./exercise-demo-25d";

type MotionModule = typeof import("@/lib/exercise-motion");

// The motion library is loaded on demand so pages that never show a demo don't pay for it.
let modPromise: Promise<MotionModule> | null = null;
const loadMotion = () => (modPromise ??= import("@/lib/exercise-motion"));

export interface ExerciseDemoProps {
  slug: string;
  name: string;
  meta?: Omit<ExerciseMeta, "slug">;
  className?: string;
  /** Show play/pause and speed controls plus the "Animated demo" badge (default true). */
  controls?: boolean;
  autoplay?: boolean;
}

/**
 * The exercise's demonstration: the premium 2.5D render when the app has one for this exercise
 * (src/data/exercise-demos.json), otherwise the animated illustration. The 3D anatomical figure is no longer used
 * here; it stays on its own showcase page (/train/3d).
 */
export function ExerciseDemo(props: ExerciseDemoProps) {
  const asset = getDemoAsset(props.slug);
  if (asset) return <ExerciseDemo25D slug={props.slug} name={props.name} asset={asset} className={props.className} controls={props.controls} autoplay={props.autoplay} />;
  return <ExerciseIllustration {...props} />;
}

/** Looping animated demonstration of an exercise (stylised illustration, not filmed video). */
export function ExerciseIllustration({
  slug,
  name,
  meta,
  className,
  controls = true,
  autoplay = true,
}: ExerciseDemoProps) {
  const host = useRef<HTMLDivElement>(null);
  const metaKey = JSON.stringify(meta ?? {});
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let destroyed = false;
    let ctrl: { destroy(): void } | null = null;
    void loadMotion().then((m) => {
      if (destroyed || !host.current) return;
      const parsed = JSON.parse(metaKey) as Omit<ExerciseMeta, "slug">;
      ctrl = m.mountExerciseMotion(el, slug, {
        autoplay,
        controls,
        badge: controls ? "Animated demo" : "",
        meta: { slug, name, ...parsed },
        label: `Animated demonstration of ${name}. ${
          m.getMotion(slug, { slug, name, ...parsed }).label
        }`,
      });
    });
    return () => {
      destroyed = true;
      ctrl?.destroy();
    };
  }, [slug, name, metaKey, controls, autoplay]);
  return (
    <div
      ref={host}
      className={cn("relative overflow-hidden bg-[#0a0a0a]", className)}
      data-testid="exercise-demo"
    />
  );
}

/** Small looping demo that opens a larger one when tapped (workout logger). */
export function ExerciseDemoMini({
  slug,
  name,
  meta,
  className,
  animate = true,
}: {
  slug: string;
  name: string;
  meta?: Omit<ExerciseMeta, "slug">;
  className?: string;
  /** Loop the animation inline (current exercise); otherwise a still that animates when enlarged. */
  animate?: boolean;
}) {
  const [open, setOpen] = useState(false);
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
        {animate ? (
          <ExerciseDemo
            slug={slug}
            name={name}
            meta={meta}
            controls={false}
            className="pointer-events-none h-full w-full"
          />
        ) : getDemoAsset(slug) ? (
          <ExerciseDemo25DStill name={name} asset={getDemoAsset(slug)!} className="pointer-events-none" />
        ) : (
          <ExerciseThumb
            slug={slug}
            name={name}
            meta={meta}
            className="pointer-events-none h-full w-full"
          />
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
          <DialogDescription className="sr-only">
            Animated demonstration of {name}
          </DialogDescription>
          {open ? (
            <ExerciseDemo
              slug={slug}
              name={name}
              meta={meta}
              className={cn("mt-3 w-full rounded-xl", getDemoAsset(slug) ? "aspect-[4/3]" : "aspect-video")}
            />
          ) : null}
          <p className="mt-2 text-[0.6875rem] text-muted-foreground">
            {getDemoAsset(slug)
              ? "Rendered demonstration of the movement — a computer render, not filmed video."
              : "Animated illustration of the movement — not filmed video."}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Still thumbnail of an exercise: the 2.5D poster when there is one, else the illustration drawn when scrolled into view. */
export function ExerciseThumb(props: { slug: string; name: string; meta?: Omit<ExerciseMeta, "slug">; className?: string }) {
  const asset = getDemoAsset(props.slug);
  if (asset) return <ExerciseDemo25DStill name={props.name} asset={asset} className={props.className} />;
  return <IllustrationThumb {...props} />;
}

function IllustrationThumb({
  slug,
  name,
  meta,
  className,
}: {
  slug: string;
  name: string;
  meta?: Omit<ExerciseMeta, "slug">;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const metaKey = JSON.stringify(meta ?? {});
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let done = false;
    const draw = () => {
      if (done) return;
      done = true;
      void loadMotion().then((m) => {
        if (!ref.current) return;
        const r = canvas.getBoundingClientRect();
        m.drawExerciseStill(canvas, slug, {
          meta: { slug, name, ...(JSON.parse(metaKey) as object) },
          width: r.width || 96,
          height: r.height || 72,
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
  }, [slug, name, metaKey]);
  return (
    <canvas
      ref={ref}
      className={cn("block bg-[#0a0a0a]", className)}
      role="img"
      aria-label={`${name} demonstration (still)`}
    />
  );
}
