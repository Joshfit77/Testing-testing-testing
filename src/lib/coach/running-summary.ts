/**
 * Deterministic running summary for the AI coach (get_running_summary), from the member's recorded runs only.
 *
 * Each run keeps its source (GPS recording, treadmill or manual entry). Pace only comes from runs with both a
 * distance and a moving time. Heart rate is not stored for runs, so it is never reported. Pure (no I/O).
 */
import { addDays, daysBetween } from "@/lib/domain/dates";
import { distanceUnitFor, formatPace, fromMeters, paceSecondsPer, type ActivitySource } from "@/lib/domain/activities";
import type { UnitSystem } from "@/lib/domain/types";
import { inRange, mean, pctChange, r1, windowStart, type Finding } from "./lift-analysis";

export interface RunRecord {
  date: string;
  source: ActivitySource;
  /** Came from a health app or wearable import (external id). */
  imported: boolean;
  distanceM: number | null;
  movingS: number;
  perceivedEffort: number | null;
}

export interface RunningSummaryInput {
  today: string;
  weeks: number;
  units: UnitSystem;
  /** Runs from at least the last max(weeks, 4) weeks (older ones are ignored except for the ramp check). */
  runs: RunRecord[];
  /** The most recent run ever recorded (may be before the window). */
  lastRunDate: string | null;
}

/** A weekly distance rise above this is flagged. */
export const RAMP_PCT = 10;
/** Runs within ±25% of the median distance count as comparable for the pace trend. */
export const COMPARABLE_BAND = 0.25;
export const MIN_RUNS = 3;

export function summarizeRunning(input: RunningSummaryInput) {
  const { today, weeks, units } = input;
  const unit = distanceUnitFor(units);
  const dist = (m: number) => Math.round(fromMeters(m, unit) * 100) / 100;
  const start = windowStart(today, weeks);
  const runs = input.runs.filter((r) => r.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const inWin = runs.filter((r) => r.date >= start);
  const paced = inWin.filter((r) => paceSecondsPer(r.distanceM, r.movingS, unit) != null);

  const weekly = [];
  for (let k = 0; k < weeks; k++) {
    const ws = addDays(start, k * 7);
    const rs = inWin.filter((r) => inRange(r.date, ws, addDays(ws, 6)));
    weekly.push({
      week_start: ws,
      runs: rs.length,
      distance: dist(rs.reduce((a, r) => a + (r.distanceM ?? 0), 0)),
      moving_minutes: Math.round(rs.reduce((a, r) => a + r.movingS, 0) / 60),
    });
  }

  const totalPacedM = paced.reduce((a, r) => a + r.distanceM!, 0);
  const totalPacedS = paced.reduce((a, r) => a + r.movingS, 0);
  const avgPace = paced.length ? paceSecondsPer(totalPacedM, totalPacedS, unit) : null;
  const longest = inWin.filter((r) => r.distanceM).sort((a, b) => b.distanceM! - a.distanceM! || b.date.localeCompare(a.date))[0];

  // Pace trend: comparable runs (similar distance) in the older vs newer half of the window.
  let paceTrend = null as null | Record<string, unknown>;
  if (paced.length >= 4) {
    const ds = paced.map((r) => r.distanceM!).sort((a, b) => a - b);
    const median = ds.length % 2 ? ds[(ds.length - 1) / 2]! : (ds[ds.length / 2 - 1]! + ds[ds.length / 2]!) / 2;
    const lo = median * (1 - COMPARABLE_BAND);
    const hi = median * (1 + COMPARABLE_BAND);
    const comparable = paced.filter((r) => r.distanceM! >= lo && r.distanceM! <= hi);
    const mid = addDays(start, Math.floor((weeks * 7) / 2));
    const older = comparable.filter((r) => r.date < mid);
    const newer = comparable.filter((r) => r.date >= mid);
    if (older.length >= 2 && newer.length >= 2) {
      const p = (rs: RunRecord[]) => paceSecondsPer(rs.reduce((a, r) => a + r.distanceM!, 0), rs.reduce((a, r) => a + r.movingS, 0), unit)!;
      const delta = Math.round(p(newer) - p(older));
      paceTrend = {
        comparable_distance: `${dist(lo)}–${dist(hi)} ${unit}`,
        older_half: { pace: formatPace(p(older), unit), runs: older.length, until: addDays(mid, -1) },
        newer_half: { pace: formatPace(p(newer), unit), runs: newer.length, from: mid },
        change_seconds_per_unit: delta,
        direction: delta < -3 ? "faster" : delta > 3 ? "slower" : "about the same",
      };
    }
  }

  // Ramp: rolling weeks ending today, from all runs passed in.
  const weekDist = (k: number) => runs.filter((r) => inRange(r.date, addDays(today, -(7 * k + 6)), addDays(today, -7 * k))).reduce((a, r) => a + (r.distanceM ?? 0), 0);
  const [w0, w1, w2, w3] = [0, 1, 2, 3].map(weekDist) as [number, number, number, number];
  const weekOverWeek = pctChange(w1, w0);
  const twoWeek = pctChange((w2 + w3) / 2, (w0 + w1) / 2);

  const sources = { gps: inWin.filter((r) => r.source === "gps").length, treadmill: inWin.filter((r) => r.source === "treadmill").length, manual: inWin.filter((r) => r.source === "manual").length, imported: inWin.filter((r) => r.imported).length };
  const efforts = inWin.map((r) => r.perceivedEffort).filter((x): x is number => x != null);

  const flags: Finding[] = [];
  if (inWin.length < MIN_RUNS) flags.push({ id: "insufficient_data", evidence: `${inWin.length} run${inWin.length === 1 ? "" : "s"} recorded in the last ${weeks} weeks; at least ${MIN_RUNS} are needed before judging a trend.` });
  if (weekOverWeek != null && weekOverWeek > RAMP_PCT) {
    flags.push({ id: "distance_ramp", evidence: `Last 7 days ${dist(w0)} ${unit} vs ${dist(w1)} ${unit} the week before (+${weekOverWeek}%, above the ${RAMP_PCT}% guideline).` });
  } else if (twoWeek != null && twoWeek > RAMP_PCT) {
    flags.push({ id: "distance_ramp", evidence: `Last 2 weeks averaged ${dist((w0 + w1) / 2)} ${unit}/week vs ${dist((w2 + w3) / 2)} ${unit}/week in the 2 weeks before (+${twoWeek}%, above the ${RAMP_PCT}% guideline).` });
  }

  const missing: string[] = [];
  if (!inWin.length) missing.push(`no runs recorded in the last ${weeks} weeks`);
  else if (inWin.length < MIN_RUNS) missing.push(`fewer than ${MIN_RUNS} runs in the window`);
  const noDistance = inWin.length - paced.length;
  if (noDistance) missing.push(`${noDistance} run${noDistance === 1 ? " has" : "s have"} no distance, so no pace`);
  if (inWin.length >= MIN_RUNS && !paceTrend) missing.push("not enough runs of a similar distance in both halves of the window for a pace trend");
  if (inWin.length && !efforts.length) missing.push("no perceived effort logged");

  return {
    unit,
    window: { weeks, start, end: today },
    runs_in_window: inWin.length,
    sources,
    weekly,
    runs_per_week: r1(inWin.length / weeks),
    distance_per_week_avg: dist(inWin.reduce((a, r) => a + (r.distanceM ?? 0), 0) / weeks),
    average_pace: avgPace == null ? null : { pace: formatPace(avgPace, unit), from_runs: paced.length },
    longest_run: longest ? { date: longest.date, distance: dist(longest.distanceM!), source: longest.source } : null,
    pace_trend: inWin.length >= MIN_RUNS ? paceTrend : null,
    weekly_distance_change: {
      last_7_days: dist(w0),
      previous_7_days: dist(w1),
      week_over_week_pct: weekOverWeek,
      last_2_weeks_avg: dist((w0 + w1) / 2),
      prior_2_weeks_avg: dist((w2 + w3) / 2),
      two_week_pct: twoWeek,
    },
    perceived_effort: efforts.length ? { avg: r1(mean(efforts)), runs: efforts.length, scale: "1–10" } : null,
    days_since_last_run: input.lastRunDate ? daysBetween(input.lastRunDate, today) : null,
    recent_runs: inWin
      .slice(-8)
      .reverse()
      .map((r) => ({ date: r.date, source: r.source, ...(r.imported ? { imported: true } : {}), distance: r.distanceM ? dist(r.distanceM) : null, moving_minutes: Math.round(r.movingS / 6) / 10, pace: r.distanceM ? formatPace(paceSecondsPer(r.distanceM, r.movingS, unit), unit) : null })),
    flags,
    missing,
    rules: "Sources: gps = recorded live by the app, treadmill/manual = entered by the athlete. Heart rate isn't stored for runs: never mention it. Quote these figures as given; don't claim a trend that isn't listed.",
  };
}

export type RunningSummary = ReturnType<typeof summarizeRunning>;
