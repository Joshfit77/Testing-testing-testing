"use server";

import { z } from "zod";
import { MAX_DISTANCE_M, MAX_ELAPSED_S, MAX_NOTES } from "@/lib/domain/activities";
import { haversine, MAX_SPEED_MS } from "@/lib/domain/gps-track";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { finishWorkout } from "@/server/services/workouts";

type Result = { ok: true; id: string; message: string } | { ok: false; error: string };

const coord = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const gpsActivitySchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["run", "walk"]),
  startedAt: z.number().int().positive(),
  finishedAt: z.number().int().positive(),
  distanceM: z.number().min(0).max(MAX_DISTANCE_M),
  elapsedS: z.number().int().min(1).max(MAX_ELAPSED_S),
  movingS: z.number().int().min(1).max(MAX_ELAPSED_S),
  splits: z
    .array(z.object({ index: z.number().int().min(1).max(600), unit: z.enum(["mi", "km"]), distance_m: z.number().min(0), moving_s: z.number().int().min(0), elapsed_s: z.number().int().min(0), split_s: z.number().int().min(0) }))
    .max(600),
  route: z.object({ type: z.literal("MultiLineString"), coordinates: z.array(z.array(coord).min(2).max(2000)).min(1).max(200) }).nullable(),
  gpsQuality: z.object({
    gaps: z.number().int().min(0).max(10_000),
    rejected: z.number().int().min(0).max(1_000_000),
    lastAccuracy: z.number().min(0).max(10_000).nullable(),
    /** Straight-line distance across signal gaps that was not counted (m), shown with the activity. */
    uncountedGapM: z.number().int().min(0).max(1_000_000).optional(),
  }),
  effort: z.number().int().min(1).max(10).nullable(),
  notes: z.string().trim().max(MAX_NOTES).nullable(),
  /** A guided run from the member's program: the work sets completed per prescribed exercise. */
  program: z.object({ userProgramId: z.string().uuid(), programDayId: z.string().uuid(), completedSets: z.array(z.number().int().min(0).max(50)).max(20) }).nullable(),
});

function routeLength(route: { coordinates: [number, number][][] }): number {
  let m = 0;
  for (const line of route.coordinates) for (let i = 1; i < line.length; i++) m += haversine({ lng: line[i - 1]![0], lat: line[i - 1]![1] }, { lng: line[i]![0], lat: line[i]![1] });
  return m;
}

/**
 * Save a GPS run or walk recorded on this device. Idempotent: the id is generated when recording starts, so a retry
 * after a dropped connection (or a double tap) saves it once. Routes are private. Everything is checked again here:
 * sizes, times and that the speed and route are physically consistent.
 */
export async function saveGpsActivityAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = gpsActivitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "This recording couldn't be read. Please try saving again." };
  const v = parsed.data;
  const now = Date.now();
  if (v.startedAt > now + 10 * 60_000 || v.startedAt < now - 2 * 86_400_000) return { ok: false, error: "This recording's start time doesn't look right, so it wasn't saved." };
  if (v.finishedAt < v.startedAt || v.movingS > v.elapsedS) return { ok: false, error: "This recording's times don't add up, so it wasn't saved." };
  if (v.distanceM / v.movingS > MAX_SPEED_MS[v.kind] * 1.1) return { ok: false, error: "That speed isn't possible on foot, so it wasn't saved." };
  const points = v.route?.coordinates.reduce((n, l) => n + l.length, 0) ?? 0;
  if (points > 2000) return { ok: false, error: "The route is too large to save." };
  if (v.route && routeLength(v.route) > v.distanceM * 1.2 + 100) return { ok: false, error: "The route and distance don't match, so it wasn't saved." };

  const supabase = await getServerSupabase();
  const profile = await getProfile(user.id);
  const row = {
    id: v.id,
    user_id: user.id,
    kind: v.kind,
    source: "gps" as const,
    started_at: new Date(v.startedAt).toISOString(),
    timezone: profile?.timezone || "UTC",
    distance_m: Math.round(v.distanceM * 10) / 10,
    elapsed_s: v.elapsedS,
    moving_s: v.movingS,
    route: v.route,
    splits: v.splits,
    gps_quality: v.gpsQuality,
    perceived_effort: v.effort,
    notes: v.notes || null,
    is_private: true,
  };
  const { error } = await supabase.from("activities").insert(row);
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase.from("activities").select("id").eq("id", v.id).eq("user_id", user.id).maybeSingle();
      if (existing) return { ok: true, id: v.id, message: "Already saved." };
    }
    logError("gps.save", error);
    return { ok: false, error: "Couldn't save this recording. It's still on this device: try again." };
  }

  let programNote = "";
  if (v.program && v.program.completedSets.some((n) => n > 0)) {
    try {
      programNote = await logProgramRun(supabase, user.id, v, row.distance_m);
    } catch (err) {
      // The run itself is saved; only the program link failed.
      logError("gps.program_link", err);
      programNote = " It couldn't be marked against your program; log the session from Train if you want it to count.";
    }
  }
  return { ok: true, id: v.id, message: `Saved.${programNote}` };
}

/** Mark the program day done with the work sets the member actually completed during the guided run. */
async function logProgramRun(supabase: Awaited<ReturnType<typeof getServerSupabase>>, userId: string, v: z.infer<typeof gpsActivitySchema>, distanceM: number): Promise<string> {
  const program = v.program!;
  const { data: up } = await supabase.from("user_programs").select("id").eq("id", program.userProgramId).eq("user_id", userId).maybeSingle();
  if (!up) return "";
  const { data: day } = await supabase.from("program_days").select("name").eq("id", program.programDayId).maybeSingle();
  const { data: rows } = await supabase.from("program_exercises").select("exercise_id, sets, duration_seconds, position").eq("day_id", program.programDayId).order("position");
  if (!day || !rows?.length) return "";
  const exercises = rows.map((r, i) => {
    const done = Math.min(program.completedSets[i] ?? 0, Number(r.sets));
    return {
      exerciseId: r.exercise_id as string,
      substitutedFromId: null,
      notes: "",
      skipped: done === 0,
      skipReason: done === 0 ? ("time" as const) : null,
      sets: Array.from({ length: done }, () => ({ reps: null, weightKg: null, durationSeconds: (r.duration_seconds as number | null) ?? null, distanceM: null, rpe: null, isWarmup: false, completed: true })),
    };
  });
  const res = await finishWorkout(supabase, userId, {
    clientId: v.id,
    name: (day.name as string).slice(0, 120),
    userProgramId: program.userProgramId,
    programDayId: program.programDayId,
    startedAt: new Date(v.startedAt).toISOString(),
    endedAt: new Date(v.finishedAt).toISOString(),
    pausedSeconds: v.elapsedS - v.movingS,
    notes: `Recorded with GPS: ${(distanceM / 1000).toFixed(2)} km.`,
    exercises,
  });
  await supabase.from("activities").update({ workout_session_id: res.sessionId }).eq("id", v.id).eq("user_id", userId);
  return ` ${day.name as string} is marked done in your program.`;
}

const goalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("weekly_distance"), distance: z.number().positive().max(1000), unit: z.enum(["mi", "km"]) }),
  z.object({ kind: z.literal("monthly_distance"), distance: z.number().positive().max(5000), unit: z.enum(["mi", "km"]) }),
  z.object({ kind: z.literal("race_time"), raceMeters: z.number().positive().max(100_000), targetSeconds: z.number().int().min(60).max(172_800) }),
]);

export async function addRunningGoalAction(input: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the goal and try again." };
  const g = parsed.data;
  const supabase = await getServerSupabase();
  const meters = g.kind === "race_time" ? g.raceMeters : g.distance * (g.unit === "mi" ? 1609.344 : 1000);
  const { error } = await supabase.from("running_goals").insert({ user_id: user.id, kind: g.kind, distance_m: Math.round(meters * 10) / 10, target_s: g.kind === "race_time" ? g.targetSeconds : null });
  if (error) {
    if (error.message.includes("running_goal_limit")) return { ok: false, error: "You can have up to 10 goals. Remove one first." };
    logError("gps.goal_add", error);
    return { ok: false, error: "Couldn't save the goal. Please try again." };
  }
  return { ok: true, message: "Goal added." };
}

export async function removeRunningGoalAction(id: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Goal not found." };
  const supabase = await getServerSupabase();
  const { error, count } = await supabase.from("running_goals").delete({ count: "exact" }).eq("id", id).eq("user_id", user.id);
  if (error || !count) return { ok: false, error: "Goal not found." };
  return { ok: true, message: "Goal removed." };
}
