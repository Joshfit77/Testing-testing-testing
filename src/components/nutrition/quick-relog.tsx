"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { ResultLine } from "@/components/nutrition/diary-client";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import type { QuickFood } from "@/lib/domain/diary";
import { mealForTime } from "@/lib/domain/meal-time";
import { relogItemAction } from "@/server/actions/nutrition";

/**
 * One-tap re-logging of the foods a member eats most, right on the Nutrition page: the same `relogItemAction` the
 * Add food dialog's Recent tab uses, into the meal for the time of day (on this device's clock). Shown only when
 * there is something recent to offer.
 */
export function QuickRelog({ date, recent, frequent, max = 6 }: { date: string; recent: QuickFood[]; frequent: QuickFood[]; max?: number }) {
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  // Most recent first, then the most frequent ones not already listed, up to `max`.
  const seen = new Set<string>();
  const foods = [...recent, ...frequent].filter((f) => {
    const k = f.name.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, max);
  if (foods.length === 0) return null;

  const relog = (itemId: string) =>
    start(async () => {
      setResult(await relogItemAction({ itemId, date, mealType: mealForTime(new Date()), status: "logged" }));
    });

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="quick-relog-title" data-testid="quick-relog-section">
      <h2 id="quick-relog-title" className="text-lg font-semibold">
        Recent foods
      </h2>
      <p className="text-sm text-muted-foreground">One tap adds it to {mealForTime(new Date())} with the same amount as last time.</p>
      <ul className="mt-2 divide-y divide-border" aria-busy={pending}>
        {foods.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0">
              <span className="block truncate font-medium">{f.name}</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(f.calories)} kcal · P {Math.round(Number(f.protein_g))} g
              </span>
            </span>
            <Button size="sm" variant="secondary" className="min-h-11 shrink-0" disabled={pending} onClick={() => relog(f.id)} aria-label={`Add ${f.name} again`} data-testid="quick-relog">
              <Plus aria-hidden /> Add
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <ResultLine result={result} />
      </div>
    </section>
  );
}
