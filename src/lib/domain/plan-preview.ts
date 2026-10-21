/**
 * Plan previews (SPEC §4): before a change is applied, show what it does to the plan — e.g. "4 → 3 days a week,
 * sessions ~52 → ~61 min". Pure, shared by the program builder and Training preferences.
 */
import type { ProgramSeed } from "@/data/programs";

export interface PlanSummary {
  name: string;
  daysPerWeek: number;
  /** Average estimated session length in a normal (non-deload) week, minutes. */
  minutes: number;
  /** Longest estimated session in that week, minutes. */
  maxMinutes: number;
  weeks: number;
}

/** Average and longest session of a list of day lengths. */
export function summarizeDays(name: string, minutes: number[], weeks: number): PlanSummary {
  const list = minutes.filter((m) => Number.isFinite(m) && m > 0);
  const avg = list.length ? Math.round(list.reduce((s, m) => s + m, 0) / list.length) : 0;
  return { name, daysPerWeek: minutes.length, minutes: avg, maxMinutes: list.length ? Math.max(...list) : 0, weeks };
}

/** Summary of a built program: its first loading week. */
export function summarizeSeed(seed: ProgramSeed): PlanSummary {
  const weeks = seed.weekTemplates ?? [{ focus: "", days: seed.days }];
  const week = weeks.find((w) => !w.isDeload) ?? weeks[0]!;
  return summarizeDays(seed.name, week.days.map((d) => d.minutes), seed.weeks);
}

export interface PlanChange {
  key: "days" | "minutes" | "weeks" | "program";
  label: string;
  before: string;
  after: string;
}

/** What changes between the current plan and a proposed one. Unchanged values are left out. */
export function planChanges(before: PlanSummary | null, after: PlanSummary): PlanChange[] {
  if (!before) return [{ key: "program", label: "New plan", before: "none", after: after.name }];
  const out: PlanChange[] = [];
  if (before.daysPerWeek !== after.daysPerWeek) out.push({ key: "days", label: "Days a week", before: String(before.daysPerWeek), after: String(after.daysPerWeek) });
  if (Math.abs(before.minutes - after.minutes) >= 1) out.push({ key: "minutes", label: "Average session", before: `~${before.minutes} min`, after: `~${after.minutes} min` });
  if (before.weeks !== after.weeks) out.push({ key: "weeks", label: "Program length", before: `${before.weeks} wk`, after: `${after.weeks} wk` });
  if (before.name !== after.name) out.push({ key: "program", label: "Program", before: before.name, after: after.name });
  return out;
}

/** One line: "4 → 3 days, sessions 52 → 61 min, 8 → 12 weeks". */
export function planChangeSentence(before: PlanSummary | null, after: PlanSummary): string {
  if (!before) return `${after.daysPerWeek} days, sessions about ${after.minutes} min, ${after.weeks} weeks`;
  const parts: string[] = [];
  if (before.daysPerWeek !== after.daysPerWeek) parts.push(`${before.daysPerWeek} → ${after.daysPerWeek} days`);
  if (before.minutes !== after.minutes) parts.push(`sessions ${before.minutes} → ${after.minutes} min`);
  if (before.weeks !== after.weeks) parts.push(`${before.weeks} → ${after.weeks} weeks`);
  return parts.length ? parts.join(", ") : "Same schedule and session length";
}
