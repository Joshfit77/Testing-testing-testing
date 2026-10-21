"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/action-state";
import { parseQuantity } from "@/lib/domain/food-units";
import { MEAL_TYPES } from "@/lib/domain/meals";
import { formatNutrient, scaleTotals, type NutrientTotals } from "@/lib/domain/recipes";
import { logRecipeAction } from "@/server/actions/recipes";

/** Log a serving, or part of one (0.5, 1/3, 1 1/2), of a recipe to a meal in the diary. */
export function RecipeLogForm({ recipeId, perServing, today }: { recipeId: string; perServing: NutrientTotals; today: string }) {
  const router = useRouter();
  const [qty, setQty] = useState("1");
  const [mealType, setMealType] = useState("dinner");
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<(ActionState & { date?: string }) | null>(null);
  const [pending, start] = useTransition();
  const servings = parseQuantity(qty);
  const ok = Number.isFinite(servings) && servings >= 0.05 && servings <= 20;
  const preview = ok ? scaleTotals(perServing, servings) : null;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        start(async () => {
          const res = await logRecipeAction({ recipeId, date, mealType, servings });
          setResult({ ...res, date });
          if (res.ok) router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="log-servings">Servings eaten</Label>
          <Input id="log-servings" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-invalid={!ok} aria-describedby="log-servings-hint" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="log-meal">Meal</Label>
          <NativeSelect id="log-meal" value={mealType} onChange={(e) => setMealType(e.target.value)}>
            {MEAL_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="log-date">Date</Label>
        <Input id="log-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <p id="log-servings-hint" className="text-sm text-muted-foreground" aria-live="polite">
        {preview ? `${formatNutrient(preview.calories, "calories")} · protein ${formatNutrient(preview.protein_g, "protein_g")}` : "Enter servings like 1, 0.5, 1/3 or 1 1/2."}
      </p>
      {result?.message && (
        <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm text-[#5fc49a]" : "text-sm text-[#f08a8a]"}>
          {result.message}{" "}
          {result.ok && result.date && (
            <Link href={`/nutrition?date=${result.date}`} className="font-semibold text-gold-highlight underline">
              View diary
            </Link>
          )}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending || !ok}>
        {pending && <Loader2 className="animate-spin" aria-hidden />} Log to diary
      </Button>
    </form>
  );
}
