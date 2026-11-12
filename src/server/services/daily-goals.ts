import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { faithChallengeFor, type FaithChallenge } from "@/data/faith-challenges";
import { parseReference } from "@/lib/bible/reference";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { passageParts, passageText } from "@/server/bible/text";
import type { TextPart } from "@/lib/bible/red-letter";
import { loadProgramSchedule } from "@/server/services/schedule";

/*
 * The two optional daily goals beside the journey's required reading and prayer. Both are tracked on their own
 * (faith_daily_goals) and never touch the journey: missing them never restarts anything. The fitness goal only reads
 * the member's training program; it never changes the program or its schedule.
 */

export interface FitnessToday {
  /** "workout": the program has a session today; "rest": a program day off; "none": no active program. */
  kind: "workout" | "rest" | "none";
  programName: string | null;
  sessionName: string | null;
  minutes: number | null;
  /** A workout was completed today (from the training log). */
  workoutDone: boolean;
  /** The member ticked it themselves (rest honoured, or training done away from the app). */
  marked: boolean;
}

export interface DailyGoals {
  today: string;
  challenge: FaithChallenge & { verseText: string | null; verseParts: TextPart[] | null; done: boolean };
  fitness: FitnessToday;
}

export async function loadDailyGoals(supabase: SupabaseClient, userId: string, timezone: string): Promise<DailyGoals> {
  const today = isoDateInTz(new Date(), timezone);
  const challenge = faithChallengeFor(today);
  const ref = parseReference(challenge.reference);
  const since = `${addDays(today, -1)}T00:00:00Z`;
  const [goalsRes, schedule, workoutsRes] = await Promise.all([
    supabase.from("faith_daily_goals").select("kind").eq("user_id", userId).eq("goal_date", today),
    loadProgramSchedule(supabase, userId, timezone).catch(() => null),
    supabase.from("workout_sessions").select("started_at").eq("user_id", userId).eq("status", "completed").gte("started_at", since).limit(20),
  ]);
  const kinds = new Set((goalsRes.data ?? []).map((g) => g.kind as string));
  const workoutDone = (workoutsRes.data ?? []).some((w) => isoDateInTz(new Date(w.started_at as string), timezone) === today);
  const session = schedule?.planned.find((p) => p.date === today) ?? null;
  return {
    today,
    challenge: { ...challenge, verseText: ref ? passageText(ref) : null, verseParts: ref ? passageParts(ref) : null, done: kinds.has("faith_challenge") },
    fitness: {
      kind: !schedule ? "none" : session ? "workout" : "rest",
      programName: schedule?.programName ?? null,
      sessionName: session?.name ?? null,
      minutes: session?.minutes ?? null,
      workoutDone,
      marked: kinds.has("fitness"),
    },
  };
}
