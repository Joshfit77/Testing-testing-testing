import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { isListedProgram, RETIRED_PROGRAMS } from "@/data/program-retirements";
import { PROGRAMS, type ProgramSeed } from "@/data/programs";
import { AUDIT_MUSCLES, auditProgram } from "@/lib/domain/program-audit";
import { BEGINNER_MAX_RPE, expandProgram } from "@/lib/domain/program-expansion";
import { isExerciseAvailable } from "@/lib/domain/program-generator";
import { EQUIPMENT } from "@/lib/domain/types";

/**
 * One validation over EVERY program in the catalog (audit 2026-11-14, docs/audit-2026-11-14/workouts-programs-progress.md).
 * Each rule lists the programs that break it, so a failure names the program. Rules that programs break on purpose
 * carry a short, reviewed exception list with the reason; anything new fails.
 *
 * Retired programs (src/data/program-retirements.ts) stay exactly as their enrolled members have them. They are
 * checked for integrity (exercises exist, schedule matches) but not for the listing rules (equipment list, level).
 */
const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));
const listed = PROGRAMS.filter((p) => isListedProgram(p.slug));
const all = (p: ProgramSeed) => expandProgram(p).flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => ({ week: w.weekNumber, day: d.name, ...e }))));
const failing = (programs: ProgramSeed[], problems: (p: ProgramSeed) => string[]) => programs.flatMap((p) => problems(p).map((m) => `${p.slug}: ${m}`));

describe("program catalog: every program", () => {
  it("is counted: 74 programs, 64 listed and 10 retired", () => {
    expect(PROGRAMS).toHaveLength(74);
    expect(listed).toHaveLength(64);
    expect(Object.keys(RETIRED_PROGRAMS).filter((s) => PROGRAMS.some((p) => p.slug === s))).toHaveLength(10);
  });

  it("references only exercises that exist in the exercise catalog", () => {
    expect(failing(PROGRAMS, (p) => [...new Set(all(p).filter((e) => !bySlug.has(e.ex)).map((e) => `unknown exercise ${e.ex}`))])).toEqual([]);
  });

  it("prescribes sets, reps, time, rest and effort within sane bounds", () => {
    expect(
      failing(PROGRAMS, (p) =>
        all(p).flatMap((e) => {
          const at = `w${e.week} ${e.day} ${e.ex}`;
          const out: string[] = [];
          if (!(e.sets >= 1 && e.sets <= 10)) out.push(`${at}: ${e.sets} sets`);
          if (!(e.rest >= 0 && e.rest <= 600)) out.push(`${at}: rest ${e.rest} s`);
          if (!e.reps && !e.seconds) out.push(`${at}: neither reps nor time`);
          if (e.seconds != null && !(e.seconds >= 5 && e.seconds <= 7200)) out.push(`${at}: ${e.seconds} s`);
          if (e.rpe != null && !(e.rpe >= 4 && e.rpe <= 10)) out.push(`${at}: RPE ${e.rpe}`);
          if (e.reps) {
            const numbers = (e.reps.match(/\d+/g) ?? []).map(Number);
            if (!numbers.length && !/AMRAP|max|event/i.test(e.reps)) out.push(`${at}: reps "${e.reps}" has no number`);
            // A plain rep count ("12", "8-10") above 50 is a typo; distances, breaths and contacts are written with their unit.
            if (/^\d+(\s*[-–]\s*\d+)?$/.test(e.reps) && Math.max(...numbers) > 50) out.push(`${at}: ${e.reps} reps`);
          }
          return out;
        }),
      ),
    ).toEqual([]);
  });

  it("has exactly the stored days-per-week in every week (the program pointer walks day 1…N of each week)", () => {
    // training_programs.days_per_week is seeded from the first week; advanceProgram moves to day + 1 and rolls the
    // week over after days_per_week, so a week with fewer or more days would strand or skip sessions.
    expect(
      failing(PROGRAMS, (p) =>
        expandProgram(p)
          .filter((w) => w.days.length !== p.days.length || w.days.some((d, i) => d.dayNumber !== i + 1))
          .map((w) => `week ${w.weekNumber} has ${w.days.length} days, the program says ${p.days.length}`),
      ),
    ).toEqual([]);
    expect(failing(PROGRAMS, (p) => (expandProgram(p).length === p.weeks ? [] : [`${expandProgram(p).length} weeks built, ${p.weeks} stated`]))).toEqual([]);
  });

  it("leaves at least one rest day in every week (no program schedules 7 days)", () => {
    expect(failing(PROGRAMS, (p) => expandProgram(p).filter((w) => w.days.length > 6).map((w) => `week ${w.weekNumber} trains ${w.days.length} days`))).toEqual([]);
  });

  it("keeps weekly hard sets per muscle group and sets per session out of absurd territory", () => {
    // Fractional set counting per audited group (glutes+hamstrings and lats+upper back are each one group, so a
    // specialization can reach the low 20s). Library maximum today: 23.5 (glutes & hamstrings, a glute program).
    expect(
      failing(PROGRAMS, (p) =>
        auditProgram(p).weeks.flatMap((w) => [
          ...AUDIT_MUSCLES.filter((m) => w.setsByMuscle[m] > 26).map((m) => `week ${w.weekNumber}: ${w.setsByMuscle[m]} weekly sets for ${m}`),
          ...w.days.filter((d) => d.exercises.reduce((n, e) => n + e.sets, 0) > (p.difficulty === "beginner" ? 24 : 36)).map((d) => `week ${w.weekNumber} ${d.name}: ${d.exercises.reduce((n, e) => n + e.sets, 0)} sets in one session`),
        ]),
      ),
    ).toEqual([]);
  });

  it("a week or day count in a listed program's name matches what is stored", () => {
    expect(
      failing(listed, (p) => {
        const out: string[] = [];
        const weeks = p.name.match(/(\d+)[- ]week/i);
        const days = p.name.match(/(\d+)[- ]day\b/i);
        if (weeks && Number(weeks[1]) !== p.weeks) out.push(`name says ${weeks[1]} weeks, stored ${p.weeks}`);
        if (days && Number(days[1]) !== p.days.length) out.push(`name says ${days[1]} days, stored ${p.days.length}`);
        return out;
      }),
    ).toEqual([]);
  });
});

describe("program catalog: equipment listed matches the exercises used (listed programs)", () => {
  /** An exercise the listed equipment can't do, where the program itself names the substitute. */
  const SUBSTITUTE_IN_NOTES: Record<string, string[]> = {
    // "Use a conventional deadlift if no trap bar." (barbell and rack are listed)
    "womens-strength-progression": ["trap-bar-deadlift"],
  };
  /** Equipment listed for an option the program offers in its notes, not for a prescribed exercise. */
  const OPTIONAL_LISTED: Record<string, string[]> = {
    // Hack squat: "Back squats work too."
    "physique-show-prep": ["rack"],
  };

  it("every prescribed exercise can be done with the equipment the program lists", () => {
    expect(
      failing(listed, (p) =>
        [...new Set(all(p).map((e) => e.ex))]
          .filter((slug) => !isExerciseAvailable(bySlug.get(slug)!, p.equipment) && !(SUBSTITUTE_IN_NOTES[p.slug] ?? []).includes(slug))
          .map((slug) => `${slug} needs ${bySlug.get(slug)!.equipment.join(" or ")}, the program lists ${p.equipment.join(", ")}`),
      ),
    ).toEqual([]);
  });

  it("lists no equipment that none of its exercises use", () => {
    expect(
      failing(listed, (p) => {
        const used = new Set(all(p).flatMap((e) => bySlug.get(e.ex)?.equipment ?? []));
        return p.equipment.filter((q) => q !== "bodyweight" && !used.has(q) && !(OPTIONAL_LISTED[p.slug] ?? []).includes(q)).map((q) => `lists ${q}, which no exercise uses`);
      }),
    ).toEqual([]);
  });

  it("only uses known equipment names", () => {
    expect(failing(PROGRAMS, (p) => p.equipment.filter((q) => !(EQUIPMENT as readonly string[]).includes(q)).map((q) => `unknown equipment ${q}`))).toEqual([]);
  });
});

describe("program catalog: level matches content (listed programs)", () => {
  /**
   * Beginner-labelled programs that prescribe an exercise the exercise catalog rates "advanced". These are OPEN
   * findings, not approvals: each needs a coach's decision (swap the lift, or relabel the program). They are pinned
   * so the list can't grow silently. See the audit document.
   */
  const KNOWN_ADVANCED_IN_BEGINNER: Record<string, string[]> = {
    "strongman-foundations": ["push-press", "sandbag-to-shoulder"],
    "mma-off-camp-2-day": ["front-squat"],
    "core-strength-stability-8-week": ["ab-wheel-rollout"],
  };

  it("beginner programs use no advanced-rated exercise beyond the known, reported list", () => {
    const found: Record<string, string[]> = {};
    for (const p of listed.filter((x) => x.difficulty === "beginner")) {
      const adv = [...new Set(all(p).map((e) => e.ex))].filter((slug) => bySlug.get(slug)?.difficulty === "advanced").sort();
      if (adv.length) found[p.slug] = adv;
    }
    expect(found).toEqual(Object.fromEntries(Object.entries(KNOWN_ADVANCED_IN_BEGINNER).map(([k, v]) => [k, [...v].sort()])));
  });

  it("beginner programs never prescribe effort above RPE 8.5", () => {
    expect(failing(listed.filter((p) => p.difficulty === "beginner"), (p) => all(p).filter((e) => (e.rpe ?? 0) > BEGINNER_MAX_RPE).map((e) => `w${e.week} ${e.ex} RPE ${e.rpe}`))).toEqual([]);
  });
});

describe("program catalog: time prescriptions on exercises the catalog counts in reps (finding P-3, fixed 2026-11-15)", () => {
  it("is limited to the known programs", () => {
    // These programs prescribe seconds on exercises the catalog counts in reps. The logger now logs such a set by
    // time (src/lib/domain/timed-sets.ts, tests/unit/timed-sets.test.ts). The list stays pinned so it is known which
    // programs rely on that.
    const affected = listed
      .filter((p) => all(p).some((e) => e.seconds && !e.reps && bySlug.get(e.ex) && !bySlug.get(e.ex)!.timed))
      .map((p) => p.slug)
      .sort();
    expect(affected).toEqual(
      [
        "busy-schedule-30-minute-workouts",
        "conditioning-intervals-8-week",
        "flexibility-recovery-routines",
        "full-body-fitness-foundations",
        "full-body-mobility-6-week",
        "functional-engine",
        "grappling-mat-endurance",
        "kettlebell-circuit-intervals",
        "mma-fight-camp-3-day",
        "mma-fight-conditioning",
        "powerlifting-peaking-12-week",
      ].sort(),
    );
  });
});
