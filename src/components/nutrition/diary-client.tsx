"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy, Loader2, Zap } from "lucide-react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { ACTIVITY_INFO, ACTIVITY_LEVELS, WEEKLY_RATES_KG, type ActivityLevel } from "@/lib/domain/calorie-budget";
import { paceLabel } from "@/lib/domain/diary";
import { MEAL_TYPES } from "@/lib/domain/meals";
import type { UnitSystem } from "@/lib/domain/types";
import { displayWeight, toKg, weightUnit } from "@/lib/domain/units";
import { copyMealsAction, logFoodAction, updateBudgetAction } from "@/server/actions/nutrition";

function ResultLine({ result }: { result: ActionState | null }) {
  if (!result?.message) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm text-[#5fc49a]" : "text-sm text-[#f08a8a]"}>
      {result.message}
    </p>
  );
}

/** MyFitnessPal-style "Quick add": just calories (and optional macros) into a meal. */
export function QuickAddDialog({ date, mealType: initialMeal = "breakfast", label = "Quick add", compact = false }: { date: string; mealType?: string; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mealType, setMealType] = useState(initialMeal);
  const [values, setValues] = useState({ calories: "", protein_g: "", carbs_g: "", fat_g: "" });
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const mealName = MEAL_TYPES.find(([v]) => v === mealType)?.[1] ?? "meal";

  const submit = () =>
    start(async () => {
      const res = await logFoodAction({
        date,
        mealType,
        status: "logged",
        item: {
          source: "manual",
          name: "Quick add",
          calories: Number(values.calories || 0),
          protein_g: Number(values.protein_g || 0),
          carbs_g: Number(values.carbs_g || 0),
          fat_g: Number(values.fat_g || 0),
          isEstimate: false,
        },
      });
      setResult(res.ok ? { ...res, message: `Added ${Math.round(Number(values.calories))} kcal to ${mealName}.` } : res);
      if (res.ok) setValues({ calories: "", protein_g: "", carbs_g: "", fat_g: "" });
    });

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={compact ? "ghost" : "secondary"}
        onClick={() => {
          setMealType(initialMeal);
          setResult(null);
          setOpen(true);
        }}
        aria-label={compact ? `Quick add calories to ${mealName}` : undefined}
      >
        <Zap aria-hidden /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick add calories</DialogTitle>
            <DialogDescription>For {date}. Use it when you know the numbers but not the food.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!(Number(values.calories) > 0)) {
                setResult({ ok: false, message: "Enter the calories to add." });
                return;
              }
              submit();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="qa-meal">Meal</Label>
              <NativeSelect id="qa-meal" value={mealType} onChange={(e) => setMealType(e.target.value)}>
                {MEAL_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["calories", "Calories"],
                  ["protein_g", "Protein g"],
                  ["carbs_g", "Carbs g"],
                  ["fat_g", "Fat g"],
                ] as const
              ).map(([k, l]) => (
                <div key={k} className="space-y-1">
                  <Label htmlFor={`qa-${k}`} className="text-xs">
                    {l}
                  </Label>
                  <Input
                    id={`qa-${k}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={k === "calories" ? 10000 : 1000}
                    step="any"
                    required={k === "calories"}
                    value={values[k]}
                    onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Macros are optional.</p>
            <ResultLine result={result} />
            <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Add to {mealName}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Copy one meal (or the whole day) from another day into this one. */
export function CopyMealButton({ fromDate, toDate, mealType, label }: { fromDate: string; toDate: string; mealType?: string; label: string }) {
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          start(async () => {
            setResult(await copyMealsAction({ fromDate, toDate, mealType }));
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Copy aria-hidden />} {label}
      </Button>
      <ResultLine result={result} />
    </span>
  );
}

/** Goal weight, weekly pace and activity level → recalculated calorie budget. */
export function BudgetForm({
  units,
  goalWeightKg,
  weeklyChangeKg,
  activity,
}: {
  units: UnitSystem;
  goalWeightKg: number | null;
  weeklyChangeKg: number | null;
  activity: ActivityLevel | null;
}) {
  const [state, action] = useActionState(updateBudgetAction, initialActionState);
  const [goalWeight, setGoalWeight] = useState(goalWeightKg ? String(displayWeight(goalWeightKg, units)) : "");
  const unit = weightUnit(units);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="goalWeightKg" value={goalWeight && Number(goalWeight) > 0 ? toKg(Number(goalWeight), units) : ""} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="bud-goal" className="text-xs">
            Goal weight ({unit}, optional)
          </Label>
          <Input id="bud-goal" type="number" inputMode="decimal" step="0.1" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} aria-invalid={Boolean(state.fieldErrors?.goalWeightKg)} />
          <FieldError message={state.fieldErrors?.goalWeightKg} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bud-pace" className="text-xs">
            Weekly pace
          </Label>
          <NativeSelect id="bud-pace" name="weeklyChangeKg" defaultValue={String(weeklyChangeKg ?? 0)}>
            {WEEKLY_RATES_KG.map((r) => (
              <option key={r} value={r}>
                {paceLabel(r, units)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="bud-activity" className="text-xs">
            Activity outside workouts
          </Label>
          <NativeSelect id="bud-activity" name="activityLevel" defaultValue={activity ?? "light"}>
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_INFO[a].label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingLabel="Recalculating…">
        Recalculate budget
      </SubmitButton>
    </form>
  );
}
