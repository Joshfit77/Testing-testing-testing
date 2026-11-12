import Link from "next/link";
import { cn } from "@/lib/utils";
import { SCORE_BAND_TEXT, SLEEP_SCORE_VERSION, type SleepScore } from "@/lib/domain/sleep-score";

/** "Partial" next to a score built from time in bed alone; it is left out of score averages. */
export function PartialTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground", className)} title="Only time in bed was entered, so this score is partial and left out of averages">
      Partial
    </span>
  );
}

/** The nightly score with its basis; the breakdown of how it was built is part of Pro sleep analytics. */
export function SleepScoreCard({ score, breakdown, compact }: { score: SleepScore; breakdown: boolean; compact?: boolean }) {
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={compact ? "font-display text-3xl font-bold text-gold-highlight" : "font-display text-5xl font-bold text-gold-highlight"}>{score.score}</span>
        <span className="text-sm text-muted-foreground">/ 100 · {SCORE_BAND_TEXT[score.band]}</span>
        {score.partial && <PartialTag />}
      </p>
      {compact ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Based on {score.basedOn}{score.partial ? " (time in bed only)" : ""}. Not a medical measure.
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Based on {score.basedOn}. Describes this night as logged (score v{SLEEP_SCORE_VERSION}); it isn&apos;t sleep debt, recovery or a medical measure.
          {score.partial ? " Partial: only time in bed was entered, so this score is left out of averages." : ""}{" "}
          <Link href="/progress/sleep/method" className="underline">
            How it&apos;s worked out
          </Link>
        </p>
      )}
      {!compact &&
        (breakdown ? (
          <div className="mt-3 space-y-2">
            <ul className="space-y-1.5" aria-label="Score parts">
              {score.components.map((c) => (
                <li key={c.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    <span className="font-semibold">{c.label}</span>
                    <span className="block text-xs text-muted-foreground">{c.detail}</span>
                  </span>
                  <span className="shrink-0 font-semibold">
                    {c.points} / {c.weight}
                  </span>
                </li>
              ))}
            </ul>
            {score.missing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Not counted (nothing was entered, so nothing was deducted): {score.missing.map((m) => `${m.label.toLowerCase()} — ${m.why}`).join(" ")}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-border bg-elevated p-3 text-sm text-muted-foreground">
            Pro All Access shows how this score was built, part by part, and compares the night with your own history.{" "}
            <Link href="/profile/billing" className="font-semibold text-gold-highlight underline">
              See plans
            </Link>
          </p>
        ))}
    </div>
  );
}
