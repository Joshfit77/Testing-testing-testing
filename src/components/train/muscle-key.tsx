import { PRIMARY_RGB, SECONDARY_RGB } from "@/lib/exercise-motion/muscle-colors";
import { cn, titleCase } from "@/lib/utils";

/**
 * The exercise's muscles, keyed to the colours they glow on the animated athlete: primary movers in gold, secondary
 * (assisting and stabilising) muscles in steel blue. Says plainly that the highlight teaches where an exercise mainly
 * works; it is not a measurement of muscle activity.
 */
export function MuscleKey({
  primary,
  secondary,
  showColours = true,
  className,
}: {
  primary: readonly string[];
  secondary: readonly string[];
  /** Colour dots matching the athlete's glow (off when no animated athlete is shown). */
  showColours?: boolean;
  className?: string;
}) {
  const row = (label: string, names: readonly string[], rgb: string, testId: string) =>
    names.length > 0 && (
      <div className="flex gap-3" data-testid={testId}>
        {showColours && (
          <span
            className="mt-1.5 size-3 shrink-0 rounded-full"
            style={{ background: `rgb(${rgb})`, boxShadow: `0 0 10px rgba(${rgb},0.65)` }}
            aria-hidden
          />
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-sm text-foreground">{names.map(titleCase).join(", ")}</p>
        </div>
      </div>
    );
  return (
    <div className={cn("space-y-3", className)} data-testid="muscle-key">
      {row("Primary", primary, PRIMARY_RGB, "muscle-key-primary")}
      {row("Secondary", secondary, SECONDARY_RGB, "muscle-key-secondary")}
      {showColours && (
        <p className="text-xs text-muted-foreground">
          {secondary.length > 0 ? "Gold marks the main muscles worked, blue the muscles that assist. " : "Gold marks the main muscles worked. "}
          The highlight shows where the exercise mainly works; it is an illustration, not a measurement of muscle activity.
        </p>
      )}
    </div>
  );
}
