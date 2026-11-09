"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Plus } from "lucide-react";
import { LoggedUndo } from "@/components/nutrition/logged-undo";
import { Button } from "@/components/ui/button";
import { mealPhrase, quickFoodSummary, type LogResult, type QuickFood } from "@/lib/domain/diary";
import { mealForTime } from "@/lib/domain/meal-time";
import { relogItemAction } from "@/server/actions/nutrition";

/**
 * One-tap re-logging of the foods a member eats most, right on the Nutrition page: the same `relogItemAction` the
 * Add food dialog's Recent tab uses, into the meal for the time of day (on this device's clock). Shown only when
 * there is something recent to offer. Each row shows the amount one tap adds; the confirmation offers Undo.
 */
const subscribeNever = () => () => {};

export function QuickRelog({ date, recent, frequent, max = 6 }: { date: string; recent: QuickFood[]; frequent: QuickFood[]; max?: number }) {
  const [result, setResult] = useState<LogResult | null>(null);
  const [pending, start] = useTransition();
  // The meal comes from the device's clock, which the server can't know (a phone in New York and a server in UTC
  // disagree), so it is read only on the device after hydration; the server and the first client render say nothing.
  const meal = useSyncExternalStore(subscribeNever, () => mealForTime(new Date()), () => null);
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
      <p className="text-sm text-muted-foreground">One tap adds the amount shown to {meal ? mealPhrase(meal) : "the meal for this time of day"}.</p>
      <ul className="mt-2 divide-y divide-border" aria-busy={pending}>
        {foods.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0">
              <span className="block truncate font-medium">{f.name}</span>
              <span className="block text-sm text-muted-foreground" data-testid="quick-relog-amount">
                {quickFoodSummary(f)}
              </span>
            </span>
            <Button size="sm" variant="secondary" className="min-h-11 shrink-0" disabled={pending} onClick={() => relog(f.id)} aria-label={`Add ${f.name} again`} data-testid="quick-relog">
              <Plus aria-hidden /> Add
            </Button>
          </li>
        ))}
      </ul>
      <LoggedUndo result={result} className="mt-2" />
    </section>
  );
}
