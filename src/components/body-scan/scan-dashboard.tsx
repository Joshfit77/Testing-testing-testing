"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Camera, Info, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { LineSeriesChart } from "@/components/charts/charts";
import { Notice } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm";
import { NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compareScans, SCAN_MEASUREMENT_LABELS, SCAN_MEASUREMENTS, SCAN_POSE_LABELS, SCAN_POSES, type ScanPose, type ScanSummary } from "@/lib/domain/body-scan";
import type { UnitSystem } from "@/lib/domain/types";
import { displayLength, displayWeight, lengthUnit, weightUnit } from "@/lib/domain/units";
import { cn } from "@/lib/utils";
import { deleteBodyScanAction, withdrawBodyScanConsentAction } from "@/server/actions/body-scan";
import type { BodyTrends } from "@/server/services/body-scan";

function longDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function BodyScanDashboard({ scans, trends, units, savedId, canScan }: { scans: ScanSummary[]; trends: BodyTrends; units: UnitSystem; savedId: string | null; canScan: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  const wu = weightUnit(units);
  const lu = lengthUnit(units);
  return (
    <div className="space-y-5">
      {savedId && scans.some((s) => s.id === savedId) && <Notice tone="success">Scan saved. Only you can see it.</Notice>}
      {message && <Notice tone={message.ok ? "success" : "error"}>{message.text}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        {canScan ? (
          <Button asChild>
            <Link href="/progress/body-scan/new" data-testid="new-scan">
              <Camera aria-hidden /> New scan
            </Link>
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href="/profile/billing">New scans need Pro</Link>
          </Button>
        )}
        <p className="text-sm text-muted-foreground">
          {scans.length === 0 ? "No scans yet." : `${scans.length} scan${scans.length === 1 ? "" : "s"} · last on ${longDate(scans[0]!.takenOn)}`}
        </p>
      </div>

      {scans.length >= 2 && <Compare scans={scans} units={units} />}

      <Card>
        <CardHeader>
          <CardTitle>Scan history</CardTitle>
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Take your first scan to start a history. Scanning every 2–4 weeks under the same conditions makes changes easiest to see.</p>
          ) : (
            <ul className="space-y-3" data-testid="scan-history">
              {scans.map((s) => (
                <li key={s.id} className="rounded-xl border border-border bg-elevated/50 p-3" data-testid="scan-item">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{longDate(s.takenOn)}</p>
                      <p className="text-sm text-muted-foreground">
                        {[
                          s.weightKg != null ? `${displayWeight(s.weightKg, units)} ${wu}` : null,
                          ...SCAN_MEASUREMENTS.filter((m) => s.measurements[m] != null).map((m) => `${SCAN_MEASUREMENT_LABELS[m]} ${displayLength(s.measurements[m]!, units)} ${lu}`),
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Photos only"}
                      </p>
                      {s.note && <p className="text-sm">{s.note}</p>}
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete the scan from ${longDate(s.takenOn)}`}
                      disabled={pending}
                      onClick={async () => {
                        const ok = await confirmDialog({
                          title: "Delete this scan?",
                          message: "Its photos are deleted for good. Measurements saved with it stay in your measurement history.",
                          confirmLabel: "Delete",
                          destructive: true,
                        });
                        if (ok) run(() => deleteBodyScanAction(s.id));
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {SCAN_POSES.map((p) =>
                      s.photos[p] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link to a private photo
                        <img key={p} src={s.photos[p]!} alt={`${SCAN_POSE_LABELS[p]} photo, ${longDate(s.takenOn)}`} loading="lazy" className="aspect-[3/4] w-full rounded-lg object-cover" />
                      ) : (
                        <div key={p} className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                          No {SCAN_POSE_LABELS[p].toLowerCase()}
                        </div>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Trends trends={trends} units={units} />

      <Notice>
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
          <span>
            Body Scan doesn&apos;t estimate body fat. A phone camera can&apos;t measure body fat or visceral fat, and no independently validated estimate is built in, so the app doesn&apos;t guess. Your photos, weight and tape measurements show change over time.
          </span>
        </p>
      </Notice>

      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <ShieldCheck className="size-6 shrink-0 text-gold" aria-hidden />
          <CardTitle className="text-base">Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Scan photos are in private storage only your account can open, shown through links that expire after 10 minutes. They aren&apos;t sent to the AI coach or any other service, and they&apos;re included in your data export and deleted with your account.</p>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            data-testid="withdraw-consent"
            onClick={async () => {
              const ok = await confirmDialog({
                title: "Withdraw consent and delete all scans?",
                message: "Every scan and scan photo is deleted for good. Measurements and body weights stay in your history.",
                confirmLabel: "Delete all scans",
                destructive: true,
              });
              if (ok) run(withdrawBodyScanConsentAction);
            }}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />} Withdraw consent and delete all scans
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Compare({ scans, units }: { scans: ScanSummary[]; units: UnitSystem }) {
  // Oldest and newest by default.
  const [aId, setA] = useState(scans.at(-1)!.id);
  const [bId, setB] = useState(scans[0]!.id);
  const [pose, setPose] = useState<ScanPose>("front");
  const a = scans.find((s) => s.id === aId)!;
  const b = scans.find((s) => s.id === bId)!;
  const [earlier, later] = a.takenOn <= b.takenOn ? [a, b] : [b, a];
  const diff = useMemo(() => compareScans(earlier, later), [earlier, later]);
  const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`;
  const lu = lengthUnit(units);
  return (
    <Card data-testid="scan-compare">
      <CardHeader>
        <CardTitle>Compare</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["compare-a", "First", aId, setA],
              ["compare-b", "Second", bId, setB],
            ] as const
          ).map(([id, label, value, set]) => (
            <div key={id} className="space-y-1">
              <Label htmlFor={id}>{label}</Label>
              <NativeSelect id={id} value={value} onChange={(e) => set(e.target.value)}>
                {scans.map((s) => (
                  <option key={s.id} value={s.id}>
                    {longDate(s.takenOn)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
        <div role="radiogroup" aria-label="View" className="inline-flex rounded-xl border border-border bg-card p-1">
          {SCAN_POSES.map((p) => (
            <button key={p} role="radio" aria-checked={pose === p} onClick={() => setPose(p)} className={cn("h-9 rounded-lg px-3 text-sm font-semibold", pose === p ? "bg-elevated text-gold-highlight" : "text-muted-foreground")}>
              {SCAN_POSE_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[earlier, later].map((s) => (
            <figure key={s.id} className="space-y-1">
              {s.photos[pose] ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link to a private photo
                <img src={s.photos[pose]!} alt={`${SCAN_POSE_LABELS[pose]} photo, ${longDate(s.takenOn)}`} className="aspect-[3/4] w-full rounded-xl object-cover" />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">No {SCAN_POSE_LABELS[pose].toLowerCase()} photo</div>
              )}
              <figcaption className="text-center text-sm">{longDate(s.takenOn)}</figcaption>
            </figure>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3" data-testid="compare-changes">
          <div className="rounded-lg bg-elevated/60 p-2">
            <dt className="text-xs text-muted-foreground">Time between</dt>
            <dd className="font-semibold">
              {diff.days} day{diff.days === 1 ? "" : "s"}
            </dd>
          </div>
          {diff.weightKg != null && (
            <div className="rounded-lg bg-elevated/60 p-2">
              <dt className="text-xs text-muted-foreground">Body weight</dt>
              <dd className="font-semibold">
                {sign(displayWeight(diff.weightKg, units))} {weightUnit(units)}
              </dd>
            </div>
          )}
          {SCAN_MEASUREMENTS.filter((m) => diff.measurements[m] != null).map((m) => (
            <div key={m} className="rounded-lg bg-elevated/60 p-2">
              <dt className="text-xs text-muted-foreground">{SCAN_MEASUREMENT_LABELS[m]}</dt>
              <dd className="font-semibold">
                {sign(displayLength(diff.measurements[m]!, units))} {lu}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function Trends({ trends, units }: { trends: BodyTrends; units: UnitSystem }) {
  const wu = weightUnit(units);
  const lu = lengthUnit(units);
  const mData = trends.measurements.map((m) => ({
    date: m.date,
    ...Object.fromEntries(SCAN_MEASUREMENTS.map((k) => [k, m[k] == null ? null : displayLength(m[k]!, units)])),
  }));
  const used = SCAN_MEASUREMENTS.filter((k) => trends.measurements.some((m) => m[k] != null));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <LineSeriesChart
        title="Body weight"
        description={`Last 12 months (${wu})`}
        data={trends.weights.map((w) => ({ date: w.date, weight: displayWeight(w.kg, units) }))}
        xKey="date"
        xFormat="date"
        decimals={1}
        valueSuffix={` ${wu}`}
        series={[{ key: "weight", label: "Body weight" }]}
        emptyMessage="Log your weight, or add it to a scan, to see the trend."
      />
      <LineSeriesChart
        title="Measurements"
        description={`Last 12 months (${lu}), from scans and the measurement log`}
        data={used.length ? mData : []}
        xKey="date"
        xFormat="date"
        decimals={1}
        valueSuffix={` ${lu}`}
        series={used.map((k) => ({ key: k, label: SCAN_MEASUREMENT_LABELS[k] }))}
        emptyMessage="Add measurements to a scan to see them here."
      />
    </div>
  );
}
