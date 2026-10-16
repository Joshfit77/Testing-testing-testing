"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, MessageSquare, Pause, Play, Plus, Repeat2, SkipForward, Trash2, Undo2, X } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { displayWeight, formatDuration, toKg, weightUnit } from "@/lib/domain/units";
import type { UnitSystem } from "@/lib/domain/types";
import type { DraftAction, DraftExercise, DraftSet } from "@/lib/domain/workout-draft";

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function NumberCell({
  value,
  onCommit,
  label,
  inputMode = "decimal",
  placeholder,
  className,
}: {
  value: number | null;
  onCommit: (n: number | null) => void;
  label: string;
  inputMode?: "decimal" | "numeric";
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value));
  }, [value]);
  return (
    <input
      type="text"
      inputMode={inputMode}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onBlur={() => {
        focused.current = false;
        onCommit(parseNum(text));
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/[^0-9.,]/g, "");
        setText(next);
        const n = parseNum(next);
        if (n != null || next === "") onCommit(n);
      }}
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-border bg-elevated px-2 text-center text-base font-semibold tabular-nums focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
        className,
      )}
    />
  );
}

function Stopwatch({ onStop, label }: { onStop: (seconds: number) => void; label: string }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (startedAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt]);
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  return startedAt ? (
    <button
      type="button"
      onClick={() => {
        onStop(elapsed);
        setStartedAt(null);
      }}
      className="flex h-11 w-full items-center justify-center gap-1 rounded-lg bg-gold/15 text-sm font-semibold tabular-nums text-gold-highlight"
      aria-label={`Stop timer for ${label} at ${elapsed} seconds`}
    >
      <Pause className="size-3.5" aria-hidden /> {formatDuration(elapsed)}
    </button>
  ) : (
    <button
      type="button"
      onClick={() => {
        setStartedAt(Date.now());
        setNow(Date.now());
      }}
      className="flex h-11 w-full items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
      aria-label={`Start timer for ${label}`}
    >
      <Play className="size-4" aria-hidden />
    </button>
  );
}

function SetRow({
  exercise,
  set,
  index,
  units,
  dispatch,
  showComplete,
}: {
  exercise: DraftExercise;
  set: DraftSet;
  index: number;
  units: UnitSystem;
  dispatch: (a: DraftAction) => void;
  showComplete: boolean;
}) {
  const label = `${exercise.name} set ${index + 1}`;
  const update = (patch: Partial<DraftSet>) => dispatch({ type: "updateSet", exerciseKey: exercise.id, setId: set.id, patch });
  return (
    <li
      className={cn(
        "grid items-center gap-2 rounded-xl px-1 py-1.5 transition-colors",
        exercise.isTimed ? "grid-cols-[2rem_1fr_3.2rem_3.4rem_2.75rem]" : "grid-cols-[2rem_1fr_1fr_3.4rem_2.75rem]",
        set.completed && "bg-success/10",
      )}
    >
      <button
        type="button"
        onClick={() => update({ isWarmup: !set.isWarmup })}
        className={cn("h-11 rounded-lg text-sm font-bold", set.isWarmup ? "text-gold" : "text-muted-foreground")}
        aria-label={set.isWarmup ? `${label}: warm-up set. Mark as working set` : `${label}: working set. Mark as warm-up`}
        title="Tap to toggle warm-up"
      >
        {set.isWarmup ? "W" : index + 1}
      </button>
      {exercise.isTimed ? (
        <>
          <NumberCell value={set.durationSeconds} onCommit={(n) => update({ durationSeconds: n == null ? null : Math.round(n) })} label={`${label} seconds`} inputMode="numeric" placeholder="sec" />
          <Stopwatch label={label} onStop={(s) => update({ durationSeconds: s })} />
        </>
      ) : (
        <>
          <NumberCell
            value={set.weightKg == null ? null : displayWeight(set.weightKg, units)}
            onCommit={(n) => update({ weightKg: n == null ? null : toKg(n, units) })}
            label={`${label} weight in ${weightUnit(units)}`}
            placeholder={weightUnit(units)}
          />
          <NumberCell value={set.reps} onCommit={(n) => update({ reps: n == null ? null : Math.round(n) })} label={`${label} reps`} inputMode="numeric" placeholder="reps" />
        </>
      )}
      <select
        aria-label={`${label} RPE`}
        value={set.rpe ?? ""}
        onChange={(e) => update({ rpe: e.target.value ? Number(e.target.value) : null })}
        className="h-11 w-full rounded-lg border border-border bg-elevated px-1 text-center text-sm text-foreground"
      >
        <option value="">RPE</option>
        {[5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {showComplete ? (
        <button
          type="button"
          onClick={() => dispatch({ type: "toggleSetComplete", exerciseKey: exercise.id, setId: set.id, now: new Date().toISOString() })}
          aria-pressed={set.completed}
          aria-label={set.completed ? `${label} completed. Mark incomplete` : `Mark ${label} complete`}
          className={cn(
            "flex size-11 items-center justify-center rounded-lg border transition-colors",
            set.completed ? "border-success bg-success text-white" : "border-border bg-elevated text-muted-foreground hover:border-gold-muted",
          )}
        >
          <Check className="size-5" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => dispatch({ type: "removeSet", exerciseKey: exercise.id, setId: set.id })}
          aria-label={`Remove ${label}`}
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}

export function ExerciseCard({
  exercise,
  index,
  total,
  units,
  dispatch,
  onSubstitute,
  onSkip,
  showComplete = true,
}: {
  exercise: DraftExercise;
  index: number;
  total: number;
  units: UnitSystem;
  dispatch: (a: DraftAction) => void;
  onSubstitute: () => void;
  onSkip: () => void;
  showComplete?: boolean;
}) {
  const [notesOpen, setNotesOpen] = useState(Boolean(exercise.notes));
  const done = exercise.sets.filter((s) => s.completed).length;
  const t = exercise.target;
  const targetText = t
    ? [`${t.sets} × ${t.reps ?? (t.seconds ? formatDuration(t.seconds) : "")}`, t.intensity, t.rpe ? `RPE ${t.rpe}` : null].filter(Boolean).join(" · ")
    : null;

  if (exercise.skipped) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-4" aria-label={`${exercise.name} (skipped)`}>
        <div>
          <p className="font-semibold text-muted-foreground line-through">{exercise.name}</p>
          <p className="text-xs text-muted-foreground">Skipped{exercise.skipReason ? ` · ${exercise.skipReason}` : ""}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "unskipExercise", exerciseKey: exercise.id })}>
          <Undo2 aria-hidden /> Undo
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby={`ex-${exercise.id}`}>
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`ex-${exercise.id}`} className="font-display text-lg font-semibold uppercase leading-tight">
            <Link href={`/train/exercises/${exercise.slug}`} target="_blank" className="hover:text-gold-highlight">
              {exercise.name}
            </Link>
          </h3>
          {exercise.substitutedFromName && <p className="text-xs text-muted-foreground">Substituted for {exercise.substitutedFromName}</p>}
          <p className="text-xs text-muted-foreground">
            {targetText && <span className="text-gold-highlight">Target {targetText} · </span>}
            {done}/{exercise.sets.length} sets · rest {exercise.restSeconds}s
          </p>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Options for ${exercise.name}`}>
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl border border-border bg-elevated p-1 text-sm shadow-2xl">
              {[
                { label: "Substitute exercise", icon: Repeat2, onSelect: onSubstitute },
                { label: "Skip exercise", icon: SkipForward, onSelect: onSkip },
                { label: notesOpen ? "Hide notes" : "Add notes", icon: MessageSquare, onSelect: () => setNotesOpen((o) => !o) },
                ...(index > 0 ? [{ label: "Move up", icon: ArrowUp, onSelect: () => dispatch({ type: "moveExercise", exerciseKey: exercise.id, direction: -1 }) }] : []),
                ...(index < total - 1 ? [{ label: "Move down", icon: ArrowDown, onSelect: () => dispatch({ type: "moveExercise", exerciseKey: exercise.id, direction: 1 }) }] : []),
                { label: "Remove exercise", icon: Trash2, onSelect: () => dispatch({ type: "removeExercise", exerciseKey: exercise.id }), danger: true },
              ].map((item) => (
                <DropdownMenu.Item
                  key={item.label}
                  onSelect={item.onSelect}
                  className={cn("flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 outline-none data-[highlighted]:bg-card", "danger" in item && item.danger && "text-[#f08a8a]")}
                >
                  <item.icon className="size-4" aria-hidden /> {item.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      <div
        className={cn(
          "grid gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
          exercise.isTimed ? "grid-cols-[2rem_1fr_3.2rem_3.4rem_2.75rem]" : "grid-cols-[2rem_1fr_1fr_3.4rem_2.75rem]",
        )}
        aria-hidden
      >
        <span className="text-center">Set</span>
        {exercise.isTimed ? (
          <>
            <span className="text-center">Seconds</span>
            <span className="text-center">Timer</span>
          </>
        ) : (
          <>
            <span className="text-center">{weightUnit(units)}</span>
            <span className="text-center">Reps</span>
          </>
        )}
        <span className="text-center">RPE</span>
        <span className="text-center">{showComplete ? "Done" : ""}</span>
      </div>
      <ol className="space-y-1">
        {exercise.sets.map((s, i) => (
          <SetRow key={s.id} exercise={exercise} set={s} index={i} units={units} dispatch={dispatch} showComplete={showComplete} />
        ))}
      </ol>
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" variant="secondary" className="flex-1" onClick={() => dispatch({ type: "addSet", exerciseKey: exercise.id })}>
          <Plus aria-hidden /> Add set
        </Button>
        {exercise.sets.length > 0 && showComplete && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              const last = exercise.sets[exercise.sets.length - 1]!;
              dispatch({ type: "removeSet", exerciseKey: exercise.id, setId: last.id });
            }}
            aria-label={`Remove last set of ${exercise.name}`}
          >
            <Trash2 aria-hidden /> Remove set
          </Button>
        )}
      </div>
      {notesOpen && (
        <Textarea
          className="mt-3 min-h-16"
          value={exercise.notes}
          onChange={(e) => dispatch({ type: "setExerciseNotes", exerciseKey: exercise.id, notes: e.target.value })}
          placeholder="Notes for this exercise (cues, how it felt, equipment settings)"
          aria-label={`Notes for ${exercise.name}`}
          maxLength={1000}
        />
      )}
    </section>
  );
}
