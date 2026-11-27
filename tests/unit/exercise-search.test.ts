import { describe, expect, it } from "vitest";
import { matchesQuery, searchExercises, suggestExercises, type SearchableExercise } from "@/lib/domain/exercise-search";

const ex = (slug: string, name: string, aliases: string[] = [], primary: string[] = []): SearchableExercise => ({ slug, name, aliases, primary });
const LIST = [
  ex("romanian-deadlift", "Romanian Deadlift", ["RDL", "Romanian hinge"], ["hamstrings", "glutes"]),
  ex("conventional-deadlift", "Conventional Deadlift", ["deadlift"], ["hamstrings", "glutes", "back"]),
  ex("bulgarian-split-squat", "Bulgarian Split Squat", ["rear-foot-elevated split squat"], ["quadriceps", "glutes"]),
  ex("dumbbell-bench-press", "Dumbbell Bench Press", ["DB bench"], ["chest"]),
  ex("overhead-press", "Overhead Press", ["military press", "strict press"], ["front deltoids"]),
  ex("skull-crusher", "EZ-Bar Skull Crusher", ["lying triceps extension"], ["triceps"]),
];

describe("exercise library search", () => {
  it("finds exercises by alternate names and gym shorthand", () => {
    expect(searchExercises(LIST, "rdl").map((e) => e.slug)).toEqual(["romanian-deadlift"]);
    expect(searchExercises(LIST, "military").map((e) => e.slug)).toEqual(["overhead-press"]);
    expect(searchExercises(LIST, "OHP").map((e) => e.slug)).toEqual(["overhead-press"]);
    expect(searchExercises(LIST, "db bench").map((e) => e.slug)).toEqual(["dumbbell-bench-press"]);
    expect(searchExercises(LIST, "lying triceps").map((e) => e.slug)).toEqual(["skull-crusher"]);
  });

  it("matches word starts, in any order, and ranks name matches first", () => {
    expect(matchesQuery(LIST[2]!, "split bulg")).toBe(true);
    expect(matchesQuery(LIST[2]!, "plit")).toBe(false);
    // "Deadlift" is an alternate name of the conventional deadlift, so it comes first.
    expect(searchExercises(LIST, "deadlift").map((e) => e.slug)).toEqual(["conventional-deadlift", "romanian-deadlift"]);
    // A muscle search lists the exercises that train it.
    expect(searchExercises(LIST, "hamstrings").map((e) => e.slug)).toEqual(["romanian-deadlift", "conventional-deadlift"]);
  });

  it("suggests close names for a typo when nothing matches", () => {
    expect(searchExercises(LIST, "bulgarain")).toEqual([]);
    expect(suggestExercises(LIST, "bulgarain").map((e) => e.slug)).toContain("bulgarian-split-squat");
    expect(suggestExercises(LIST, "romainan deadlift")[0]!.slug).toBe("romanian-deadlift");
    expect(suggestExercises(LIST, "zz")).toEqual([]);
  });

  it("an empty query returns everything in order", () => {
    expect(searchExercises(LIST, "  ")).toEqual(LIST);
  });
});
