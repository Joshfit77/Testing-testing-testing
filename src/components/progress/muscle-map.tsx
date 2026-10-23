"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronRight, Info, Loader2 } from "lucide-react";
import { BarSeriesChart, LineSeriesChart } from "@/components/charts/charts";
import { Notice } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { BODY_REGIONS, BODY_REGION_LABELS, type BodyRegion } from "@/lib/domain/body-regions";
import { volumeBand, type RegionStats, type VolumeBand } from "@/lib/domain/body-map";
import {
  formatMeasure,
  levelLabel,
  measureLabel,
  needsBodyweight,
  STANDARDS_LABELS,
  STRENGTH_RANK_LABELS,
  STRENGTH_RANKS,
  type BenchmarkResult,
  type OverallRank,
  type RegionRank,
  type StandardsTable,
} from "@/lib/domain/strength-ranks";
import type { UnitSystem } from "@/lib/domain/types";
import { displayWeight, formatDuration, formatWeight, weightUnit } from "@/lib/domain/units";
import { cn } from "@/lib/utils";
import { setStrengthStandardsAction } from "@/server/actions/body-map";
import { BodyFigure, type FigureView, type RegionPaint } from "./body-figure";
import { BELOW_BRONZE_COLOR, RANK_COLORS, StrengthRankEmblem } from "./strength-rank-emblem";

const FRONT: BodyRegion[] = ["shoulders", "chest", "biceps", "forearms", "abdominals", "quadriceps", "calves"];
const VOLUME_COLORS: Record<VolumeBand, string> = { none: "#1f1d19", low: "#7a6230", in_range: "#cfa53e", high: "#d9774f", no_range: "#8b7d5c" };
const VOLUME_LABELS: Record<VolumeBand, string> = {
  none: "No sets this week",
  low: "Below the usual range",
  in_range: "In the usual range",
  high: "Above the usual range",
  no_range: "Trained (no set range for this region)",
};
const RECORD_LABELS: Record<string, string> = {
  estimated_1rm: "Estimated 1-rep max",
  max_weight: "Heaviest set",
  max_reps: "Most reps",
  max_set_volume: "Best set volume",
  max_duration: "Longest hold",
};

function shortDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.slice(0, 4) === new Date().toISOString().slice(0, 4) ? undefined : "numeric", timeZone: "UTC" });
}

function rankFill(level: number | null): string {
  if (level == null) return "#1f1d19";
  if (level === 0) return BELOW_BRONZE_COLOR;
  return RANK_COLORS[level]!.base;
}

export interface MuscleMapProps {
  regions: RegionRank[];
  stats: RegionStats[];
  overall: OverallRank;
  table: StandardsTable | null;
  bodyweight: { kg: number; date: string } | null;
  staleBodyweightDate: string | null;
  units: UnitSystem;
  rulesVersion: string;
  initialRegion: BodyRegion | null;
}

export function MuscleMap(props: MuscleMapProps) {
  const { regions, stats, overall, table, bodyweight, units } = props;
  const [view, setView] = useState<FigureView>(props.initialRegion && !FRONT.includes(props.initialRegion) ? "back" : "front");
  const [mode, setMode] = useState<"rank" | "sets">("rank");
  const [selected, setSelected] = useState<BodyRegion | null>(props.initialRegion);
  const byRegion = useMemo(() => new Map(regions.map((r) => [r.region, r])), [regions]);
  const statsBy = useMemo(() => new Map(stats.map((s) => [s.region, s])), [stats]);

  // Keep the selection in the address so it can be shared or survive a reload.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("region", selected);
    else url.searchParams.delete("region");
    window.history.replaceState(window.history.state, "", url);
  }, [selected]);

  const paint = useMemo(() => {
    const out = {} as Record<BodyRegion, RegionPaint>;
    for (const r of BODY_REGIONS) {
      if (mode === "rank") {
        const rr = byRegion.get(r)!;
        out[r] = { fill: rankFill(rr.level), hatched: rr.level == null, label: levelLabel(rr.level) };
      } else {
        const band = volumeBand(statsBy.get(r)!);
        out[r] = { fill: VOLUME_COLORS[band], hatched: band === "none", label: `${statsBy.get(r)!.setsThisWeek} sets this week, ${VOLUME_LABELS[band].toLowerCase()}` };
      }
    }
    return out;
  }, [mode, byRegion, statsBy]);

  const select = (r: BodyRegion) => {
    setSelected(r);
    if (FRONT.includes(r) !== (view === "front") && r !== "shoulders" && r !== "forearms" && r !== "calves") setView(FRONT.includes(r) ? "front" : "back");
    requestAnimationFrame(() => document.getElementById("region-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="space-y-5">
      <StandardsChooser table={table} />
      <OverallCard overall={overall} table={table} bodyweight={bodyweight} staleBodyweightDate={props.staleBodyweightDate} units={units} />

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="radiogroup" aria-label="Figure view" className="inline-flex rounded-xl border border-border bg-card p-1">
              {(["front", "back"] as const).map((v) => (
                <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)} className={cn("h-9 rounded-lg px-3 text-sm font-semibold", view === v ? "bg-elevated text-gold-highlight" : "text-muted-foreground")}>
                  {v === "front" ? "Front" : "Back"}
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label="Colour by" className="inline-flex rounded-xl border border-border bg-card p-1">
              {(
                [
                  ["rank", "Strength rank"],
                  ["sets", "Sets this week"],
                ] as const
              ).map(([m, label]) => (
                <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn("h-9 rounded-lg px-3 text-sm font-semibold", mode === m ? "bg-elevated text-gold-highlight" : "text-muted-foreground")}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
            <div className="flex justify-center">
              <BodyFigure view={view} paint={paint} selected={selected} onSelect={select} />
            </div>
            <div className="space-y-3">
              <Legend mode={mode} />
              <ul className="grid gap-1.5" aria-label="Body regions" data-testid="region-list">
                {BODY_REGIONS.map((r) => {
                  const rr = byRegion.get(r)!;
                  const st = statsBy.get(r)!;
                  return (
                    <li key={r}>
                      <button
                        onClick={() => select(r)}
                        aria-current={selected === r ? "true" : undefined}
                        className={cn("flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm", selected === r ? "border-gold bg-gold/10" : "border-border bg-elevated/60 hover:border-gold-muted")}
                        data-testid={`region-${r}`}
                      >
                        <span className="size-3 shrink-0 rounded-sm border border-black/40" style={{ background: paint[r].hatched ? "repeating-linear-gradient(45deg,#1f1d19 0 3px,#4a4436 3px 5px)" : paint[r].fill }} aria-hidden />
                        <span className="min-w-0 flex-1 font-medium">{BODY_REGION_LABELS[r]}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{mode === "rank" ? levelLabel(rr.level) : `${st.setsThisWeek} set${st.setsThisWeek === 1 ? "" : "s"}`}</span>
                        <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected && <RegionDetail rank={byRegion.get(selected)!} stats={statsBy.get(selected)!} table={table} bodyweight={bodyweight} units={units} />}

      <ScoringNote rulesVersion={props.rulesVersion} />
    </div>
  );
}

function StandardsChooser({ table }: { table: StandardsTable | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string } | null>(null);
  const choose = (t: StandardsTable) =>
    start(async () => {
      const r = await setStrengthStandardsAction(t);
      // On success the line above the buttons already says which table is in use.
      setMsg(r.ok ? null : { text: r.error });
      if (r.ok) router.refresh();
    });
  const buttons = (
    <div className="flex flex-wrap gap-2">
      {(["men", "women"] as const).map((t) => (
        <Button key={t} size="sm" variant={table === t ? "default" : "secondary"} disabled={pending || table === t} onClick={() => choose(t)} aria-pressed={table === t}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {STANDARDS_LABELS[t]}
        </Button>
      ))}
    </div>
  );
  return (
    <div className={cn("space-y-2 rounded-2xl border p-4", table ? "border-border bg-card" : "border-gold-muted/60 bg-gold/5")} data-testid="standards-chooser">
      {table ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            Comparing with the <span className="font-semibold">{STANDARDS_LABELS[table].toLowerCase()}</span>.
          </p>
          {buttons}
        </div>
      ) : (
        <>
          <p className="font-semibold">Which strength table should your ranks use?</p>
          <p className="text-sm text-muted-foreground">Typical strength differs between men and women, so each lift has two tables. Pick one; you can change it any time. It’s used only for these ranks.</p>
          {buttons}
        </>
      )}
      {msg && (
        <p role="alert" className="text-sm text-[#f08a8a]">
          {msg.text}
        </p>
      )}
    </div>
  );
}

function OverallCard({ overall, table, bodyweight, staleBodyweightDate, units }: { overall: OverallRank; table: StandardsTable | null; bodyweight: MuscleMapProps["bodyweight"]; staleBodyweightDate: string | null; units: UnitSystem }) {
  return (
    <Card data-testid="overall-rank">
      <CardContent className="flex items-start gap-4 pt-5">
        <StrengthRankEmblem level={overall.level} className="size-16" />
        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall strength rank</p>
          <p className="font-display text-2xl uppercase text-gold-highlight">{levelLabel(overall.level)}</p>
          <p className="text-sm text-muted-foreground">{overall.explanation}</p>
          <p className="text-sm text-muted-foreground">
            {bodyweight ? (
              <>
                Body weight used: {formatWeight(bodyweight.kg, units)} (logged {shortDate(bodyweight.date)}).
              </>
            ) : staleBodyweightDate ? (
              <>Your last body weight is from {shortDate(staleBodyweightDate)}. Log a current one to rank barbell lifts, pull-ups and dips.</>
            ) : (
              <>Log your body weight to rank barbell lifts, pull-ups and dips.</>
            )}
            {!table && " Choose a strength table above to see ranks."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ mode }: { mode: "rank" | "sets" }) {
  const items =
    mode === "rank"
      ? [
          ...STRENGTH_RANKS.map((r, i) => ({ color: RANK_COLORS[i + 1]!.base, label: STRENGTH_RANK_LABELS[r] })),
          { color: BELOW_BRONZE_COLOR, label: "Working toward Bronze" },
          { color: null, label: "Not assessed" },
        ]
      : (Object.keys(VOLUME_LABELS) as VolumeBand[]).map((b) => ({ color: b === "none" ? null : VOLUME_COLORS[b], label: VOLUME_LABELS[b] }));
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Legend" data-testid="map-legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-black/40" style={{ background: i.color ?? "repeating-linear-gradient(45deg,#1f1d19 0 3px,#4a4436 3px 5px)" }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function bestSetText(b: BenchmarkResult, units: UnitSystem): string {
  if (!b.best) return "";
  if (b.benchmark.measure === "seconds") return formatDuration(b.best.seconds ?? 0);
  if (b.benchmark.measure === "reps") return `${b.best.reps} reps`;
  const load = b.best.weightKg ? formatWeight(b.best.weightKg, units) : "body weight";
  return b.benchmark.measure === "bodyweight_ratio" ? `${b.best.weightKg ? `+${load}` : "body weight"} × ${b.best.reps}` : `${load} × ${b.best.reps}`;
}

function RegionDetail({ rank, stats, table, bodyweight, units }: { rank: RegionRank; stats: RegionStats; table: StandardsTable | null; bodyweight: MuscleMapProps["bodyweight"]; units: UnitSystem }) {
  const next = rank.level != null && rank.level < 6 ? STRENGTH_RANK_LABELS[STRENGTH_RANKS[rank.level]!] : null;
  const rep = rank.representative;
  const u = weightUnit(units);
  const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? "new" : "—") : `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%`);
  return (
    <section id="region-detail" className="scroll-mt-4 space-y-4" aria-labelledby="region-detail-title" data-testid="region-detail">
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <StrengthRankEmblem level={rank.level} />
          <div className="min-w-0">
            <CardTitle id="region-detail-title">{rank.label}</CardTitle>
            <p className="text-sm text-gold-highlight" data-testid="region-rank">
              {levelLabel(rank.level)}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rank.level == null ? (
            <p className="text-sm text-muted-foreground" data-testid="region-not-assessed">
              Not assessed: {rank.notAssessed}
            </p>
          ) : (
            <>
              {next ? (
                <div className="space-y-1">
                  <ProgressBar value={(rank.progress ?? 0) * 100} label={`Progress toward ${next}`} />
                  <p className="text-xs text-muted-foreground">
                    {Math.round((rank.progress ?? 0) * 100)}% of the way to {next}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">The highest rank.</p>
              )}
              {rep && (
                <p className="text-sm" data-testid="region-representative">
                  Set by your best {rep.benchmark.name}: {bestSetText(rep, units)} on {shortDate(rep.date!)}
                  {rep.benchmark.measure === "load_ratio" || rep.benchmark.measure === "bodyweight_ratio" ? (
                    <>
                      {" "}
                      → {formatMeasure(rep.benchmark.measure, rep.value!)} <span className="text-muted-foreground">(estimated 1-rep max)</span>
                    </>
                  ) : null}
                  .
                </p>
              )}
            </>
          )}

          <details className="rounded-xl border border-border bg-elevated/50 p-3 text-sm" data-testid="region-scoring">
            <summary className="cursor-pointer font-semibold">How this rank is scored</summary>
            {rank.benchmarks.length === 0 ? (
              <p className="mt-2 text-muted-foreground">{rank.notAssessed}</p>
            ) : (
              <div className="mt-2 space-y-3">
                <p className="text-muted-foreground">
                  The region takes the rank of its best benchmark lift. More sets or more similar exercises don’t raise it; only a better result on one of these lifts does. Last 12 months, completed working sets only.
                </p>
                {rank.benchmarks.map((b) => (
                  <div key={b.benchmark.slug} className="space-y-1">
                    <p className="font-medium">
                      {b.benchmark.name} <span className="font-normal text-muted-foreground">· {measureLabel(b.benchmark.measure)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      {b.level != null ? (
                        <>
                          Your best: {formatMeasure(b.benchmark.measure, b.value!)} ({bestSetText(b, units)}, {shortDate(b.date!)}) → {levelLabel(b.level)}
                        </>
                      ) : (
                        <>Not assessed: {b.notAssessed}</>
                      )}
                      {b.ignoredImplausible > 0 && ` ${b.ignoredImplausible} set${b.ignoredImplausible === 1 ? " looked" : "s looked"} like a typo and ${b.ignoredImplausible === 1 ? "was" : "were"} ignored.`}
                    </p>
                    {table && (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[22rem] text-xs">
                          <caption className="sr-only">
                            {b.benchmark.name} thresholds, {STANDARDS_LABELS[table].toLowerCase()}
                          </caption>
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              {STRENGTH_RANKS.map((r) => (
                                <th key={r} scope="col" className="pr-2 font-medium">
                                  {STRENGTH_RANK_LABELS[r]}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {b.benchmark[table].map((t, i) => (
                                <td key={i} className="pr-2 tabular-nums">
                                  {b.benchmark.measure === "reps" ? t : b.benchmark.measure === "seconds" ? `${t} s` : `${t}×`}
                                  {needsBodyweight(b.benchmark.measure) && bodyweight ? <span className="block text-muted-foreground">{displayWeight(t * bodyweight.kg, units, 0)} {u}</span> : null}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Training</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.year.workouts === 0 ? (
            <p className="text-sm text-muted-foreground">No completed sets for this region in the last 12 months. Exercises that train it show up here once you log them.</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" data-testid="region-stats">
                <Stat label="Workouts (28 days)" value={String(stats.last28.workouts)} sub={`${delta(stats.last28.workouts, stats.previous28.workouts)} vs the 28 days before`} />
                <Stat
                  label="Sets a week (28-day average)"
                  value={String(Math.round((stats.last28.sets / 4) * 10) / 10)}
                  sub={stats.setRange ? `Usual range ${stats.setRange[0]}–${stats.setRange[1]} a week` : `${stats.last28.sets} sets in 28 days`}
                />
                <Stat label="Volume (28 days)" value={`${displayWeight(stats.last28.volumeKg, units, 0).toLocaleString()} ${u}`} sub={`${delta(stats.last28.volumeKg, stats.previous28.volumeKg)} vs the 28 days before`} />
                <Stat label="Per week" value={`${stats.last28.perWeek}×`} sub={`${stats.year.workouts} workouts in 12 months`} />
              </dl>
              <BarSeriesChart
                title="Sets per week"
                description="Last 12 weeks. A primary muscle counts 1 per set, a secondary one ½."
                data={stats.weekly.map((w) => ({ date: w.weekStart, sets: w.sets }))}
                xKey="date"
                xFormat="date"
                decimals={1}
                series={[{ key: "sets", label: "Sets" }]}
                referenceLine={stats.setRange ? { value: stats.setRange[0], label: `Range starts at ${stats.setRange[0]}` } : undefined}
              />
              {stats.strength && stats.strength.points.length > 0 && (
                <LineSeriesChart
                  title={`${stats.strength.name}: estimated 1-rep max`}
                  description={`Best estimate each month (Epley formula, sets of 1–12 reps), in ${u}. ${
                    stats.previous28.bestE1rmKg != null && stats.last28.bestE1rmKg != null
                      ? `Last 28 days ${formatWeight(stats.last28.bestE1rmKg, units)} vs ${formatWeight(stats.previous28.bestE1rmKg, units)} the 28 days before.`
                      : ""
                  }`}
                  data={stats.strength.points.map((p) => ({ date: `${p.month}-01`, e1rm: displayWeight(p.e1rmKg, units) }))}
                  xKey="date"
                  xFormat="date"
                  decimals={1}
                  valueSuffix={` ${u}`}
                  series={[{ key: "e1rm", label: "Estimated 1RM" }]}
                />
              )}
              <div>
                <h3 className="mb-1.5 text-sm font-semibold">Exercises (12 months)</h3>
                <ul className="divide-y divide-border rounded-xl border border-border text-sm" data-testid="region-exercises">
                  {stats.exercises.slice(0, 8).map((e) => (
                    <li key={e.slug} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0">
                        <a href={`/train/exercises/${e.slug}/history`} className="font-medium hover:underline">
                          {e.name}
                        </a>{" "}
                        <span className="text-xs text-muted-foreground">{e.role === "primary" ? "main muscle" : "assists"}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {e.sets} set{e.sets === 1 ? "" : "s"} · last {shortDate(e.lastDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          {stats.records.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold">Personal records</h3>
              <ul className="space-y-1 text-sm" data-testid="region-records">
                {stats.records.map((r) => (
                  <li key={`${r.slug}-${r.recordType}`} className="flex justify-between gap-2">
                    <span>
                      {r.name} · {RECORD_LABELS[r.recordType]}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {r.recordType === "max_reps" ? `${r.value} reps` : r.recordType === "max_duration" ? formatDuration(r.value) : r.recordType === "max_set_volume" ? `${displayWeight(r.value, units, 0)} ${u}` : formatWeight(r.value, units)}
                      {r.recordType === "estimated_1rm" ? " (est.)" : ""} · {shortDate(r.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-elevated/60 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-xl tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground">{sub}</dd>
    </div>
  );
}

function ScoringNote({ rulesVersion }: { rulesVersion: string }) {
  return (
    <Notice>
      <p className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
        <span>
          <span className="font-semibold">{rulesVersion}.</span> These ranks follow the app’s own provisional rules, set by hand to roughly match common strength tables; they are not validated standards. One-rep maxes are estimates. Each lift is compared only with its own table, and dumbbell and machine lifts aren’t ranked because their loads aren’t comparable. Ranks come only from your logged workouts, never from photos, and are separate from your 27 milestone badges.
        </span>
      </p>
    </Notice>
  );
}
