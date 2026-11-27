/**
 * Prints the data behind the owner review sheet (scripts/exercise-review/review-sheet.mjs) as JSON: every exercise's
 * launch tier, 2D demo state and notes, its written steps, cues and mistakes, and how its animation is drawn.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/exercise-review/review-data.ts > rows.json
 */
import { getMotion } from "@/lib/exercise-motion";
import { READINESS_REVIEW } from "@/lib/exercise-demo-readiness";
import { exerciseRows } from "./tiers";

const rows = exerciseRows().map((r) => {
  const m = getMotion(r.slug);
  return { ...r, view: m.view ?? "side", motionLabel: m.label };
});
process.stdout.write(JSON.stringify({ reviewed: READINESS_REVIEW.reviewed, method: READINESS_REVIEW.method, rows }));
