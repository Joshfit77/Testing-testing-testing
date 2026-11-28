/**
 * Personalized Bible studies: the plan the model submits and the checks it must pass before it is saved. Pure.
 * A plan is saved only when it has exactly the days asked for, numbered 1…N, every reading is a real BSB passage of
 * reasonable length, and no reading repeats on consecutive days.
 */
import { z } from "zod";
import { formatReference, parseReference, type ScriptureRef } from "@/lib/bible/reference";
import { STUDY_DURATIONS, type StudyDuration } from "./config";

const s = (n: number) => z.string().trim().max(n);
export const rawPlanSchema = z.object({
  title: s(120),
  objective: s(800),
  days: z
    .array(
      z.object({
        day: z.number().int(),
        title: s(160),
        readings: z.array(s(80)).min(1).max(4),
        explanation: s(2500),
        questions: z.array(s(400)).max(5).default([]),
        application: s(1500).optional(),
        prayer: s(800).optional(),
      }),
    )
    .max(100),
});
export type RawPlan = z.infer<typeof rawPlanSchema>;

export interface StudyDay {
  day: number;
  title: string;
  readings: string[];
  explanation: string;
  questions: string[];
  application: string | null;
  prayer: string | null;
}
export interface StudyPlan {
  title: string;
  objective: string;
  topic: string;
  durationDays: StudyDuration;
  days: StudyDay[];
}

export function isStudyDuration(n: number): n is StudyDuration {
  return (STUDY_DURATIONS as readonly number[]).includes(n);
}

/** The longest reading one day may have (verses), so a day stays a day's reading. */
export const MAX_DAY_VERSES = 60;

export function validatePlan(raw: RawPlan, opts: { days: StudyDuration; topic: string; verseCount: (ref: ScriptureRef) => number }): { plan: StudyPlan | null; failures: string[] } {
  const failures: string[] = [];
  if (raw.days.length !== opts.days) failures.push(`The plan has ${raw.days.length} days; it must have exactly ${opts.days}.`);
  const days: StudyDay[] = [];
  let previous = new Set<string>();
  raw.days.forEach((d, i) => {
    if (d.day !== i + 1) failures.push(`Day ${i + 1} is numbered ${d.day}; days must be numbered 1 to ${opts.days} in order.`);
    const readings: string[] = [];
    let verses = 0;
    for (const r of d.readings) {
      const ref = parseReference(r.replace(/^Psalms?\b/i, "Psalm"));
      const n = ref ? opts.verseCount(ref) : 0;
      if (!ref || n === 0) {
        failures.push(`Day ${i + 1}: "${r}" is not a passage in the Berean Standard Bible.`);
        continue;
      }
      verses += n;
      readings.push(formatReference(ref));
    }
    if (!readings.length) failures.push(`Day ${i + 1} has no valid reading.`);
    if (verses > MAX_DAY_VERSES) failures.push(`Day ${i + 1}'s reading is ${verses} verses; keep each day under ${MAX_DAY_VERSES}.`);
    const now = new Set(readings);
    if (readings.some((r) => previous.has(r))) failures.push(`Day ${i + 1} repeats the previous day's reading.`);
    previous = now;
    days.push({ day: i + 1, title: d.title, readings, explanation: d.explanation, questions: d.questions, application: d.application?.trim() || null, prayer: d.prayer?.trim() || null });
  });
  if (failures.length) return { plan: null, failures };
  return { plan: { title: raw.title, objective: raw.objective, topic: opts.topic, durationDays: opts.days, days }, failures };
}
