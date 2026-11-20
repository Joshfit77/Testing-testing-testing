import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { stackAvailable } from "./helpers";

/**
 * Database-wide security invariants, read from the live catalog (pg_class, pg_proc, pg_policies, storage.buckets), so
 * a table, function, policy or bucket added later can't quietly skip them. The member-isolation sweep
 * (cross-user-isolation.test.ts) probes the tables it knows; this checks every table, whether or not anyone listed it.
 * Uses psql like account-deletion-closure.test.ts (TEST_DB_URL, default: the local Supabase CLI database).
 */
const available = await stackAvailable();
const DB_URL = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function sql(query: string): string[][] {
  const r = spawnSync("psql", [DB_URL, "-X", "-q", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error(`psql failed (is psql installed and TEST_DB_URL right?): ${r.error?.message ?? r.stderr}`);
  return r.stdout.split("\n").filter(Boolean).map((l) => l.split("\t"));
}

/** Catalog tables a signed-out visitor may read (the public library). Nothing else, and never a write. */
const VISITOR_READABLE = [
  "content_items",
  "exercise_alternatives",
  "exercise_media",
  "exercises",
  "feature_flags",
  "program_categories",
  "program_days",
  "program_exercises",
  "program_weeks",
  "training_programs",
];

describe.skipIf(!available)("database security invariants (live catalog)", () => {
  it("every table in the public schema has row-level security switched on", () => {
    const tables = sql(`select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') order by 1`);
    expect(tables.length).toBeGreaterThan(50);
    const without = sql(`select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity order by 1`);
    expect(without.map((r) => r[0])).toEqual([]);
  });

  it("there are no views in the public schema that could read past row-level security", () => {
    // A view runs with its owner's rights unless it is security_invoker, so it could expose rows a policy hides.
    const views = sql(`
      select c.relname from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
        and not coalesce((select bool_or(o = 'security_invoker=true' or o = 'security_invoker=on') from unnest(c.reloptions) o), false)
      order by 1`);
    expect(views.map((r) => r[0])).toEqual([]);
  });

  it("every security-definer function pins its search_path (no hijacking through a member's own objects)", () => {
    const loose = sql(`
      select p.proname from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      order by 1`);
    expect(Number(sql(`select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef`)[0]![0])).toBeGreaterThan(0);
    expect(loose.map((r) => r[0])).toEqual([]);
  });

  it("signed-out visitors reach only the public catalog, read-only", () => {
    const visitor = sql(`
      select tablename, cmd from pg_policies
      where schemaname = 'public' and (roles @> '{anon}' or roles @> '{public}')
      order by 1, 2`);
    for (const [table, cmd] of visitor) {
      expect(VISITOR_READABLE, `visitor policy on ${table}`).toContain(table);
      expect(cmd, `visitor policy on ${table} must be SELECT`).toBe("SELECT");
    }
  });

  it("only the exercise-media bucket is public; members' photos and scans are private", () => {
    const buckets = Object.fromEntries(sql(`select id, public::text from storage.buckets order by 1`).map(([id, pub]) => [id!, pub === "true"]));
    expect(buckets).toMatchObject({ avatars: false, "progress-photos": false, "body-scans": false, "exercise-media": true });
    expect(Object.entries(buckets).filter(([, pub]) => pub).map(([id]) => id)).toEqual(["exercise-media"]);
  });
});
