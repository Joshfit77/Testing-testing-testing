import { barcodeInputError, barcodeLookupCandidates, expandUpcE, gtinCheckDigit, isValidGtin } from "@/lib/barcode";
import { normalizeOffProduct, nutritionForAmount, scaleNutrition, type OffProductResponse } from "@/lib/open-food-facts";
import nutella from "./fixtures/off-nutella.json";
import notFound from "./fixtures/off-not-found.json";
import noNutrition from "./fixtures/off-no-nutrition.json";
import servingOnly from "./fixtures/off-serving-only.json";

describe("barcode check digits", () => {
  it("computes GS1 check digits", () => {
    expect(gtinCheckDigit("301762042200")).toBe(3); // EAN-13 3017620422003
    expect(gtinCheckDigit("03600029145")).toBe(2); // UPC-A 036000291452
    expect(gtinCheckDigit("9638507")).toBe(4); // EAN-8 96385074
  });
  it("validates EAN-13, UPC-A and EAN-8", () => {
    expect(isValidGtin("3017620422003")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("96385074")).toBe(true);
    expect(isValidGtin("3017620422004")).toBe(false);
    expect(isValidGtin("12345")).toBe(false);
    expect(isValidGtin("30176204220a3")).toBe(false);
  });
  it("expands UPC-E to UPC-A", () => {
    expect(expandUpcE("04252614")).toBe("042100005264");
    expect(isValidGtin("042100005264")).toBe(true);
    expect(expandUpcE("04252615")).toBeNull(); // wrong check digit
    expect(expandUpcE("24252614")).toBeNull(); // number system must be 0 or 1
  });
  it("builds lookup candidates", () => {
    expect(barcodeLookupCandidates("3017620422003")).toEqual(["3017620422003"]);
    expect(barcodeLookupCandidates("0 36000 29145 2")).toEqual(["0036000291452", "036000291452"]);
    expect(barcodeLookupCandidates("96385074")).toEqual(["96385074"]);
    expect(barcodeLookupCandidates("04252614", "upce")).toEqual(["0042100005264"]);
    expect(barcodeLookupCandidates("04252614", "ean8")).toBeNull();
    expect(barcodeLookupCandidates("3017620422004")).toBeNull();
    expect(barcodeLookupCandidates("abc")).toBeNull();
  });
  it("explains typed-input problems", () => {
    expect(barcodeInputError("")).toMatch(/Enter/);
    expect(barcodeInputError("12ab")).toMatch(/digits only/);
    expect(barcodeInputError("123456")).toMatch(/8, 12 or 13/);
    expect(barcodeInputError("3017620422004")).toMatch(/check digit/);
    expect(barcodeInputError("3017620422003")).toBeNull();
  });
});

describe("Open Food Facts normalization", () => {
  it("normalizes a complete product with per-100 g and per-serving values", () => {
    const r = normalizeOffProduct(nutella as OffProductResponse, "3017620422003");
    expect(r.status).toBe("found");
    if (r.status !== "found") return;
    const p = r.product;
    expect(p).toMatchObject({ code: "3017620422003", name: "Nutella", brand: "Nutella", quantity: "400 g", servingLabel: "15 g", servingQuantity: 15, unit: "g", missing: [] });
    expect(p.per100).toEqual({ calories: 539, protein_g: 6.3, carbs_g: 57.5, fat_g: 30.9, fiber_g: 0 });
    // Per serving is derived from per-100 g × serving weight so both bases agree.
    expect(p.perServing?.calories).toBeCloseTo(80.9, 0);
    expect(p.perServing?.fat_g).toBeCloseTo(4.6, 1);
  });
  it("reports not found", () => {
    expect(normalizeOffProduct(notFound as OffProductResponse, "0000000000017")).toEqual({ status: "not_found", code: "0000000000017" });
    expect(normalizeOffProduct(null, "123")).toEqual({ status: "not_found", code: "123" });
  });
  it("reports products without nutrition so the name can prefill manual entry", () => {
    expect(normalizeOffProduct(noNutrition as OffProductResponse, "5000000000005")).toEqual({
      status: "no_nutrition",
      product: { code: "5000000000005", name: "Mystery Crackers", brand: "Example Foods" },
    });
  });
  it("handles per-serving-only data, kJ-only energy and ml units", () => {
    const r = normalizeOffProduct(servingOnly as OffProductResponse, "0049000028911");
    expect(r.status).toBe("found");
    if (r.status !== "found") return;
    expect(r.product.name).toBe("Cola 330 ml can");
    expect(r.product.unit).toBe("ml");
    expect(r.product.perServing).toEqual({ calories: 140.1, protein_g: 0, carbs_g: 35, fat_g: 0, fiber_g: null });
    expect(r.product.per100?.calories).toBeCloseTo(42.5, 1);
    expect(r.product.per100?.carbs_g).toBeCloseTo(10.6, 1);
  });
  it("ignores junk values and lists missing macros", () => {
    const r = normalizeOffProduct(
      { status: 1, product: { product_name: "Odd", nutriments: { "energy-kcal_100g": "250", proteins_100g: "abc", fat_100g: -3, carbohydrates_100g: 40 } } },
      "96385074",
    );
    expect(r.status).toBe("found");
    if (r.status !== "found") return;
    expect(r.product.per100).toEqual({ calories: 250, protein_g: 0, carbs_g: 40, fat_g: 0, fiber_g: null });
    expect(r.product.missing).toEqual(["protein", "fat"]);
    expect(r.product.perServing).toBeNull();
    expect(r.product.code).toBe("96385074");
  });
  it("rejects impossible energy values", () => {
    const r = normalizeOffProduct({ status: 1, product: { product_name: "Bad", nutriments: { "energy-kcal_100g": 5000 } } }, "96385074");
    expect(r.status).toBe("no_nutrition");
  });
});

describe("barcode portion math", () => {
  const r = normalizeOffProduct(nutella as OffProductResponse, "3017620422003");
  const p = r.status === "found" ? r.product : null;
  it("scales per 100 g by grams", () => {
    expect(nutritionForAmount(p!, { grams: 30 })).toEqual({ calories: 161.7, protein_g: 1.9, carbs_g: 17.3, fat_g: 9.3, fiber_g: 0 });
    expect(nutritionForAmount(p!, { grams: 100 })?.calories).toBe(539);
  });
  it("scales per serving by servings", () => {
    const two = nutritionForAmount(p!, { servings: 2 });
    expect(two?.calories).toBeCloseTo(161.7, 0);
  });
  it("returns null when a basis is unavailable", () => {
    const noServing = { ...p!, perServing: null };
    expect(nutritionForAmount(noServing, { servings: 1 })).toBeNull();
    expect(nutritionForAmount({ ...p!, per100: null }, { grams: 50 })).toBeNull();
  });
  it("rounds scaled values to one decimal", () => {
    expect(scaleNutrition({ calories: 100, protein_g: 3.33, carbs_g: 0, fat_g: 1, fiber_g: null }, 1.5)).toEqual({ calories: 150, protein_g: 5, carbs_g: 0, fat_g: 1.5, fiber_g: null });
  });
});
