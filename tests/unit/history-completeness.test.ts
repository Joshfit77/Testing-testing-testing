import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, startOfWeek } from "@/lib/domain/dates";
import { dailyStreak, streakNeedsOlderHistory, weeklyStreak } from "@/lib/domain/streak";
import { fakeSupabase, hasFilter, type FakeCall } from "./fixtures/fake-supabase";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));
const db: { client: unknown } = { client: null };
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: async () => db.client }));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: "user-1" }), getProfile: async () => ({ unit_system: "metric", timezone: "UTC" }) }));

const { streakDates } = await import("@/server/services/dashboard");
const { getPersonalBests } = await import("@/server/services/progress");
const { deleteWorkout, WorkoutError } = await import("@/server/services/workouts");
const { deleteMeasurementAction, deleteWeightAction } = await import("@/server/actions/progress");

const today = "2026-11-11";
const since = addDays(today, -120);
const at = (date: string) => `${date}T12:00:00Z`;

describe("streaks over a long history", () => {
  it("knows when older history could still lengthen the streak", () => {
    const loadedFrom = addDays(since, 1);
    expect(streakNeedsOlderHistory([], today, loadedFrom)).toBe(false);
    expect(streakNeedsOlderHistory([today, addDays(today, -7)], today, loadedFrom)).toBe(false); // ended by an empty week
    const everyWeek = Array.from({ length: 18 }, (_, i) => addDays(today, -7 * i));
    expect(streakNeedsOlderHistory(everyWeek, today, loadedFrom)).toBe(true);
    expect(streakNeedsOlderHistory(everyWeek.slice(1), today, loadedFrom)).toBe(true); // nothing yet this week
  });

  it("asks for nothing more when the streak ends inside the loaded 120 days", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: [] }));
    const recent = [today, addDays(today, -1)];
    expect(await streakDates(client, "user-1", "UTC", today, since, recent)).toEqual(recent);
    expect(calls).toHaveLength(0);
  });

  it("counts a 40-week / 200-day streak by paging older session times until the streak ends", async () => {
    // Trained every day for 200 days, then a 30-day break, then 1,500 older sessions that must never be read in full.
    const older = [
      ...Array.from({ length: 200 - 120 }, (_, i) => addDays(since, -1 - i)),
      ...Array.from({ length: 1500 }, (_, i) => addDays(since, -(200 - 120) - 30 - i)),
    ];
    const { client, calls } = fakeSupabase((c) => ({ data: older.slice(c.range![0], c.range![1] + 1).map((d) => ({ started_at: at(d) })) }));
    const recent = Array.from({ length: 121 }, (_, i) => addDays(today, -i));
    const dates = await streakDates(client, "user-1", "UTC", today, since, recent);
    expect(dailyStreak(dates, today)).toBe(201);
    expect(weeklyStreak(dates, today, 1)).toBe(Math.round((Date.parse(startOfWeek(today)) - Date.parse(startOfWeek(addDays(today, -200)))) / 604_800_000) + 1);
    expect(calls).toHaveLength(1); // the gap is inside the first older page, so the remaining history isn't loaded
    expect(hasFilter(calls[0]!, "eq", "user_id", "user-1")).toBe(true);
    expect(hasFilter(calls[0]!, "eq", "status", "completed")).toBe(true);
    expect(hasFilter(calls[0]!, "lt", "started_at", `${since}T00:00:00Z`)).toBe(true);
  });

  it("keeps the 120-day figures when the older read fails", async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: { message: "boom" } }));
    const recent = Array.from({ length: 121 }, (_, i) => addDays(today, -i));
    expect(await streakDates(client, "user-1", "UTC", today, since, recent)).toEqual(recent);
  });
});

describe("personal bests table", () => {
  it("reads every record page, so exercises older than the newest 1,000 rows stay in the table", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      exercise_id: i === 1000 ? "old-lift" : "bench",
      record_type: "max_weight",
      value: i === 1000 ? 60 : 100 + (i % 5),
      achieved_at: new Date(Date.UTC(2026, 10, 1) - i * 3_600_000).toISOString(),
      exercise: i === 1000 ? { name: "Old lift", slug: "old-lift" } : { name: "Bench press", slug: "bench-press" },
    }));
    const { client, calls } = fakeSupabase((c) => ({ data: rows.slice(c.range![0], c.range![1] + 1) }));
    const bests = await getPersonalBests(client, "user-1");
    expect(calls.map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(bests.map((b) => b.slug)).toEqual(["bench-press", "old-lift"]);
    expect(bests[0]!.maxWeight).toBe(104);
    expect(bests[1]!.maxWeight).toBe(60);
  });
});

describe("deleting a workout", () => {
  const SESSION = "11111111-1111-4111-8111-111111111111";
  const describeCall = (c: FakeCall) => `${c.op} ${c.table}`;

  it("removes the workout's records before the workout, then rebuilds the affected exercises", async () => {
    const { client, calls } = fakeSupabase((c) => {
      if (c.table === "workout_exercises" && hasFilter(c, "eq", "session_id", SESSION)) return { data: [{ exercise_id: "bench" }] };
      if (c.table === "personal_records" && c.op === "select") return { data: [{ exercise_id: "bench" }, { exercise_id: "squat" }] };
      if (c.table === "workout_sessions" && c.op === "delete") return { count: 1 };
      return { data: [] };
    });
    await deleteWorkout(client, "user-1", SESSION);
    const order = calls.map(describeCall);
    const prDelete = calls.findIndex((c) => c.table === "personal_records" && c.op === "delete" && hasFilter(c, "eq", "session_id", SESSION));
    const sessionDelete = order.indexOf("delete workout_sessions");
    expect(prDelete).toBeGreaterThan(-1);
    expect(prDelete).toBeLessThan(sessionDelete);
    expect(hasFilter(calls[prDelete]!, "eq", "user_id", "user-1")).toBe(true);
    // The rebuild reads both exercises: the one in the workout and the one only its records pointed at.
    const rebuildRead = calls.slice(sessionDelete + 1).find((c) => c.table === "workout_exercises");
    expect(rebuildRead!.filters.find((f) => f[0] === "in")![2]).toEqual(["bench", "squat"]);
  });

  it("still rebuilds records left without a workout when the workout is already gone (a retry), then reports not found", async () => {
    const { client, calls } = fakeSupabase((c) => {
      if (c.table === "personal_records" && c.op === "select" && hasFilter(c, "is", "session_id", null)) return { data: [{ exercise_id: "deadlift" }] };
      if (c.table === "workout_sessions" && c.op === "delete") return { count: 0 };
      return { data: [] };
    });
    const err = await deleteWorkout(client, "user-1", SESSION).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WorkoutError);
    expect((err as InstanceType<typeof WorkoutError>).code).toBe("not_found");
    const rebuildDelete = calls.find((c) => c.table === "personal_records" && c.op === "delete");
    expect(rebuildDelete!.filters.find((f) => f[0] === "in")![2]).toEqual(["deadlift"]);
  });

  it("stops before deleting the workout when its records can't be removed", async () => {
    const { client, calls } = fakeSupabase((c) => {
      if (c.table === "personal_records" && c.op === "select") return { data: [{ exercise_id: "bench" }] };
      if (c.table === "personal_records" && c.op === "delete") return { error: { message: "nope" } };
      return { data: [] };
    });
    await expect(deleteWorkout(client, "user-1", SESSION)).rejects.toBeInstanceOf(WorkoutError);
    expect(calls.some((c) => c.table === "workout_sessions")).toBe(false);
  });
});

describe("deleting progress entries", () => {
  const ID = "22222222-2222-4222-8222-222222222222";
  const form = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    return fd;
  };
  let calls: FakeCall[] = [];
  const use = (error: unknown = null) => {
    const fake = fakeSupabase(() => ({ error }));
    db.client = fake.client;
    calls = fake.calls;
  };
  beforeEach(() => use());

  it("deletes a measurement entry only for the signed-in member", async () => {
    expect(await deleteMeasurementAction(form(ID))).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.table).toBe("measurement_entries");
    expect(calls[0]!.op).toBe("delete");
    expect(hasFilter(calls[0]!, "eq", "id", ID)).toBe(true);
    expect(hasFilter(calls[0]!, "eq", "user_id", "user-1")).toBe(true);
  });

  it("rejects a malformed id without touching the database", async () => {
    expect((await deleteMeasurementAction(form("not-a-uuid"))).ok).toBe(false);
    expect((await deleteWeightAction(form(""))).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("reports a database error instead of looking successful", async () => {
    use({ message: "connection reset" });
    expect(await deleteMeasurementAction(form(ID))).toEqual({ ok: false, error: "Couldn't delete those measurements. Please try again." });
    expect(await deleteWeightAction(form(ID))).toEqual({ ok: false, error: "Couldn't delete that weight entry. Please try again." });
  });
});
