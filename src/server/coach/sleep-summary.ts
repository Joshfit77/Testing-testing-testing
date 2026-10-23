import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { clockMinutesInTz, DEFAULT_SLEEP_GOAL_MINUTES, formatClock, formatDuration, summarizeNights } from "@/lib/domain/sleep";
import { associations, clockToMinutes, describeAssociation } from "@/lib/domain/sleep-checkins";
import { sleepDebt } from "@/lib/domain/sleep-debt";
import { nightlyScore } from "@/lib/domain/sleep-score";
import { sleepWindows } from "@/lib/domain/sleep-schedule";
import { averageAsleepMinutes, scheduleStats } from "@/lib/domain/sleep-stats";
import { listSleepCheckins, listSleepSessions } from "@/server/services/sleep";

/**
 * The deterministic sleep summary the AI coach reads (Stage C4). Every number comes from the same domain code the
 * Sleep & Recovery pages use; the model explains and interprets, it never produces a figure of its own.
 */
export async function buildSleepSummary(supabase: SupabaseClient, userId: string, timeZone: string, days: number) {
  const { data: profile } = await supabase.from("profiles").select("wellness_consent_at, sleep_goal_minutes, sleep_target_wake").eq("id", userId).maybeSingle();
  if (!profile?.wellness_consent_at) {
    return { available: false, note: "The athlete hasn't allowed sleep logging (optional wellness information), so there is no sleep data. Don't guess; they can turn it on under My Progress > Sleep & Recovery." };
  }
  const today = isoDateInTz(new Date(), timeZone);
  const start = addDays(today, -(days - 1));
  const goal = (profile.sleep_goal_minutes as number | null) ?? DEFAULT_SLEEP_GOAL_MINUTES;
  const [sessions, checkins] = await Promise.all([listSleepSessions(supabase, userId, { fromNight: addDays(start, -14), toNight: today }), listSleepCheckins(supabase, userId, start, today)]);
  const all = summarizeNights(sessions);
  const nights = all.filter((n) => n.nightOf >= start);
  const fortnight = all.filter((n) => n.nightOf >= addDays(today, -13));
  if (!nights.length) {
    return { available: true, nights_logged: 0, goal: formatDuration(goal), note: `No nights logged in the last ${days} days. Say so plainly and suggest the sleep timer or entering a night by hand; don't estimate their sleep.` };
  }
  const pattern = scheduleStats(fortnight);
  const windows = sleepWindows(fortnight, goal, clockToMinutes((profile.sleep_target_wake as string | null) ?? null));
  const debt = sleepDebt(fortnight, goal, today);
  const scores = nights.map((n) => nightlyScore(n, goal, scheduleStats(all.filter((e) => e.nightOf < n.nightOf && e.nightOf >= addDays(n.nightOf, -14)))).score);
  const avg = averageAsleepMinutes(nights);
  const last = nights[0]!;
  const gaps: string[] = [];
  if (nights.every((n) => n.asleepEstimated)) gaps.push("No night has when-fell-asleep or awake-time detail, so 'asleep' means time in bed throughout.");
  if (pattern.typicalBed === null) gaps.push("Fewer than three nights in the last two weeks, so there is no typical bedtime or wake time yet.");
  if (!checkins.length) gaps.push("No check-ins, so there are no habit patterns and no reported energy.");
  const stages = sessions.some((s) => s.source !== "manual" && s.source !== "timer");
  if (!stages) gaps.push("No imported records, so there is no stage information (the app never infers stages).");
  return {
    available: true,
    window_days: days,
    nights_logged: nights.length,
    goal: formatDuration(goal),
    average_asleep: formatDuration(avg),
    nights_at_goal: nights.filter((n) => n.asleepMinutes >= goal).length,
    shortest: formatDuration(Math.min(...nights.map((n) => n.asleepMinutes))),
    longest: formatDuration(Math.max(...nights.map((n) => n.asleepMinutes))),
    last_night: { date: last.nightOf, asleep: formatDuration(last.asleepMinutes), in_bed_only: last.asleepEstimated, bed: formatClock(clockMinutesInTz(last.bedAt, last.timezone)), source: last.sources.join(", ") },
    typical_times: pattern.typicalBed === null ? null : { bedtime: formatClock(pattern.typicalBed), wake: formatClock(pattern.typicalWake!), bedtime_moves_minutes: pattern.bedSpread, wake_moves_minutes: pattern.wakeSpread, steadiness: pattern.steadiness },
    average_nightly_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    estimated_sleep_debt: debt.nightsWithData ? { minutes_behind: debt.debtMinutes, band: debt.band, trend: debt.trend, how: "Rolling 14 nights: a short night adds its whole shortfall; a long night repays half of the extra, only against what's owed; unlogged nights change nothing. An estimate from entries, not a measurement." } : null,
    suggested_windows: windows.bedWindow ? { bedtime: `${formatClock(windows.bedWindow.start)}–${formatClock(windows.bedWindow.end)}`, wake: `${formatClock(windows.wakeWindow!.start)}–${formatClock(windows.wakeWindow!.end)}`, based_on: windows.anchorSource === "target" ? "the wake time they chose" : "their typical wake time", gradual_plan: windows.adjustment ? `${windows.adjustment.minutesPerNight} min ${windows.adjustment.direction} a night for about ${windows.adjustment.nights} nights` : null } : null,
    checkin_patterns: associations(nights, checkins).map(describeAssociation),
    checkins_logged: checkins.length,
    data_gaps: gaps,
    rules: "Use these figures as they are. They describe logged sleep; they are not medical measurements. Don't diagnose insomnia, apnoea or any disorder; for persistent problems suggest a doctor or sleep specialist. Any training change you suggest goes through a proposal card the athlete must accept.",
  };
}
