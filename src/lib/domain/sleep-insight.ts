/**
 * The one recovery line on the Sleep & Recovery dashboard. It restates something already worked out from the member's
 * own nights (the estimated sleep debt on Pro, otherwise how many of this week's logged nights reached the goal) and
 * never adds a figure of its own.
 */
import { formatDuration, type NightSummary } from "@/lib/domain/sleep";
import { DEBT_BAND_TEXT, MIN_NIGHTS_FOR_TREND, type SleepDebt } from "@/lib/domain/sleep-debt";

export interface SleepInsight {
  text: string;
  href: string | null;
  linkLabel: string | null;
}

export function recoveryInsight({ week, goalMinutes, debt }: { week: NightSummary[]; goalMinutes: number; debt: Pick<SleepDebt, "debtMinutes" | "band" | "nightsWithData"> | null }): SleepInsight {
  if (debt && debt.nightsWithData >= MIN_NIGHTS_FOR_TREND) {
    return { text: `Estimated sleep debt ${formatDuration(debt.debtMinutes)}. ${DEBT_BAND_TEXT[debt.band]}`, href: "/progress/sleep/debt", linkLabel: "How it adds up" };
  }
  const n = week.length;
  if (n >= MIN_NIGHTS_FOR_TREND) {
    const atGoal = week.filter((night) => night.asleepMinutes >= goalMinutes).length;
    const goal = formatDuration(goalMinutes);
    const text =
      atGoal === n
        ? `All ${n} nights you logged this week reached your ${goal} goal. Keep your wake time steady.`
        : `${atGoal} of ${n} nights you logged this week reached your ${goal} goal. A fixed wake time is the easiest place to start.`;
    return { text, href: "/progress/sleep/history", linkLabel: "Sleep history" };
  }
  const more = MIN_NIGHTS_FOR_TREND - n;
  return { text: `Log ${more} more ${more === 1 ? "night" : "nights"} this week to see how often you reach your goal.`, href: null, linkLabel: null };
}
