import { clockMinutesInTz, formatClock, formatDuration, minutesBetween } from "@/lib/domain/sleep";
import type { SleepStageRow } from "@/server/services/sleep";
import { cn } from "@/lib/utils";

export type StageKey = SleepStageRow["stage"];
export const STAGE_LABEL: Record<StageKey, string> = { awake: "Awake", light: "Light", deep: "Deep", rem: "REM", asleep: "Asleep (stage not given)", unknown: "Unknown" };
/** Deep sits lowest and darkest, awake highest and palest, as sleep charts conventionally draw them. */
const STAGE_ROW: Record<StageKey, number> = { awake: 0, rem: 1, light: 2, asleep: 2, unknown: 2, deep: 3 };
const STAGE_FILL: Record<StageKey, string> = {
  awake: "bg-champagne/70",
  rem: "bg-gold-highlight",
  light: "bg-gold/80",
  asleep: "bg-gold/60",
  unknown: "bg-elevated",
  deep: "bg-bronze",
};

export interface StageTotals {
  /** Minutes per stage, only for stages that appear. */
  minutes: Partial<Record<StageKey, number>>;
  /** Minutes spent asleep across all stage intervals (everything except awake). */
  asleepMinutes: number;
  /** Share of asleep time per sleeping stage, as whole percentages. */
  pct: Partial<Record<Exclude<StageKey, "awake">, number>>;
}

/** Totals and shares from the recorded intervals. Gaps between intervals are unknown time and count toward nothing. */
export function stageTotals(stages: SleepStageRow[]): StageTotals {
  const minutes: Partial<Record<StageKey, number>> = {};
  for (const s of stages) minutes[s.stage] = (minutes[s.stage] ?? 0) + minutesBetween(s.started_at, s.ended_at);
  const asleep = (Object.keys(minutes) as StageKey[]).filter((k) => k !== "awake").reduce((acc, k) => acc + (minutes[k] ?? 0), 0);
  const pct: StageTotals["pct"] = {};
  for (const k of ["deep", "rem", "light", "asleep", "unknown"] as const) if (minutes[k] && asleep) pct[k] = Math.round((minutes[k]! / asleep) * 100);
  return { minutes, asleepMinutes: asleep, pct };
}

/**
 * The night's recorded stages as a hypnogram: time across, stage down (awake at the top, deep at the bottom), each
 * interval a block exactly as the device recorded it. Server-rendered markup, no library.
 */
export function StageTimeline({ stages, bedAt, wakeAt, timeZone, className }: { stages: SleepStageRow[]; bedAt: string; wakeAt: string; timeZone: string; className?: string }) {
  const start = Date.parse(bedAt);
  const end = Date.parse(wakeAt);
  const span = Math.max(1, end - start);
  const pct = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(iso) - start) / span) * 100));
  // Hour ticks on the hour, at most every two hours when the night is long.
  const ticks: { left: number; label: string }[] = [];
  const firstHour = new Date(start);
  firstHour.setUTCMinutes(0, 0, 0);
  const stepMs = span > 10 * 3_600_000 ? 2 * 3_600_000 : 3_600_000;
  for (let t = firstHour.getTime() + 3_600_000; t < end; t += stepMs) {
    if (t <= start) continue;
    ticks.push({ left: ((t - start) / span) * 100, label: formatClock(clockMinutesInTz(new Date(t).toISOString(), timeZone)) });
  }
  const rows: StageKey[] = ["awake", "rem", "light", "deep"];
  return (
    <figure className={cn("space-y-2", className)}>
      <div className="grid grid-cols-[3.25rem_1fr] gap-x-2">
        <div className="grid grid-rows-4 text-[0.6875rem] leading-none text-muted-foreground" aria-hidden>
          {rows.map((r) => (
            <span key={r} className="flex items-center">
              {STAGE_LABEL[r]}
            </span>
          ))}
        </div>
        <div className="relative h-24 rounded-lg border border-border bg-elevated/40" role="img" aria-label={`Sleep stages from ${formatClock(clockMinutesInTz(bedAt, timeZone))} to ${formatClock(clockMinutesInTz(wakeAt, timeZone))}`}>
          {rows.map((r, i) => (
            <span key={r} aria-hidden className="absolute inset-x-0 border-t border-border/60" style={{ top: `${(i / 4) * 100}%` }} />
          ))}
          {stages.map((s, i) => (
            <span
              key={`${s.session_id}-${i}`}
              aria-hidden
              className={cn("absolute rounded-[3px]", STAGE_FILL[s.stage])}
              style={{ left: `${pct(s.started_at)}%`, width: `${Math.max(0.4, pct(s.ended_at) - pct(s.started_at))}%`, top: `calc(${(STAGE_ROW[s.stage] / 4) * 100}% + 3px)`, height: "calc(25% - 6px)" }}
            />
          ))}
          {ticks.map((t) => (
            <span key={t.label} aria-hidden className="absolute bottom-0 top-0 border-l border-dashed border-border/70" style={{ left: `${t.left}%` }} />
          ))}
        </div>
        <span />
        <div className="relative h-4 text-[0.625rem] text-muted-foreground" aria-hidden>
          <span className="absolute left-0">{formatClock(clockMinutesInTz(bedAt, timeZone))}</span>
          {ticks.map((t) => (
            <span key={t.label} className="absolute -translate-x-1/2" style={{ left: `${t.left}%` }}>
              {t.label}
            </span>
          ))}
          <span className="absolute right-0">{formatClock(clockMinutesInTz(wakeAt, timeZone))}</span>
        </div>
      </div>
      <figcaption className="sr-only">
        {stages.map((s) => `${formatClock(clockMinutesInTz(s.started_at, timeZone))} to ${formatClock(clockMinutesInTz(s.ended_at, timeZone))}: ${STAGE_LABEL[s.stage]}, ${formatDuration(minutesBetween(s.started_at, s.ended_at))}`).join("; ")}
      </figcaption>
    </figure>
  );
}

/** Stage shares as one stacked bar (deep, REM, light, then awake as time not counted), for the hub and history. */
export function StageBar({ totals, className }: { totals: StageTotals; className?: string }) {
  const parts = (["deep", "rem", "light", "asleep", "unknown"] as const).filter((k) => totals.minutes[k]);
  const awake = totals.minutes.awake ?? 0;
  const whole = totals.asleepMinutes + awake;
  if (!whole) return null;
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-elevated" role="img" aria-label={[...parts.map((k) => `${STAGE_LABEL[k]} ${formatDuration(totals.minutes[k]!)}`), awake ? `Awake ${formatDuration(awake)}` : ""].filter(Boolean).join(", ")}>
        {parts.map((k) => (
          <span key={k} aria-hidden className={STAGE_FILL[k]} style={{ width: `${(totals.minutes[k]! / whole) * 100}%` }} />
        ))}
        {awake > 0 && <span aria-hidden className={STAGE_FILL.awake} style={{ width: `${(awake / whole) * 100}%` }} />}
      </div>
      <dl className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground" aria-hidden>
        {parts.map((k) => (
          <div key={k} className="flex items-center gap-1">
            <span className={cn("inline-block size-2 rounded-sm", STAGE_FILL[k])} />
            <dt>{STAGE_LABEL[k].replace(" (stage not given)", "")}</dt>
            <dd className="text-foreground">
              {formatDuration(totals.minutes[k]!)}
              {totals.pct[k] !== undefined ? ` · ${totals.pct[k]}%` : ""}
            </dd>
          </div>
        ))}
        {awake > 0 && (
          <div className="flex items-center gap-1">
            <span className={cn("inline-block size-2 rounded-sm", STAGE_FILL.awake)} />
            <dt>Awake</dt>
            <dd className="text-foreground">{formatDuration(awake)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
