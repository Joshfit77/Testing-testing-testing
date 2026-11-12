/**
 * Prints a structural audit of every library program: days, exercises, sets × reps, intensity,
 * weekly hard sets per muscle group, weekly frequency per main lift, and estimated session minutes.
 * Run with: npx tsx scripts/audit-programs.ts [slug]
 */
import { PROGRAMS } from "../src/data/programs";
import { auditProgram } from "../src/lib/domain/program-audit";

const only = process.argv[2];
for (const p of PROGRAMS) {
  if (only && p.slug !== only) continue;
  const a = auditProgram(p);
  console.log(`\n=== ${p.slug} — ${p.name} [${p.category}, ${p.difficulty}, ${p.tier}] ${p.weeks} wk × ${p.days.length} d, stated ${p.sessionMinutes} min`);
  console.log(`  deload weeks: ${a.deloadWeeks.join(", ") || "none"}`);
  for (const w of a.weeks) {
    if (!only && w.weekNumber > 1 && !w.isDeload) continue;
    console.log(`  Week ${w.weekNumber}${w.isDeload ? " (deload)" : ""}: ${w.focus}`);
    for (const d of w.days) {
      console.log(`    ${d.name} — stated ${d.minutes} min, est ${d.estimatedMinutes} min`);
      for (const e of d.exercises) console.log(`      ${e.ex} ${e.sets}×${e.reps ?? `${e.seconds}s`} rest ${e.rest}s${e.rpe ? ` RPE ${e.rpe}` : ""}${e.intensity ? ` @ ${e.intensity}` : ""}`);
    }
    console.log(`    hard sets/muscle: ${Object.entries(w.setsByMuscle).filter(([, n]) => n > 0).map(([m, n]) => `${m} ${n}`).join(", ")}`);
    console.log(`    lift frequency: ${Object.entries(w.liftFrequency).filter(([, n]) => n > 0).map(([m, n]) => `${m} ${n}×`).join(", ")}`);
    console.log(`    push:pull sets ${w.pushSets}:${w.pullSets}`);
  }
}
