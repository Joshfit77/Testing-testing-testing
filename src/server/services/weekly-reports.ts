import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoDateInTz, isValidTimeZone } from "@/lib/domain/dates";
import { hasFeature, planFromEntitlement } from "@/lib/domain/plans";
import { DEFAULT_SLEEP_GOAL_MINUTES, summarizeNights } from "@/lib/domain/sleep";
import { scheduleStats } from "@/lib/domain/sleep-stats";
import type { Plan } from "@/lib/domain/types";
import {
  buildWeeklyMetrics,
  latestDuePeriod,
  metricsForAi,
  REPORT_AI_INSTRUCTIONS,
  reportAnalysisSchema,
  ruleBasedAnalysis,
  type ReportAnalysis,
  type ReportPeriod,
  type WeeklyMetrics,
  type WeeklyReportInput,
} from "@/lib/domain/weekly-report";
import { getServiceSupabase } from "@/lib/supabase/server";
import { serverEnv } from "@/server/env";
import { logError, logInfo } from "@/server/log";
import { AiError, withAiRequest } from "@/server/services/ai-coach";
import { getNutritionDaily } from "@/server/services/progress";
import { listSleepSessions, listSleepStages } from "@/server/services/sleep";

export interface WeeklyReportRow {
  id: string;
  week_start: string;
  time_zone: string;
  metrics: WeeklyMetrics;
  analysis: ReportAnalysis;
  analysis_source: "rules" | "ai";
  model: string | null;
  generated_at: string;
  read_at: string | null;
}

const REPORT_COLUMNS = "id, week_start, time_zone, metrics, analysis, analysis_source, model, generated_at, read_at";

/** Read the member's records for one week (and the few weeks before it, for comparisons). Read-only. */
export async function collectWeeklyInput(supabase: SupabaseClient, userId: string, period: ReportPeriod, tz: string, sleepGoalMinutes: number): Promise<WeeklyReportInput> {
  const { weekStart, weekEnd } = period;
  const histStart = addDays(weekStart, -28);
  // A day either side of the UTC range so a time-zone offset can't drop a session at the edges.
  const fromTs = `${addDays(histStart, -1)}T00:00:00Z`;
  const toTs = `${addDays(weekEnd, 2)}T00:00:00Z`;

  const [sessionsRes, programRes, prsRes, nutrition, goalsRes, runsRes, weightsRes, sessions] = await Promise.all([
    supabase.from("workout_sessions").select("started_at, total_volume_kg").eq("user_id", userId).eq("status", "completed").gte("started_at", fromTs).lt("started_at", toTs),
    supabase.from("user_programs").select("program:training_programs(days_per_week)").eq("user_id", userId).eq("status", "active").maybeSingle(),
    supabase
      .from("personal_records")
      .select("record_type, achieved_at, exercise:exercises(name)")
      .eq("user_id", userId)
      .gte("achieved_at", `${addDays(weekStart, -1)}T00:00:00Z`)
      .lt("achieved_at", toTs)
      .order("achieved_at"),
    getNutritionDaily(supabase, userId, weekStart, weekEnd),
    supabase.from("nutrition_goals").select("calories, protein_g").eq("user_id", userId).maybeSingle(),
    supabase.from("activities").select("started_at, distance_m, moving_s").eq("user_id", userId).eq("kind", "run").is("deleted_at", null).gte("started_at", `${addDays(weekStart, -8)}T00:00:00Z`).lt("started_at", toTs),
    supabase.from("weight_entries").select("recorded_on, weight_kg").eq("user_id", userId).gte("recorded_on", addDays(weekStart, -30)).lte("recorded_on", weekEnd).order("recorded_on"),
    listSleepSessions(supabase, userId, { fromNight: weekStart, toNight: weekEnd }),
  ]);
  for (const r of [sessionsRes, prsRes, goalsRes, runsRes, weightsRes]) if (r.error) throw r.error;

  const dated = (sessionsRes.data ?? []).map((s) => ({ date: isoDateInTz(new Date(s.started_at as string), tz), volumeKg: Number(s.total_volume_kg ?? 0) }));
  const priorWeekWorkouts = [4, 3, 2, 1].map((k) => {
    const ws = addDays(weekStart, -7 * k);
    const we = addDays(ws, 6);
    return dated.filter((d) => d.date >= ws && d.date <= we).length;
  });
  const program = (programRes.data?.program as unknown as { days_per_week: number } | null) ?? null;

  const seenPr = new Set<string>();
  const prs: WeeklyReportInput["prs"] = [];
  for (const r of prsRes.data ?? []) {
    const date = isoDateInTz(new Date(r.achieved_at as string), tz);
    if (date < weekStart || date > weekEnd) continue;
    const name = (r.exercise as unknown as { name: string } | null)?.name ?? "an exercise";
    if (seenPr.has(name)) continue;
    seenPr.add(name);
    prs.push({ exercise: name, recordType: r.record_type as string });
  }

  const runs = (runsRes.data ?? []).map((a) => ({ date: isoDateInTz(new Date(a.started_at as string), tz), distanceM: a.distance_m == null ? null : Number(a.distance_m), movingS: Number(a.moving_s ?? 0) }));
  const priorStart = addDays(weekStart, -7);
  const prior = runs.filter((r) => r.date >= priorStart && r.date < weekStart);

  // Sleep: finished nights, with stage minutes only where the device recorded stages.
  const nights = summarizeNights(sessions).filter((n) => n.nightOf >= weekStart && n.nightOf <= weekEnd);
  const stageRows = await listSleepStages(supabase, userId, nights.flatMap((n) => n.sessions.map((s) => s.id)));
  const stagesBySession = new Map<string, { rem: number; deep: number; light: number; awake: number }>();
  for (const st of stageRows) {
    const minutes = Math.max(0, (Date.parse(st.ended_at) - Date.parse(st.started_at)) / 60_000);
    if (!(st.stage === "rem" || st.stage === "deep" || st.stage === "light" || st.stage === "awake")) continue;
    const acc = stagesBySession.get(st.session_id) ?? { rem: 0, deep: 0, light: 0, awake: 0 };
    acc[st.stage] += minutes;
    stagesBySession.set(st.session_id, acc);
  }
  const sleep = nights.map((n) => {
    const parts = n.sessions.map((s) => stagesBySession.get(s.id)).filter(Boolean) as { rem: number; deep: number; light: number; awake: number }[];
    const stages = parts.length && parts.some((p) => p.rem + p.deep > 0)
      ? parts.reduce((a, p) => ({ rem: a.rem + p.rem, deep: a.deep + p.deep, light: a.light + p.light, awake: a.awake + p.awake }), { rem: 0, deep: 0, light: 0, awake: 0 })
      : null;
    return { asleepMinutes: n.asleepMinutes, estimated: n.asleepEstimated, recorded: n.recorded, stages };
  });

  const goals = goalsRes.data as { calories: number; protein_g: number } | null;
  return {
    period,
    workouts: dated.filter((d) => d.date >= weekStart && d.date <= weekEnd),
    priorWeekWorkouts,
    plannedPerWeek: program?.days_per_week ?? null,
    prs,
    nutrition,
    nutritionTargets: goals ? { calories: goals.calories, protein: goals.protein_g } : null,
    runs: runs.filter((r) => r.date >= weekStart && r.date <= weekEnd),
    priorRunDistanceM: prior.length ? prior.reduce((a, r) => a + (r.distanceM ?? 0), 0) : null,
    sleep,
    sleepGoalMinutes: sleepGoalMinutes,
    sleepSteadiness: scheduleStats(nights).steadiness,
    weights: (weightsRes.data ?? []).map((w) => ({ date: w.recorded_on as string, kg: Number(w.weight_kg) })),
  };
}

/** Whether to ask the AI for the written analysis (it costs money and counts against the member's allowance). */
function aiAnalysisEnabled(): boolean {
  return Boolean(serverEnv.anthropicApiKey) && process.env.WEEKLY_REPORT_AI !== "off";
}

async function aiAnalysis(supabase: SupabaseClient, userId: string, plan: Plan, metrics: WeeklyMetrics): Promise<{ analysis: ReportAnalysis; model: string } | null> {
  if (!aiAnalysisEnabled() || !hasFeature(plan, "ai_coach")) return null;
  try {
    return await withAiRequest({ supabase, userId, plan, kind: "weekly_report", tier: "fast" }, async ({ client, model }) => {
      const res = await client.beta.messages.parse({
        model,
        max_tokens: 1_500,
        system: [{ type: "text", text: REPORT_AI_INSTRUCTIONS, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: metricsForAi(metrics) }],
        output_config: { format: betaZodOutputFormat(reportAnalysisSchema) },
      });
      const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      if (res.stop_reason === "refusal" || !res.parsed_output) throw new AiError("provider", "No analysis returned.");
      return { value: { analysis: res.parsed_output, model }, inputTokens, outputTokens: res.usage.output_tokens };
    });
  } catch (err) {
    // No consent, no allowance left, or the provider failed: the report keeps its rule-based analysis.
    if (!(err instanceof AiError) || err.code === "provider" || err.code === "not_configured") logError("weekly_report.ai", err, { userId });
    return null;
  }
}

/**
 * Create the member's report for `period` if it doesn't exist yet. Retry-safe: the first insert wins (unique
 * user_id + week_start) and only the call that inserted the row asks for an AI analysis, so a retry or a second
 * concurrent call never pays twice or writes twice. Returns the stored report.
 */
export async function ensureWeeklyReport(
  readClient: SupabaseClient,
  userId: string,
  plan: Plan,
  period: ReportPeriod,
  tz: string,
  sleepGoalMinutes: number,
): Promise<WeeklyReportRow> {
  const service = getServiceSupabase();
  const existing = await service.from("weekly_reports").select(REPORT_COLUMNS).eq("user_id", userId).eq("week_start", period.weekStart).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as unknown as WeeklyReportRow;

  const metrics = buildWeeklyMetrics(await collectWeeklyInput(readClient, userId, period, tz, sleepGoalMinutes));
  const inserted = await service
    .from("weekly_reports")
    .upsert(
      { user_id: userId, week_start: period.weekStart, time_zone: tz, metrics, analysis: ruleBasedAnalysis(metrics), analysis_source: "rules", model: null },
      { onConflict: "user_id,week_start", ignoreDuplicates: true },
    )
    .select(REPORT_COLUMNS);
  if (inserted.error) throw inserted.error;
  const mine = (inserted.data ?? [])[0] as unknown as WeeklyReportRow | undefined;
  if (!mine) {
    // Another call created it first.
    const again = await service.from("weekly_reports").select(REPORT_COLUMNS).eq("user_id", userId).eq("week_start", period.weekStart).single();
    if (again.error) throw again.error;
    return again.data as unknown as WeeklyReportRow;
  }

  const ai = await aiAnalysis(readClient, userId, plan, metrics);
  if (!ai) return mine;
  const upgraded = await service
    .from("weekly_reports")
    .update({ analysis: ai.analysis, analysis_source: "ai", model: ai.model })
    .eq("id", mine.id)
    .select(REPORT_COLUMNS)
    .single();
  if (upgraded.error) {
    logError("weekly_report.save_ai", upgraded.error, { userId });
    return mine;
  }
  return upgraded.data as unknown as WeeklyReportRow;
}

export async function listWeeklyReports(supabase: SupabaseClient, userId: string, limit = 26): Promise<WeeklyReportRow[]> {
  const { data, error } = await supabase.from("weekly_reports").select(REPORT_COLUMNS).eq("user_id", userId).order("week_start", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as WeeklyReportRow[];
}

export async function getWeeklyReport(supabase: SupabaseClient, userId: string, weekStart: string): Promise<WeeklyReportRow | null> {
  const { data, error } = await supabase.from("weekly_reports").select(REPORT_COLUMNS).eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
  if (error) throw error;
  return (data as unknown as WeeklyReportRow | null) ?? null;
}

/**
 * Scheduled job: create the due report for every Pro member whose local time has reached Sunday 18:00 (or later in
 * the week) and who doesn't have it yet. Safe to run every hour and to re-run after a failure. Returns counts only.
 */
export async function runWeeklyReportJob(now = new Date(), maxMembers = 500): Promise<{ checked: number; created: number; failed: number }> {
  const service = getServiceSupabase();
  let checked = 0;
  let created = 0;
  let failed = 0;
  for (let from = 0; checked < maxMembers; from += 200) {
    const { data, error } = await service.from("user_entitlements").select("user_id, plan, valid_until").order("user_id").range(from, from + 199);
    if (error) throw error;
    const rows = data ?? [];
    const eligible = rows.filter((r) => hasFeature(planFromEntitlement(r as { plan: string; valid_until: string | null }), "weekly_reports"));
    if (eligible.length) {
      const { data: profiles, error: pErr } = await service.from("profiles").select("id, timezone, sleep_goal_minutes").in("id", eligible.map((r) => r.user_id as string));
      if (pErr) throw pErr;
      for (const p of profiles ?? []) {
        if (checked >= maxMembers) break;
        checked += 1;
        const tz = isValidTimeZone(p.timezone as string) ? (p.timezone as string) : "UTC";
        const period = latestDuePeriod(now, tz);
        try {
          const { data: has } = await service.from("weekly_reports").select("id").eq("user_id", p.id).eq("week_start", period.weekStart).maybeSingle();
          if (has) continue;
          const ent = eligible.find((r) => r.user_id === p.id)!;
          await ensureWeeklyReport(service, p.id as string, planFromEntitlement(ent as { plan: string; valid_until: string | null }), period, tz, (p.sleep_goal_minutes as number | null) ?? DEFAULT_SLEEP_GOAL_MINUTES);
          created += 1;
        } catch (err) {
          failed += 1;
          logError("weekly_report.job", err, { userId: p.id });
        }
      }
    }
    if (rows.length < 200) break;
  }
  logInfo("weekly_report.job", { checked, created, failed });
  return { checked, created, failed };
}

