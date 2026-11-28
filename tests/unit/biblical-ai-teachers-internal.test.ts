// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_TEACHERS } from "@/lib/biblical-ai/teachers";

/**
 * The eleven approved teachers are internal knowledge sources for one assistant (founder clarification, 2026-11-28).
 * Members never see a teacher directory, profiles, selection menus or teacher modes. This guard keeps it that way in
 * the code: the list lives in one server-only module, no other source file names a teacher, and nothing that runs in
 * the browser imports the list or the module that uses it.
 */
const ROOT = path.resolve(import.meta.dirname, "../..");
const TEACHERS_FILE = "src/lib/biblical-ai/teachers.ts";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(name) ? [path.relative(ROOT, full)] : [];
  });
}
const SRC = files(path.join(ROOT, "src"));

describe("approved teachers are internal only", () => {
  it("the list is server-only", () => {
    expect(readFileSync(path.join(ROOT, TEACHERS_FILE), "utf8")).toMatch(/^import "server-only";/);
    expect(APPROVED_TEACHERS).toHaveLength(11);
  });

  it("no other source file names a teacher (no profiles, directory, menus or modes)", () => {
    const hits: string[] = [];
    for (const f of SRC) {
      if (f === TEACHERS_FILE) continue;
      const text = readFileSync(path.join(ROOT, f), "utf8");
      for (const t of APPROVED_TEACHERS) if (text.includes(t.name) || text.includes(t.slug)) hits.push(`${f}: ${t.name}`);
    }
    expect(hits).toEqual([]);
  });

  it("nothing that runs in the browser imports the list or the answer checks (type-only imports aside)", () => {
    const bad: string[] = [];
    for (const f of SRC) {
      const text = readFileSync(path.join(ROOT, f), "utf8");
      if (!/^["']use client["']/m.test(text)) continue;
      for (const m of text.matchAll(/^import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm)) {
        if (m[1]) continue;
        if (/biblical-ai\/(teachers|answer|prompt)$/.test(m[2]!)) bad.push(`${f}: ${m[2]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
