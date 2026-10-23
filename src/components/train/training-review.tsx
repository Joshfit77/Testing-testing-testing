"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Activity, Check, ChevronRight, Loader2, MessageSquare, SlidersHorizontal, TrendingDown, TrendingUp, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/common/states";
import { cn } from "@/lib/utils";
import type { Recommendation, TrainingReview } from "@/lib/domain/adaptive-training";
import { displayWeight, weightUnit } from "@/lib/domain/units";
import type { UnitSystem } from "@/lib/domain/types";
import { acceptRecommendationAction, rejectRecommendationAction, restoreRecommendationAction, undoAdjustmentAction } from "@/server/actions/adaptive-training";

type Result = { ok: true; message: string } | { ok: false; error: string };

const CONFIDENCE: Record<Recommendation["confidence"], string> = { high: "Strong evidence", moderate: "Some evidence", low: "Little evidence" };

function RecommendationCard({ rec, units, onDone }: { rec: Recommendation; units: UnitSystem; onDone: (r: Result) => void }) {
  const [pending, start] = useTransition();
  const [modifying, setModifying] = useState(false);
  const c = rec.change;
  const [weight, setWeight] = useState(c?.kind === "exercise_target" ? String(displayWeight(c.weightKg, units)) : "");
  const [reps, setReps] = useState(c?.kind === "exercise_target" && c.reps ? String(c.reps) : "");
  const [percent, setPercent] = useState(c?.kind === "deload_week" ? String(Math.round(c.setsFactor * 100)) : "60");
  const [rpe, setRpe] = useState(c?.kind === "deload_week" ? String(c.rpeCap) : "7");
  const [delta, setDelta] = useState(c?.kind === "volume_change" ? String(c.deltaSets) : "1");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) onDone(r);
      else setError(r.error);
    });
  const modification = () => {
    if (!modifying || !c) return undefined;
    if (c.kind === "exercise_target") return { weight: Number(weight), reps: reps ? Number(reps) : null };
    if (c.kind === "deload_week") return { setsPercent: Number(percent), rpeCap: Number(rpe) };
    return { deltaSets: Number(delta) };
  };

  return (
    <li className="rounded-2xl border border-gold-muted/60 bg-[#141210] p-4" data-testid="training-recommendation">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{rec.title}</h3>
        <Badge variant="secondary">{CONFIDENCE[rec.confidence]}</Badge>
      </div>
      <p className="mt-1 text-sm">{rec.summary}</p>
      <details className="mt-2 text-sm" open>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-gold">Why</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
          {rec.why.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </details>
      {rec.blocked && <p className="mt-2 text-xs text-muted-foreground">{rec.blocked}</p>}

      {modifying && c && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {c.kind === "exercise_target" && (
            <>
              <label className="text-xs text-muted-foreground">
                Load ({weightUnit(units)})
                <Input type="number" inputMode="decimal" step="0.5" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1" />
              </label>
              <label className="text-xs text-muted-foreground">
                Reps
                <Input type="number" inputMode="numeric" min="1" max="100" value={reps} onChange={(e) => setReps(e.target.value)} className="mt-1" />
              </label>
            </>
          )}
          {c.kind === "deload_week" && (
            <>
              <label className="text-xs text-muted-foreground">
                Keep % of sets (40–80)
                <Input type="number" min="40" max="80" step="5" value={percent} onChange={(e) => setPercent(e.target.value)} className="mt-1" />
              </label>
              <label className="text-xs text-muted-foreground">
                Effort cap (RPE 5–8)
                <Input type="number" min="5" max="8" step="0.5" value={rpe} onChange={(e) => setRpe(e.target.value)} className="mt-1" />
              </label>
            </>
          )}
          {c.kind === "volume_change" && (
            <label className="text-xs text-muted-foreground">
              Sets to add (−2 to 2)
              <Input type="number" min="-2" max="2" step="1" value={delta} onChange={(e) => setDelta(e.target.value)} className="mt-1" />
            </label>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {c && (
          <Button size="sm" disabled={pending} onClick={() => run(() => acceptRecommendationAction(rec.key, modification()))}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} {modifying ? "Apply my version" : "Accept"}
          </Button>
        )}
        {c && !modifying && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setModifying(true)}>
            <SlidersHorizontal aria-hidden /> Modify
          </Button>
        )}
        {rec.link && (
          <Button size="sm" variant="secondary" asChild>
            <Link href={rec.link.href}>
              {rec.link.label} <ChevronRight aria-hidden />
            </Link>
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => rejectRecommendationAction(rec.key))}>
          <X aria-hidden /> {c ? "Not now" : "Got it"}
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/coach?q=${encodeURIComponent(`About my training review: "${rec.title}". ${rec.summary} What do you think?`)}`}>
            <MessageSquare aria-hidden /> Ask the coach
          </Link>
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#f08a8a]">
          {error}
        </p>
      )}
    </li>
  );
}

export function TrainingReviewView({
  review,
  units,
  programName,
  adjustments,
}: {
  review: TrainingReview;
  units: UnitSystem;
  programName: string | null;
  adjustments: { id: string; kind: string; summary: string; source: string; created_at: string; reverted_at: string | null }[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const done = (r: Result) => {
    setNotice(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    router.refresh();
  };
  const w = (kg: number) => `${displayWeight(kg, units)} ${weightUnit(units)}`;
  const c = review.consistency;
  const trackedVolume = review.volume.filter((v) => v.range && (v.setsPerWeek > 0 || v.status === "below"));

  return (
    <div className="space-y-6">
      {notice && (
        <Notice tone={notice.ok ? "success" : "error"}>
          {notice.text}
        </Notice>
      )}

      <section aria-labelledby="recs">
        <h2 id="recs" className="mb-2 text-lg font-semibold">
          Suggestions
        </h2>
        {review.recommendations.length ? (
          <ul className="space-y-3">
            {review.recommendations.map((r) => (
              <RecommendationCard key={r.key} rec={r} units={units} onDone={done} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            Nothing to change right now. Keep logging your sets (with RPE if you can) and recovery check-ins; suggestions appear when your data supports them.
          </p>
        )}
      </section>

      {review.turnedDown.length > 0 && (
        <section aria-labelledby="turned-down" className="rounded-2xl border border-dashed border-border p-4">
          <h2 id="turned-down" className="text-sm font-semibold">
            Turned down
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Suggestions you said no to that still apply. Bring one back and it returns to the list above.</p>
          <ul className="mt-2 space-y-2">
            {review.turnedDown.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{r.title}</span>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => done(await restoreRecommendationAction(r.key)))}>
                  Show again
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="consistency" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="consistency" className="flex items-center gap-2 font-semibold">
          <Activity className="size-4 text-gold" aria-hidden /> Consistency
        </h2>
        <p className="mt-1 text-sm">
          {c.sessionsLast28} workout{c.sessionsLast28 === 1 ? "" : "s"} in the last 4 weeks
          {c.plannedLast28 ? ` of about ${c.plannedLast28} planned${c.pct != null ? ` (${c.pct}%)` : ""}` : ""}
          {programName ? ` on ${programName}` : ""}. Last workout: {c.lastSession ?? "none yet"}.
        </p>
        {review.weeksSinceDeload != null && <p className="mt-1 text-sm text-muted-foreground">{review.weeksSinceDeload} weeks since the last lighter week in this program.</p>}
      </section>

      <section aria-labelledby="lifts" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="lifts" className="font-semibold">
          Strength trends <span className="text-sm font-normal text-muted-foreground">(estimated 1-rep max, last 8 weeks)</span>
        </h2>
        {review.lifts.length ? (
          <ul className="mt-2 divide-y divide-border text-sm">
            {review.lifts.slice(0, 10).map((l) => (
              <li key={l.slug} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{l.name}</span>
                <span className={cn("flex shrink-0 items-center gap-1", l.changePct > 0 ? "text-[#5fc49a]" : l.changePct < 0 ? "text-[#f08a8a]" : "text-muted-foreground")}>
                  {l.changePct >= 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
                  {w(l.firstE1rmKg)} → {w(l.lastE1rmKg)} ({l.changePct >= 0 ? "+" : ""}
                  {l.changePct}%){l.plateau && <Badge variant="secondary">stalled</Badge>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Log a lift with weight and reps at least twice to see its trend.</p>
        )}
      </section>

      <section aria-labelledby="volume" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="volume" className="font-semibold">
          Weekly working sets <span className="text-sm font-normal text-muted-foreground">(last 3 weeks)</span>
        </h2>
        {trackedVolume.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {trackedVolume.map((v) => {
              const max = Math.max(v.range![1] + 6, v.setsPerWeek);
              return (
                <li key={v.region}>
                  <div className="flex justify-between">
                    <span>{v.label}</span>
                    <span className="text-muted-foreground">
                      {v.setsPerWeek} / usual {v.range![0]}–{v.range![1]}
                    </span>
                  </div>
                  <div className="relative mt-1 h-2 rounded-full bg-elevated" aria-hidden>
                    <div className="absolute inset-y-0 rounded-full bg-gold/25" style={{ left: `${(v.range![0] / max) * 100}%`, width: `${((v.range![1] - v.range![0]) / max) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-gold" style={{ width: `${Math.min(100, (v.setsPerWeek / max) * 100)}%`, opacity: 0.85 }} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No working sets logged in the last 3 weeks.</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">A set counts fully for the muscles an exercise mainly trains and half for its supporting muscles. The ranges are common guides for muscle growth, not rules.</p>
      </section>

      <section aria-labelledby="recovery" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="recovery" className="font-semibold">
          Recovery
        </h2>
        <p className="mt-1 text-sm">
          {review.recovery.avgReadiness7 != null ? `Average readiness ${review.recovery.avgReadiness7}/100 this week` : "No check-ins this week"}
          {review.recovery.rpeDrift != null ? `; logged effort ${review.recovery.rpeDrift >= 0 ? "+" : ""}${review.recovery.rpeDrift} RPE versus plan` : ""}.
        </p>
        <Link href="/train/recovery" className="mt-1 inline-block text-sm text-gold-highlight underline">
          Log a recovery check-in
        </Link>
      </section>

      {review.dataGaps.length > 0 && (
        <section aria-labelledby="gaps" className="rounded-2xl border border-dashed border-border p-4">
          <h2 id="gaps" className="text-sm font-semibold">
            What the review can&apos;t see yet
          </h2>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {review.dataGaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="history">
        <h2 id="history" className="mb-2 text-lg font-semibold">
          Changes you accepted
        </h2>
        {adjustments.length ? (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {adjustments.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 p-3 text-sm" data-testid="training-adjustment">
                <div>
                  <p className={cn(a.reverted_at && "text-muted-foreground line-through")}>{a.summary}</p>
                  <p className="text-[0.6875rem] text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()} · {a.source === "coach" ? "from the AI coach" : "from this review"}
                    {a.reverted_at ? " · undone" : ""}
                  </p>
                </div>
                {!a.reverted_at && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => done(await undoAdjustmentAction(a.id)))}>
                    <Undo2 aria-hidden /> Undo
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">None yet.</p>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        These suggestions come from your own logs and simple, published training rules. They are not medical advice and can&apos;t see injuries or illness. If something hurts, stop and get it checked.
      </p>
    </div>
  );
}
