"use server";

import { z } from "zod";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import {
  ACTIVITY_KIND_LABELS,
  formatDistance,
  formatPace,
  localToUtcIso,
  MAX_DISTANCE_M,
  MAX_ELAPSED_S,
  MAX_NOTES,
  paceSecondsPer,
  parseDuration,
  toMeters,
} from "@/lib/domain/activities";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

/*
 * No revalidatePath here (see IMPLEMENTATION_STATUS.md, "Loading boundaries"): the Run pages are
 * dynamic, and the client calls router.refresh() / router.push() after a successful save or delete.
 */

const blank = (v: unknown) => (v === "" || v === null ? undefined : v);
const durationField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}`)
    .transform((s, ctx) => {
      const secs = parseDuration(s);
      if (secs == null) {
        ctx.addIssue({ code: "custom", message: "Use h:mm:ss, mm:ss or minutes" });
        return z.NEVER;
      }
      if (secs < 1) {
        ctx.addIssue({ code: "custom", message: `The ${label} must be more than zero` });
        return z.NEVER;
      }
      if (secs > MAX_ELAPSED_S) {
        ctx.addIssue({ code: "custom", message: "That's longer than 48 hours" });
        return z.NEVER;
      }
      return secs;
    });

const activitySchema = z
  .object({
    id: z.string().uuid("Invalid activity id"),
    kind: z.enum(["run", "walk"], { error: "Choose run or walk" }),
    source: z.enum(["manual", "treadmill"], { error: "Choose outdoor (manual) or treadmill" }),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
    unit: z.enum(["mi", "km"]),
    distance: z.preprocess(
      blank,
      z.coerce.number({ error: "Enter a distance" }).gt(0, "Distance must be more than zero").optional(),
    ),
    duration: durationField("duration"),
    moving: z.preprocess(blank, durationField("moving time").optional()),
    effort: z.preprocess(blank, z.coerce.number().int("Pick 1–10").min(1, "Pick 1–10").max(10, "Pick 1–10").optional()),
    notes: z.preprocess(blank, z.string().trim().max(MAX_NOTES, `Keep notes under ${MAX_NOTES} characters`).optional()),
  })
  .superRefine((v, ctx) => {
    if (v.source === "treadmill" && v.distance === undefined) {
      ctx.addIssue({ code: "custom", path: ["distance"], message: "Enter the distance from the treadmill display" });
    }
    if (v.distance !== undefined && toMeters(v.distance, v.unit) > MAX_DISTANCE_M) {
      ctx.addIssue({ code: "custom", path: ["distance"], message: "That distance is too long to log" });
    }
    if (v.moving !== undefined && v.moving > v.duration) {
      ctx.addIssue({ code: "custom", path: ["moving"], message: "Moving time can't be longer than the total duration" });
    }
  });

function formToObject(fd: FormData) {
  const keys = ["id", "kind", "source", "date", "time", "unit", "distance", "duration", "moving", "effort", "notes"];
  return Object.fromEntries(keys.map((k) => [k, fd.get(k) ?? undefined]));
}

/** Rows saved by this action. Route and splits stay null: a manual entry never has a route. */
function toRow(v: z.infer<typeof activitySchema>, startedAt: string, timezone: string) {
  return {
    kind: v.kind,
    source: v.source,
    started_at: startedAt,
    timezone,
    distance_m: v.distance === undefined ? null : toMeters(v.distance, v.unit),
    elapsed_s: v.duration,
    moving_s: v.moving ?? v.duration,
    perceived_effort: v.effort ?? null,
    notes: v.notes ?? null,
    route: null,
    splits: null,
  };
}

function summary(row: ReturnType<typeof toRow>, unit: "mi" | "km"): string {
  const pace = paceSecondsPer(row.distance_m, row.moving_s, unit);
  const dist = row.distance_m == null ? "" : ` · ${formatDistance(row.distance_m, unit)}`;
  return `${ACTIVITY_KIND_LABELS[row.kind]} saved${dist}${pace ? ` · ${formatPace(pace, unit)}` : ""}.`;
}

async function parse(formData: FormData) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const timezone = profile?.timezone || "UTC";
  const parsed = activitySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { user, error: actionInvalid(parsed.error) } as const;
  const startedAt = localToUtcIso(parsed.data.date, parsed.data.time, timezone);
  if (!startedAt) return { user, error: actionError("Please fix the highlighted fields.", { date: "Pick a valid date and time" }) } as const;
  // A few minutes of slack for clock differences between phone and server.
  if (Date.parse(startedAt) > Date.now() + 10 * 60_000) {
    return { user, error: actionError("Please fix the highlighted fields.", { date: "That start time is in the future" }) } as const;
  }
  if (Date.parse(startedAt) < Date.now() - 5 * 365 * 86_400_000) {
    return { user, error: actionError("Please fix the highlighted fields.", { date: "Pick a date within the last five years" }) } as const;
  }
  return { user, data: parsed.data, row: toRow(parsed.data, startedAt, timezone) } as const;
}

/**
 * Log a run or walk by hand. The form supplies a client-generated id (the stable activity id),
 * so a double submit or a retry after a dropped response saves the activity once.
 */
export async function createActivityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const res = await parse(formData);
  if ("error" in res) return res.error!;
  const { user, data, row } = res;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("activities").insert({ id: data.id, user_id: user.id, ...row });
  if (error) {
    if (error.code === "23505") {
      // Same id already saved by this user (a repeated submit): treat as success.
      const { data: existing } = await supabase.from("activities").select("id").eq("id", data.id).eq("user_id", user.id).maybeSingle();
      if (existing) return actionOk(summary(row, data.unit));
    }
    logError("activities.create", error);
    return actionError("Couldn't save this activity. Please try again.");
  }
  return actionOk(summary(row, data.unit));
}

/** Edit a manual or treadmill activity. GPS recordings keep their source; this form can't edit them. */
export async function updateActivityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const res = await parse(formData);
  if ("error" in res) return res.error!;
  const { user, data, row } = res;
  const supabase = await getServerSupabase();
  const { data: updated, error } = await supabase
    .from("activities")
    .update(row)
    .eq("id", data.id)
    .eq("user_id", user.id)
    .in("source", ["manual", "treadmill"])
    .is("deleted_at", null)
    .select("id");
  if (error) {
    logError("activities.update", error);
    return actionError("Couldn't save your changes. Please try again.");
  }
  if (!updated?.length) return actionError("This activity no longer exists.");
  return actionOk(summary(row, data.unit).replace("saved", "updated"));
}

/**
 * Soft-delete an activity. Weekly totals and records are derived from live rows, so they recalculate. The GPS route,
 * splits and signal summary are removed at the same time: a deleted run's track (where the member was) must not stay
 * on the server or turn up in a later export.
 */
export async function deleteActivityAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(id).success) return actionError("Invalid activity.");
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("activities")
    .update({ deleted_at: new Date().toISOString(), route: null, splits: null, gps_quality: null })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    logError("activities.delete", error);
    return actionError("Couldn't delete this activity. Please try again.");
  }
  if (!data?.length) return actionError("This activity was already deleted.");
  return actionOk("Activity deleted.");
}
