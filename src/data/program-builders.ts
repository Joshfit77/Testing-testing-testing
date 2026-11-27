import { estimateSessionMinutes, framingMinutes } from "@/lib/domain/session-time";
import type { ProgramDaySeed, ProgramExerciseSeed, ProgramWeekSeed } from "./programs";

/**
 * Shared program builders and standard warm-ups/cool-downs (moved out of programs.ts so program files can be split
 * by category without circular imports). Session minutes are computed from the prescription.
 */
export const STANDARD_WARMUP = [
  "3–5 minutes easy cardio (walk, bike, rower or skipping)",
  "World's greatest stretch × 3 per side",
  "Bodyweight squats × 10",
  "Band pull-aparts or arm circles × 15",
  "2–3 ramp-up sets of your first lift, building toward working weight",
];

export const STANDARD_COOLDOWN = [
  "3–5 minutes easy walking or cycling to bring heart rate down",
  "Child's pose — 60 seconds",
  "Figure-four glute stretch — 30–45 seconds per side",
  "Slow nasal breathing — 1–2 minutes",
];

export const LOW_IMPACT_WARMUP = [
  "3–5 minutes standing march or easy walk",
  "Cat-cow × 8 slow breaths",
  "Sit-to-stand × 5, slow and controlled",
  "Arm circles × 10 each direction",
];

export const CONDITIONING_WARMUP = [
  "5 minutes easy jump rope, bike or shadowboxing",
  "Lateral shuffles × 20 seconds each way",
  "World's greatest stretch × 3 per side",
  "2 × 10-second build-up efforts at moderate intensity",
];

export const SPRINT_WARMUP = [
  "5 minutes easy jog, skipping or jump rope",
  "Leg swings front-to-back and side-to-side × 10 each leg",
  "World's greatest stretch × 3 per side",
  "A-skips and wall drills × 2 rounds",
  "3 build-up runs of 30–40 m at 60%, 75% and 90% effort",
];

// --------------------------------------------------------------------------- Builders
// Small helpers so each program reads like a coach's sheet. Session minutes are computed from the
// prescription (work + rest + set-up + ramp-up sets) so the stated length matches what you'll do.

export type BuildEx = ProgramExerciseSeed & {
  /** Hypertrophy blocks add sets to this exercise as the block progresses. */
  grow?: boolean;
  /** Isolation work: in hypertrophy blocks it runs half an RPE point closer to failure than compounds. */
  iso?: boolean;
};

export const R = (ex: string, sets: number, reps: string, rest: number, o: Partial<BuildEx> = {}): BuildEx => ({ ex, sets, reps, rest, ...o });
export const T = (ex: string, sets: number, seconds: number, rest: number, o: Partial<BuildEx> = {}): BuildEx => ({ ex, sets, seconds, rest, ...o });

export function clean(e: BuildEx): ProgramExerciseSeed {
  const out: BuildEx = { ...e };
  delete out.grow;
  delete out.iso;
  return out;
}

export const toFive = (n: number) => Math.max(10, Math.round(n / 5) * 5);
export const joinNotes = (...n: (string | undefined)[]) => n.filter(Boolean).join(" ");

export function day(name: string, focus: string, exercises: BuildEx[], extra: { warmup?: string[]; cooldown?: string[]; minutes?: number } = {}): ProgramDaySeed {
  const list = exercises.map(clean);
  const framing = framingMinutes(extra.warmup ?? STANDARD_WARMUP, extra.cooldown ?? STANDARD_COOLDOWN);
  const out: ProgramDaySeed = { name, focus, minutes: extra.minutes ?? toFive(estimateSessionMinutes(list, framing)), exercises: list };
  if (extra.warmup) out.warmup = extra.warmup;
  if (extra.cooldown) out.cooldown = extra.cooldown;
  return out;
}

export const DELOAD_NOTE = "Deload: about 60% of your recent working weights; every rep smooth and fast.";

export function deloadExercise(e: ProgramExerciseSeed, note = DELOAD_NOTE): ProgramExerciseSeed {
  const out: ProgramExerciseSeed = { ...e, sets: Math.max(1, Math.round(e.sets * 0.6)), notes: joinNotes(e.notes, note) };
  if (e.rpe) out.rpe = Math.max(5, e.rpe - 2);
  if (e.intensity) out.intensity = "about 60% of recent working weight";
  return out;
}

export function deloadDays(days: ProgramDaySeed[], note?: string): ProgramDaySeed[] {
  return days.map((d) => day(d.name, d.focus, d.exercises.map((e) => deloadExercise(e, note)), { warmup: d.warmup, cooldown: d.cooldown }));
}

export const weeksOf = (n: number, make: (w: number) => ProgramWeekSeed): ProgramWeekSeed[] => Array.from({ length: n }, (_, i) => make(i + 1));
export const pct = (p: number) => `${p}% 1RM`;

/** Same days every week, with deloads in the listed weeks (used by templates whose loads are user-driven). */
export function repeatWeeks(n: number, days: ProgramDaySeed[], focus: (w: number) => string, deloadWeeks: number[] = [n]): ProgramWeekSeed[] {
  return weeksOf(n, (w) =>
    deloadWeeks.includes(w) ? { focus: "Deload — fewer sets and lighter weights so you recover before the next block", isDeload: true, days: deloadDays(days) } : { focus: focus(w), days },
  );
}

// ----- Hypertrophy blocks: sets per muscle start near the low end of 10–20 hard sets a week and rise
// through the block as reps in reserve fall (an RP-style MEV → MAV mesocycle), then a deload.

export interface DayPlan {
  name: string;
  focus: string;
  ex: BuildEx[];
  warmup?: string[];
}
export interface BlockWeek {
  focus: string;
  /** Extra sets on exercises marked `grow`. */
  add: number;
  /** Target RPE for compounds (isolation work runs +0.5). */
  rpe: number;
  deload?: boolean;
}

export function hypertrophyWeeks(plans: DayPlan[], weeks: BlockWeek[], extras?: (week: number, dayIndex: number) => BuildEx[]): ProgramWeekSeed[] {
  return weeks.map((w, wi) => {
    const out: ProgramWeekSeed = {
      focus: w.focus,
      days: plans.map((p, di) =>
        day(
          p.name,
          p.focus,
          [
            ...p.ex.map((e) => {
              if (w.deload) {
                const d: BuildEx = { ...e, sets: Math.max(1, Math.ceil(e.sets / 2)), notes: joinNotes(e.notes, "Deload: half the sets at the same or slightly lighter weights, 3–4 reps in reserve.") };
                if (e.rpe !== undefined) d.rpe = 6;
                return d;
              }
              const x: BuildEx = { ...e, sets: e.sets + (e.grow ? w.add : 0) };
              // The week sets the effort; an exercise written below the standard RPE 8 (a deadlift "kept submaximal")
              // stays that far below it every week instead of being pushed up with the rest.
              if (e.rpe !== undefined) x.rpe = Math.min(9.5, w.rpe + (e.iso ? 0.5 : 0) + Math.min(0, e.rpe - 8));
              return x;
            }),
            ...(extras ? extras(wi + 1, di) : []),
          ],
          { warmup: p.warmup },
        ),
      ),
    };
    if (w.deload) out.isDeload = true;
    return out;
  });
}

/** Five loading weeks and a deload — repeat the block slightly heavier. */
export const HYPERTROPHY_6: BlockWeek[] = [
  { focus: "Week 1 — find your working weights: about 3 reps in reserve on every set", add: 0, rpe: 7 },
  { focus: "Week 2 — same sets, about 2 reps in reserve: beat last week's reps or load", add: 0, rpe: 8 },
  { focus: "Week 3 — add a set to the key exercises, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: "Week 4 — 1–2 reps in reserve; keep adding reps before load", add: 1, rpe: 8.5 },
  { focus: "Week 5 — peak volume: one more set on key exercises, about 1 rep in reserve (isolation can reach failure)", add: 2, rpe: 9 },
  { focus: "Deload — half the sets and easy effort; then run the block again a little heavier", add: 0, rpe: 6, deload: true },
];

/** Two three-week waves, each followed by a deload. */
export const HYPERTROPHY_8: BlockWeek[] = [
  { focus: "Wave 1, week 1 — about 3 reps in reserve: find your working weights", add: 0, rpe: 7 },
  { focus: "Wave 1, week 2 — about 2 reps in reserve: add reps or load", add: 0, rpe: 8 },
  { focus: "Wave 1, week 3 — one more set on key exercises, 1–2 reps in reserve", add: 1, rpe: 8.5 },
  { focus: "Deload — half the sets, easy effort", add: 0, rpe: 6, deload: true },
  { focus: "Wave 2, week 1 — start a set higher than wave 1, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: "Wave 2, week 2 — 1–2 reps in reserve; beat wave 1's numbers", add: 1, rpe: 8.5 },
  { focus: "Wave 2, week 3 — peak volume, about 1 rep in reserve (isolation can reach failure)", add: 2, rpe: 9 },
  { focus: "Deload — half the sets, easy effort; then start a new block", add: 0, rpe: 6, deload: true },
];

export const secondsLabel = (s: number) => (s % 60 === 0 ? `${s / 60} min` : `${s} s`);

