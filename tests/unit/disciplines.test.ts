import { PROGRAM_CATEGORIES, PROGRAMS } from "@/data/programs";
import { CUSTOM_PROGRAM_TYPES, CUSTOM_TYPES } from "@/lib/domain/custom-programs";
import { DISCIPLINE_IDS, DISCIPLINES, disciplineForCategory, disciplineForCustomType, getDiscipline, groupByDiscipline } from "@/lib/domain/disciplines";

describe("disciplines", () => {
  it("place every program style in exactly one discipline", () => {
    for (const t of CUSTOM_PROGRAM_TYPES) {
      expect(DISCIPLINES.filter((d) => d.customTypes.includes(t)), t).toHaveLength(1);
      expect(disciplineForCustomType(t).customTypes).toContain(t);
      expect(CUSTOM_TYPES[t].whoFor.length, t).toBeGreaterThan(20);
      expect(CUSTOM_TYPES[t].typicalWeek.length, t).toBeGreaterThan(20);
    }
  });

  it("place every library category in exactly one discipline, and every library program in a non-empty group", () => {
    for (const c of PROGRAM_CATEGORIES) expect(DISCIPLINES.filter((d) => d.categories.includes(c.slug)), c.slug).toHaveLength(1);
    const known = new Set(PROGRAM_CATEGORIES.map((c) => c.slug));
    for (const d of DISCIPLINES) for (const c of d.categories) expect(known.has(c), c).toBe(true);
    const groups = groupByDiscipline(PROGRAMS, (p) => disciplineForCategory(p.category));
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(PROGRAMS.length);
    expect(groups.map((g) => g.discipline.id)).toEqual([...DISCIPLINE_IDS]);
  });

  it("puts sport programs where athletes would look for them", () => {
    expect(disciplineForCategory("strongman").label).toBe("Strongman");
    expect(disciplineForCategory("boxing-conditioning").label).toBe("Combat Sports");
    expect(disciplineForCategory("show-prep").label).toBe("Bodybuilding & Physique");
    expect(disciplineForCategory("unknown-category").id).toBe("general");
    expect(disciplineForCustomType("mma").id).toBe("combat");
    expect(getDiscipline("speed_agility")?.customTypes).toEqual(["speed", "agility"]);
    expect(getDiscipline("nope")).toBeUndefined();
  });
});
