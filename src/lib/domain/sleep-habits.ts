/**
 * Sleep habit coaching, version 1 (Sleep & Recovery, Stage C3): a few plain rules over the member's own nights and
 * check-ins that each produce one practical suggestion with its reason. At most three are shown, dismissed ones
 * stay hidden, and nothing here touches medication or medical conditions.
 */
import type { NightSummary, SleepSession } from "@/lib/domain/sleep";
import { clockMinutesInTz, formatClock, formatDuration } from "@/lib/domain/sleep";
import { clockToMinutes, LATE_CAFFEINE_MINUTES, type SleepCheckin } from "@/lib/domain/sleep-checkins";
import type { SleepWindows } from "@/lib/domain/sleep-schedule";
import { averageAsleepMinutes } from "@/lib/domain/sleep-stats";

export const SLEEP_HABITS_VERSION = 1;
export const MAX_TIPS = 3;

export const TIP_KEYS = ["fix_wake_time", "earlier_bedtime", "late_caffeine", "evening_screens", "late_meals", "weekend_shift", "wind_down", "environment", "naps", "protect_window"] as const;
export type TipKey = (typeof TIP_KEYS)[number];

export interface SleepTip {
  key: TipKey;
  title: string;
  /** The evidence from the member's own entries. */
  why: string;
  /** One concrete thing to try. */
  action: string;
}

export interface HabitInputs {
  nights: NightSummary[];
  naps: SleepSession[];
  checkins: SleepCheckin[];
  goalMinutes: number;
  debtMinutes: number | null;
  windows: SleepWindows;
  dismissed: string[];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/** Every tip the rules produce, in priority order, before dismissals and the cap are applied. */
export function allSleepTips(i: HabitInputs): SleepTip[] {
  const tips: SleepTip[] = [];
  const { pattern } = i.windows;
  const avg = averageAsleepMinutes(i.nights);
  const count = (pick: (c: SleepCheckin) => boolean) => i.checkins.filter(pick).length;

  if (pattern.wakeSpread !== null && pattern.wakeSpread > 45) {
    tips.push({ key: "fix_wake_time", title: "Get up at the same time every day", why: `Your wake time moved about ±${pattern.wakeSpread} minutes across ${pattern.nights} nights.`, action: i.windows.wakeWindow ? `Set an alarm inside ${formatClock(i.windows.wakeWindow.start)}–${formatClock(i.windows.wakeWindow.end)} and keep it on weekends too.` : "Pick one wake time and keep it for a week, weekends included." });
  }
  if (i.windows.adjustment?.direction === "earlier" && avg !== null && avg < i.goalMinutes - 30) {
    tips.push({ key: "earlier_bedtime", title: "Move bedtime earlier, a little at a time", why: `You averaged ${formatDuration(avg)} against a ${formatDuration(i.goalMinutes)} goal, and your usual bedtime is ${formatClock(i.windows.adjustment.fromBed)}.`, action: `Go to bed ${i.windows.adjustment.minutesPerNight} minutes earlier each night until you're inside ${formatClock(i.windows.bedWindow!.start)}–${formatClock(i.windows.bedWindow!.end)}.` });
  }
  const lateCaffeine = count((c) => (clockToMinutes(c.caffeine_last) ?? -1) >= LATE_CAFFEINE_MINUTES);
  if (lateCaffeine >= 3) tips.push({ key: "late_caffeine", title: "Review afternoon caffeine", why: `Caffeine after 2 PM on ${lateCaffeine} of the last ${i.checkins.length} days you checked in.`, action: "Try a 2 PM cut-off for a week and compare your nights on the history page." });
  const screens = count((c) => c.evening_screens === true);
  if (screens >= 3) tips.push({ key: "evening_screens", title: "A screen-free last hour", why: `Screens in the hour before bed on ${screens} of ${i.checkins.length} check-ins.`, action: "Put the phone on charge outside the bedroom at wind-down time; read or stretch instead." });
  const meals = count((c) => c.late_meal === true);
  if (meals >= 3) tips.push({ key: "late_meals", title: "Finish large meals earlier", why: `A large meal within two hours of bed on ${meals} of ${i.checkins.length} check-ins.`, action: "Aim to finish dinner three hours before bed; keep anything later small." });
  if (i.windows.weekendShift && i.windows.weekendShift.minutes > 60) {
    tips.push({ key: "weekend_shift", title: "Keep weekend wake times within an hour", why: `Weekday wake ${formatClock(i.windows.weekendShift.weekdayWake)}, weekend ${formatClock(i.windows.weekendShift.weekendWake)}: about ${i.windows.weekendShift.minutes} minutes apart.`, action: "Sleep in by an hour at most; if you're short, take an early-afternoon nap instead." });
  }
  const latency = median(i.nights.flatMap((n) => (n.latencyMinutes === null ? [] : [n.latencyMinutes])));
  if (latency !== null && latency > 30) tips.push({ key: "wind_down", title: "Build a wind-down routine", why: `You typically took ${formatDuration(latency)} to fall asleep.`, action: "Start the same 30-minute routine every night: dim lights, no work, a warm shower or stretching. Only get into bed when sleepy." });
  const env = count((c) => c.disturbances.some((d) => ["noise", "light", "heat", "cold"].includes(d)));
  if (env >= 2) tips.push({ key: "environment", title: "Fix the room", why: `Noise, light or temperature disturbed ${env} of your last ${i.checkins.length} nights.`, action: "Dark, quiet and cool: blackout curtains or a mask, earplugs or steady background sound, and a cooler room." });
  const lateNaps = i.naps.filter((n) => n.endedAt && clockMinutesInTz(n.startedAt, n.timezone) >= 15 * 60).length;
  if (i.naps.length >= 3 && lateNaps >= 2) tips.push({ key: "naps", title: "Keep naps short and early", why: `${i.naps.length} naps in two weeks, ${lateNaps} of them after 3 PM.`, action: "If you nap, keep it to 20–30 minutes before 3 PM so it doesn't eat into the night." });
  if (i.debtMinutes !== null && i.debtMinutes > 120) tips.push({ key: "protect_window", title: "Protect your sleep window this week", why: `You're an estimated ${formatDuration(i.debtMinutes)} behind your goal over the last two weeks.`, action: i.windows.bedWindow ? `Treat ${formatClock(i.windows.bedWindow.start)}–${formatClock(i.windows.bedWindow.end)} as booked, especially the night before a hard training day.` : "Keep bedtime fixed for the next few nights, especially before a hard training day." });
  return tips;
}

/** The tips to show: dismissed ones removed, at most three. */
export function sleepTips(i: HabitInputs): SleepTip[] {
  return allSleepTips(i)
    .filter((t) => !i.dismissed.includes(t.key))
    .slice(0, MAX_TIPS);
}
