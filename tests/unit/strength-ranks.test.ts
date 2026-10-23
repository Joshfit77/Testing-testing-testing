import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { BODY_REGIONS, regionShares } from "@/lib/domain/body-regions";
import { allRegionStats, regionStats, volumeBand, type MapSession } from "@/lib/domain/body-map";
import { levelFor, levelLabel, overallRank, rankAll, rankRegion, REGION_BENCHMARKS, scoreBenchmark, STRENGTH_RANKS, type RankInput, type RankSet } from "@/lib/domain/strength-ranks";

const TODAY = "2026-10-22";
const set = (weightKg: number | null, reps: number | null, over: Partial<RankSet> = {}): RankSet => ({ weightKg, reps, durationSeconds: null, completed: true, isWarmup: false, ...over });
let n = 0;
const session = (date: string, exercises: { slug: string; sets: RankSet[] }[], id = `s${++n}`) => ({ id, date, exercises });
const input = (sessions: RankInput["sessions"], over: Partial<RankInput> = {}): RankInput => ({ sessions, bodyweightKg: 80, table: "men", today: TODAY, ...over });

describe("strength rank rules", () => {
  it("uses only lifts from the catalog that really train the region, with rising thresholds", () => {
    const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));
    for (const region of BODY_REGIONS) {
      for (const b of REGION_BENCHMARKS[region]) {
        const ex = bySlug.get(b.slug);
        expect(ex, b.slug).toBeDefined();
        expect(regionShares(ex!.primary, ex!.secondary).get(region), `${b.slug} → ${region}`).toBeGreaterThan(0);
        expect(ex!.equipment, `${b.slug} must not be a dumbbell or machine lift`).not.toContain("machine");
        for (const t of [b.men, b.women]) for (let i = 1; i < 6; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
      }
    }
    expect(STRENGTH_RANKS).toEqual(["bronze", "silver", "gold", "platinum", "diamond", "disciple"]);
  });

  it("places a value between thresholds and shows progress toward the next rank", () => {
    const t = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75] as const;
    expect(levelFor(0.25, t)).toEqual({ level: 0, progress: 0.5 });
    expect(levelFor(1.0, t)).toEqual({ level: 3, progress: 0 });
    expect(levelFor(1.125, t)).toEqual({ level: 3, progress: 0.5 });
    expect(levelFor(2.2, t)).toEqual({ level: 6, progress: 1 });
    expect(levelLabel(null)).toBe("Not assessed");
    expect(levelLabel(0)).toBe("Working toward Bronze");
    expect(levelLabel(6)).toBe("Disciple");
  });

  it("scores the bench press by estimated 1RM relative to body weight", () => {
    // 80 kg × 5 → Epley 93.3 kg; ÷ 80 kg body weight = 1.17, between Gold (1.0) and Platinum (1.25).
    const r = scoreBenchmark(REGION_BENCHMARKS.chest[0]!, input([session("2026-10-01", [{ slug: "bench-press", sets: [set(80, 5), set(60, 10, { isWarmup: true })] }])]));
    expect(r.value).toBe(1.17);
    expect(r.level).toBe(3);
    expect(r.best).toEqual({ weightKg: 80, reps: 5, seconds: null });
    // The women's table puts the same lift higher.
    expect(scoreBenchmark(REGION_BENCHMARKS.chest[0]!, input([session("2026-10-01", [{ slug: "bench-press", sets: [set(80, 5)] }])], { table: "women" })).level).toBe(5);
  });

  it("counts body weight for pull-ups and dips, and caps high-rep sets at 12", () => {
    const pull = REGION_BENCHMARKS.upper_back[0]!;
    expect(scoreBenchmark(pull, input([session("2026-10-01", [{ slug: "pull-up", sets: [set(0, 1)] }])])).level).toBe(1);
    expect(scoreBenchmark(pull, input([session("2026-10-01", [{ slug: "pull-up", sets: [set(null, 10)] }])])).value).toBe(1.33);
    expect(scoreBenchmark(pull, input([session("2026-10-01", [{ slug: "pull-up", sets: [set(null, 25)] }])])).value).toBe(1.4);
    // 20 kg added for 5 reps at 80 kg body weight: 100 × (1 + 5/30) / 80 = 1.46 → Gold.
    expect(scoreBenchmark(pull, input([session("2026-10-01", [{ slug: "pull-up", sets: [set(20, 5)] }])])).level).toBe(3);
  });

  it("never treats different movements as the same lift", () => {
    const legPressOnly = input([session("2026-10-01", [{ slug: "leg-press", sets: [set(300, 10)] }, { slug: "hack-squat", sets: [set(200, 8)] }])]);
    const quads = rankRegion("quadriceps", legPressOnly);
    expect(quads.level).toBeNull();
    expect(quads.notAssessed).toContain("Barbell Back Squat");
    const bandPull = rankRegion("upper_back", input([session("2026-10-01", [{ slug: "band-assisted-pull-up", sets: [set(0, 8)] }])]));
    expect(bandPull.level).toBeNull();
  });

  it("can't be inflated by repeating logs or the same session twice", () => {
    const one = session("2026-10-01", [{ slug: "back-squat", sets: [set(100, 5)] }]);
    const base = rankRegion("quadriceps", input([one])).representative!.value;
    const many = Array.from({ length: 50 }, (_, i) => session(`2026-09-${String((i % 28) + 1).padStart(2, "0")}`, [{ slug: "back-squat", sets: Array.from({ length: 10 }, () => set(100, 5)) }, { slug: "front-squat", sets: [set(60, 5)] }]));
    expect(rankRegion("quadriceps", input([one, one, ...many])).representative!.value).toBe(base);
    expect(rankRegion("quadriceps", input([one, one, ...many])).level).toBe(rankRegion("quadriceps", input([one])).level);
  });

  it("says Not assessed, with the reason, when data is missing", () => {
    const squat = [session("2026-10-01", [{ slug: "back-squat", sets: [set(100, 5)] }])];
    expect(rankRegion("quadriceps", input(squat, { bodyweightKg: null })).benchmarks[0]!.notAssessed).toBe("Log your body weight so this lift can be compared.");
    expect(rankRegion("quadriceps", input(squat, { table: null })).notAssessed).toBe("Choose the men's or women's table first.");
    expect(rankRegion("calves", input(squat)).notAssessed).toMatch(/No provisional rule yet/);
    // Old sets (over 12 months) and warm-ups don't count.
    expect(rankRegion("quadriceps", input([session("2025-09-01", [{ slug: "back-squat", sets: [set(100, 5)] }])])).level).toBeNull();
    expect(rankRegion("quadriceps", input([session("2026-10-01", [{ slug: "back-squat", sets: [set(100, 5, { isWarmup: true })] }])])).level).toBeNull();
    // Push-ups with a weight vest aren't body-weight reps.
    expect(rankRegion("chest", input([session("2026-10-01", [{ slug: "push-up", sets: [set(10, 20)] }])])).benchmarks[2]!.notAssessed).toMatch(/added weight/);
  });

  it("ignores implausible values (typos) and reports them", () => {
    const r = rankRegion("quadriceps", input([session("2026-10-01", [{ slug: "back-squat", sets: [set(1000, 5), set(100, 5)] }])]));
    expect(r.representative!.value).toBe(1.46);
    expect(r.representative!.ignoredImplausible).toBe(1);
  });

  it("uses the best benchmark for the region and the middle region for the overall rank", () => {
    const sessions = [
      session("2026-10-01", [
        { slug: "bench-press", sets: [set(80, 5)] }, // chest & (secondary) — Gold
        { slug: "push-up", sets: [set(null, 12)] }, // Silver; bench wins for chest
        { slug: "back-squat", sets: [set(140, 5)] }, // 2.04 → Diamond (quads, glutes)
        { slug: "conventional-deadlift", sets: [set(100, 5)] }, // 1.46 → Silver (lower back, hamstrings)
        { slug: "overhead-press", sets: [set(40, 5)] }, // 0.58 → Silver
      ]),
    ];
    const { regions, overall } = rankAll(input(sessions));
    const chest = regions.find((r) => r.region === "chest")!;
    expect(chest.representative!.benchmark.slug).toBe("bench-press");
    expect(chest.rank).toBe("gold");
    // Assessed: chest 3, lower back 2, shoulders 2, glutes 5, quads 5, hamstrings 2 → sorted 2,2,2,3,5,5 → middle (lower) = 2.
    expect(overall.assessed).toBe(6);
    expect(overall.rank).toBe("silver");
    expect(overall.notAssessed.map((x) => x.region)).toEqual(expect.arrayContaining(["calves", "biceps", "forearms"]));
    expect(overallRank(regions.slice(0, 3)).level).toBeNull();
  });
});

describe("muscle map statistics", () => {
  const ex = (slug: string, sets: RankSet[]) => {
    const e = EXERCISES.find((x) => x.slug === slug)!;
    return { slug, name: e.name, primary: e.primary, secondary: e.secondary, sets };
  };
  const sessions: MapSession[] = [
    { id: "a", date: "2026-10-20", exercises: [ex("bench-press", [set(80, 5), set(80, 5), set(40, 10, { isWarmup: true })]), ex("dips", [set(0, 10)])] },
    { id: "b", date: "2026-10-13", exercises: [ex("bench-press", [set(77.5, 5)])] },
    { id: "c", date: "2026-09-10", exercises: [ex("bench-press", [set(75, 5)]), ex("overhead-press", [set(40, 5)])] },
  ];

  it("counts sets once, primary as 1 and secondary as 0.5, with volume for primary loaded sets", () => {
    const chest = regionStats("chest", { sessions: [...sessions, sessions[0]!], records: [], today: TODAY });
    expect(chest.last28.workouts).toBe(2);
    expect(chest.last28.sets).toBe(4); // 2 + 1 dips + 1 (last week)
    expect(chest.last28.volumeKg).toBe(Math.round(80 * 5 * 2 + 77.5 * 5));
    expect(chest.setsThisWeek).toBe(3);
    expect(chest.previous28.workouts).toBe(1);
    expect(chest.exercises[0]).toMatchObject({ slug: "bench-press", role: "primary", sets: 4 });
    const shoulders = regionStats("shoulders", { sessions, records: [], today: TODAY });
    expect(shoulders.exercises.find((e) => e.slug === "overhead-press")?.role).toBe("primary");
    const triceps = regionStats("triceps", { sessions, records: [], today: TODAY });
    expect(triceps.last28.sets).toBe(4); // bench (primary chest and triceps) 2 + 1, dips 1
  });

  it("tracks the main lift's estimated 1RM by month and keeps one best record per exercise and type", () => {
    const records = [
      { slug: "bench-press", name: "Barbell Bench Press", recordType: "estimated_1rm" as const, value: 87.5, weightKg: 75, reps: 5, date: "2026-09-10", primary: ["chest", "triceps"] },
      { slug: "bench-press", name: "Barbell Bench Press", recordType: "estimated_1rm" as const, value: 93.33, weightKg: 80, reps: 5, date: "2026-10-20", primary: ["chest", "triceps"] },
      { slug: "back-squat", name: "Barbell Back Squat", recordType: "estimated_1rm" as const, value: 120, weightKg: 100, reps: 6, date: "2026-10-20", primary: ["quadriceps", "glutes"] },
    ];
    const chest = regionStats("chest", { sessions, records, today: TODAY });
    expect(chest.strength).toMatchObject({ slug: "bench-press", points: [{ month: "2026-09", e1rmKg: 87.5 }, { month: "2026-10", e1rmKg: 93.3 }] });
    expect(chest.records).toHaveLength(1);
    expect(chest.records[0]!.value).toBe(93.33);
    expect(chest.weekly).toHaveLength(12);
    expect(chest.weekly.at(-1)!.sets).toBe(3);
  });

  it("bands this week's sets against the usual range", () => {
    expect(volumeBand({ setsThisWeek: 0, setRange: [10, 20] })).toBe("none");
    expect(volumeBand({ setsThisWeek: 4, setRange: [10, 20] })).toBe("low");
    expect(volumeBand({ setsThisWeek: 12, setRange: [10, 20] })).toBe("in_range");
    expect(volumeBand({ setsThisWeek: 25, setRange: [10, 20] })).toBe("high");
    expect(volumeBand({ setsThisWeek: 5, setRange: null })).toBe("no_range");
    expect(allRegionStats({ sessions: [], records: [], today: TODAY })).toHaveLength(12);
  });
});
