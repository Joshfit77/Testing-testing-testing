/**
 * Audits the "Build my program" generator: every type × goal × days-per-week for an intermediate lifter
 * with a full gym. Prints deloads, RPE range, sets range, session-length fit and main-lift frequency.
 * Run with: npx tsx scripts/audit-custom-programs.ts
 */
import { EXERCISES } from "../src/data/exercises";
import { buildCustomProgram, CUSTOM_PROGRAM_TYPES, CUSTOM_TYPES, weeksRange } from "../src/lib/domain/custom-programs";
import { auditProgram } from "../src/lib/domain/program-audit";
import { EQUIPMENT, type ExperienceLevel } from "../src/lib/domain/types";

const catalog = EXERCISES.map((e) => ({ slug: e.slug, name: e.name, equipment: e.equipment, pattern: e.pattern, category: e.category, difficulty: e.difficulty, timed: e.timed, lowImpact: e.lowImpact }));
const experience = (process.argv[2] ?? "intermediate") as ExperienceLevel;
for (const type of CUSTOM_PROGRAM_TYPES) {
  const cfg = CUSTOM_TYPES[type];
  for (const goal of cfg.goals) {
    for (let d = cfg.days.min; d <= cfg.days.max; d++) {
      const weeks = weeksRange(type, goal.id).default;
      const p = buildCustomProgram(
        { type, goal: goal.id, experience, daysPerWeek: d, sessionMinutes: cfg.defaultMinutes, weeks, units: "metric", age: 30, heightCm: 178, bodyweightKg: 80, maxesKg: { squat: 140, bench: 100, deadlift: 180, press: 60 }, cardio: cfg.cardioInput ? { modality: "run", continuousMinutes: 20 } : null, division: type === "show_prep" ? "classic_physique" : null, equipment: [...EQUIPMENT] },
        catalog,
      );
      const a = auditProgram(p);
      const all = p.weekTemplates!.flatMap((w) => w.days.flatMap((x) => x.exercises));
      const rpes = all.map((e) => e.rpe).filter((x): x is number => x != null);
      const over = a.weeks.flatMap((w) => w.days.filter((x) => x.estimatedMinutes > cfg.defaultMinutes * 1.25).map((x) => `w${w.weekNumber} ${x.name} ${x.estimatedMinutes}m`));
      const w1 = a.weeks[0]!;
      console.log(
        `${type}/${goal.id}/${d}d ${weeks}wk deloads[${a.deloadWeeks.join(",")}] RPE ${Math.min(...rpes)}–${Math.max(...rpes)} sets ${Math.min(...all.map((e) => e.sets))}–${Math.max(...all.map((e) => e.sets))} ` +
          `freq ${Object.entries(w1.liftFrequency).map(([k, v]) => `${k}${v}`).join(" ")} sets/wk ${Object.entries(w1.setsByMuscle).map(([k, v]) => `${k}${v}`).join(" ")} push:pull ${w1.pushSets}:${w1.pullSets}` +
          (over.length ? `\n   OVER ${cfg.defaultMinutes} min: ${over.slice(0, 4).join("; ")}${over.length > 4 ? ` (+${over.length - 4})` : ""}` : ""),
      );
    }
  }
}
