import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { clockMinutesInTz, DEFAULT_SLEEP_GOAL_MINUTES, formatClock, formatDuration, HRV_METHOD_LABEL, minutesBetween, summarizeNights, type NightSummary } from "@/lib/domain/sleep";
import { associations, clockToMinutes, describeAssociation } from "@/lib/domain/sleep-checkins";
import { sleepDebt } from "@/lib/domain/sleep-debt";
import { nightlyScore } from "@/lib/domain/sleep-score";
import { sleepWindows } from "@/lib/domain/sleep-schedule";
import { averageAsleepMinutes, scheduleStats } from "@/lib/domain/sleep-stats";
import { listSleepCheckins, listSleepSessions, listSleepStages } from "@/server/services/sleep";

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
  const recordedNights = nights.filter((n) => n.recorded);
  if (!recordedNights.length) gaps.push("No night in this window was recorded by a wearable, so there are no sleep stages and no overnight heart rate, HRV or breathing (the app never infers them).");
  const recorded = recordedNights.length ? await describeRecorded(supabase, userId, recordedNights) : null;
  return {
    available: true,
    window_days: days,
    nights_logged: nights.length,
    goal: formatDuration(goal),
    average_asleep: formatDuration(avg),
    nights_at_goal: nights.filter((n) => n.asleepMinutes >= goal).length,
    shortest: formatDuration(Math.min(...nights.map((n) => n.asleepMinutes))),
    longest: formatDuration(Math.max(...nights.map((n) => n.asleepMinutes))),
    last_night: { date: last.nightOf, asleep: formatDuration(last.asleepMinutes), in_bed_only: last.asleepEstimated, bed: formatClock(clockMinutesInTz(last.bedAt, last.timezone)), source: last.sources.join(", "), recorded_by: last.recorded ? (last.deviceName ?? "a wearable") : null },
    recorded,
    typical_times: pattern.typicalBed === null ? null : { bedtime: formatClock(pattern.typicalBed), wake: formatClock(pattern.typicalWake!), bedtime_moves_minutes: pattern.bedSpread, wake_moves_minutes: pattern.wakeSpread, steadiness: pattern.steadiness },
    average_nightly_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    estimated_sleep_debt: debt.nightsWithData ? { minutes_behind: debt.debtMinutes, band: debt.band, trend: debt.trend, how: "Rolling 14 nights: a short night adds its whole shortfall; a long night repays half of the extra, only against what's owed; unlogged nights change nothing. An estimate from entries, not a measurement." } : null,
    suggested_windows: windows.bedWindow ? { bedtime: `${formatClock(windows.bedWindow.start)}–${formatClock(windows.bedWindow.end)}`, wake: `${formatClock(windows.wakeWindow!.start)}–${formatClock(windows.wakeWindow!.end)}`, based_on: windows.anchorSource === "target" ? "the wake time they chose" : "their typical wake time", gradual_plan: windows.adjustment ? `${windows.adjustment.minutesPerNight} min ${windows.adjustment.direction} a night for about ${windows.adjustment.nights} nights` : null } : null,
    checkin_patterns: associations(nights, checkins).map(describeAssociation),
    checkins_logged: checkins.length,
    data_gaps: gaps,
    rules: "Use these figures as they are. They describe logged sleep; they are not medical measurements. Stages and overnight heart rate, HRV and breathing, where present, are the wearable's own readings shared through the health platform: quote them as the device's, compare HRV and heart rate only with the athlete's own earlier nights (never with population norms), and never call any of them a recovery score or a sign of illness. Don't diagnose insomnia, apnoea or any disorder; for persistent problems suggest a doctor or sleep specialist. Any training change you suggest goes through a proposal card the athlete must accept.",
  };
}

const avgOf = (xs: number[], decimals: number) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10 ** decimals) / 10 ** decimals : null);

/**
 * What the wearable recorded, as data: stage shares of the latest recorded night, average stage shares over the
 * recorded nights, and overnight measurements for the latest night and the window. Every figure is the device's
 * reading or an average of them; a series the device never recorded is null.
 */
async function describeRecorded(supabase: SupabaseClient, userId: string, recordedNights: NightSummary[]) {
  const latest = recordedNights[0]!;
  const sample = recordedNights.slice(0, 30);
  const stages = await listSleepStages(supabase, userId, sample.flatMap((n) => n.sessions.map((s) => s.id)));
  const shares = (rows: typeof stages) => {
    const minutes: Record<string, number> = {};
    for (const s of rows) minutes[s.stage] = (minutes[s.stage] ?? 0) + minutesBetween(s.started_at, s.ended_at);
    const asleep = Object.entries(minutes).filter(([k]) => k !== "awake").reduce((a, [, v]) => a + v, 0);
    if (!asleep) return null;
    const pct = (k: string) => (minutes[k] ? Math.round((minutes[k]! / asleep) * 100) : null);
    return { asleep_by_stage: formatDuration(asleep), deep: formatDuration(minutes.deep ?? 0), deep_pct: pct("deep"), rem: formatDuration(minutes.rem ?? 0), rem_pct: pct("rem"), light: formatDuration(minutes.light ?? 0), light_pct: pct("light"), awake: formatDuration(minutes.awake ?? 0), unlabelled_asleep: minutes.asleep ? formatDuration(minutes.asleep) : null };
  };
  const latestIds = new Set(latest.sessions.map((s) => s.id));
  const hr = (n: NightSummary) => n.vitals?.heartRate?.avg ?? null;
  const hrv = (n: NightSummary) => n.vitals?.hrv?.avgMs ?? null;
  const rr = (n: NightSummary) => n.vitals?.respiratoryRate?.avg ?? null;
  const nums = (f: (n: NightSummary) => number | null) => sample.map(f).filter((v): v is number => v !== null);
  const method = sample.find((n) => n.vitals?.hrv)?.vitals?.hrv?.method;
  return {
    nights_recorded: recordedNights.length,
    devices: [...new Set(recordedNights.map((n) => n.deviceName).filter((d): d is string => Boolean(d)))],
    latest_night: {
      date: latest.nightOf,
      device: latest.deviceName,
      in_bed: formatDuration(latest.inBedMinutes),
      stages: shares(stages.filter((s) => latestIds.has(s.session_id))),
      overnight_heart_rate_bpm: latest.vitals?.heartRate ? { avg: latest.vitals.heartRate.avg, min: latest.vitals.heartRate.min, max: latest.vitals.heartRate.max } : null,
      hrv_ms: latest.vitals?.hrv ? { avg: latest.vitals.hrv.avgMs, method: HRV_METHOD_LABEL[latest.vitals.hrv.method], readings: latest.vitals.hrv.samples } : null,
      breathing_per_min: latest.vitals?.respiratoryRate ? { avg: latest.vitals.respiratoryRate.avg, min: latest.vitals.respiratoryRate.min, max: latest.vitals.respiratoryRate.max } : null,
    },
    window: {
      nights: sample.length,
      stage_shares_average: shares(stages),
      overnight_heart_rate_bpm_avg: avgOf(nums(hr), 0),
      hrv_ms_avg: avgOf(nums(hrv), 1),
      hrv_method: method ? HRV_METHOD_LABEL[method] : null,
      breathing_per_min_avg: avgOf(nums(rr), 1),
      nights_with_heart_rate: nums(hr).length,
      nights_with_hrv: nums(hrv).length,
    },
    how: "Stages and measurements are the wearable's, shared through Apple Health or Health Connect; the app only totals and averages them. The nightly score does not use them. Compare a night only with this athlete's own earlier nights.",
  };
}
