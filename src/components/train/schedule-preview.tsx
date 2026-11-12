"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Notice } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmDialog } from "@/components/ui/confirm";
import { planChanges, planChangeSentence, summarizeSeed, type PlanSummary } from "@/lib/domain/plan-preview";
import { buildCustomProgram } from "@/lib/domain/custom-programs";
import type { CatalogExercise } from "@/lib/domain/program-generator";
import { starterProgramInput, type StarterAnswers } from "@/lib/domain/starter-program";
import { applyScheduleChangeAction } from "@/server/actions/plan-schedule";

const DAY_OPTIONS = [2, 3, 4, 5, 6];
const MINUTE_OPTIONS = [30, 45, 60, 75, 90];

/**
 * Training preferences: try a different schedule and see what it does to the plan before applying it
 * ("4 → 3 days, sessions 52 → 61 min"). Applying rebuilds the starter program from your saved answers.
 */
export function SchedulePreview({ answers, catalog, current, suggestedDays }: { answers: StarterAnswers; catalog: CatalogExercise[]; current: PlanSummary | null; suggestedDays?: number }) {
  const router = useRouter();
  const [days, setDays] = useState(suggestedDays ?? answers.daysPerWeek);
  const [minutes, setMinutes] = useState(answers.sessionMinutes);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const proposed = useMemo(
    () => {
      // The same builder onboarding uses for the starter program (session lengths fitted to the choice).
      try {
        return summarizeSeed(buildCustomProgram(starterProgramInput({ ...answers, daysPerWeek: days, sessionMinutes: minutes }), catalog));
      } catch {
        return null;
      }
    },
    [answers, catalog, days, minutes],
  );
  const changes = proposed ? planChanges(current, proposed).filter((c) => c.key !== "program") : [];
  const unchanged = days === answers.daysPerWeek && minutes === answers.sessionMinutes;

  const apply = async () => {
    const ok = await confirmDialog({
      title: "Apply this schedule?",
      message: `${proposed ? planChangeSentence(current, proposed) : "New schedule"}. Your starter program is rebuilt and becomes your active program; the current one stays in My programs, paused.`,
      confirmLabel: "Apply",
    });
    if (!ok) return;
    start(async () => {
      const res = await applyScheduleChangeAction({ daysPerWeek: days, sessionMinutes: minutes });
      setResult(res);
      if (res.ok) router.refresh();
    });
  };

  return (
    <section id="schedule" aria-labelledby="sched-title" className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 id="sched-title" className="text-lg font-semibold">
          Change my schedule
        </h2>
        <p className="text-sm text-muted-foreground">See what a different schedule does to your plan before you apply it.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sched-days">Days per week</Label>
          <NativeSelect id="sched-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[...new Set([...DAY_OPTIONS, answers.daysPerWeek])].sort((a, b) => a - b).map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sched-min">Session length</Label>
          <NativeSelect id="sched-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {[...new Set([...MINUTE_OPTIONS, answers.sessionMinutes])].sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="rounded-xl border border-gold-muted/50 bg-gold/5 p-3" aria-live="polite" data-testid="schedule-preview">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">{current ? `Compared with ${current.name}` : "Your rebuilt plan"}</p>
        {changes.length ? (
          <ul className="mt-1.5 space-y-1 text-sm">
            {changes.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center justify-between gap-x-3">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                  {c.before} <ArrowRight className="size-3.5 text-gold" aria-label="to" /> <span className="text-gold-highlight">{c.after}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No change to days or session length.</p>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">Session times are estimates that include warm-up, sets, rest and moving between exercises.</p>
      </div>
      {result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>}
      <Button type="button" onClick={apply} disabled={pending || unchanged} aria-busy={pending} className="w-full sm:w-auto">
        {pending && <Loader2 className="animate-spin" aria-hidden />} Apply new schedule
      </Button>
    </section>
  );
}
