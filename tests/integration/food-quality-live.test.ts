import { describe, expect, it } from "vitest";

/**
 * Live Open Food Facts lookups. Off unless OFF_LIVE=1 is set, because the test environment has no internet access
 * and the project's other tests use a local mock. When it does run it reads two well-known barcodes from the real
 * API and checks the shape, never exact nutrition figures (they change as the database is edited).
 */
const live = process.env.OFF_LIVE === "1";

describe.skipIf(!live)("food quality service (live Open Food Facts)", () => {
  it("reads real products by barcode", async () => {
    delete process.env.OFF_API_BASE_URL;
    const svc = await import("@/server/services/food-quality");
    for (const code of ["3017620422003", "5449000000996"]) {
      const result = await svc.getQualityProduct(code);
      expect(result, code).not.toBeNull();
      expect(result?.quality.name).toBeTruthy();
      expect(result?.quality.brand !== undefined).toBe(true);
    }
  }, 30_000);
});
