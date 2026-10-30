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

/** The per-exercise verification the owner asked for; "" = not reviewed / not tested. */
export interface DemoChecks {
  character?: "PASS" | "FAIL" | "";
  form?: "PASS" | "FAIL" | "NOT REVIEWED" | "";
  equipment?: "PASS" | "FAIL" | "";
  highlighting?: "PASS" | "FAIL" | "";
  playback?: "PASS" | "FAIL" | "";
  mobile?: "PASS" | "FAIL" | "NOT TESTED" | "";
}

/** The 0.5× version of a clip: the same frames, each held twice as long (built by the pipeline, nothing invented). */
export interface DemoSlow {
  mp4?: string;
  webm?: string;
  durationMs?: number;
}

/** Frames for scrubbing with a finger: `count` WebPs evenly spaced through one rep, `<base>001.webp` onwards. */
export interface DemoScrub {
  base: string;
  count: number;
  width: number;
  height: number;
}

/** A second camera angle, rendered separately where the movement needs it (front and side). */
export interface DemoAngle {
  label: string;
  poster: string;
  mp4?: string;
  webm?: string;
  durationMs?: number;
  slow?: DemoSlow;
  scrub?: DemoScrub;
}

export interface ExerciseDemoAsset {
  mode: DemoMode;
  status: DemoStatus;
  /** Asset version, bumped by the source folder's meta.json when a clip is re-rendered. */
  version?: number;
  /** Which model or tool rendered the clip, for the record. */
  source?: string;
  /** The main clip's camera, named when there are other angles ("Side", "Front"). */
  mainAngle?: string;
  /** Extra camera angles beyond the main clip. */
  angles?: DemoAngle[];
  /** The owner's and the reviewer's verdicts, copied from meta.json. */
  review?: DemoChecks;
  poster: string;
  /** Small still for lists (480 px wide). */
  thumb: string;
  mp4?: string;
  webm?: string;
  durationMs?: number;
  /** The 0.5× version (absent on older builds: the player then plays the normal clip at half rate). */
  slow?: DemoSlow;
  scrub?: DemoScrub;
  width: number;
  height: number;
  phases: DemoPhase[];
  /** Loop the clip (default true). False when its last frame does not meet its first: it plays once and offers Replay. */
  loop?: boolean;
  /** Reviewer notes on the clip (form, artifacts, look), for the owner; not shown in the app. */
  flags?: string[];
  /** Muscles highlighted in the render (the exercise's primary muscles unless the source says otherwise). */
  highlighted: string[];
  /** A short note shown to reviewers while the status is not "approved". */
  note?: string;
  /** The build's checks: loop seam difference (0 = identical first and last frames) and file sizes. */
  checks?: { seam?: number; mp4Bytes?: number; webmBytes?: number; posterBytes?: number; copied?: boolean; slowMp4Bytes?: number; slowWebmBytes?: number; scrubBytes?: number };
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

/** The URL of scrub frame `i` (0-based). */
export function scrubFrameSrc(scrub: DemoScrub, i: number): string {
  return `${scrub.base}${String(i + 1).padStart(3, "0")}.webp`;
}

/** Both speeds exist as files: the normal clip and its 0.5× version. */
export function hasBothSpeeds(a: ExerciseDemoAsset): boolean {
  return Boolean((a.mp4 || a.webm) && (a.slow?.mp4 || a.slow?.webm));
}
