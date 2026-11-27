import { REPEAT_REST_SECONDS, repeatFromSession, type RepeatSource } from "@/lib/domain/workout-templates";

/** "Do this workout again": same exercises and order, the working sets done, no invented weights. */
const set = (n: number, o: Partial<RepeatSource["exercises"][number]["sets"][number]> = {}) => ({
  set_number: n,
  reps: 8,
  duration_seconds: null,
  distance_m: null,
  is_warmup: false,
  is_drop: false,
  completed: true,
  ...o,
});
const ex = (position: number, id: string, o: Partial<RepeatSource["exercises"][number]> = {}) => ({
  position,
  skipped: false,
  exercise: { id, slug: id, name: id, is_timed: false },
  sets: [set(1), set(2), set(3)],
  ...o,
});

describe("repeat a workout", () => {
  it("keeps the order and the planned working sets (not warm-ups or drops), aiming at the first done set's reps", () => {
    const r = repeatFromSession({
      name: "Push day",
      exercises: [
        ex(1, "curl", { sets: [set(1, { reps: 12 }), set(2, { reps: 10 }), set(3, { is_drop: true, reps: 6 })] }),
        ex(0, "bench", { sets: [set(1, { is_warmup: true, reps: 10 }), set(2, { reps: 5 }), set(3, { reps: 5 }), set(4, { reps: 5, completed: false })] }),
      ],
    });
    expect(r.name).toBe("Push day");
    expect(r.exercises.map((e) => e.exercise.id)).toEqual(["bench", "curl"]);
    expect(r.exercises[0]!.target).toEqual({ sets: 3, reps: "5", seconds: null, distanceM: null });
    expect(r.exercises[1]!.target).toEqual({ sets: 2, reps: "12", seconds: null, distanceM: null });
    expect(r.exercises.every((e) => e.restSeconds === REPEAT_REST_SECONDS)).toBe(true);
    // Nothing about weight: the logger fills it from the member's own last time.
    expect(JSON.stringify(r)).not.toMatch(/weight/i);
  });

  it("leaves skipped exercises out and keeps timed and distance targets", () => {
    const r = repeatFromSession({
      name: "",
      exercises: [
        ex(0, "plank", { exercise: { id: "plank", slug: "plank", name: "Plank", is_timed: true }, sets: [set(1, { reps: null, duration_seconds: 45 })] }),
        ex(1, "skipped-one", { skipped: true }),
        ex(2, "farmers-carry", { sets: [set(1, { reps: null, distance_m: "40" })] }),
      ],
    });
    expect(r.name).toBe("My workout");
    expect(r.exercises.map((e) => e.exercise.id)).toEqual(["plank", "farmers-carry"]);
    expect(r.exercises[0]!.target).toEqual({ sets: 1, reps: null, seconds: 45, distanceM: null });
    expect(r.exercises[1]!.target.distanceM).toBe(40);
  });

  it("a workout finished early, or with nothing completed, repeats with its planned sets (at least one)", () => {
    const r = repeatFromSession({ name: "X", exercises: [ex(0, "row", { sets: [set(1, { completed: false }), set(2, { completed: false })] }), ex(1, "empty", { sets: [] })] });
    expect(r.exercises[0]!.target.sets).toBe(2);
    expect(r.exercises[1]!.target).toEqual({ sets: 1, reps: null, seconds: null, distanceM: null });
  });
});
