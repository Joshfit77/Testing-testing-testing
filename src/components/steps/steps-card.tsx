"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Footprints, HeartPulse, Loader2, Pencil } from "lucide-react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressRing } from "@/components/ui/progress-ring";
import { toast } from "@/components/ui/toaster";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { formatSteps, STEP_GOAL_MAX, STEP_GOAL_MIN, STEP_SOURCE_LABELS, stepGoalPct, type StepSource } from "@/lib/domain/steps";
import { HEALTH_APP_NAME, healthSyncPlatform, readRecentSteps, type HealthPlatform } from "@/lib/native-health";
import { cn } from "@/lib/utils";
import { saveStepsManualAction, syncStepsAction, updateStepGoalAction } from "@/server/actions/steps";

export interface StepsCardProps {
  today: string;
  goal: number;
  todaySteps: number;
  todaySource: StepSource | null;
  /** Last 7 days, oldest first, today last. */
  week: { day: string; steps: number }[];
}

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

function WeekBars({ week, goal, today }: { week: StepsCardProps["week"]; goal: number; today: string }) {
  const max = Math.max(goal, ...week.map((d) => d.steps), 1);
  const goalPct = (goal / max) * 100;
  const total = week.reduce((s, d) => s + d.steps, 0);
  const daysHit = week.filter((d) => d.steps >= goal).length;
  return (
    <figure aria-labelledby="steps-week-title">
      <figcaption id="steps-week-title" className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">Last 7 days</span>
        <span>
          {formatSteps(Math.round(total / Math.max(1, week.length)))} avg · goal hit {daysHit}/{week.length}
        </span>
      </figcaption>
      <div className="relative h-24" aria-hidden>
        <div className="absolute inset-x-0 border-t border-dashed border-gold-muted/60" style={{ bottom: `${goalPct}%` }} />
        <div className="absolute inset-0 flex items-end gap-1.5">
          {week.map((d) => (
            <div key={d.day} className="flex h-full flex-1 items-end">
              <div
                className={cn("w-full rounded-t-md transition-[height] duration-700", d.steps >= goal ? "bg-gold-gradient" : "bg-gold/35", d.steps === 0 && "bg-elevated")}
                style={{ height: `${d.steps > 0 ? Math.max(3, (d.steps / max) * 100) : 3}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-1.5 text-center text-xs uppercase tracking-wider text-muted-foreground" aria-hidden>
        {week.map((d) => (
          <span key={d.day} className={cn("flex-1", d.day === today && "font-semibold text-gold-highlight")}>
            {weekday(d.day)}
          </span>
        ))}
      </div>
      <ul className="sr-only">
        {week.map((d) => (
          <li key={d.day}>
            {d.day}: {formatSteps(d.steps)} steps
          </li>
        ))}
      </ul>
    </figure>
  );
}

function HealthSync() {
  const router = useRouter();
  const [platform, setPlatform] = useState<HealthPlatform | null | undefined>(undefined);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Native detection needs `window`, so it happens after hydration.
  useEffect(() => setPlatform(healthSyncPlatform()), []);

  if (platform === undefined) return null;
  if (platform === null) {
    return <p className="text-xs text-muted-foreground">Apple Health and Health Connect sync in the Narrow Gate phone app.</p>;
  }
  const appName = HEALTH_APP_NAME[platform];
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const read = await readRecentSteps(7);
            if (!read.ok) {
              setError(read.message);
              return;
            }
            const res = await syncStepsAction({ source: read.source, days: read.days });
            if (res.ok) {
              toast.success(res.message ?? `Synced from ${appName}.`);
              router.refresh();
            }
            else setError(res.message ?? `Couldn't save steps from ${appName}.`);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <HeartPulse aria-hidden />}
        {pending ? "Syncing…" : `Sync ${appName}`}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-[#f08a8a]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Re-fetch the current page once per successful save (see the note in server/actions/steps.ts). */
function useRefreshOnSuccess(state: ActionState, after?: () => void) {
  const router = useRouter();
  const [seen, setSeen] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!state.ok || state.at === undefined || state.at === seen) return;
    setSeen(state.at);
    router.refresh();
    after?.();
  }, [state, seen, router, after]);
}

function GoalForm({ goal, onDone }: { goal: number; onDone: () => void }) {
  const [state, action] = useActionState(updateStepGoalAction, initialActionState);
  useRefreshOnSuccess(state, onDone);
  return (
    <form action={action} className="space-y-2">
      <Label htmlFor="step-goal">Daily step goal</Label>
      <div className="flex gap-2">
        <Input
          id="step-goal"
          name="stepGoal"
          type="number"
          inputMode="numeric"
          aria-describedby="step-goal-help"
          defaultValue={goal}
          aria-invalid={Boolean(state.fieldErrors?.stepGoal)}
          required
        />
        <SubmitButton size="default" variant="secondary">
          Save goal
        </SubmitButton>
      </div>
      <p id="step-goal-help" className="text-xs text-muted-foreground">
        Between {formatSteps(STEP_GOAL_MIN)} and {formatSteps(STEP_GOAL_MAX)}.
      </p>
      <FieldError message={state.fieldErrors?.stepGoal} />
      <FormMessage state={state} />
    </form>
  );
}

export function StepsCard({ today, goal, todaySteps, todaySource, week }: StepsCardProps) {
  const [state, action] = useActionState(saveStepsManualAction, initialActionState);
  const [editingGoal, setEditingGoal] = useState(false);
  useRefreshOnSuccess(state);
  const pct = stepGoalPct(todaySteps, goal);
  const remaining = Math.max(0, goal - todaySteps);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Footprints className="size-4 text-gold" aria-hidden /> Steps
        </CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingGoal((v) => !v)} aria-expanded={editingGoal}>
          <Pencil aria-hidden /> {editingGoal ? "Close" : "Goal"}
        </Button>
      </CardHeader>
      <CardContent className="grid flex-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {editingGoal && <GoalForm goal={goal} onDone={() => setEditingGoal(false)} />}
          <div className="flex items-center gap-4">
            <ProgressRing ariaLabel="Steps today" value={pct} label={formatSteps(todaySteps)} sublabel={`/ ${formatSteps(goal)}`} />
            <div className="min-w-0 text-sm">
              <p className="font-semibold" data-testid="steps-today">
                {formatSteps(todaySteps)} steps today
              </p>
              <p className="text-xs text-muted-foreground">
                {remaining > 0 ? `${formatSteps(remaining)} to go` : "Goal reached. Well walked."}
                {todaySource && todaySteps > 0 ? ` · ${STEP_SOURCE_LABELS[todaySource]}` : ""}
              </p>
            </div>
          </div>

          <form action={action} className="space-y-2">
            <input type="hidden" name="day" value={today} />
            <Label htmlFor="steps-today-input">Today&apos;s steps</Label>
            <div className="flex gap-2">
              <Input
                id="steps-today-input"
                name="steps"
                type="number"
                inputMode="numeric"
                min={0}
                max={200000}
                placeholder="e.g. 7500"
                aria-invalid={Boolean(state.fieldErrors?.steps)}
                aria-describedby="steps-today-help"
                required
              />
              <SubmitButton variant="secondary">Save</SubmitButton>
            </div>
            <p id="steps-today-help" className="text-xs text-muted-foreground">
              Replaces today&apos;s total.
            </p>
            <FieldError message={state.fieldErrors?.steps} />
            <FormMessage state={state} />
          </form>
        </div>

        <div className="flex flex-col justify-between gap-4">
          <WeekBars week={week} goal={goal} today={today} />
          <HealthSync />
        </div>
      </CardContent>
    </Card>
  );
}
