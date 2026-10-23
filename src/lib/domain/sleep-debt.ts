/**
 * Estimated sleep shortfall ("sleep debt"), version 1 (Sleep & Recovery, Stage B6). A transparent rolling sum over
 * the last 14 logged nights: a night under the goal adds its whole shortfall; a night over the goal pays back half
 * of the extra, and only against what is outstanding; a night with nothing logged changes nothing. It is an estimate
 * from the member's own entries and goal, not a measurement, and it is kept apart from the nightly score.
 * Method: docs/SLEEP_METHOD.md.
 */
import { addDays } from "@/lib/domain/dates";
import type { NightSummary } from "@/lib/domain/sleep";

export const SLEEP_DEBT_VERSION = 1;
export const DEBT_WINDOW_NIGHTS = 14;
/** Share of a night's extra sleep (over the goal) that counts against outstanding debt. */
export const SURPLUS_REPAY_RATE = 0.5;
/** Nights with data needed before a trend is stated. */
export const MIN_NIGHTS_FOR_TREND = 3;

export interface DebtDay {
  date: string;
  /** Minutes asleep, or null when nothing was logged. */
  asleep: number | null;
  /** Added to the debt (goal − asleep), 0 when at goal or no data. */
  shortfall: number;
  /** Paid back from the debt, 0 when under goal or no data. */
  repaid: number;
  /** Running estimate after this night. */
  debt: number;
}

export type DebtBand = "on_track" | "behind" | "deficit";
export type DebtTrend = "rising" | "falling" | "steady";

export interface SleepDebt {
  version: typeof SLEEP_DEBT_VERSION;
  goalMinutes: number;
  windowNights: number;
  nightsWithData: number;
  debtMinutes: number;
  band: DebtBand;
  /** Compared with a week earlier; null until three nights are logged. */
  trend: DebtTrend | null;
  totalShortfall: number;
  totalRepaid: number;
  days: DebtDay[];
}

export const DEBT_BAND_TEXT: Record<DebtBand, string> = {
  on_track: "Within an hour of your goal over the last two weeks.",
  behind: "A little behind: an earlier night or two would clear it.",
  deficit: "Running a deficit. Protect your sleep window on the next few nights rather than trying to make it all up at once.",
};

export function debtBand(minutes: number): DebtBand {
  if (minutes <= 60) return "on_track";
  if (minutes <= 180) return "behind";
  return "deficit";
}

/** The rolling estimate ending on `endDate` (the last night counted). */
export function sleepDebt(nights: NightSummary[], goalMinutes: number, endDate: string, windowNights = DEBT_WINDOW_NIGHTS): SleepDebt {
  const byDate = new Map(nights.map((n) => [n.nightOf, n]));
  const days: DebtDay[] = [];
  let debt = 0;
  let totalShortfall = 0;
  let totalRepaid = 0;
  let withData = 0;
  for (let i = windowNights - 1; i >= 0; i--) {
    const date = addDays(endDate, -i);
    const n = byDate.get(date);
    if (!n) {
      days.push({ date, asleep: null, shortfall: 0, repaid: 0, debt: Math.round(debt) });
      continue;
    }
    withData++;
    let shortfall = 0;
    let repaid = 0;
    if (n.asleepMinutes < goalMinutes) {
      shortfall = goalMinutes - n.asleepMinutes;
      debt += shortfall;
    } else {
      repaid = Math.min(debt, (n.asleepMinutes - goalMinutes) * SURPLUS_REPAY_RATE);
      debt -= repaid;
    }
    totalShortfall += shortfall;
    totalRepaid += repaid;
    days.push({ date, asleep: n.asleepMinutes, shortfall: Math.round(shortfall), repaid: Math.round(repaid), debt: Math.round(debt) });
  }
  const now = Math.round(debt);
  let trend: DebtTrend | null = null;
  if (withData >= MIN_NIGHTS_FOR_TREND && days.length > 7) {
    const weekAgo = days[days.length - 8]!.debt;
    trend = now - weekAgo >= 60 ? "rising" : weekAgo - now >= 60 ? "falling" : "steady";
  }
  return {
    version: SLEEP_DEBT_VERSION,
    goalMinutes,
    windowNights,
    nightsWithData: withData,
    debtMinutes: now,
    band: debtBand(now),
    trend,
    totalShortfall: Math.round(totalShortfall),
    totalRepaid: Math.round(totalRepaid),
    days,
  };
}
