/**
 * The premium 2.5D exercise demonstrations: pre-rendered assets (a poster still, a short seamless loop, and the
 * phase stills) per exercise slug, built by scripts/exercise-demos/build.mjs into public/exercise-demos/<slug>/ and
 * listed in src/data/exercise-demos.json. The app shows one when it exists and keeps the animated illustration as
 * the fallback for every other exercise (and when the loop cannot play).
 *
 * Status is honest and visible: "stand-in" (a placeholder to judge the UI, not the final art), "review" (built,
 * awaiting the owner's approval) and "approved". Nothing is approved by code; the owner records it in the source
 * folder's meta.json and the build copies it here.
 */
import manifest from "@/data/exercise-demos.json";

export type DemoMode = "video" | "sequence" | "keyframes" | "poster";
export type DemoStatus = "stand-in" | "review" | "approved";

export interface DemoPhase {
  /** Short label shown under the visual: "Start", "Curl", "Top". */
  label: string;
  /** The phase still, 4:3. */
  src: string;
  /** Where the phase starts in the loop, seconds (video and sequence modes). */
  t?: number;
}

export interface ExerciseDemoAsset {
  mode: DemoMode;
  status: DemoStatus;
  poster: string;
  /** Small still for lists (480 px wide). */
  thumb: string;
  mp4?: string;
  webm?: string;
  durationMs?: number;
  width: number;
  height: number;
  phases: DemoPhase[];
  /** Muscles highlighted in the render (the exercise's primary muscles unless the source says otherwise). */
  highlighted: string[];
  /** A short note shown to reviewers while the status is not "approved". */
  note?: string;
  /** The build's checks: loop seam difference (0 = identical first and last frames) and file sizes. */
  checks?: { seam?: number; mp4Bytes?: number; webmBytes?: number; posterBytes?: number };
}

export interface ExerciseDemoManifest {
  version: number;
  frame: { width: number; height: number };
  demos: Record<string, ExerciseDemoAsset>;
}

export const EXERCISE_DEMOS = manifest as ExerciseDemoManifest;

/** Whether the app has a 2.5D demonstration for this exercise. */
export function has25dDemo(slug: string): boolean {
  return slug in EXERCISE_DEMOS.demos;
}

export function getDemoAsset(slug: string): ExerciseDemoAsset | null {
  return EXERCISE_DEMOS.demos[slug] ?? null;
}

/** Whether the asset has something that moves (a loop or more than one phase still). */
export function demoMoves(a: ExerciseDemoAsset): boolean {
  return Boolean(a.mp4 || a.webm) || a.phases.length > 1;
}
