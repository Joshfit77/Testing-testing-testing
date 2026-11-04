"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Flag, Minus, Plus, SkipForward, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { displayWeight, formatDuration, toKg, weightUnit } from "@/lib/domain/units";
import type { UnitSystem } from "@/lib/domain/types";
import { setCanComplete, type CurrentSetInfo, type DraftAction, type DraftSet } from "@/lib/domain/workout-draft";

/** One tap on − / + moves the weight by a plate pair's worth: 5 lb or 2.5 kg. */
/**
 * After a completion, the Complete button moves on to the next set, so the per-set double-tap guard in the logger
 * can't see a shaky second tap: the card ignores a second completion this soon after the first.
 */
const CARD_DOUBLE_TAP_MS = 700;
const WEIGHT_STEP: Record<UnitSystem, number> = { imperial: 5, metric: 2.5 };

function Stepper({
  label,
  value,
  unit,
  step,
  onChange,
  inputMode = "decimal",
  testId,
}: {
  label: string;
  value: number | null;
  unit: string;
  step: number;
  onChange: (n: number | null) => void;
  inputMode?: "decimal" | "numeric";
  testId: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value));
  }, [value]);
  const commit = (raw: string) => {
    const t = raw.trim().replace(",", ".");
    if (t === "") return onChange(null);
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0) onChange(n);
  };
  const bump = (dir: 1 | -1) => {
    const base = value ?? 0;
    const next = Math.max(0, Math.round((base + dir * step) * 100) / 100);
    onChange(dir < 0 && value == null ? null : next);
  };
  return (
    <div className="min-w-0 space-y-1" data-testid={testId}>
      <p className="text-center text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
        {label} {unit && <span className="normal-case tracking-normal">({unit})</span>}
      </p>
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="secondary" size="icon" onClick={() => bump(-1)} aria-label={`Less ${label.toLowerCase()}`}>
          <Minus aria-hidden />
        </Button>
        <input
          type="text"
          inputMode={inputMode}
          aria-label={unit ? `${label} (${unit})` : label}
          value={text}
          placeholder="—"
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onBlur={() => {
            focused.current = false;
            commit(text);
          }}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-14 w-full min-w-0 rounded-xl border border-border bg-elevated text-center font-display text-3xl font-bold tabular-nums text-foreground focus-visible:border-gold-muted focus-visible:outline-none"
        />
        <Button type="button" variant="secondary" size="icon" onClick={() => bump(1)} aria-label={`More ${label.toLowerCase()}`}>
          <Plus aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** A ring that empties as the rest runs down. Decorative: the time is also written out. */
function RestRing({ remaining, total }: { remaining: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" className="stroke-elevated" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-gold transition-[stroke-dashoffset] duration-1000 ease-linear"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - frac)}
      />
    </svg>
  );
}

export interface CurrentSetCardProps {
  info: CurrentSetInfo | null;
  units: UnitSystem;
  dispatch: (a: DraftAction) => void;
  /** "Last time: 3 × 8 at 185 lb", when the exercise has history. */
  lastTime: string | null;
  /** "Target 4 × 6–8 · RPE 8" from the program day, when there is one. */
  target: string | null;
  /** Seconds of rest left (0 when not resting). */
  rest: number;
  restTotal: number;
  paused: boolean;
  /** Scroll to the exercise's full card (its demonstration, notes, substitutions, every set). */
  onShowExercise: (exerciseKey: string) => void;
  onFinish: () => void;
  /** Un-complete a set just logged here (bypasses the double-tap guard; also ends the rest it started). */
  onUndo: (exerciseKey: string, setId: string) => void;
  /**
   * The card is scrolled off screen and the header's compact rest bar is showing instead: this one is then inert and
   * hidden from assistive technology, so there is only ever one rest timer to hear or reach.
   */
  restElsewhere?: boolean;
}

/**
 * The set to do now, front and centre: what it is, what you did last time, big weight and reps controls, one button
 * to complete it, then the rest countdown with Skip. It drives the same draft as the exercise cards below (so saving,
 * offline use and recovery after an interruption are unchanged), and the last completed set can be undone.
 */
export function CurrentSetCard({ info, units, dispatch, lastTime, target, rest, restTotal, paused, onShowExercise, onFinish, onUndo, restElsewhere = false }: CurrentSetCardProps) {
  const [undo, setUndo] = useState<{ exerciseKey: string; setId: string; label: string } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const lastComplete = useRef(0);
  // The undo offer goes away after a while, or when a different set is completed.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 12_000);
    return () => clearTimeout(t);
  }, [undo]);
  useEffect(() => setBlocked(false), [info?.set?.id]);

  const resting = rest > 0;
  const restRow = resting ? (
    // Two rows, so it fits a phone: the countdown and what happens next, then the controls.
    <div
      className="space-y-3 rounded-xl border border-gold-muted/60 bg-gold/10 p-3"
      role={restElsewhere ? undefined : "timer"}
      aria-label={restElsewhere ? undefined : "Rest timer"}
      aria-hidden={restElsewhere || undefined}
      inert={restElsewhere}
      data-testid="current-rest"
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <RestRing remaining={rest} total={restTotal} />
          <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold tabular-nums text-gold-highlight">{formatDuration(rest)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold uppercase">Rest</p>
          <p className="text-sm text-muted-foreground">{info?.set ? "Next set when the timer ends, or skip it." : "Rest, then finish when you're ready."}</p>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
        <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "adjustRest", deltaSeconds: -15, now: new Date().toISOString() })} aria-label="Subtract 15 seconds">
          <Minus aria-hidden /> 15s
        </Button>
        <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "adjustRest", deltaSeconds: 15, now: new Date().toISOString() })} aria-label="Add 15 seconds">
          <Plus aria-hidden /> 15s
        </Button>
        <Button size="sm" onClick={() => dispatch({ type: "clearRest" })}>
          <SkipForward aria-hidden /> Skip rest
        </Button>
      </div>
    </div>
  ) : null;

  const undoRow = undo ? (
    <p className="flex items-center justify-between gap-2 text-sm" role="status" data-testid="set-undo">
      <span className="text-muted-foreground">
        <Check className="mr-1 inline size-4 text-success" aria-hidden />
        {undo.label} logged
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          onUndo(undo.exerciseKey, undo.setId);
          lastComplete.current = 0; // completing it again straight away is deliberate, not a double tap
          setUndo(null);
        }}
      >
        <Undo2 aria-hidden /> Undo
      </Button>
    </p>
  ) : null;

  // Everything done: say so, keep the rest timer, and offer Finish.
  if (!info) {
    return (
      <section className="space-y-3 rounded-2xl border border-gold-muted bg-card p-4" aria-label="Current set" data-testid="current-set-card">
        <p className="font-display text-lg font-semibold uppercase">Every planned set is done</p>
        <p className="text-sm text-muted-foreground">Add another set or exercise below, or finish and see your summary.</p>
        {undoRow}
        {restRow}
        <Button className="w-full" size="lg" onClick={onFinish}>
          <Flag aria-hidden /> Finish workout
        </Button>
      </section>
    );
  }

  const { exercise, set } = info;
  const setLabel = !set
    ? "No sets yet"
    : info.warmup
      ? `Warm-up ${info.warmupNumber} of ${info.warmupCount}`
      : `Set ${info.workingNumber} of ${info.workingCount}`;
  const update = (patch: Partial<DraftSet>) => set && dispatch({ type: "updateSet", exerciseKey: exercise.id, setId: set.id, patch });
  const unit = weightUnit(units);
  // Timed holds and distance work keep their own controls in the exercise card (stopwatch, distance units).
  const simple = !exercise.usesDistance;

  const complete = () => {
    if (!set) return;
    const t = Date.now();
    if (t - lastComplete.current < CARD_DOUBLE_TAP_MS) return;
    if (!setCanComplete(exercise, set)) {
      setBlocked(true);
      return;
    }
    lastComplete.current = t;
    dispatch({ type: "toggleSetComplete", exerciseKey: exercise.id, setId: set.id, now: new Date().toISOString() });
    setUndo({ exerciseKey: exercise.id, setId: set.id, label: `${exercise.name}, ${setLabel.toLowerCase()}` });
  };

  return (
    <section className="space-y-3 rounded-2xl border border-gold-muted bg-card p-4 shadow-[0_0_32px_-18px_rgba(230,199,110,0.6)]" aria-label="Current set" data-testid="current-set-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            Exercise {info.exerciseNumber} of {info.exerciseCount}
            {exercise.supersetId ? " · superset" : ""}
          </p>
          <h2 className="line-clamp-2 break-words font-display text-2xl font-bold uppercase leading-tight [text-wrap:balance]" data-testid="current-exercise">
            {exercise.name}
          </h2>
          {target && <p className="text-sm text-gold-highlight">{target}</p>}
          {lastTime && <p className="text-sm text-foreground/85" data-testid="current-last-time">{lastTime}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => onShowExercise(exercise.id)} className="shrink-0">
          Demo &amp; sets <ChevronDown aria-hidden />
        </Button>
      </div>

      <p className={cn("text-center font-display text-lg font-semibold uppercase", info.warmup ? "text-gold" : "text-foreground")} aria-live="polite" data-testid="current-set-label">
        {setLabel}
      </p>

      {set && simple && (
        <div className={cn("grid gap-3", exercise.isTimed ? "grid-cols-1" : "grid-cols-2")}>
          {exercise.isTimed ? (
            <Stepper
              label="Time"
              unit="sec"
              step={5}
              inputMode="numeric"
              value={set.durationSeconds}
              onChange={(n) => update({ durationSeconds: n == null ? null : Math.round(n) })}
              testId="current-seconds"
            />
          ) : (
            <>
              <Stepper
                label="Weight"
                unit={unit}
                step={WEIGHT_STEP[units]}
                value={set.weightKg == null ? null : displayWeight(set.weightKg, units)}
                onChange={(n) => update({ weightKg: n == null ? null : toKg(n, units) })}
                testId="current-weight"
              />
              <Stepper
                label="Reps"
                unit=""
                step={1}
                inputMode="numeric"
                value={set.reps}
                onChange={(n) => update({ reps: n == null ? null : Math.round(n) })}
                testId="current-reps"
              />
            </>
          )}
        </div>
      )}
      {set && !simple && <p className="text-sm text-muted-foreground">Enter the distance and time for this set in the exercise card below.</p>}

      {set ? (
        <Button className="h-14 w-full text-lg" onClick={complete} data-testid="complete-set" disabled={!simple}>
          <Check className="size-5" aria-hidden /> Complete set
        </Button>
      ) : (
        <Button className="w-full" variant="secondary" onClick={() => dispatch({ type: "addSet", exerciseKey: exercise.id })}>
          <Plus aria-hidden /> Add a set
        </Button>
      )}
      {blocked && (
        <p className="text-sm text-gold" role="alert">
          {exercise.isTimed ? "Enter the time you held it for, then complete the set." : "Enter your reps, then complete the set. Leave the weight empty for bodyweight."}
        </p>
      )}
      {paused && <p className="text-xs text-muted-foreground">The workout is paused: the clock is stopped, and completing a set won&apos;t start a rest.</p>}
      {undoRow}
      {restRow}
    </section>
  );
}
