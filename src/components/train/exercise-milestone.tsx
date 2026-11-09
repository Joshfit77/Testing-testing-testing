import { Target, Trophy } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { ExerciseMilestone } from "@/lib/domain/exercise-milestones";
import { cn } from "@/lib/utils";

/**
 * The member's next milestone for one exercise: personal best, next target, a progress bar, what's left and one
 * encouraging line. `compact` drops the date line (the exercise page, where history is one tap away).
 */
export function ExerciseMilestoneCard({ milestone, name, timeZone, compact, className }: { milestone: ExerciseMilestone; name: string; timeZone: string; compact?: boolean; className?: string }) {
  if (milestone.kind === "first") {
    return (
      <section aria-labelledby="milestone-title" data-testid="exercise-milestone" className={cn("card-gold rounded-2xl p-4", className)}>
        <h2 id="milestone-title" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-highlight">
          <Target className="size-4" aria-hidden /> First milestone
        </h2>
        <p className="mt-1 font-semibold">Log your first set</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{milestone.message}</p>
        <ProgressBar className="mt-3" value={0} label={`${name} first milestone progress`} />
      </section>
    );
  }
  const date = new Date(milestone.bestDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone });
  return (
    <section aria-labelledby="milestone-title" data-testid="exercise-milestone" className={cn("card-gold rounded-2xl p-4", className)}>
      <h2 id="milestone-title" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-highlight">
        <Target className="size-4" aria-hidden /> Next milestone
      </h2>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Personal best</p>
          <p className="flex items-baseline gap-1.5 text-lg font-semibold tabular-nums">
            <Trophy className="size-4 self-center text-gold" aria-hidden />
            {milestone.currentLabel}
            {milestone.bestDetail && <span className="text-sm font-normal text-muted-foreground">{milestone.bestDetail}</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Next</p>
          <p className="font-display text-2xl font-bold tabular-nums text-gold-highlight" data-testid="milestone-target">
            {milestone.targetLabel}
          </p>
        </div>
      </div>
      <ProgressBar className="mt-3 h-2.5" value={milestone.percent} label={`${name} progress to ${milestone.targetLabel}`} />
      <div className="mt-2 flex items-baseline justify-between gap-3 text-xs text-muted-foreground tabular-nums">
        <span>
          {milestone.currentLabel} / {milestone.targetLabel}
        </span>
        <span className="font-semibold text-foreground">{milestone.remainingLabel} to go</span>
      </div>
      <p className="mt-2 text-sm" data-testid="milestone-message">
        {milestone.message}
      </p>
      {!compact && <p className="mt-1 text-xs text-muted-foreground">Best set on {date}</p>}
    </section>
  );
}
