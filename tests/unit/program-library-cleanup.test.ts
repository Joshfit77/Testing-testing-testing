import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HABIT_PROGRAMS } from "@/data/habit-programs";
import { getProgramSeed, PROGRAMS } from "@/data/programs";
import { isListedProgram, programRetirement, RETIRED_PROGRAMS } from "@/data/program-retirements";
import { buildProgramProposal, programRecommendationsForCoach } from "@/lib/coach/program-recommendations";
import { expandProgram } from "@/lib/domain/program-expansion";
import { filterCatalog, SPEC_CATEGORIES, specCategoriesFor } from "@/lib/domain/program-catalog";

/**
 * The 2026-11 library clean-up (docs/programs/PROGRAM_LIBRARY_AUDIT.md): what members can browse has no look-alike
 * names and no durations that disagree with the plan, and programs retired from browsing stay whole for the members
 * who already started them.
 */

const MIGRATION = "supabase/migrations/20261114000070_program_library_cleanup.sql";
const listed = PROGRAMS.filter((p) => isListedProgram(p.slug));
const retiredSlugs = Object.keys(RETIRED_PROGRAMS);

const STOP_WORDS = new Set(["a", "an", "and", "the", "for", "to", "of", "your", "in", "with", "on"]);
/** Lower-case word tokens: "&" is "and", "Upper / Lower" is "upper lower", "Full-Body" is "full body". */
const tokens = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t));

function nameOverlap(a: string, b: string): { jaccard: number; subset: boolean } {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return { jaccard: shared / (ta.size + tb.size - shared), subset: shared === Math.min(ta.size, tb.size) };
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, thirty: 30, forty: 40, sixty: 60, ninety: 90 };
const toNumber = (s: string) => (/^\d+$/.test(s) ? Number(s) : WORD_NUMBERS[s.toLowerCase()]);
/** Every "N-Week", "N Weeks", "N-Day" or "N Days" claim in a name. */
function durationClaims(name: string): { n: number; unit: "week" | "day" }[] {
  return [...name.matchAll(/\b(\d+|[A-Za-z]+)[- ](weeks?|days?)\b/gi)]
    .map((m) => ({ n: toNumber(m[1]!), unit: m[2]!.toLowerCase().startsWith("week") ? ("week" as const) : ("day" as const) }))
    .filter((c): c is { n: number; unit: "week" | "day" } => c.n !== undefined);
}

describe("library names", () => {
  it("no two visible programs (training or habit) have identical or near-identical names", () => {
    const visible = [...listed.map((p) => ({ slug: p.slug, name: p.name })), ...HABIT_PROGRAMS.map((h) => ({ slug: h.slug, name: h.name }))];
    for (let i = 0; i < visible.length; i++)
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i]!;
        const b = visible[j]!;
        const { jaccard, subset } = nameOverlap(a.name, b.name);
        const label = `"${a.name}" (${a.slug}) vs "${b.name}" (${b.slug})`;
        expect(jaccard, label).toBeLessThan(0.6);
        expect(subset, `${label}: one name is contained in the other`).toBe(false);
      }
  });

  it("the near-identical pairs found in the audit are no longer both visible", () => {
    const visibleNames = new Set(listed.map((p) => p.name));
    expect(visibleNames.has("Active Aging: Strength & Balance") && visibleNames.has("Active Aging Strength and Balance")).toBe(false);
    expect(visibleNames.has("Hypertrophy: Upper / Lower Split") && visibleNames.has("Upper/Lower Hypertrophy")).toBe(false);
    expect(listed.some((p) => p.name === "Push/Pull/Legs")).toBe(false);
  });

  it("every week or day count in a program's name matches what is stored", () => {
    for (const p of PROGRAMS)
      for (const c of durationClaims(p.name)) {
        if (c.unit === "week") expect(c.n, `${p.slug}: "${p.name}" vs ${p.weeks} weeks`).toBe(p.weeks);
        // "3-Day" means sessions a week; "First 30 Days" means calendar days, within a few days of the plan's length.
        else if (c.n <= 7) expect(c.n, `${p.slug}: "${p.name}" vs ${p.days.length} sessions a week`).toBe(p.days.length);
        else expect(Math.abs(c.n - p.weeks * 7), `${p.slug}: "${p.name}" vs ${p.weeks} weeks`).toBeLessThanOrEqual(3);
      }
    for (const h of HABIT_PROGRAMS) for (const c of durationClaims(h.name)) expect(c.unit === "day" ? c.n : c.n * 7, `${h.slug}: "${h.name}"`).toBe(h.days);
  });

  it("puts weeks in a visible name only for event countdowns, and days in one pattern (\"N-Day\")", () => {
    for (const p of listed) {
      if (durationClaims(p.name).some((c) => c.unit === "week")) expect(p.slug, p.name).toMatch(/peaking|fight-camp/);
      expect(p.name, p.slug).not.toMatch(/\(\d+ Days?\)|: \d+ Days\b/);
    }
  });

  it("Wave Strength: the name no longer says 4 weeks, and the stored 8 weeks are two 4-week waves with deloads", () => {
    const p = getProgramSeed("wave-strength-training-max")!;
    expect(p.name).toBe("Wave Strength: Training-Max Method");
    expect(p.name).not.toMatch(/4-Week/);
    expect(p.weeks).toBe(8);
    const weeks = expandProgram(p);
    expect(weeks).toHaveLength(8);
    expect(weeks.filter((w) => w.isDeload).map((w) => w.weekNumber)).toEqual([4, 8]);
    expect(weeks[0]!.focus).toMatch(/^Cycle 1/);
    expect(weeks[4]!.focus).toMatch(/^Cycle 2/);
    expect(p.summary).toMatch(/two 4-week .*waves \(8 weeks\)/);
  });

  it("similar programs that stay visible say who each one is for", () => {
    const pairs = [
      ["push-pull-legs-6-day", "push-pull-legs-12-week"],
      ["hybrid-strength-and-run", "hybrid-strength-run-12-week"],
      ["walk-to-run-beginner", "beginner-run-walk-5k-10-week"],
      ["first-30-days-in-the-gym", "full-body-fitness-foundations"],
      ["barbell-strength-foundations", "beginner-strength-foundations-8-week"],
      ["active-aging-strength-and-balance", "active-aging-strength-2-day"],
      ["womens-glute-strength", "lower-body-glute-development"],
      ["mma-fight-conditioning", "mma-fight-camp-3-day"],
    ];
    for (const pair of pairs)
      for (const slug of pair) {
        const p = getProgramSeed(slug)!;
        expect(isListedProgram(slug), slug).toBe(true);
        expect(p.summary, slug).toMatch(/^For [^:]{5,90}:/);
      }
  });
});

describe("retired programs stay whole for the members who started them", () => {
  const seed = readFileSync("supabase/seed.sql", "utf8");
  const migrations = readdirSync("supabase/migrations").map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"));

  it("are a small, known set, each pointing to a listed program with the same goal", () => {
    expect(retiredSlugs.length).toBe(10);
    for (const slug of retiredSlugs) {
      const p = getProgramSeed(slug);
      const r = programRetirement(slug)!;
      const to = getProgramSeed(r.replacedBy);
      expect(p, slug).toBeDefined();
      expect(to, `${slug} → ${r.replacedBy}`).toBeDefined();
      expect(isListedProgram(slug)).toBe(false);
      expect(isListedProgram(r.replacedBy), `${slug} → ${r.replacedBy}`).toBe(true);
      expect(p!.goals.some((g) => to!.goals.includes(g)), `${slug} → ${r.replacedBy} share a goal`).toBe(true);
      expect(r.reason.length, slug).toBeGreaterThan(20);
    }
  });

  it("still resolve by slug, with every week and day, in the catalog source", () => {
    for (const slug of retiredSlugs) {
      const p = getProgramSeed(slug)!;
      expect(p.slug).toBe(slug);
      const weeks = expandProgram(p);
      expect(weeks, slug).toHaveLength(p.weeks);
      for (const w of weeks) expect(w.days.length, `${slug} week ${w.weekNumber}`).toBe(p.days.length);
    }
  });

  it("are still seeded as published under the same stable ids, so enrollments, history and access keep working", () => {
    for (const slug of retiredSlugs) {
      const line = seed.split("\n").find((l) => l.startsWith("insert into public.training_programs ") && l.includes(`, '${slug}', `));
      expect(line, slug).toBeDefined();
      // is_published stays true on insert and on every re-seed: RLS hides unpublished programs from enrolled members.
      expect(line!, slug).toMatch(/, true, 'curated'\) on conflict \(slug\) do update set .* is_published = true;$/);
    }
    expect(seed).not.toMatch(/delete from public\.training_programs/i);
  });

  it("are never unpublished or deleted by a migration", () => {
    for (const sql of migrations) {
      for (const slug of retiredSlugs) {
        const mentions = sql.split("\n").filter((l) => !l.trimStart().startsWith("--") && l.includes(`'${slug}'`));
        for (const l of mentions) {
          expect(l, slug).not.toMatch(/is_published\s*=\s*false/i);
          expect(l, slug).not.toMatch(/delete\s+from/i);
        }
      }
    }
  });

  it("are left out of browsing, the coach's suggestions and proposals", () => {
    const browse = filterCatalog(
      listed.map((p) => ({ slug: p.slug, name: p.name, summary: p.summary, difficulty: p.difficulty, days_per_week: p.days.length, session_minutes: p.sessionMinutes, duration_weeks: p.weeks, goals: p.goals, equipment: p.equipment, category: p.category })),
      {},
    );
    for (const slug of retiredSlugs) expect(browse.some((p) => p.slug === slug), slug).toBe(false);
    // Every browse category still has programs after the clean-up.
    for (const c of SPEC_CATEGORIES) expect(listed.filter((p) => specCategoriesFor(p).includes(c.id)).length, c.id).toBeGreaterThan(0);

    const answers = { primary_goal: "general_health", experience: "beginner", days_per_week: 3, session_minutes: 45, equipment: ["dumbbell", "bench", "band"], preferred_types: ["home", "strength", "low_impact", "mobility"] };
    const recs = programRecommendationsForCoach({ answers: answers as never, plan: "pro", activeProgram: null, activeHabitPrograms: [] });
    for (const r of recs.training_programs) expect(retiredSlugs, r.slug).not.toContain(r.slug);

    const proposal = buildProgramProposal("foundations-full-body", "x", { activeProgram: null, activeHabitPrograms: [] });
    expect(proposal.ok).toBe(false);
    if (!proposal.ok) expect(proposal.error).toMatch(/retired.*dumbbell-home-strength/);
  });
});

describe("migration 070 matches the catalog", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const unquote = (s: string) => s.slice(1, -1).replace(/''/g, "'");
  const updates = [...sql.matchAll(/^update public\.training_programs set (.+)\n\s+where slug = ('[a-z0-9-]+') and owner_id is null and source = 'curated';$/gm)].map((m) => ({
    slug: unquote(m[2]!),
    sets: Object.fromEntries([...m[1]!.matchAll(/(name|summary) = ('(?:[^']|'')*')/g)].map((s) => [s[1]!, unquote(s[2]!)])),
  }));

  it("only renames and re-summarises curated programs, by slug", () => {
    expect(updates.length).toBeGreaterThan(0);
    const statements = sql.split("\n").filter((l) => l.trim() && !l.trimStart().startsWith("--"));
    expect(statements.filter((l) => l.startsWith("update ")).length).toBe(updates.length);
    expect(sql.replace(/^--.*$/gm, "")).not.toMatch(/\b(delete|insert|drop|alter|is_published|duration_weeks|program_weeks|program_days)\b/i);
  });

  it("writes exactly the names and summaries the seed writes", () => {
    for (const u of updates) {
      const p = getProgramSeed(u.slug)!;
      expect(p, u.slug).toBeDefined();
      if (u.sets.name !== undefined) expect(u.sets.name, u.slug).toBe(p.name);
      if (u.sets.summary !== undefined) expect(u.sets.summary, u.slug).toBe(p.summary);
    }
  });
});
