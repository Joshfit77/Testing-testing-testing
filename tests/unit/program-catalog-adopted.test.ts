import { ADOPTED_CATALOG } from "@/data/program-catalog/adopted";
import { PROGRAMS, type ProgramSeed } from "@/data/programs";
import { expandProgram } from "@/lib/domain/program-expansion";

const METADATA = ["milestones", "instructions", "catalogNumber"] as const;
const withoutMetadata = (p: ProgramSeed) => {
  const copy: Partial<ProgramSeed> = { ...p };
  for (const k of METADATA) delete copy[k];
  return copy;
};

const EXPECTED_TIERS: Record<string, ProgramSeed["tier"]> = {
  "powerlifting-peaking-12-week": "plus",
  "bench-press-specialist": "plus",
  "squat-specialist": "plus",
  "deadlift-specialist": "plus",
  "dumbbell-home-strength": "plus",
  "calisthenics-foundations": "pro",
  "5k-training": "plus",
  "10k-training": "plus",
  "half-marathon-base-80-20": "plus",
  "aerobic-base-run-walk": "pro",
};

/** The library as it would be without any adopted metadata, to prove adoption changes nothing else. */
async function unadoptedPrograms(): Promise<ProgramSeed[]> {
  vi.resetModules();
  vi.doMock("@/data/program-catalog/adopted", () => ({ ADOPTED_CATALOG: {} }));
  try {
    return (await import("@/data/programs")).PROGRAMS;
  } finally {
    vi.doUnmock("@/data/program-catalog/adopted");
    vi.resetModules();
  }
}

describe("adopted catalog programs", () => {
  it("adopts the ten expected programs", () => {
    expect(Object.keys(ADOPTED_CATALOG).sort()).toEqual(Object.keys(EXPECTED_TIERS).sort());
  });

  it("catalog numbers are unique across the whole library", () => {
    const numbers = PROGRAMS.map((p) => p.catalogNumber).filter((n): n is number => n != null);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const n of numbers) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(40);
    }
  });

  for (const [slug, entry] of Object.entries(ADOPTED_CATALOG)) {
    describe(slug, () => {
      const merged = PROGRAMS.find((p) => p.slug === slug);

      it("exists in the library and carries the catalog metadata", () => {
        expect(merged).toBeDefined();
        expect(merged!.catalogNumber).toBe(entry.catalogNumber);
        expect(merged!.milestones).toEqual(entry.milestones);
        expect(merged!.instructions).toEqual(entry.instructions);
      });

      it("has one milestone per week and 3–6 instructions", () => {
        expect(entry.milestones).toHaveLength(merged!.weeks);
        for (const m of entry.milestones) {
          expect(m.trim().length).toBeGreaterThan(0);
          expect(m.length).toBeLessThanOrEqual(160);
        }
        expect(entry.instructions.length).toBeGreaterThanOrEqual(3);
        expect(entry.instructions.length).toBeLessThanOrEqual(6);
      });

      it("keeps its tier and expands to the same number of weeks", () => {
        expect(merged!.tier).toBe(EXPECTED_TIERS[slug]);
        expect(expandProgram(merged!)).toHaveLength(merged!.weeks);
      });
    });
  }

  it("adopting changes nothing but the metadata — prescriptions are untouched", async () => {
    const original = await unadoptedPrograms();
    for (const slug of Object.keys(ADOPTED_CATALOG)) {
      const before = original.find((p) => p.slug === slug)!;
      const after = PROGRAMS.find((p) => p.slug === slug)!;
      expect(before, slug).toBeDefined();
      for (const k of METADATA) expect(before[k], `${slug} already had ${k}`).toBeUndefined();
      expect(withoutMetadata(after), slug).toEqual(withoutMetadata(before));
      expect(expandProgram(after), slug).toEqual(expandProgram(before));
    }
  });
});
