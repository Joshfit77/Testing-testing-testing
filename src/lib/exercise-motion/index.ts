/**
 * Animated exercise demonstrations — framework-agnostic entry point.
 *
 * Pure TypeScript + DOM/canvas: no React, no Node APIs. Safe to bundle with esbuild as an IIFE for the
 * offline single-file edition, e.g.
 *   esbuild src/lib/exercise-motion/index.ts --bundle --format=iife --global-name=ExerciseMotion
 *
 * Usage:
 *   const ctrl = mountExerciseMotion(element, "back-squat", { autoplay: true });
 *   ctrl.pause(); ctrl.play(); ctrl.setSpeed(0.5); ctrl.destroy();
 */
import { EXERCISE_MOTIONS, EXERCISE_MOTION_VIEWS, fallbackMotion } from "../../data/exercise-motions";
import { mountMotion, type MotionController, type MountOptions } from "./mount";
import { compileMotion, evaluate, motionBounds, stillFrame } from "./timeline";
import { fitCamera, renderFrame, type FigureStyle } from "./render";
import { highlightFor, type Highlight } from "./athlete";
import type { ExerciseMeta, MotionDef, View } from "./types";

const cache = new Map<string, MotionDef>();

/** True when the slug has a hand-made motion, or when `meta` is given (a pattern-based fallback is always available then). */
export function hasMotion(slug: string, meta?: ExerciseMeta): boolean {
  return slug in EXERCISE_MOTIONS || Boolean(meta);
}

/** True when the slug has a hand-made (not fallback) motion. */
export function hasExactMotion(slug: string): boolean {
  return slug in EXERCISE_MOTIONS;
}

/**
 * The motion for an exercise: the hand-made definition when there is one, otherwise a fallback chosen from
 * the exercise's name, movement pattern and equipment (pass `meta` for the best match).
 */
export function getMotion(slug: string, meta?: ExerciseMeta): MotionDef {
  const key = meta && !(slug in EXERCISE_MOTIONS) ? `${slug}|${meta.pattern ?? ""}|${(meta.equipment ?? []).join(",")}|${meta.name ?? ""}` : slug;
  const hit = cache.get(key);
  if (hit) return hit;
  const builder = EXERCISE_MOTIONS[slug];
  const def = builder ? builder(slug) : fallbackMotion(meta ?? { slug });
  cache.set(key, def);
  return def;
}

/** One camera angle of an exercise's demonstration. */
export interface MotionView {
  view: View;
  /** Short name for the view switch ("Side", "Front"). */
  label: string;
  def: MotionDef;
}

const VIEW_LABEL: Record<View, string> = { side: "Side", front: "Front" };

/**
 * Every camera angle of an exercise's demonstration: the main view first, then the extra views from
 * EXERCISE_MOTION_VIEWS (none for most exercises). Each extra view shares the main view's timing.
 */
export function getMotionViews(slug: string, meta?: ExerciseMeta): MotionView[] {
  const main = getMotion(slug, meta);
  const out: MotionView[] = [{ view: main.view, label: VIEW_LABEL[main.view], def: main }];
  for (const [view, build] of Object.entries(EXERCISE_MOTION_VIEWS[slug] ?? {}) as [View, (id: string) => MotionDef][]) {
    if (view === main.view) continue;
    const key = `${slug}@${view}`;
    let def = cache.get(key);
    if (!def) {
      def = build(slug);
      cache.set(key, def);
    }
    out.push({ view, label: VIEW_LABEL[view], def });
  }
  return out;
}

/** Plain-language description of the movement (used as the accessible label). */
export function motionLabel(slug: string, meta?: ExerciseMeta): string {
  return getMotion(slug, meta).label;
}

/** Mount a looping animated demonstration of an exercise into `element`. */
export function mountExerciseMotion(element: HTMLElement, slug: string, options: MountOptions = {}): MotionController {
  // Exercises with more than one camera view get the view switch (shown only on an interactive player).
  const views = options.views ?? getMotionViews(slug, options.meta).map((v) => ({ label: v.label, def: v.def }));
  return mountMotion(element, views[0]?.def ?? getMotion(slug, options.meta), { ...options, views });
}

/** Draw a single still frame (phase 0..1 of the loop, default the motion's still phase) into a canvas. */
export function drawExerciseStill(canvas: HTMLCanvasElement, slug: string, opts: { meta?: ExerciseMeta; phase?: number; width?: number; height?: number; style?: FigureStyle; highlight?: Highlight; view?: View } = {}): void {
  const def = (opts.view && getMotionViews(slug, opts.meta).find((v) => v.view === opts.view)?.def) || getMotion(slug, opts.meta);
  const c = compileMotion(def);
  const w = opts.width ?? canvas.clientWidth ?? 160;
  const h = opts.height ?? canvas.clientHeight ?? 120;
  const dpr = Math.min(3, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const frame = opts.phase === undefined ? stillFrame(c) : evaluate(c, opts.phase * c.duration);
  renderFrame(ctx, frame, fitCamera(motionBounds(c), w, h, dpr, def.mirror), { floor: def.floor, style: opts.style, highlight: opts.highlight });
}

export { EXERCISE_MOTIONS, EXERCISE_MOTION_VIEWS, fallbackMotion, mountMotion, compileMotion, evaluate, motionBounds, renderFrame, fitCamera, highlightFor };
export type { MotionController, MountOptions, MotionDef, ExerciseMeta, FigureStyle, Highlight };
