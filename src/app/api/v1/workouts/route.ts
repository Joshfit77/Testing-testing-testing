import type { NextRequest } from "next/server";
import { finishWorkoutSchema } from "@/lib/validation/schemas";
import { authenticateRequest } from "@/server/api-auth";
import { apiError, apiOk } from "@/server/api-response";
import { finishWorkout, listHistory, WorkoutError } from "@/server/services/workouts";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";

/** GET /api/v1/workouts?before=<iso>&limit=<n> — completed workout history (newest first). */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return apiError(401, auth.error);
  const before = request.nextUrl.searchParams.get("before") ?? undefined;
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 30));
  try {
    return apiOk(await listHistory(auth.supabase, auth.user.id, limit, before && !Number.isNaN(Date.parse(before)) ? new Date(before).toISOString() : undefined));
  } catch (err) {
    logError("api.workouts.list", err);
    return apiError(500, "server_error");
  }
}

/** POST /api/v1/workouts — complete a workout (idempotent by clientId). Body: FinishWorkoutInput. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return apiError(auth.error === "unauthorized" ? 401 : 403, auth.error);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json");
  }
  const parsed = finishWorkoutSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "invalid_request", parsed.error.issues[0]?.message);
  try {
    const res = await finishWorkout(auth.supabase, auth.user.id, parsed.data);
    return apiOk(res, res.alreadyCompleted ? 200 : 201);
  } catch (err) {
    if (err instanceof WorkoutError && err.code === "invalid") return apiError(422, "invalid_reference");
    logError("api.workouts.finish", err);
    return apiError(500, "server_error");
  }
}
