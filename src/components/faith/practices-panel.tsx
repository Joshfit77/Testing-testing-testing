"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { CustomPracticeForm } from "@/components/faith/faith-forms";
import { addDays } from "@/lib/domain/dates";
import { CHECKIN_WINDOW_DAYS, PRACTICE_INFO, PRESET_PRACTICES, practiceLabel, weeklyPracticeSummary, type Practice, type PracticeCheckin } from "@/lib/domain/practices";
import { cn } from "@/lib/utils";
import { addPresetPracticeAction, removePracticeAction, togglePracticeCheckinAction } from "@/server/actions/faith";

function dayLabel(iso: string, today: string): { short: string; long: string } {
  const d = new Date(`${iso}T12:00:00Z`);
  const long = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  if (iso === today) return { short: "Today", long: `Today, ${long}` };
  return { short: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), long };
}

/**
 * Daily practices: choose practices, check them off for today or a recent day, and read a gentle
 * summary of the week. No streaks, scores or comparisons.
 */
export function PracticesPanel({ practices, checkins, today }: { practices: Practice[]; checkins: PracticeCheckin[]; today: string }) {
  const [day, setDay] = useState(today);
  const [choosing, setChoosing] = useState(practices.length === 0);
  const days = Array.from({ length: CHECKIN_WINDOW_DAYS }, (_, i) => addDays(today, i - (CHECKIN_WINDOW_DAYS - 1)));
  const done = new Set(checkins.filter((c) => c.date === day).map((c) => c.goalId));
  const chosen = new Set(practices.filter((p) => p.practice !== "custom").map((p) => p.practice));
  const summary = weeklyPracticeSummary(practices, checkins, today);
  const selected = dayLabel(day, today);

  return (
    <div className="space-y-4">
      {practices.length > 0 && (
        <>
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Day to check off">
            {days.map((d) => {
              const l = dayLabel(d, today);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={d === day}
                  aria-label={l.long}
                  onClick={() => setDay(d)}
                  className={cn(
                    "flex min-h-12 min-w-12 shrink-0 flex-col items-center justify-center rounded-xl border px-2 text-xs font-semibold",
                    d === day ? "border-gold bg-gold/12 text-gold-highlight" : "border-border bg-elevated/50 text-muted-foreground",
                  )}
                >
                  <span>{l.short}</span>
                  <span className="tabular-nums">{Number(d.slice(8))}</span>
                </button>
              );
            })}
          </div>
          <ul className="space-y-2" aria-label={`Practices for ${selected.long}`}>
            {practices.map((p) => {
              const on = done.has(p.id);
              const label = practiceLabel(p);
              return (
                <li key={p.id} className="flex items-center gap-2 rounded-xl bg-elevated/60 pl-1 pr-1">
                  <ActionButton
                    action={togglePracticeCheckinAction}
                    fields={{ goalId: p.id, date: day }}
                    variant="ghost"
                    aria-pressed={on}
                    aria-label={`${label}, ${selected.long}`}
                    className="h-auto min-h-12 flex-1 justify-start gap-3 px-2 text-left"
                  >
                    {on ? <CheckCircle2 className="size-6 shrink-0 text-gold" aria-hidden /> : <Circle className="size-6 shrink-0 text-muted-foreground" aria-hidden />}
                    <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", on && "text-gold-highlight")}>{label}</span>
                  </ActionButton>
                  <ActionButton
                    action={removePracticeAction}
                    fields={{ goalId: p.id }}
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${label}`}
                    confirmMessage={`Remove “${label}” from your practices?`}
                    confirmDetail="Its check-off history is removed too."
                    confirmLabel="Remove"
                  >
                    <Trash2 aria-hidden />
                  </ActionButton>
                </li>
              );
            })}
          </ul>
          <div className="rounded-xl border border-gold-muted/40 bg-gold/5 p-3" aria-label="This week" role="group">
            <ul className="space-y-1 text-sm" data-testid="practice-summary">
              {summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={choosing}
          onClick={() => setChoosing((c) => !c)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-gold-highlight hover:underline"
        >
          <Plus className="size-4" aria-hidden /> {choosing ? "Done choosing" : "Choose practices"}
        </button>
        <Link href="/faith/practices" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-gold-highlight hover:underline">
          <CalendarDays className="size-4" aria-hidden /> History
        </Link>
      </div>

      {choosing && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <p className="text-sm text-muted-foreground">Pick any that help you draw near to God. Change them whenever you like.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESET_PRACTICES.filter((k) => !chosen.has(k)).map((k) => (
              <ActionButton
                key={k}
                action={addPresetPracticeAction}
                fields={{ practice: k }}
                variant="outline"
                className="h-auto min-h-12 justify-start whitespace-normal px-3 py-2 text-left"
                aria-label={`Add ${PRACTICE_INFO[k].label}`}
              >
                <span className="block">
                  <span className="block text-sm font-semibold">{PRACTICE_INFO[k].label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{PRACTICE_INFO[k].hint}</span>
                </span>
              </ActionButton>
            ))}
          </div>
          {chosen.size === PRESET_PRACTICES.length && <p className="text-sm text-muted-foreground">You&apos;ve added every suggested practice.</p>}
          <CustomPracticeForm />
        </div>
      )}
    </div>
  );
}
