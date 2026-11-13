import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { formatWeek } from "@/components/reports/format";
import { ReportActions } from "@/components/reports/report-actions";
import { formatWeight } from "@/lib/domain/units";
import { formatMinutes, formatPace, isValidWeekStart, shareText, type Coverage } from "@/lib/domain/weekly-report";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { getWeeklyReport } from "@/server/services/weekly-reports";

export const metadata = { title: "Weekly report" };
export const dynamic = "force-dynamic";

const COVERAGE_TEXT: Record<Coverage, string> = { complete: "", partial: "Some days have no records", none: "No records this week" };

function Section({ title, coverage, children, testId }: { title: string; coverage: Coverage; children: React.ReactNode; testId: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold uppercase">{title}</h2>
        {COVERAGE_TEXT[coverage] && <span className="text-xs text-muted-foreground">{COVERAGE_TEXT[coverage]}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-elevated p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold text-gold-highlight">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function List({ title, items, testId }: { title: string; items: string[]; testId: string }) {
  if (!items.length) return null;
  return (
    <div data-testid={testId}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export default async function WeeklyReportPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  if (!isValidWeekStart(week)) notFound();
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const report = await getWeeklyReport(supabase, user.id, week);
  if (!report) notFound();
  if (!report.read_at) await supabase.from("weekly_reports").update({ read_at: new Date().toISOString() }).eq("id", report.id).eq("user_id", user.id);

  const m = report.metrics;
  const a = report.analysis;
  const units = profile.unit_system ?? "metric";
  const stageTotal = m.sleep.stages ? m.sleep.stages.rem + m.sleep.stages.deep + m.sleep.stages.light + m.sleep.stages.awake : 0;

  return (
    <div className="space-y-5">
      <BackLink href="/progress/reports">Weekly reports</BackLink>
      <PageHeader eyebrow="Weekly report" title={formatWeek(m.period.weekStart, m.period.weekEnd)} description={`From your own logs, prepared ${new Date(report.generated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: report.time_zone })}. Anything logged later isn't included.`} />

      <section className="bg-card-gradient rounded-2xl border border-gold/40 p-5" data-testid="report-analysis">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold uppercase">Your week</h2>
          <span className="text-xs text-muted-foreground" data-testid="analysis-source">
            {report.analysis_source === "ai" ? "AI analysis of your numbers" : "Automatic summary from your numbers"}
          </span>
        </div>
        <div className="mt-3 space-y-4">
          <List title="What went well" items={a.wentWell} testId="went-well" />
          <List title="Areas to improve" items={a.toImprove} testId="to-improve" />
          <List title="Recovery" items={a.recovery} testId="recovery" />
          <div data-testid="recommendations">
            <h3 className="text-sm font-semibold">Three things for next week</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
              {a.recommendations.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-muted-foreground">Observations come from what you logged; this isn&apos;t medical advice. Speak to a qualified professional about pain, illness or injury.</p>
        </div>
      </section>

      <Section title="Training" coverage={m.training.coverage} testId="report-training">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Workouts" value={String(m.training.workouts)} note={m.training.plannedPerWeek ? `program: ${m.training.plannedPerWeek} a week` : undefined} />
          <Stat label="Training days" value={String(m.training.trainingDays)} />
          <Stat label="Volume" value={formatWeight(m.training.volumeKg, units)} note="weight × reps, working sets" />
          <Stat label="Records" value={String(m.training.prs.length)} />
        </div>
        {m.training.priorAverage !== null && <p className="mt-2 text-sm text-muted-foreground">Average over the four weeks before: {m.training.priorAverage} workouts a week.</p>}
        {m.training.prs.length > 0 && <p className="mt-2 text-sm">New personal records: {m.training.prs.map((p) => p.exercise).join(", ")}.</p>}
      </Section>

      <Section title="Nutrition" coverage={m.nutrition.coverage} testId="report-nutrition">
        {m.nutrition.loggedDays === 0 ? (
          <p className="text-sm text-muted-foreground">No food was logged this week.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Avg calories" value={`${m.nutrition.avgCalories}`} note={m.nutrition.targetCalories ? `target ${m.nutrition.targetCalories}` : "no target set"} />
              <Stat label="Avg protein" value={`${m.nutrition.avgProtein} g`} note={m.nutrition.targetProtein ? `target ${m.nutrition.targetProtein} g` : undefined} />
              <Stat label="Carbs / fat" value={`${m.nutrition.avgCarbs} / ${m.nutrition.avgFat} g`} />
              <Stat label="Days logged" value={`${m.nutrition.loggedDays} / 7`} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Averages are over the days you logged food.{m.nutrition.daysOnTarget !== null ? ` Within 10% of your calorie target on ${m.nutrition.daysOnTarget} of them.` : ""}</p>
          </>
        )}
      </Section>

      <Section title="Running" coverage={m.running.coverage} testId="report-running">
        {m.running.runs === 0 ? (
          <p className="text-sm text-muted-foreground">No runs this week.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Distance" value={`${m.running.distanceKm} km`} note={m.running.priorDistanceKm !== null ? `last week ${m.running.priorDistanceKm} km` : undefined} />
            <Stat label="Runs" value={String(m.running.runs)} />
            <Stat label="Avg pace" value={m.running.avgPaceSecPerKm ? formatPace(m.running.avgPaceSecPerKm) : "—"} />
          </div>
        )}
      </Section>

      <Section title="Sleep" coverage={m.sleep.coverage} testId="report-sleep">
        {m.sleep.nights === 0 ? (
          <p className="text-sm text-muted-foreground">No sleep was logged or imported this week.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Avg asleep" value={formatMinutes(m.sleep.avgAsleepMinutes!)} note={`goal ${formatMinutes(m.sleep.goalMinutes)}`} />
              <Stat label="Nights at goal" value={`${m.sleep.nightsAtGoal} / ${m.sleep.nights}`} />
              <Stat label="Rhythm" value={m.sleep.steadiness ?? "—"} note={m.sleep.steadiness ? undefined : "needs 3+ nights"} />
            </div>
            {m.sleep.stages && stageTotal > 0 ? (
              <div className="mt-3" data-testid="report-stages">
                <p className="text-sm">Average stages over {m.sleep.stages.nights} night{m.sleep.stages.nights === 1 ? "" : "s"} recorded by your device:</p>
                <div className="mt-2 flex h-3 overflow-hidden rounded-full" aria-hidden>
                  {(["awake", "rem", "light", "deep"] as const).map((k) => (
                    <span key={k} className={`stage-${k}`} style={{ width: `${(m.sleep.stages![k] / stageTotal) * 100}%` }} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Awake {formatMinutes(m.sleep.stages.awake)} · REM {formatMinutes(m.sleep.stages.rem)} · Light/core {formatMinutes(m.sleep.stages.light)} · Deep {formatMinutes(m.sleep.stages.deep)}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Sleep stages appear only for nights a watch or ring recorded them; the phone doesn&apos;t measure stages.</p>
            )}
            {m.sleep.anyEstimated && <p className="mt-1 text-xs text-muted-foreground">Some nights only have bed and wake times, so their time asleep is estimated.</p>}
          </>
        )}
      </Section>

      <Section title="Body" coverage={m.body.coverage} testId="report-body">
        {m.body.entries === 0 ? (
          <p className="text-sm text-muted-foreground">No weigh-ins this week.</p>
        ) : (
          <p className="text-sm">
            {m.body.endKg !== null ? `Latest ${formatWeight(m.body.endKg, units)}` : ""}
            {m.body.changeKg !== null ? ` · ${m.body.changeKg > 0 ? "+" : m.body.changeKg < 0 ? "−" : "±"}${formatWeight(Math.abs(m.body.changeKg), units)} over the week` : ""} ({m.body.entries} weigh-in{m.body.entries === 1 ? "" : "s"})
          </p>
        )}
      </Section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold uppercase">Share or delete</h2>
        <div className="mt-3">
          <ReportActions weekStart={report.week_start} summary={shareText(m)} />
        </div>
      </section>
    </div>
  );
}
