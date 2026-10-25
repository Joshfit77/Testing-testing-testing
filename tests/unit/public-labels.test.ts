import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOOD_IQ_VERSION, NUTRITION_FEATURE_TITLE, NUTRITION_SCORE_LABEL } from "@/lib/food-iq";

/**
 * "Food IQ" is a registered trademark of another company (docs/launch-audit/TRADEMARKS.md): nothing a member can read
 * may use it. The internal names (files, the FOOD_IQ_SCORE flag, the FIQ-0.1 method version, test ids) stay as they
 * are, so this looks only at the text people see: everything under src/app and src/components, plus the prompts and
 * facts sent to the AI (whose replies are shown to members), with code comments stripped first.
 */
const ROOT = path.resolve(__dirname, "../..");
const SCANNED = ["src/app", "src/components", "src/lib/food-quality-ai.ts", "src/lib/coach"];

function files(p: string): string[] {
  const full = path.join(ROOT, p);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap((name) => {
    const child = path.join(full, name);
    if (statSync(child).isDirectory()) return files(path.relative(ROOT, child));
    return /\.(tsx?|css)$/.test(name) ? [child] : [];
  });
}

const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("public labels", () => {
  it("never shows the old name to members", () => {
    const hits: string[] = [];
    for (const file of SCANNED.flatMap(files)) {
      const text = stripComments(readFileSync(file, "utf8"));
      // The spellings a person would read; identifiers (foodIq, FoodIqScore, food-iq, FOOD_IQ) are internal names.
      text.split("\n").forEach((line, i) => {
        if (/\b(Food IQ|FoodIQ|FOOD IQ|Food-IQ)\b/.test(line)) hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it("keeps the public name and the internal method version apart", () => {
    expect(NUTRITION_SCORE_LABEL).toBe("Nutrition Score");
    expect(NUTRITION_FEATURE_TITLE).toBe("Narrow Gate Nutrition Score");
    // Renaming what members see must never change the method, which is what the stored ratings refer to.
    expect(FOOD_IQ_VERSION).toBe("FIQ-0.1");
  });
});
