import data from "@/data/exercise-demo-readiness.json";

/**
 * How far each exercise's 2D demonstration is, and so what the app shows for it (docs/EXERCISE_DEMOS_2D.md):
 *
 * - "animated": the moving 2D athlete. Its six review phases passed a visual review in the athlete look (setup, path,
 *   equipment in the hands, no clipping, a clean loop) and the automated motion checks (tests/unit/exercise-motion*).
 * - "poses": still pose frames only (the start and the mid-rep position). Those positions are right; something in the
 *   movement between them is not yet, so the moving version stays off until it is fixed.
 * - "placeholder": a clearly labelled "demonstration in progress" box. The drawing would mislead, so the written steps,
 *   form cues and common mistakes carry the exercise on their own.
 *
 * The written instructions, cues and mistakes are shown with every one of these. None of them means "approved": the
 * owner's sign-off is listed separately (`ownerApproved`), and nothing in code adds to it. An exercise missing from the
 * file shows the placeholder, so a new exercise is never presented as finished by default.
 */
export type DemoReadiness = "animated" | "poses" | "placeholder";

export interface ReadinessEntry {
  readiness: DemoReadiness;
  /** What is wrong or missing, for the status report (not shown in the app). */
  note?: string;
}

interface ReadinessFile {
  /** When the review behind this file was done, and how. */
  reviewed: string;
  method: string;
  /** Slugs whose 2D demonstration the owner has signed off. Empty until the owner records it. */
  ownerApproved: string[];
  exercises: Record<string, ReadinessEntry>;
}

const FILE = data as ReadinessFile;

export const READINESS_REVIEW = { reviewed: FILE.reviewed, method: FILE.method };

/** What the app shows for this exercise's demonstration. */
export function demoReadiness(slug: string): DemoReadiness {
  return FILE.exercises[slug]?.readiness ?? "placeholder";
}

/** The reviewer's note for an exercise that is not fully animated yet. */
export function readinessNote(slug: string): string | null {
  return FILE.exercises[slug]?.note || null;
}

/** Whether the owner has signed this exercise's demonstration off (never set by code). */
export function ownerApproved(slug: string): boolean {
  return FILE.ownerApproved.includes(slug);
}

/** Every entry, for reports and tests. */
export function readinessEntries(): [string, ReadinessEntry][] {
  return Object.entries(FILE.exercises);
}

/** What the enlarged demo's caption says, by readiness. */
export function demoCaption(readiness: DemoReadiness, video = false): string {
  if (video) return "Rendered demonstration of the movement — a computer render, not filmed video.";
  if (readiness === "poses") return "Still pose frames of the movement (start and mid-rep). The animation is still being finished.";
  if (readiness === "placeholder") return "The demonstration for this exercise is still being made. Follow the written steps, cues and common mistakes.";
  return "Animated 2D demonstration of the movement — an illustration, not filmed video.";
}
