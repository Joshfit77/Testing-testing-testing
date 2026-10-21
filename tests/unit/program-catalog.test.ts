import { PROGRAM_CATEGORIES, PROGRAMS } from "@/data/programs";
import { programSimilarity } from "@/lib/domain/program-audit";
import {
  catalogQuery,
  completionRequirement,
  equipmentSummary,
  filterCatalog,
  parseCatalogFilters,
  requiredSessions,
  SPEC_CATEGORIES,
  specCategoriesFor,
  type CatalogProgram,
} from "@/lib/domain/program-catalog";

const catalog: CatalogProgram[] = PROGRAMS.map((p) => ({
  slug: p.slug,
  name: p.name,
  summary: p.summary,
  difficulty: p.difficulty,
  days_per_week: p.days.length,
  session_minutes: p.sessionMinutes,
  goals: [...p.goals, ...p.types.map((t) => `type:${t}`)],
  equipment: p.equipment,
  category: p.category,
  categoryName: PROGRAM_CATEGORIES.find((c) => c.slug === p.category)?.name,
}));
const slugs = (list: CatalogProgram[]) => list.map((p) => p.slug);

describe("spec categories (SPEC §5)", () => {
  it("has the 13 spec categories and maps every library category to exactly one", () => {
    expect(SPEC_CATEGORIES).toHaveLength(13);
    for (const c of PROGRAM_CATEGORIES) expect(SPEC_CATEGORIES.filter((s) => s.categories.includes(c.slug)).map((s) => s.id), c.slug).toHaveLength(1);
  });

  it("every spec category has at least one program, and calisthenics, hybrid and seated work exist", () => {
    for (const c of SPEC_CATEGORIES) expect(filterCatalog(catalog, { category: c.id }).length, c.id).toBeGreaterThan(0);
    expect(filterCatalog(catalog, { category: "calisthenics" }).length).toBeGreaterThanOrEqual(2);
    expect(slugs(filterCatalog(catalog, { category: "endurance" }))).toContain("hybrid-strength-and-run");
    expect(slugs(filterCatalog(catalog, { category: "active-aging" }))).toContain("seated-strength-mobility");
    expect(filterCatalog(catalog, { category: "functional" }).length).toBeGreaterThanOrEqual(3);
    expect(filterCatalog(catalog, { category: "home" }).length).toBeGreaterThanOrEqual(3);
  });

  it("also lists home-friendly programs under Home, but never barbell programs", () => {
    const home = filterCatalog(catalog, { category: "home" });
    expect(slugs(home)).toContain("calisthenics-foundations");
    expect(home.every((p) => !p.equipment.includes("barbell"))).toBe(true);
    expect(specCategoriesFor({ category: "strength", equipment: ["barbell", "rack"] })).toEqual(["strength"]);
  });
});

describe("filters", () => {
  it("search matches every word against name, summary, category and equipment", () => {
    expect(slugs(filterCatalog(catalog, { q: "calisthen" }))).toEqual(expect.arrayContaining(["calisthenics-foundations", "calisthenics-strength-upper-lower"]));
    expect(slugs(filterCatalog(catalog, { q: "kettlebell circuits" }))).toContain("kettlebell-circuit-intervals");
    expect(filterCatalog(catalog, { q: "zzzz" })).toEqual([]);
  });

  it("filters by goal, experience, equipment, days and session length together", () => {
    const res = filterCatalog(catalog, { goal: "build_strength", experience: "beginner", equipment: "dumbbells", days: 3, minutes: 45 });
    expect(res.length).toBeGreaterThan(0);
    for (const p of res) {
      expect(p.goals).toContain("build_strength");
      expect(p.difficulty).toBe("beginner");
      expect(p.days_per_week).toBeLessThanOrEqual(3);
      expect(p.session_minutes).toBeLessThanOrEqual(45);
      for (const e of p.equipment) expect(["bodyweight", "mat", "dumbbell", "bench", "band"]).toContain(e);
    }
    expect(slugs(filterCatalog(catalog, { equipment: "none" }))).toContain("aerobic-base-run-walk");
    expect(slugs(filterCatalog(catalog, { equipment: "none" }))).not.toContain("dumbbell-home-strength");
  });

  it("reads filters from the URL, drops unknown values and writes them back in a stable order", () => {
    const f = parseCatalogFilters({ q: " glute ", category: "home", goal: "lose_fat", experience: "expert", equipment: "bands", days: "3", minutes: "37" });
    expect(f).toEqual({ q: "glute", category: "home", goal: "lose_fat", equipment: "bands", days: 3 });
    expect(catalogQuery(f)).toBe("?q=glute&category=home&goal=lose_fat&equipment=bands&days=3");
    expect(catalogQuery({})).toBe("");
  });
});

describe("equipment and completion text", () => {
  it("states equipment needed in plain words", () => {
    expect(equipmentSummary(["bodyweight"])).toBe("No equipment");
    expect(equipmentSummary(["dumbbell", "bench", "bodyweight"])).toBe("Dumbbells and Bench");
  });

  it("asks for 80% of sessions (all of them for one-week libraries)", () => {
    expect(requiredSessions(3, 8)).toEqual({ total: 24, required: 20 });
    expect(completionRequirement({ days_per_week: 3, duration_weeks: 8 })).toMatch(/80% of the 24 sessions — 20 or more/);
    expect(completionRequirement({ days_per_week: 6, duration_weeks: 1 })).toBe("Complete all 6 sessions.");
    expect(completionRequirement({ days_per_week: 5, duration_weeks: 8 }, "Custom rule.")).toBe("Custom rule.");
  });
});

describe("no near-duplicate programs (SPEC §5)", () => {
  it("scores a renamed copy as identical", () => {
    const p = PROGRAMS[0]!;
    expect(programSimilarity(p, { ...p, slug: "copy", name: "Copy" })).toBe(1);
  });

  it("keeps every pair of library programs well below a near-duplicate", () => {
    for (let i = 0; i < PROGRAMS.length; i++)
      for (let j = i + 1; j < PROGRAMS.length; j++) {
        const s = programSimilarity(PROGRAMS[i]!, PROGRAMS[j]!);
        expect(s, `${PROGRAMS[i]!.slug} ~ ${PROGRAMS[j]!.slug}`).toBeLessThan(0.5);
      }
  });

  it("flags specialist programming for review and never claims a review happened", () => {
    const flagged = PROGRAMS.filter((p) => p.needsSpecialistReview).map((p) => p.slug);
    for (const s of ["physique-show-prep", "powerlifting-peaking-12-week", "mma-fight-camp-3-day", "active-aging-strength-2-day", "seated-strength-mobility"]) expect(flagged).toContain(s);
    for (const p of PROGRAMS) expect(`${p.description} ${p.summary}`, p.slug).not.toMatch(/reviewed by a (qualified|certified)/i);
  });
});
