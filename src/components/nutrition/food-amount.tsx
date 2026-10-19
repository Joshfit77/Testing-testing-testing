"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/action-state";
import { basisUnits, computeAmount, type FoodBasis, type FoodChoice } from "@/lib/domain/food-basis";
import { parseQuantity } from "@/lib/domain/food-units";
import { MEAL_TYPES } from "@/lib/domain/meals";
import { updateMealItemAction } from "@/server/actions/nutrition";

const fmt = (n: number | null | undefined, d = 1) => (n == null ? null : Number.isInteger(n) ? String(n) : n.toFixed(d).replace(/\.0$/, ""));

/** One line summarizing a food's values, e.g. "165 kcal · P 31 g · C 0 g · F 3.6 g per 100 g". */
export function basisSummary(b: FoodBasis): string {
  const v = b.per100;
  const per = b.servingOnly ? `per serving${b.servingLabel ? ` (${b.servingLabel})` : ""}` : `per 100 ${b.liquid ? "ml" : "g"}`;
  return `${Math.round(v.calories)} kcal · P ${fmt(v.protein_g)} g · C ${fmt(v.carbs_g)} g · F ${fmt(v.fat_g)} g ${per}`;
}

/**
 * MyFitnessPal-style amount step: quantity (accepts 1.5, 1 1/2, 3/4) × unit (label serving, USDA household
 * measures, g / oz / lb or ml / fl oz), meal, and a nutrition panel that updates as you type.
 */
export function AmountPicker({
  food,
  initialQuantity,
  initialUnitId,
  mealType,
  onMealType,
  pending,
  submitLabel,
  onSubmit,
  onBack,
  idPrefix = "amt",
  children,
}: {
  food: Pick<FoodChoice, "name" | "detail" | "basis" | "note" | "isEstimate">;
  initialQuantity: number;
  initialUnitId: string;
  mealType: string;
  onMealType: (v: string) => void;
  pending: boolean;
  submitLabel: string;
  onSubmit: (quantity: number, unitId: string) => void;
  onBack?: () => void;
  idPrefix?: string;
  /** Extra controls (e.g. "Log as: Eaten / Planned"). */
  children?: React.ReactNode;
}) {
  const units = basisUnits(food.basis);
  const [qtyText, setQtyText] = useState(String(Math.round(initialQuantity * 1000) / 1000));
  const [unitId, setUnitId] = useState(units.some((u) => u.id === initialUnitId) ? initialUnitId : units[0]!.id);
  const quantity = parseQuantity(qtyText);
  const result = computeAmount(food.basis, quantity, unitId);
  const n = result?.nutrition;
  const extras = n
    ? ([
        ["Fiber", n.fiber_g, "g"],
        ["Sugar", n.sugar_g, "g"],
        ["Sodium", n.sodium_mg, "mg"],
      ] as const)
    : [];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (result) onSubmit(quantity, unitId);
      }}
    >
      <div className="flex items-start gap-2">
        {onBack && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to results">
            <ArrowLeft aria-hidden />
          </Button>
        )}
        <div className="min-w-0">
          <p className="font-semibold leading-snug" data-testid="amount-food-name">
            {food.name} {food.isEstimate && <Badge variant="outline">typical values</Badge>}
          </p>
          {food.detail && <p className="text-xs text-muted-foreground">{food.detail}</p>}
          <p className="text-xs text-muted-foreground">{basisSummary(food.basis)}</p>
        </div>
      </div>

      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-qty`}>Amount</Label>
          <Input
            id={`${idPrefix}-qty`}
            inputMode="decimal"
            autoComplete="off"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            aria-invalid={!result}
            aria-describedby={`${idPrefix}-hint`}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-unit`}>Unit</Label>
          <NativeSelect id={`${idPrefix}-unit`} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
                {u.id.startsWith("p") || u.id === "serving" ? (food.basis.servingOnly ? "" : ` — ${fmt(u.grams)} ${food.basis.liquid ? "ml" : "g"}`) : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <p id={`${idPrefix}-hint`} className="-mt-2 text-xs text-muted-foreground" aria-live="polite">
        {result ? `= ${result.amountLabel}` : "Enter an amount like 1, 1.5, 1 1/2 or 3/4."}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-meal`}>Meal</Label>
          <NativeSelect id={`${idPrefix}-meal`} value={mealType} onChange={(e) => onMealType(e.target.value)}>
            {MEAL_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
        {children}
      </div>

      <section aria-label="Nutrition for this amount" className="rounded-2xl border border-border bg-elevated/40 p-3" data-testid="amount-nutrition">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Calories</span>
          <span className="font-display text-2xl font-bold tabular-nums" data-testid="amount-calories">
            {n ? n.calories : "—"}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
          {(
            [
              ["Protein", n?.protein_g, "amount-protein"],
              ["Carbs", n?.carbs_g, "amount-carbs"],
              ["Fat", n?.fat_g, "amount-fat"],
            ] as const
          ).map(([l, v, id]) => (
            <div key={l} className="rounded-xl bg-card/60 p-2">
              <dt className="text-[11px] text-muted-foreground">{l}</dt>
              <dd className="font-semibold tabular-nums" data-testid={id}>
                {v == null ? "—" : `${fmt(v)} g`}
              </dd>
            </div>
          ))}
        </dl>
        {extras.some(([, v]) => v != null) && (
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {extras.map(([l, v, u]) =>
              v == null ? null : (
                <div key={l} className="flex gap-1">
                  <dt>{l}</dt>
                  <dd className="tabular-nums text-foreground">
                    {fmt(v)} {u}
                  </dd>
                </div>
              ),
            )}
          </dl>
        )}
      </section>
      {food.note && <p className="text-[11px] text-gold">{food.note}</p>}

      <Button type="submit" className="w-full" disabled={pending || !result}>
        {pending && <Loader2 className="animate-spin" aria-hidden />} {submitLabel}
      </Button>
    </form>
  );
}

export interface EditableItem {
  id: string;
  name: string;
  mealType: string;
  basis: FoodBasis;
  quantity: number;
  unitId: string;
  /** Second line in the diary, e.g. "6 oz (170 g) · 281 kcal · P 52.7 · C 0 · F 6.1". */
  summary: string;
  isEstimate: boolean;
  /** Why this entry only scales by servings (hand-entered or older entries); null for normal foods. */
  note: string | null;
}

/** A diary row that opens the amount picker, prefilled, to change the amount, unit or meal. */
export function EditableMealItem({ item }: { item: EditableItem }) {
  const [open, setOpen] = useState(false);
  const [mealType, setMealType] = useState(item.mealType);
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        className="min-w-0 flex-1 rounded-lg py-1 text-left hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        onClick={() => {
          setMealType(item.mealType);
          setResult(null);
          setOpen(true);
        }}
        aria-label={`Edit ${item.name}`}
      >
        <p className="truncate text-sm font-semibold">
          {item.name} {item.isEstimate && <Badge variant="outline">estimate</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">{item.summary}</p>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
            <DialogDescription>
              {item.note ?? "Change the amount, unit or meal."}
            </DialogDescription>
          </DialogHeader>
          {result?.message && !result.ok && (
            <p role="alert" className="text-sm text-[#f08a8a]">
              {result.message}
            </p>
          )}
          {open && (
            <AmountPicker
              food={{ name: item.name, basis: item.basis }}
              initialQuantity={item.quantity}
              initialUnitId={item.unitId}
              mealType={mealType}
              onMealType={setMealType}
              pending={pending}
              submitLabel="Save changes"
              idPrefix={`edit-${item.id}`}
              onSubmit={(quantity, unitId) =>
                start(async () => {
                  const res = await updateMealItemAction({ id: item.id, quantity, unitId, mealType });
                  setResult(res);
                  if (res.ok) setOpen(false);
                })
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
