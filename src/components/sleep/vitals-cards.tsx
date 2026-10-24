import { Activity, HeartPulse, Wind } from "lucide-react";
import { HRV_METHOD_LABEL, type SleepVitals } from "@/lib/domain/sleep";
import { cn } from "@/lib/utils";

/**
 * Overnight measurements the wearable recorded, one tile each. A series the device didn't record (or the member
 * didn't allow) says so instead of showing a number; nothing here is computed by the app.
 */
export function VitalsCards({ vitals, deviceName, compact, className }: { vitals: SleepVitals | null; deviceName: string | null; compact?: boolean; className?: string }) {
  const hr = vitals?.heartRate ?? null;
  const hrv = vitals?.hrv ?? null;
  const rr = vitals?.respiratoryRate ?? null;
  const tile = cn("rounded-xl bg-elevated p-3", compact && "p-2.5");
  const big = cn("font-display font-bold text-gold-highlight", compact ? "text-xl" : "text-2xl");
  return (
    <div className={className}>
      <dl className="grid grid-cols-3 gap-2">
        <div className={tile}>
          <dt className="flex items-center gap-1 text-xs text-muted-foreground">
            <HeartPulse className="size-3.5 text-gold" aria-hidden /> Heart rate
          </dt>
          <dd className={big}>{hr ? `${hr.avg}` : "—"}</dd>
          <dd className="text-xs text-muted-foreground">{hr ? `bpm average · ${hr.min}–${hr.max}` : "Not recorded"}</dd>
        </div>
        <div className={tile}>
          <dt className="flex items-center gap-1 text-xs text-muted-foreground">
            <Activity className="size-3.5 text-gold" aria-hidden /> HRV
          </dt>
          <dd className={big}>{hrv ? `${hrv.avgMs}` : "—"}</dd>
          <dd className="text-xs text-muted-foreground">{hrv ? `ms ${HRV_METHOD_LABEL[hrv.method]} · ${hrv.samples} reading${hrv.samples === 1 ? "" : "s"}` : "Not recorded"}</dd>
        </div>
        <div className={tile}>
          <dt className="flex items-center gap-1 text-xs text-muted-foreground">
            <Wind className="size-3.5 text-gold" aria-hidden /> Breathing
          </dt>
          <dd className={big}>{rr ? `${rr.avg}` : "—"}</dd>
          <dd className="text-xs text-muted-foreground">{rr ? `per min · ${rr.min}–${rr.max}` : "Not recorded"}</dd>
        </div>
      </dl>
      {!compact && (
        <p className="mt-2 text-xs text-muted-foreground">
          {hr || hrv || rr
            ? `Recorded by ${deviceName ?? "your device"} and shared through the health platform; the app only averages the samples that fall inside the night. Not a medical measurement.`
            : "Overnight heart rate, HRV and breathing appear when your watch records them and you allow the app to read them."}
        </p>
      )}
    </div>
  );
}

/** "Recorded by Apple Watch" or "Entered by hand": the one label that tells a measurement from an entry. */
export function RecordedBadge({ recorded, deviceName, className }: { recorded: boolean; deviceName: string | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-semibold", recorded ? "border-gold-muted/70 text-gold-highlight" : "border-border text-muted-foreground", className)}>
      {recorded ? `Recorded by ${deviceName ?? "your device"}` : "Entered by hand"}
    </span>
  );
}

export interface VitalsNight {
  nightOf: string;
  vitals: SleepVitals | null;
}

/**
 * Overnight measurements night by night across a range: one row of bars per series, from the nights a wearable
 * recorded. Nights without a reading leave a gap. The y-scale is each series' own range, so a flat line means a
 * steady value, not a small one.
 */
export function VitalsTrend({ nights, className }: { nights: VitalsNight[]; className?: string }) {
  const series: { key: string; label: string; unit: string; pick: (v: SleepVitals) => number | null; decimals: number }[] = [
    { key: "hr", label: "Heart rate", unit: "bpm", pick: (v) => v.heartRate?.avg ?? null, decimals: 0 },
    { key: "hrv", label: "HRV", unit: "ms", pick: (v) => v.hrv?.avgMs ?? null, decimals: 1 },
    { key: "rr", label: "Breathing", unit: "per min", pick: (v) => v.respiratoryRate?.avg ?? null, decimals: 1 },
  ];
  const rows = series
    .map((s) => {
      const points = nights.map((n) => ({ nightOf: n.nightOf, value: n.vitals ? s.pick(n.vitals) : null }));
      const values = points.map((p) => p.value).filter((v): v is number => v !== null);
      if (!values.length) return null;
      const lo = Math.min(...values);
      const hi = Math.max(...values);
      const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
      const f = 10 ** s.decimals;
      return { ...s, points, lo, hi, avg: Math.round(avg * f) / f, count: values.length };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (!rows.length) return <p className={cn("text-sm text-muted-foreground", className)}>No overnight measurements in this range. They appear for nights a watch recorded through Apple Health or Health Connect.</p>;
  return (
    <div className={cn("space-y-4", className)}>
      {rows.map((r) => (
        <figure key={r.key}>
          <figcaption className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">{r.label}</span>
            <span className="text-muted-foreground">
              avg <span className="text-foreground">{r.avg}</span> {r.unit} · {r.lo}–{r.hi} · {r.count} night{r.count === 1 ? "" : "s"}
            </span>
          </figcaption>
          <div className="mt-1 flex h-12 items-end gap-px rounded-lg bg-elevated/40 px-1 pt-1" role="img" aria-label={`${r.label}: ${r.points.filter((p) => p.value !== null).map((p) => `${p.nightOf} ${p.value} ${r.unit}`).join(", ")}`}>
            {r.points.map((p) => {
              const span = r.hi - r.lo;
              const h = p.value === null ? 0 : span === 0 ? 60 : 20 + ((p.value - r.lo) / span) * 80;
              return <span key={p.nightOf} aria-hidden className={cn("flex-1 rounded-t-sm", p.value === null ? "bg-transparent" : "bg-gold/80")} style={{ height: `${h}%` }} title={p.value === null ? undefined : `${p.nightOf}: ${p.value} ${r.unit}`} />;
            })}
          </div>
        </figure>
      ))}
      <p className="text-xs text-muted-foreground">Averages of the readings your watch took while you slept, as shared through the health platform. Not a medical measurement; a change worth acting on is one your clinician confirms.</p>
    </div>
  );
}
