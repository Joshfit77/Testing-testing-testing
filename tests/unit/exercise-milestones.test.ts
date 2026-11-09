import { buildExerciseHistory, type HistoryRow } from "@/lib/domain/exercise-history";
import {
  exerciseMilestone,
  nextDistanceMilestone,
  nextDurationMilestone,
  nextRepMilestone,
  nextWeightMilestone,
  type MeasuredMilestone,
} from "@/lib/domain/exercise-milestones";
import { lbToKg } from "@/lib/domain/units";

type Set = Partial<HistoryRow["sets"][number]>;
let n = 0;
function row(date: string, sets: Set[], status = "completed"): HistoryRow {
  n += 1;
  return {
    skipped: false,
    session: { id: `s${n}`, name: "Workout", started_at: `${date}T10:00:00Z`, status },
    sets: sets.map((s, i) => ({ set_number: i + 1, reps: null, weight_kg: null, duration_seconds: null, distance_m: null, is_warmup: false, completed: true, ...s })),
  };
}
const sessions = (rows: HistoryRow[]) => buildExerciseHistory(rows).sessions;
const bench = { slug: "barbell-bench-press", name: "Bench Press" };
const measured = (m: ReturnType<typeof exerciseMilestone>) => {
  if (m.kind === "first") throw new Error("expected a measured milestone");
  return m as MeasuredMilestone;
};

describe("milestone steps", () => {
  it("rounds weight up to the next sensible plate step in the member's units", () => {
    expect(nextWeightMilestone(185, "imperial")).toBe(200);
    expect(nextWeightMilestone(225, "imperial")).toBe(250);
    expect(nextWeightMilestone(315, "imperial")).toBe(325);
    expect(nextWeightMilestone(95, "imperial")).toBe(100);
    expect(nextWeightMilestone(32.5, "imperial")).toBe(35);
    expect(nextWeightMilestone(100, "metric")).toBe(110);
    expect(nextWeightMilestone(62.5, "metric")).toBe(65);
    expect(nextWeightMilestone(12, "metric")).toBe(12.5);
  });
  it("moves on once a milestone is reached exactly", () => {
    expect(nextWeightMilestone(200, "imperial")).toBe(225);
    expect(nextRepMilestone(10)).toBe(12);
    expect(nextDurationMilestone(60)).toBe(90);
    expect(nextDistanceMilestone(5, "km")).toBe(8);
  });
  it("climbs past the end of each ladder", () => {
    expect(nextRepMilestone(100)).toBe(125);
    expect(nextDurationMilestone(3600)).toBe(4500);
    expect(nextDistanceMilestone(42.2, "km")).toBe(45);
    expect(nextDistanceMilestone(26.2, "mi")).toBe(30);
  });
  it("sizes carry and sled distances by how far the member already goes", () => {
    expect(nextDistanceMilestone(35, "yd")).toBe(40);
    expect(nextDistanceMilestone(80, "m")).toBe(100);
    expect(nextDistanceMilestone(220, "m")).toBe(250);
  });
});

describe("exerciseMilestone", () => {
  it("gives a simple first milestone when the exercise was never logged", () => {
    const m = exerciseMilestone([], bench, "imperial");
    expect(m).toEqual({ kind: "first", message: "Log your first working set of Bench Press to set your starting point." });
  });

  it("ignores warm-ups, unfinished sets and unfinished sessions", () => {
    const rows = [
      row("2026-10-01", [{ reps: 5, weight_kg: lbToKg(225), is_warmup: true }, { reps: 5, weight_kg: lbToKg(245), completed: false }]),
      row("2026-10-02", [{ reps: 5, weight_kg: lbToKg(275) }], "in_progress"),
    ];
    expect(exerciseMilestone(sessions(rows), bench, "imperial").kind).toBe("first");
  });

  it("uses the heaviest completed weight, not the estimated one-rep max", () => {
    const rows = [
      row("2026-10-01", [{ reps: 10, weight_kg: lbToKg(165) }]),
      row("2026-10-08", [{ reps: 3, weight_kg: lbToKg(185) }, { reps: 8, weight_kg: lbToKg(175) }]),
    ];
    const m = measured(exerciseMilestone(sessions(rows), bench, "imperial"));
    expect(m).toMatchObject({ kind: "weight", current: 185, target: 200, remaining: 15, unit: "lb", currentLabel: "185 lb", targetLabel: "200 lb", remainingLabel: "15 lb", bestDetail: "× 3 reps" });
    expect(m.bestDate.startsWith("2026-10-08")).toBe(true);
    expect(m.percent).toBeCloseTo(92.5);
    expect(m.message).toBe("You're 15 lb away from your next Bench Press milestone.");
  });

  it("works in kilograms for metric members", () => {
    const m = measured(exerciseMilestone(sessions([row("2026-10-01", [{ reps: 5, weight_kg: 102.5 }])]), bench, "metric"));
    expect(m).toMatchObject({ current: 102.5, target: 110, remaining: 7.5, unit: "kg", remainingLabel: "7.5 kg" });
  });

  it("dates a best to when it was first reached", () => {
    const rows = [row("2026-10-01", [{ reps: 5, weight_kg: lbToKg(185) }]), row("2026-10-15", [{ reps: 2, weight_kg: lbToKg(185) }])];
    expect(measured(exerciseMilestone(sessions(rows), bench, "imperial")).bestDate.startsWith("2026-10-01")).toBe(true);
  });

  it("counts reps for bodyweight exercises", () => {
    const m = measured(exerciseMilestone(sessions([row("2026-10-01", [{ reps: 8 }, { reps: 10 }, { reps: 7 }])]), { slug: "push-up", name: "Push-Up" }, "imperial"));
    expect(m).toMatchObject({ kind: "reps", current: 10, target: 12, remaining: 2, currentLabel: "10 reps", targetLabel: "12 reps" });
    expect(m.message).toBe("Only 2 more reps to reach your next target.");
    const one = measured(exerciseMilestone(sessions([row("2026-10-01", [{ reps: 11 }])]), { slug: "push-up", name: "Push-Up" }, "imperial"));
    expect(one.message).toBe("Only 1 more rep to reach your next target.");
  });

  it("times holds", () => {
    const m = measured(exerciseMilestone(sessions([row("2026-10-01", [{ duration_seconds: 52 }])]), { slug: "plank", name: "Plank" }, "metric"));
    expect(m).toMatchObject({ kind: "duration", current: 52, target: 60, remaining: 8, currentLabel: "0:52", targetLabel: "1:00", remainingLabel: "0:08" });
    expect(m.message).toBe("Hold 0:08 longer to reach your next target.");
  });

  it("measures loaded carries by distance in the logger's unit, with the load as context", () => {
    const m = measured(exerciseMilestone(sessions([row("2026-10-01", [{ distance_m: 36.6, weight_kg: lbToKg(70) }])]), { slug: "farmers-carry", name: "Farmer's Carry" }, "imperial"));
    expect(m).toMatchObject({ kind: "distance", current: 40, unit: "yd", target: 50, remaining: 10, bestDetail: "with 70 lb" });
  });

  it("measures cardio by distance in km or miles", () => {
    const m = measured(exerciseMilestone(sessions([row("2026-10-01", [{ distance_m: 4200, duration_seconds: 1500 }])]), { slug: "zone-2-run", name: "Easy Zone 2 Run" }, "metric"));
    expect(m).toMatchObject({ kind: "distance", current: 4.2, unit: "km", target: 5, remainingLabel: "0.8 km" });
  });

  it("uses only the sessions it is given, so exercises never mix", () => {
    const squatRows = [row("2026-10-01", [{ reps: 5, weight_kg: lbToKg(315) }])];
    const benchRows = [row("2026-10-01", [{ reps: 5, weight_kg: lbToKg(185) }])];
    expect(measured(exerciseMilestone(sessions(benchRows), bench, "imperial")).current).toBe(185);
    expect(measured(exerciseMilestone(sessions(squatRows), { slug: "back-squat", name: "Back Squat" }, "imperial")).current).toBe(315);
  });

  it("updates the next milestone as soon as a new best is logged", () => {
    const before = [row("2026-10-01", [{ reps: 5, weight_kg: lbToKg(195) }])];
    const after = [...before, row("2026-10-08", [{ reps: 1, weight_kg: lbToKg(200) }])];
    expect(measured(exerciseMilestone(sessions(before), bench, "imperial")).target).toBe(200);
    expect(measured(exerciseMilestone(sessions(after), bench, "imperial"))).toMatchObject({ current: 200, target: 225 });
  });
});
