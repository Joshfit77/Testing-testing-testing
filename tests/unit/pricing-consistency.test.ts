// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_PRO_PRICE_CENTS, formatPrice, getPlans } from "@/lib/domain/plans";
import { proPriceSummary } from "@/lib/domain/membership";

/**
 * Founder-approved pricing of 2026-11-27: Free $0, Pro $24.99 a month or $149.99 a year. No outdated Pro price may
 * appear in the app, its demo pages, the configuration templates or the current documentation. Dated reports and
 * audits keep the prices in force when they were written and aren't scanned. A line that explicitly records history
 * ("replaced", "previously", "was", "superseded", "legacy") is allowed.
 */
const OUTDATED = [/\$17\.99/, /\$119\.99/, /17,99\s?€/, /119,99\s?€/, /\$95\.89/, /Save 44%/];
const HISTORY = /replac|previous|\bwas\b|superseded|earlier|before that|legacy|history|approved 2026-11-13|until 2026-11-27/i;

const SCANNED_DIRS = ["src", "e2e", "scripts/demo", ".claude/agents", "docs/engagement"];
const SCANNED_FILES = [
  "standalone/index.html",
  "scripts/finance/forecast.py",
  ".env.example",
  "SETUP.md",
  "README.md",
  "CLAUDE.md",
  "IMPLEMENTATION_STATUS.md",
  "docs/README.md",
  "docs/MEMBERSHIPS.md",
  "docs/MOBILE_BILLING.md",
  "docs/DEMO.md",
  "docs/BETA_TEST_PLAN.md",
  "docs/LEGAL_REQUIREMENTS.md",
  "docs/PRESENTATION_GUIDE.md",
  "docs/STAGING_ENVIRONMENT.md",
  "docs/TESTFLIGHT_STEPS.md",
  "docs/TESTFLIGHT_SETUP_GUIDE.md",
  "docs/TESTFLIGHT_INTERNAL_CHECKLIST.md",
  "docs/pro/AI_COST.md",
  "docs/pro/PRICING_UPDATE_2026-11-27.md",
  "docs/ai-eval/COST_MODEL.md",
  "docs/legal/TERMS_OF_SERVICE_DRAFT.md",
  "docs/legal/REMAINING_INFORMATION_NEEDED.md",
  "docs/release/IPHONE_TEST_SCRIPT.md",
  "docs/production-consolidation/PAYMENT_VERIFICATION.md",
  "docs/production-consolidation/APP_STORE_READINESS.md",
  "docs/production-consolidation/FOUNDER_ACTION_ITEMS.md",
  "docs/production-consolidation/IPHONE_DEVICE_TESTING.md",
  "docs/production-consolidation/MASTER_ENGINEERING_REPORT.md",
];
const TEXT = /\.(tsx?|jsx?|mjs|css|html|md|py|json|sql)$/;

function filesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((f) => join(dir, f))
    .filter((f) => TEXT.test(f) && statSync(f).isFile() && !f.startsWith(join("src", "data")));
}

describe("approved pricing everywhere", () => {
  it("the approved prices are $24.99 a month and $149.99 a year, and every screen reads them from one place", () => {
    expect(formatPrice(APPROVED_PRO_PRICE_CENTS.month)).toBe("$24.99");
    expect(formatPrice(APPROVED_PRO_PRICE_CENTS.year)).toBe("$149.99");
    const plans = getPlans();
    expect(plans.free.priceCents).toBe(0);
    expect(plans.pro.priceCents).toBe(APPROVED_PRO_PRICE_CENTS.month);
    expect(plans.pro.yearlyPriceCents).toBe(APPROVED_PRO_PRICE_CENTS.year);
    expect(proPriceSummary()).toMatchObject({ monthCents: APPROVED_PRO_PRICE_CENTS.month, yearCents: APPROVED_PRO_PRICE_CENTS.year });
  });

  it("a stale display price in the environment can't show a price checkout would refuse", () => {
    process.env.PLAN_PRO_PRICE_CENTS = "1799";
    process.env.PLAN_PRO_YEARLY_PRICE_CENTS = "11999";
    try {
      expect(getPlans().pro.priceCents).toBe(2499);
      expect(getPlans().pro.yearlyPriceCents).toBe(14999);
    } finally {
      delete process.env.PLAN_PRO_PRICE_CENTS;
      delete process.env.PLAN_PRO_YEARLY_PRICE_CENTS;
    }
  });

  it("the configuration template sets no display price", () => {
    const env = readFileSync(".env.example", "utf8");
    expect(env).not.toMatch(/^PLAN_PRO_(YEARLY_)?PRICE_CENTS=\d/m);
  });

  it("no outdated Pro price appears in the app, demo pages, templates or current documentation", () => {
    const files = [...SCANNED_DIRS.flatMap(filesIn), ...SCANNED_FILES.filter((f) => existsSync(f))];
    expect(files.length).toBeGreaterThan(100);
    const hits: string[] = [];
    for (const file of files) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (OUTDATED.some((re) => re.test(line)) && !HISTORY.test(line)) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 140)}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("the current documentation states the approved prices", () => {
    for (const file of ["CLAUDE.md", "docs/MEMBERSHIPS.md", "docs/production-consolidation/PAYMENT_VERIFICATION.md", "docs/legal/TERMS_OF_SERVICE_DRAFT.md", "docs/MOBILE_BILLING.md"]) {
      const text = readFileSync(file, "utf8");
      expect(text, file).toContain("$24.99");
      expect(text, file).toContain("$149.99");
    }
  });
});
