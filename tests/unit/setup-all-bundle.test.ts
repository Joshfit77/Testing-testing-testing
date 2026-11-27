import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * supabase/setup-all.sql is the paste-once script for a brand-new database (SETUP.md). It must be exactly what
 * scripts/bundle-sql.sh makes from today's migrations and seed: a stale copy set up new projects with old program
 * data (beginner RPE 9 after the seed moved to 8.5). Run `bash scripts/bundle-sql.sh` after changing either.
 */
describe("supabase/setup-all.sql", () => {
  it("matches the current migrations and seed", () => {
    const root = path.resolve(__dirname, "../..");
    const dir = path.join(root, "supabase/migrations");
    const parts = [
      "-- Narrow Gate Fitness: complete database setup (schema, security policies, storage, catalog).",
      "-- Paste this whole file into Supabase > SQL Editor > New query, then click Run. Run it only once on a new project.",
    ];
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      parts.push("", `-- ===== supabase/migrations/${f} =====`, readFileSync(path.join(dir, f), "utf8").replace(/\n$/, ""));
    }
    parts.push("", "-- ===== supabase/seed.sql =====", readFileSync(path.join(root, "supabase/seed.sql"), "utf8").replace(/\n$/, ""));
    const expected = parts.join("\n") + "\n";
    const actual = readFileSync(path.join(root, "supabase/setup-all.sql"), "utf8");
    // (Compared by size first so a mismatch doesn't print a 10,000-line diff.)
    expect(actual.length).toBe(expected.length);
    expect(actual === expected).toBe(true);
  });
});
