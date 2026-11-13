"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HabitActivity } from "@/lib/domain/habit-programs";
import { setHabitActivityAction, stopHabitProgramAction, updateHabitGoalsAction } from "@/server/actions/habit-programs";
import type { HabitGoalField } from "@/lib/domain/habit-programs";
import { cn } from "@/lib/utils";

export interface DayItem extends HabitActivity {
  done: boolean;
  auto: boolean;
  weekly: boolean;
  answer: string | null;
}

/** One day's checklist. Ticks save immediately; automatic items (a logged workout or food) can't be unticked here. */
export function HabitDay({ enrollmentId, day, items, editable }: { enrollmentId: string; day: number; items: DayItem[]; editable: boolean }) {
  const [state, setState] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(item: DayItem, answer?: string) {
    if (!editable || item.auto) return;
    const next = answer !== undefined ? true : !item.done;
    setState((s) => s.map((i) => (i.key === item.key ? { ...i, done: next, answer: answer ?? i.answer } : i)));
    start(async () => {
      const r = await setHabitActivityAction({ enrollmentId, day, key: item.key, done: next, ...(answer !== undefined ? { answer } : {}) });
      if (!r.ok) {
        setError(r.error);
        setState((s) => s.map((i) => (i.key === item.key ? item : i)));
      } else setError(null);
    });
  }

  return (
    <div className="space-y-2" data-testid="habit-day">
      {state.map((item) => (
        <div key={item.key} className="rounded-xl border border-border bg-card p-3" data-testid={`habit-item-${item.key}`}>
          <div className="flex items-start gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              aria-label={item.title}
              disabled={!editable || item.auto || pending}
              onClick={() => toggle(item)}
              className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border-2 after:absolute after:-inset-2 relative", item.done ? "border-gold bg-gold text-black" : "border-gold/60")}
            >
              {item.done && <Check className="size-4" aria-hidden />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {item.title}
                {item.optional && <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>}
                {item.weekly && <span className="ml-2 text-xs font-normal text-muted-foreground">This week</span>}
              </p>
              {item.detail && <p className="text-sm text-muted-foreground">{item.detail}</p>}
              {item.auto && <p className="text-xs text-gold-highlight">Done: found in your logs</p>}
              {item.href && (
                <Link href={item.href} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-gold-highlight underline-offset-4 hover:underline">
                  Open
                </Link>
              )}
              {item.questions && editable && (
                <CheckinAnswer item={item} onSave={(a) => toggle(item, a)} />
              )}
            </div>
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function CheckinAnswer({ item, onSave }: { item: DayItem; onSave: (answer: string) => void }) {
  const [text, setText] = useState(item.answer ?? "");
  return (
    <div className="mt-2 space-y-2">
      <ul className="list-disc pl-5 text-sm">
        {item.questions!.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
      <label className="block text-sm">
        <span className="sr-only">Your answer</span>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} rows={2} className="w-full rounded-lg border border-border bg-elevated p-2 text-sm" placeholder="A few words (kept with this program, not in your journal)" />
      </label>
      <Button type="button" variant="secondary" size="sm" onClick={() => onSave(text.trim())} disabled={!text.trim()}>
        Save check-in
      </Button>
    </div>
  );
}

export function HabitGoals({ enrollmentId, fields, goals }: { enrollmentId: string; fields: HabitGoalField[]; goals: Record<string, number> }) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(fields.map((f) => [f.key, goals[f.key] ?? f.default])));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!fields.length) return null;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateHabitGoalsAction(enrollmentId, values);
          setMsg(r.ok ? (r.message ?? "Saved.") : r.error);
        });
      }}
    >
      {fields.map((f) => (
        <label key={f.key} className="block text-sm">
          <span className="font-semibold">
            {f.label} ({f.unit})
          </span>
          <input type="number" inputMode="numeric" min={f.min} max={f.max} value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))} className="mt-1 h-11 w-full rounded-lg border border-border bg-elevated px-3" />
          <span className="text-xs text-muted-foreground">{f.help}</span>
        </label>
      ))}
      <Button type="submit" variant="secondary" disabled={pending}>
        Save my goals
      </Button>
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
    </form>
  );
}

export function StopHabitProgram({ enrollmentId }: { enrollmentId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return confirm ? (
    <Button type="button" variant="destructive" disabled={pending} onClick={() => start(async () => void (await stopHabitProgramAction(enrollmentId)))}>
      Yes, stop (your records stay)
    </Button>
  ) : (
    <Button type="button" variant="ghost" onClick={() => setConfirm(true)}>
      Stop this program
    </Button>
  );
}
