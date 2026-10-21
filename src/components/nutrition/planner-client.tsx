"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus, Repeat2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/action-state";
import type { Budget, DayFit, PlanNutrition } from "@/lib/domain/meal-planner";
import { generatePlanAction, logPlanMealAction, planAlternativesAction, savePlannerSettingsAction, setPlanPortionAction, swapPlanMealAction, type SwapOption } from "@/server/actions/meal-plan";

function Message({ state }: { state: ActionState | null }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-[#5fc49a]" : "text-sm text-[#f08a8a]"}>
      {state.message}
    </p>
  );
}

export interface PlannerPrefsView {
  mealsPerDay: number;
  budget: Budget;
  allergies: string[];
  dislikes: string[];
  includeApp: boolean;
}

const BUDGET_TEXT: Record<Budget, string> = {
  low: "Low: beans, eggs, grains, milk, produce, canned tuna",
  medium: "Medium: adds chicken, ground meat, cheese, yogurt, avocado",
  any: "Any: also fish, shrimp, steak and nuts",
};

export function PlannerSettingsForm({ prefs }: { prefs: PlannerPrefsView }) {
  const router = useRouter();
  const [mealsPerDay, setMeals] = useState(String(prefs.mealsPerDay));
  const [budget, setBudget] = useState<Budget>(prefs.budget);
  const [allergies, setAllergies] = useState(prefs.allergies.join(", "));
  const [dislikes, setDislikes] = useState(prefs.dislikes.join(", "));
  const [includeApp, setIncludeApp] = useState(prefs.includeApp);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await savePlannerSettingsAction({ mealsPerDay: Number(mealsPerDay), budget, allergies, dislikes, includeApp });
          setState(res);
          if (res.ok) router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="plan-meals">Meals per day</Label>
          <NativeSelect id="plan-meals" value={mealsPerDay} onChange={(e) => setMeals(e.target.value)}>
            <option value="2">2 (lunch, dinner)</option>
            <option value="3">3</option>
            <option value="4">4 (with a snack)</option>
            <option value="5">5 (with two snacks)</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="plan-budget">Budget</Label>
          <NativeSelect id="plan-budget" value={budget} onChange={(e) => setBudget(e.target.value as Budget)} aria-describedby="plan-budget-hint">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="any">Any</option>
          </NativeSelect>
        </div>
      </div>
      <p id="plan-budget-hint" className="text-sm text-muted-foreground">
        {BUDGET_TEXT[budget]}. A rough guide by ingredient type, not prices.
      </p>
      <div className="space-y-1">
        <Label htmlFor="plan-allergies">Allergies (never included)</Label>
        <Textarea id="plan-allergies" rows={2} value={allergies} maxLength={900} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. peanuts, shellfish, dairy" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="plan-dislikes">Foods you don&apos;t want</Label>
        <Textarea id="plan-dislikes" rows={2} value={dislikes} maxLength={900} onChange={(e) => setDislikes(e.target.value)} placeholder="e.g. mushrooms, salmon" />
      </div>
      <p className="text-sm text-muted-foreground">
        Separate items with commas. Matching uses ingredient names (and groups like “dairy”, “gluten”, “nuts”), so it isn&apos;t a substitute for reading labels if you have a serious allergy.
      </p>
      <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
        <input type="checkbox" checked={includeApp} onChange={(e) => setIncludeApp(e.target.checked)} className="size-5 accent-[#C9A54C]" />
        Include the app&apos;s simple recipes as well as mine
      </label>
      <Message state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />} Save settings
      </Button>
    </form>
  );
}

export function GeneratePlanForm({ defaultStart, hasPlan }: { defaultStart: string; hasPlan: boolean }) {
  const router = useRouter();
  const [start, setStart] = useState(defaultStart);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await generatePlanAction({ startDate: start, days: 7 });
          setState(res);
          if (res.ok) router.refresh();
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="plan-start">First day</Label>
          <Input id="plan-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required className="w-44" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />} {hasPlan ? "Generate a new week" : "Generate a week"}
        </Button>
      </div>
      <Message state={state} />
    </form>
  );
}

export interface PlanMealView {
  entryId: string;
  label: string;
  name: string;
  href: string | null;
  origin: "app" | "recipe" | "saved_meal";
  portion: number;
  nutrition: PlanNutrition;
  complete: boolean;
  logged: boolean;
}

export interface PlanDayView {
  date: string;
  title: string;
  fit: DayFit;
  meals: ({ label: string; meal: PlanMealView | null })[];
}

const ORIGIN_LABEL = { app: "App-made", recipe: "Your recipe", saved_meal: "Saved meal" } as const;
const fmtPortion = (p: number) => `${p} serving${p === 1 ? "" : "s"}`;

function FitLine({ fit, target }: { fit: DayFit; target: PlanNutrition }) {
  const sign = fit.calorieDiff > 0 ? "+" : fit.calorieDiff < 0 ? "−" : "±";
  const pct = Math.min(100, Math.round((fit.totals.calories / Math.max(1, target.calories)) * 100));
  return (
    <div className="space-y-1.5" data-testid="day-fit">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="tabular-nums">
          <span className="font-semibold">{fit.totals.calories.toLocaleString()}</span> of {target.calories.toLocaleString()} kcal ({sign}
          {Math.abs(fit.calorieDiff)})
        </span>
        <span className={fit.status === "close" ? "text-[#5fc49a]" : "text-gold"}>
          {fit.status === "close" ? "Close to target" : fit.status === "under" ? `${fit.percentOff}% under` : `${fit.percentOff}% over`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-elevated" role="img" aria-label={`${pct}% of the calorie target`}>
        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm tabular-nums text-muted-foreground">
        Protein {fit.totals.protein_g}/{target.protein_g} g · Carbs {fit.totals.carbs_g}/{target.carbs_g} g · Fat {fit.totals.fat_g}/{target.fat_g} g
      </p>
    </div>
  );
}

function MealRow({ label, meal }: { label: string; meal: PlanMealView }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const [swapOpen, setSwapOpen] = useState(false);
  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const res = await fn();
      setState(res);
      if (res.ok) router.refresh();
    });
  const n = meal.nutrition;
  return (
    <li className="space-y-2 py-3" data-testid="plan-meal">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gold">{label}</p>
          <p className="text-[0.9375rem] font-semibold" data-testid="plan-meal-name">
            {meal.href ? (
              <Link href={meal.href} className="hover:underline">
                {meal.name}
              </Link>
            ) : (
              meal.name
            )}{" "}
            <Badge variant="secondary">{ORIGIN_LABEL[meal.origin]}</Badge>
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {n.calories} kcal{meal.complete ? "" : " (at least)"} · P {n.protein_g} · C {n.carbs_g} · F {n.fat_g}
          </p>
        </div>
        {meal.logged && (
          <Badge variant="success" className="shrink-0">
            <Check className="size-3" aria-hidden /> Logged
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="group" aria-label={`Portion of ${meal.name}`}>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={`Smaller portion of ${meal.name}`}
            disabled={pending || meal.logged || meal.portion <= 0.25}
            onClick={() => run(() => setPlanPortionAction({ entryId: meal.entryId, portion: Math.max(0.25, meal.portion - 0.25) }))}
          >
            <Minus aria-hidden />
          </Button>
          <span className="min-w-24 text-center text-sm tabular-nums" data-testid="plan-portion">
            {fmtPortion(meal.portion)}
          </span>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={`Bigger portion of ${meal.name}`}
            disabled={pending || meal.logged || meal.portion >= 4}
            onClick={() => run(() => setPlanPortionAction({ entryId: meal.entryId, portion: Math.min(4, meal.portion + 0.25) }))}
          >
            <Plus aria-hidden />
          </Button>
        </div>
        <Button type="button" variant="ghost" disabled={pending || meal.logged} onClick={() => setSwapOpen(true)} aria-label={`Swap ${label.toLowerCase()}: ${meal.name}`}>
          <Repeat2 aria-hidden /> Swap
        </Button>
        {!meal.logged && (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => logPlanMealAction({ entryId: meal.entryId }))} aria-label={`Log this meal: ${meal.name}`}>
            {pending && <Loader2 className="animate-spin" aria-hidden />} Log this meal
          </Button>
        )}
      </div>
      <Message state={state} />
      <SwapDialog open={swapOpen} onOpenChange={setSwapOpen} entryId={meal.entryId} current={meal.name} label={label} />
    </li>
  );
}

function SwapDialog({ open, onOpenChange, entryId, current, label }: { open: boolean; onOpenChange: (o: boolean) => void; entryId: string; current: string; label: string }) {
  const router = useRouter();
  const [options, setOptions] = useState<SwapOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setOptions(null);
    setError(null);
    void planAlternativesAction({ entryId }).then((res) => {
      if (!alive) return;
      if (res.ok) setOptions(res.options ?? []);
      else setError(res.message ?? "Couldn't load other options.");
    });
    return () => {
      alive = false;
    };
  }, [open, entryId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Swap {label.toLowerCase()}</DialogTitle>
          <DialogDescription>Instead of {current}. These fit your diet, exclusions and budget, sized for this meal&apos;s share of your calories.</DialogDescription>
        </DialogHeader>
        <div className="mt-3 space-y-2" aria-live="polite">
          {error && (
            <p role="alert" className="text-sm text-[#f08a8a]">
              {error}
            </p>
          )}
          {!options && !error && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Finding options…
            </p>
          )}
          {options?.length === 0 && <p className="text-sm text-muted-foreground">Nothing else fits this meal with your current settings. Add recipes or loosen the exclusions.</p>}
          <ul className="space-y-2">
            {options?.map((o) => (
              <li key={o.key} className="flex items-center gap-2 rounded-xl border border-border bg-elevated/50 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold">{o.name}</span>
                  <span className="block text-sm tabular-nums text-muted-foreground">
                    {fmtPortion(o.portion)} · {o.calories} kcal{o.complete ? "" : " (at least)"} · P {o.protein_g} g · {ORIGIN_LABEL[o.origin]}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  aria-label={`Use ${o.name}`}
                  onClick={() =>
                    start(async () => {
                      const res = await swapPlanMealAction({ entryId, key: o.key });
                      if (!res.ok) {
                        setError(res.message ?? "Couldn't swap.");
                        return;
                      }
                      onOpenChange(false);
                      router.refresh();
                    })
                  }
                >
                  Use
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PlanDays({ days, target }: { days: PlanDayView[]; target: PlanNutrition }) {
  return (
    <div className="space-y-4">
      {days.map((d) => (
        <section key={d.date} aria-label={d.title} className="rounded-2xl border border-border bg-card p-4" data-testid="plan-day">
          <h3 className="mb-2 text-lg font-semibold">{d.title}</h3>
          <FitLine fit={d.fit} target={target} />
          <ul className="mt-1 divide-y divide-border">
            {d.meals.map((m, i) =>
              m.meal ? (
                <MealRow key={m.meal.entryId} label={m.label} meal={m.meal} />
              ) : (
                <li key={`empty-${i}`} className="py-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-gold">{m.label}</span>: nothing fits this meal with your settings.
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
