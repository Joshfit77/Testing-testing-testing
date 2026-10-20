import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { NOT_EXPORTED, USER_STORAGE_BUCKETS, USER_TABLES } from "@/server/services/account";

/**
 * Export and deletion coverage, checked against the migrations themselves so a new table can't be
 * forgotten: every table with a column referencing auth.users must cascade on account deletion (or be
 * explicitly nulled) and be part of the data export (or explicitly excluded with a reason), and every
 * private storage bucket must be emptied on deletion.
 */
const dir = path.resolve(import.meta.dirname, "../../supabase/migrations");
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(dir, f), "utf8"))
  .join("\n")
  // Drop comments so prose doesn't count as schema.
  .replace(/--[^\n]*/g, "");

interface UserLink {
  table: string;
  column: string;
  onDelete: string;
}

function userLinkedColumns(): UserLink[] {
  const out: UserLink[] = [];
  const tableRe = /create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g;
  for (const m of sql.matchAll(tableRe)) {
    const [, table, body] = m;
    for (const line of body!.split("\n")) {
      const col = line.match(/^\s*(\w+)\s+uuid\b.*references auth\.users\s*\(id\)(?:\s+on delete (cascade|set null|restrict))?/);
      if (col) out.push({ table: table!, column: col[1]!, onDelete: col[2] ?? "no action" });
    }
  }
  // Columns added later with ALTER TABLE.
  const alterRe = /alter table (?:only )?public\.(\w+)\s+add column (?:if not exists )?(\w+)\s+uuid\b[^;]*references auth\.users\s*\(id\)(?:\s+on delete (cascade|set null|restrict))?/g;
  for (const m of sql.matchAll(alterRe)) out.push({ table: m[1]!, column: m[2]!, onDelete: m[3] ?? "no action" });
  return out;
}

describe("account export and deletion coverage", () => {
  const links = userLinkedColumns();

  it("finds the user-linked tables in the migrations", () => {
    const tables = new Set(links.map((l) => l.table));
    for (const t of ["profiles", "workout_sets", "meal_items", "ai_messages", "daily_steps", "food_favorites", "activities"]) expect(tables).toContain(t);
  });

  it("every user-linked row is removed (or detached) when the auth user is deleted", () => {
    const bad = links.filter((l) => l.onDelete !== "cascade" && !(l.onDelete === "set null" && l.table in NOT_EXPORTED));
    expect(bad).toEqual([]);
  });

  it("every user-owned table is in the export, or excluded with a reason", () => {
    const exported = new Map(USER_TABLES.map((t) => [t.table, t.column]));
    const missing = links.filter((l) => l.onDelete === "cascade" && !exported.has(l.table) && !(l.table in NOT_EXPORTED));
    expect(missing).toEqual([]);
    // The export filters on the right column.
    for (const l of links.filter((x) => exported.has(x.table))) {
      const col = exported.get(l.table)!;
      expect(links.some((x) => x.table === l.table && x.column === col), `${l.table}.${col}`).toBe(true);
    }
  });

  it("has no stale entries", () => {
    const linked = new Set(links.map((l) => l.table));
    for (const t of USER_TABLES) expect(linked, t.table).toContain(t.table);
    for (const t of Object.keys(NOT_EXPORTED)) expect(linked, t).toContain(t);
    expect(new Set(USER_TABLES.map((t) => t.table)).size).toBe(USER_TABLES.length);
  });

  it("every private storage bucket is emptied on account deletion", () => {
    const buckets = [...sql.matchAll(/\(\s*'([\w-]+)',\s*'[\w-]+',\s*(true|false)/g)].map((m) => ({ id: m[1]!, isPublic: m[2] === "true" }));
    expect(buckets.length).toBeGreaterThan(0);
    const privateBuckets = buckets.filter((b) => !b.isPublic).map((b) => b.id);
    for (const b of privateBuckets) expect(USER_STORAGE_BUCKETS as readonly string[]).toContain(b);
  });
});
