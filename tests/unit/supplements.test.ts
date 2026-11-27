import { DIET_TYPES } from "@/lib/domain/diets";
import {
  EVIDENCE_LABELS,
  getSupplement,
  SUPPLEMENT_CATEGORIES,
  SUPPLEMENT_IDS,
  SUPPLEMENTS,
  supplementFitsDiet,
} from "@/data/supplements";

const sup = (id: string) => {
  const s = getSupplement(id);
  if (!s) throw new Error(`missing ${id}`);
  return s;
};

describe("supplement reference list", () => {
  it("has unique, short ids that fit the database check", () => {
    expect(new Set(SUPPLEMENT_IDS).size).toBe(SUPPLEMENTS.length);
    for (const id of SUPPLEMENT_IDS) {
      expect(id.length).toBeGreaterThanOrEqual(1);
      expect(id.length).toBeLessThanOrEqual(64);
    }
  });

  it("gives every supplement complete content, a known category and an evidence label", () => {
    for (const s of SUPPLEMENTS) {
      expect(SUPPLEMENT_CATEGORIES).toContain(s.category);
      expect(EVIDENCE_LABELS[s.evidence]).toBeTruthy();
      for (const field of [s.name, s.purpose, s.dose, s.timing, s.cautions]) expect(field.length).toBeGreaterThan(3);
    }
  });

  it("only suggests alternatives that are in the list and free of animal ingredients", () => {
    for (const s of SUPPLEMENTS.filter((x) => x.alternative)) {
      const alt = SUPPLEMENTS.find((x) => x.name === s.alternative);
      expect(alt, s.id).toBeDefined();
      expect(alt?.contains ?? [], s.id).toEqual([]);
    }
  });

  it("returns undefined for unknown ids", () => {
    expect(getSupplement("not-a-supplement")).toBeUndefined();
  });
});

describe("supplementFitsDiet", () => {
  it("allows everything when no diet is chosen", () => {
    for (const s of SUPPLEMENTS) {
      expect(supplementFitsDiet(s, null)).toBe(true);
      expect(supplementFitsDiet(s, undefined)).toBe(true);
    }
  });

  it("allows products without animal ingredients on every diet", () => {
    for (const diet of DIET_TYPES) {
      expect(supplementFitsDiet(sup("creatine"), diet)).toBe(true);
      expect(supplementFitsDiet(sup("plant-protein"), diet)).toBe(true);
    }
  });

  it("rules out dairy, fish and animal products for vegans and the Daniel Fast", () => {
    for (const diet of ["vegan", "daniel_fast"] as const) {
      expect(supplementFitsDiet(sup("whey"), diet)).toBe(false);
      expect(supplementFitsDiet(sup("omega-3"), diet)).toBe(false);
      expect(supplementFitsDiet(sup("collagen"), diet)).toBe(false);
    }
  });

  it("lets vegetarians have dairy but not fish oil or collagen", () => {
    expect(supplementFitsDiet(sup("whey"), "vegetarian")).toBe(true);
    expect(supplementFitsDiet(sup("omega-3"), "vegetarian")).toBe(false);
    expect(supplementFitsDiet(sup("collagen"), "vegetarian")).toBe(false);
  });

  it("lets pescatarians have fish oil, and paleo rules out dairy only", () => {
    expect(supplementFitsDiet(sup("omega-3"), "pescatarian")).toBe(true);
    expect(supplementFitsDiet(sup("collagen"), "pescatarian")).toBe(false);
    expect(supplementFitsDiet(sup("whey"), "paleo")).toBe(false);
    expect(supplementFitsDiet(sup("omega-3"), "paleo")).toBe(true);
  });

  it("puts no restriction on omnivore diets", () => {
    for (const diet of ["balanced", "keto", "carnivore", "mediterranean"] as const) {
      for (const s of SUPPLEMENTS) expect(supplementFitsDiet(s, diet)).toBe(true);
    }
  });
});
