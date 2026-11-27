import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static security checks over every migration: row level security is on for every table, and only the
 * public catalog (exercises, programs, published content, feature flags) has policies anonymous visitors
 * can use. Personal data must never get an anon policy.
 */
const dir = path.resolve(import.meta.dirname, "../../supabase/migrations");
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(dir, f), "utf8"))
  .join("\n")
  .replace(/--[^\n]*/g, "");
const statements = sql.split(";").map((s) => s.replace(/\s+/g, " ").trim().toLowerCase());

const PUBLIC_CATALOG = new Set([
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
]);

describe("database security coverage", () => {
  const created = [...new Set(statements.flatMap((s) => [...s.matchAll(/create table (?:if not exists )?public\.([a-z_]+)/g)].map((m) => m[1]!)))];

  it("finds the app's tables", () => {
    expect(created.length).toBeGreaterThan(40);
  });

  it("enables row level security on every table", () => {
    const rls = new Set(statements.flatMap((s) => [...s.matchAll(/alter table public\.([a-z_]+) enable row level security/g)].map((m) => m[1]!)));
    expect(created.filter((t) => !rls.has(t))).toEqual([]);
  });

  it("gives anonymous visitors access only to the public catalog", () => {
    const anonTables = statements
      .filter((s) => s.startsWith("create policy") && / on public\./.test(s) && /\bto [^]*\banon\b/.test(s))
      .map((s) => s.match(/ on public\.([a-z_]+)/)?.[1] ?? "?");
    expect(anonTables.length).toBeGreaterThan(0);
    expect(anonTables.filter((t) => !PUBLIC_CATALOG.has(t))).toEqual([]);
  });

  it("never grants a policy to every role on personal tables", () => {
    const allRoles = statements.filter((s) => s.startsWith("create policy") && / to public\b/.test(s)).map((s) => s.match(/ on public\.([a-z_]+)/)?.[1]);
    expect(allRoles.filter((t) => t && !PUBLIC_CATALOG.has(t))).toEqual([]);
  });

  it("pins search_path on every security definer function", () => {
    const definers = statements.filter((s) => /create (or replace )?function/.test(s) && /security definer/.test(s));
    expect(definers.filter((s) => !/set search_path/.test(s)).map((s) => s.slice(0, 80))).toEqual([]);
  });
});
