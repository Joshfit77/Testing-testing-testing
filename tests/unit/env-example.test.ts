import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every environment variable the application reads is listed in .env.example (as a value or a commented example), so
 * whoever sets up staging or production can see every setting that exists, including the AI spending limits.
 * Variables the hosting platform sets itself are exempt.
 */
const ROOT = process.cwd();
const PLATFORM = new Set(["NODE_ENV", "NEXT_RUNTIME", "CI", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_GIT_COMMIT_SHA"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Names read as process.env.X / env.X, env["X"], or through the small parsing helpers (usdEnv("X"), intEnv("X"), ids("X")). */
export function envNamesIn(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/\benv\.([A-Z][A-Z0-9_]{2,})\b/g)) names.add(m[1]!);
  for (const m of text.matchAll(/\benv\[\s*["']([A-Z][A-Z0-9_]{2,})["']\s*\]/g)) names.add(m[1]!);
  for (const m of text.matchAll(/\b(?:usdEnv|intEnv|ids)\(\s*["']([A-Z][A-Z0-9_]{2,})["']/g)) names.add(m[1]!);
  return [...names];
}

function documentedNames(): Set<string> {
  const text = readFileSync(join(ROOT, ".env.example"), "utf8");
  return new Set([...text.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]!));
}

describe(".env.example", () => {
  it("finds names however the code reads them", () => {
    expect(envNamesIn('process.env.A_ONE; env.B_TWO; env["C_THREE"]; usdEnv("D_FOUR", 1); intEnv(\'E_FIVE\', 2); ids("F_SIX", "x")').sort()).toEqual(
      ["A_ONE", "B_TWO", "C_THREE", "D_FOUR", "E_FIVE", "F_SIX"],
    );
    expect(envNamesIn("someEnv.lower; ENV_NOT_READ")).toEqual([]);
  });

  it("lists every environment variable the application reads", () => {
    const documented = documentedNames();
    const missing: string[] = [];
    for (const file of sourceFiles(join(ROOT, "src"))) {
      for (const name of envNamesIn(readFileSync(file, "utf8"))) {
        if (!PLATFORM.has(name) && !documented.has(name)) missing.push(`${name} (${relative(ROOT, file)})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps the AI spending limits visible", () => {
    const documented = documentedNames();
    for (const name of ["AI_MEMBER_MONTHLY_BUDGET_USD", "AI_GLOBAL_MONTHLY_BUDGET_USD", "AI_GLOBAL_DAILY_BUDGET_USD", "AI_MAX_CONCURRENT"]) {
      expect(documented.has(name), name).toBe(true);
    }
  });
});
