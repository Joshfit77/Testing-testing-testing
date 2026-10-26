import Link from "next/link";
import { SCORE_BAND_TEXT, SLEEP_SCORE_VERSION, type SleepScore } from "@/lib/domain/sleep-score";

/** The nightly score with its basis; the breakdown of how it was built is part of Pro sleep analytics. */
export function SleepScoreCard({ score, breakdown, compact }: { score: SleepScore; breakdown: boolean; compact?: boolean }) {
  return (
    <div>
      <p className="flex items-baseline gap-2">
        <span className={compact ? "font-display text-3xl font-bold text-gold-highlight" : "font-display text-5xl font-bold text-gold-highlight"}>{score.score}</span>
        <span className="text-sm text-muted-foreground">/ 100 · {SCORE_BAND_TEXT[score.band]}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Based on {score.basedOn}. Describes this night as logged (score v{SLEEP_SCORE_VERSION}); it isn&apos;t sleep debt, recovery or a medical measure.{" "}
        <Link href="/progress/sleep/method" className="underline">
          How it&apos;s worked out
        </Link>
      </p>
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
