/**
 * Library programs retired from browsing in the 2026-11 library clean-up (docs/programs/PROGRAM_LIBRARY_AUDIT.md).
 *
 * A retired program is NOT unpublished or deleted. Its row stays `is_published = true` with the same id, weeks and
 * days, because row-level security only lets members read a program, its weeks and days, and log workouts against
 * those days while the program is published (or their own). Unpublishing would cut enrolled members off from their
 * active plan, calendar and history. So members who started or saved one keep it exactly as it was, and its slug and
 * page still resolve; it is only left out of the library list, search, the API listing, the coach's suggestions and
 * in-app links, and its page points new members to the program that covers the same goal.
 *
 * Kept small and free of catalog imports so list pages can use it without loading every program definition.
 */
export interface ProgramRetirement {
  /** Slug of the listed program that covers the same goal; new members are pointed there. */
  replacedBy: string;
  /** Completes "Retired from the library: <replacement> covers …" on the retired program's page. */
  reason: string;
}

export const RETIRED_PROGRAMS: Readonly<Record<string, ProgramRetirement>> = {
  "foundations-full-body": {
    replacedBy: "dumbbell-home-strength",
    reason: "the same three full-body dumbbell sessions for beginners, now in an 8-week plan with a deload.",
  },
  "home-bodyweight-strength": {
    replacedBy: "band-bodyweight-total-body",
    reason: "the same bodyweight-and-band home training, now in a 6-week plan with a lighter final week.",
  },
  "active-aging-low-impact": {
    replacedBy: "active-aging-strength-and-balance",
    reason: "the same low-impact strength and balance sessions, now a 12-week plan with lighter weeks and harder variations as you improve.",
  },
  "daily-mobility-flow": {
    replacedBy: "full-body-mobility-6-week",
    reason: "the same short hip, spine, shoulder and ankle routines, now a 6-week plan with holds that grow each week.",
  },
  "hypertrophy-upper-lower": {
    replacedBy: "upper-lower-hypertrophy-12-week",
    reason: "the same 4-day upper/lower muscle-building split and reps-in-reserve waves, run for 12 weeks with exercise rotation.",
  },
  "power-hypertrophy-upper-lower": {
    replacedBy: "powerbuilding-4-day",
    reason: "the same four-day week of two heavy days and two hypertrophy days, run as two waves over 8 weeks.",
  },
  "aerobic-base-run-walk": {
    replacedBy: "beginner-run-walk-5k-10-week",
    reason: "the same run/walk path to 30 minutes of continuous running, with two easier weeks so the build is gentler.",
  },
  "athletic-power-development": {
    replacedBy: "power-and-athletic-strength-10-week",
    reason: "the same jumps, throws, power cleans and trap-bar strength on three days, with a deload and a test week.",
  },
  "athletic-qualities-sessions": {
    replacedBy: "power-and-athletic-strength-10-week",
    reason: "the same jumps, rotational throws and sport-strength work as a full 10-week plan (a one-week pick-and-mix library can't run alongside your main program).",
  },
  "combat-conditioning-sessions": {
    replacedBy: "mma-fight-conditioning",
    reason: "the same grappling, striking and energy-system work as a full 6-week plan (a one-week pick-and-mix library can't run alongside your main program).",
  },
};

export function programRetirement(slug: string): ProgramRetirement | undefined {
  return Object.hasOwn(RETIRED_PROGRAMS, slug) ? RETIRED_PROGRAMS[slug] : undefined;
}

/** Whether a library program is shown when browsing, searching or suggesting programs (retired ones are not). */
export function isListedProgram(slug: string): boolean {
  return !programRetirement(slug);
}
