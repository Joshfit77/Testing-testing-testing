import { Flag } from "lucide-react";
import type { ReachedMilestone } from "@/lib/domain/exercise-milestones";

/**
 * "Milestone reached": the black-and-gold moment on the workout-complete screen when a session meets the next target
 * the exercise card was showing. A gold medallion with one soft ring of light and one sheen across the card, played
 * once; with reduced motion (device setting or the app's own) nothing moves and the card simply appears. Announced to
 * screen readers as a status. Shows nothing when no milestone was reached.
 */
export function MilestoneCelebration({ milestones }: { milestones: ReachedMilestone[] }) {
  if (!milestones.length) return null;
  const many = milestones.length > 1;
  return (
    <section role="status" aria-labelledby="milestones-title" data-testid="milestone-celebration" className="milestone-card card-gold-strong relative overflow-hidden rounded-2xl p-4 text-left">
      <div className="flex items-center gap-3">
        <span className="milestone-medal relative flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-black shadow-bronze" aria-hidden>
          <Flag className="size-6" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <h2 id="milestones-title" className="font-display text-lg font-bold text-gold-gradient">
            {many ? `${milestones.length} milestones reached` : "Milestone reached"}
          </h2>
          <p className="text-sm text-muted-foreground">{many ? "Each one a step on the narrow road." : "A step on the narrow road."}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-[0.9375rem]">
        {milestones.map((m, i) => (
          <li key={`${m.exerciseId}-${m.kind}-${i}`} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <strong className="block truncate">{m.name}</strong>
              <span className="block text-xs text-muted-foreground">{m.what}</span>
            </span>
            <span className="shrink-0 font-display text-lg font-bold tabular-nums text-gold-highlight">{m.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
