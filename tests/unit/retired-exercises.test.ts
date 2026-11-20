import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXERCISE_DETAILS } from "@/data/exercise-details";
import { EXERCISE_MOTIONS, EXERCISE_MOTION_VIEWS } from "@/data/exercise-motions";
import { EXERCISES, RETIRED_EXERCISES, RETIRED_EXERCISE_SLUGS } from "@/data/exercises";
import { PROGRAMS } from "@/data/programs";
import { expandProgram } from "@/lib/domain/program-expansion";
import readiness from "@/data/exercise-demo-readiness.json";

/**
 * Retired exercises (owner decision 2026-11-20: the dynamic 90/90 Hip Switch) are out of active use everywhere a
 * member or the AI coach could pick one, while their database rows stay so logged workouts keep their names.
 */

const MIGRATION = "supabase/migrations/20261120000082_retire_exercises.sql";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|json)$/.test(f) ? [p] : [];
  });
}

describe("retired exercises", () => {
  it("lists the 90/90 Hip Switch, and only exercises that are not in the active catalog", () => {
    expect(RETIRED_EXERCISES.map((r) => r.slug)).toContain("90-90-hip-switch");
    for (const r of RETIRED_EXERCISES) expect(EXERCISES.some((e) => e.slug === r.slug), r.slug).toBe(false);
  });

  it("are not offered as an alternative, motion, detail entry or demo by any active exercise", () => {
    for (const e of EXERCISES) for (const a of e.alternatives) expect(RETIRED_EXERCISE_SLUGS.has(a), `${e.slug} → ${a}`).toBe(false);
    for (const slug of RETIRED_EXERCISE_SLUGS) {
      expect(EXERCISE_MOTIONS[slug], slug).toBeUndefined();
      expect(EXERCISE_MOTION_VIEWS[slug], slug).toBeUndefined();
      expect(EXERCISE_DETAILS[slug], slug).toBeUndefined();
      expect((readiness as { exercises: Record<string, unknown> }).exercises[slug], slug).toBeUndefined();
    }
  });

  it("are in no curated program, in any week", () => {
    for (const p of PROGRAMS) {
      for (const w of expandProgram(p))
        for (const d of w.days)
          for (const x of d.exercises) expect(RETIRED_EXERCISE_SLUGS.has(x.ex), `${p.slug} week ${w.weekNumber} ${d.name}`).toBe(false);
    }
  });

  it("are not named anywhere in the app's source except the retirement list (programs, custom-program builder, coach)", () => {
    const offenders = [...files("src")].filter((f) => f !== path.join("src", "data", "exercises.ts")).filter((f) => {
      const text = readFileSync(f, "utf8");
      return [...RETIRED_EXERCISE_SLUGS].some((slug) => text.includes(`"${slug}"`));
    });
    expect(offenders).toEqual([]);
  });

  it("the seed never inserts one and unpublishes any that already exist", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");
    for (const slug of RETIRED_EXERCISE_SLUGS) {
      expect(seed).toContain(`update public.exercises set is_published = false where slug = '${slug}';`);
      expect(seed).not.toMatch(new RegExp(`insert into public\\.exercises[^\\n]*'${slug}'`));
    }
  });

  it("the migration unpublishes rather than deletes, and lets members read the ones their own data references", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const body = sql.replace(/^--.*$/gm, "");
    expect(body).toContain("update public.exercises set is_published = false where slug = '90-90-hip-switch'");
    expect(body).not.toMatch(/delete\s+from\s+public\.exercises\b/i);
    expect(body).not.toMatch(/delete\s+from\s+public\.(workout_exercises|workout_sets|personal_records|workout_template_exercises)\b/i);
    // Only curated programs lose their rows; members' own programs are left alone.
    expect(body).toMatch(/p\.owner_id is null/);
    expect(body).toMatch(/create policy exercises_read_own_history on public\.exercises\s+for select to authenticated/);
    expect(body).toMatch(/revoke all on function public\.member_references_exercise\(uuid\) from public, anon/);
    // Every lookup in the helper is limited to the caller's rows.
    const fn = body.slice(body.indexOf("create or replace function public.member_references_exercise"), body.indexOf("$$;"));
    expect((fn.match(/exists \(/g) ?? []).length).toBe(6);
    expect((fn.match(/auth\.uid\(\)/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });
});
