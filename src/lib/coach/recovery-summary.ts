/**
 * Deterministic recovery summary for the AI coach (get_recovery_summary): recovery check-ins, logged sleep and
 * training load, each with how many entries it rests on. Descriptive only: not a diagnosis and not a prediction.
 * Pure (no I/O).
 */
import { addDays } from "@/lib/domain/dates";
import { inRange, isHardSet, mean, r1, summarizeCheckins, summarizeSleepNights, type AnalysisSet, type CheckinInput, type Finding, type SleepNightInput } from "./lift-analysis";

export interface LoadSession {
  date: string;
  /** All completed, non-warm-up sets of the session. */
  sets: AnalysisSet[];
}

export interface RecoverySummaryInput {
  today: string;
  days: number;
  checkins: CheckinInput[];
  /** null = sleep not available (wellness data not allowed). */
  sleep: SleepNightInput[] | null;
  sleepGoalMinutes: number;
  /** Completed workouts from at least the last max(days, 28) days. */
  sessions: LoadSession[];
}

/** Acute:chronic needs sessions in at least this many of the last 4 rolling weeks. */
export const ACWR_MIN_WEEKS = 3;

export function summarizeRecovery(input: RecoverySummaryInput) {
  const { today, days } = input;
  const start = addDays(today, -(days - 1));
  const mid = addDays(start, Math.floor(days / 2));

  // Check-ins: averages over the window and readiness in the older vs newer half.
  const checkins = summarizeCheckins(input.checkins, start, today);
  let readinessTrend = null as null | Record<string, unknown>;
  if (checkins) {
    const older = input.checkins.filter((c) => inRange(c.date, start, addDays(mid, -1)));
    const newer = input.checkins.filter((c) => inRange(c.date, mid, today));
    if (older.length >= 2 && newer.length >= 2) {
      const a = mean(older.map((c) => c.readiness))!;
      const b = mean(newer.map((c) => c.readiness))!;
      const delta = Math.round(b - a);
      readinessTrend = { older_half_avg: r1(a), older_checkins: older.length, newer_half_avg: r1(b), newer_checkins: newer.length, change: delta, direction: delta >= 5 ? "higher" : delta <= -5 ? "lower" : "similar" };
    }
  }
  const latest = [...input.checkins].filter((c) => c.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];

  // Sleep, labelled by where each night came from.
  const sleepCounts = summarizeSleepNights(input.sleep, start, today);
  const sleep =
    sleepCounts == null
      ? { available: false as const, note: "Sleep logging isn't switched on (optional wellness data)." }
      : {
          available: true as const,
          ...sleepCounts,
          goal_hours: r1(input.sleepGoalMinutes / 60),
          nights_at_goal: input.sleep!.filter((n) => inRange(n.date, start, today) && n.asleepMinutes >= input.sleepGoalMinutes).length,
          labels: "recorded = from a wearable/health app; self_reported = entered by hand or the sleep timer; in_bed_only = no fell-asleep detail, so 'asleep' is time in bed (an estimate)",
        };

  // Training load: per week over the window, and acute (7 d) vs chronic (28 d) when there are 3+ weeks of data.
  const sessions = input.sessions.filter((s) => s.date <= today);
  const inWin = sessions.filter((s) => s.date >= start);
  const hardSets = (ss: LoadSession[]) => ss.reduce((a, s) => a + s.sets.filter(isHardSet).length, 0);
  const weeksInWindow = days / 7;
  const rolling = [0, 1, 2, 3].map((k) => sessions.filter((s) => inRange(s.date, addDays(today, -(7 * k + 6)), addDays(today, -7 * k))));
  const weeksWithData = rolling.filter((ss) => ss.length > 0).length;
  const last28 = rolling.flat();
  let acwr = null as null | Record<string, unknown>;
  if (weeksWithData >= ACWR_MIN_WEEKS) {
    const chronicSessions = last28.length / 4;
    const chronicSets = hardSets(last28) / 4;
    acwr = {
      sessions: { last_7_days: rolling[0]!.length, weekly_avg_28_days: r1(chronicSessions), ratio: chronicSessions ? Math.round((rolling[0]!.length / chronicSessions) * 100) / 100 : null },
      hard_sets: { last_7_days: hardSets(rolling[0]!), weekly_avg_28_days: r1(chronicSets), ratio: chronicSets ? Math.round((hardSets(rolling[0]!) / chronicSets) * 100) / 100 : null },
      weeks_with_sessions: weeksWithData,
      how: "Last 7 days ÷ the average week of the last 28 days. It describes a change in load only; it doesn't predict injury.",
    };
  }
  const rpeSets = inWin.flatMap((s) => s.sets).filter((x) => x.rpe != null).length;
  const load = {
    sessions: inWin.length,
    sessions_per_week: r1(inWin.length / weeksInWindow),
    hard_sets_per_week: r1(hardSets(inWin) / weeksInWindow),
    sets_with_rpe: rpeSets,
    acute_chronic: acwr,
    hard_set_definition: "completed, non-warm-up sets; a set logged below RPE 6 is not counted",
  };

  // Neutral observations from fixed rules (no judgement of health).
  const observations: Finding[] = [];
  if (readinessTrend && readinessTrend.direction !== "similar") {
    observations.push({ id: `readiness_${readinessTrend.direction}`, evidence: `Average readiness ${readinessTrend.older_half_avg} (${readinessTrend.older_checkins} check-ins) → ${readinessTrend.newer_half_avg} (${readinessTrend.newer_checkins} check-ins) in the second half of the window.` });
  }
  if (sleep.available && sleep.nights >= 5 && sleep.avg_asleep_hours != null && sleep.avg_asleep_hours < 7) {
    observations.push({ id: "short_sleep", evidence: `Average ${sleep.avg_asleep_hours} h asleep over ${sleep.nights} logged nights${sleep.in_bed_only_nights ? ` (${sleep.in_bed_only_nights} are time in bed only)` : ""}.` });
  }
  const ratio = (acwr?.hard_sets as { ratio: number | null } | undefined)?.ratio ?? null;
  if (ratio != null && ratio >= 1.3) observations.push({ id: "load_above_usual", evidence: `Hard sets in the last 7 days are ${ratio}× the average week of the last 28 days.` });
  if (ratio != null && ratio <= 0.7) observations.push({ id: "load_below_usual", evidence: `Hard sets in the last 7 days are ${ratio}× the average week of the last 28 days.` });

  const missing: string[] = [];
  if (!checkins) missing.push(`no recovery check-ins in the last ${days} days`);
  else if (!readinessTrend) missing.push("too few check-ins in each half of the window for a readiness trend");
  if (!sleep.available) missing.push("no sleep data (sleep logging isn't switched on)");
  else if (!sleep.nights) missing.push(`no sleep logged in the last ${days} days`);
  else if (sleep.in_bed_only_nights === sleep.nights) missing.push("sleep entries are time in bed only (no fell-asleep detail)");
  if (!inWin.length) missing.push(`no workouts logged in the last ${days} days`);
  if (!acwr) missing.push(`fewer than ${ACWR_MIN_WEEKS} of the last 4 weeks have workouts, so no acute vs chronic load`);
  if (inWin.length && !rpeSets) missing.push("no RPE logged, so every working set counts as hard");

  return {
    not_a_diagnosis: true,
    window: { days, start, end: today },
    checkins: checkins ? { ...checkins, readiness_trend: readinessTrend, latest: latest ? { date: latest.date, readiness: latest.readiness } : null } : null,
    sleep,
    training_load: load,
    observations,
    missing,
    rules: "Descriptive figures from the athlete's own entries, not a medical assessment. Use neutral wording, quote the counts behind each figure, and don't claim a trend that isn't listed. Suggest a qualified professional for pain, illness or persistent poor sleep.",
  };
}

export type RecoverySummary = ReturnType<typeof summarizeRecovery>;
