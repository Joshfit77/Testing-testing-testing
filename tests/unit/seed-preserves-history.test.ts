import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Re-running supabase/seed.sql on a live database must not detach members' logged workouts or calendar moves from
 * their program days (workout_sessions.program_day_id is "on delete set null"). Weeks and days are upserted under
 * stable ids; only exercise rows are rebuilt, and only weeks/days a program no longer has are deleted.
 */
describe("seed.sql keeps member history attached", () => {
  const sql = readFileSync("supabase/seed.sql", "utf8");

  it("never deletes all of a program's weeks or a week's days", () => {
    expect(sql).not.toMatch(/delete from public\.program_weeks where program_id = '[^']+';/);
    expect(sql).not.toMatch(/delete from public\.program_days where week_id = '[^']+';/);
    expect(sql).toMatch(/delete from public\.program_weeks where program_id = '[^']+' and week_number > \d+;/);
  });

  it("upserts weeks and days in place", () => {
    const weeks = sql.match(/insert into public\.program_weeks .*$/gm) ?? [];
    const days = sql.match(/insert into public\.program_days .*$/gm) ?? [];
    expect(weeks.length).toBeGreaterThan(0);
    expect(days.length).toBeGreaterThan(0);
    for (const l of [...weeks, ...days]) expect(l).toMatch(/on conflict \(id\) do update/);
  });
});
