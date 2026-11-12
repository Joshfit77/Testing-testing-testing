"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { DraftRestoredNotice } from "@/components/drafts/draft-notice";
import { FoodPickerDialog } from "@/components/nutrition/food-picker";
import { NutrientTable } from "@/components/nutrition/nutrient-table";
import { SourceBadge } from "@/components/nutrition/source-badge";
import type { MyFood } from "@/components/nutrition/nutrition-client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeAmount, type FoodChoice } from "@/lib/domain/food-basis";
import { logItemFor } from "@/lib/domain/food-favorites";
import { parseQuantity } from "@/lib/domain/food-units";
import { perServing, recipeTotals } from "@/lib/domain/recipes";
import { useDraft } from "@/lib/use-draft";
import { saveRecipeAction } from "@/server/actions/recipes";

export interface EditorIngredient {
  /** Local id for React keys. */
  uid: string;
  /** recipe_ingredients.id for an ingredient already saved (its nutrition snapshot is kept). */
  id?: string;
  food: FoodChoice;
  quantity: number;
  unitId: string;
}

export interface RecipeDraft {
  name: string;
  servings: string;
  notes: string;
  ingredients: EditorIngredient[];
}

const BLANK: RecipeDraft = { name: "", servings: "1", notes: "", ingredients: [] };

let uidCounter = 0;
const newUid = () => `n${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

/** Create or edit a recipe. Unsaved changes are kept on this device as a draft until saved. */
export function RecipeEditor({ recipeId, initial, myFoods }: { recipeId?: string; initial?: RecipeDraft; myFoods: MyFood[] }) {
  const router = useRouter();
  const blank = initial ?? BLANK;
  const draft = useDraft<RecipeDraft>(recipeId ? `food.recipe.${recipeId}` : "food.recipe.new", blank);
  const v = draft.value;
  const set = (patch: Partial<RecipeDraft>) => draft.setValue((d) => ({ ...d, ...patch }));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<EditorIngredient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const servings = parseQuantity(v.servings);
  const servingsOk = Number.isFinite(servings) && servings > 0 && servings <= 100;
  const totals = useMemo(() => recipeTotals(v.ingredients.map((i) => ({ basis: i.food.basis, quantity: i.quantity, unitId: i.unitId }))), [v.ingredients]);
  const per = perServing(totals, servingsOk ? servings : 1);

  const save = () => {
    setError(null);
    if (!v.name.trim()) return setError("Give the recipe a name.");
    if (!servingsOk) return setError("Servings must be a number between 0 and 100.");
    if (!v.ingredients.length) return setError("Add at least one ingredient.");
    start(async () => {
      const res = await saveRecipeAction({
        id: recipeId,
        name: v.name.trim(),
        servings,
        notes: v.notes.trim() || undefined,
        ingredients: v.ingredients.map((i) => (i.id ? { id: i.id, quantity: i.quantity, unitId: i.unitId } : { pick: logItemFor(i.food, i.quantity, i.unitId) })),
      });
      if (!res.ok || !res.id) {
        setError(res.message ?? "Couldn't save the recipe.");
        return;
      }
      draft.clear();
      router.push(`/nutrition/recipes/${res.id}?saved=1`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {draft.restored && <DraftRestoredNotice onDiscard={draft.clear} onDismiss={draft.dismissRestored} />}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="recipe-name">Recipe name</Label>
          <Input id="recipe-name" value={v.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Turkey chili" />
        </div>
        <div className="grid grid-cols-[8rem_1fr] items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="recipe-servings">Servings</Label>
            <Input id="recipe-servings" inputMode="decimal" value={v.servings} onChange={(e) => set({ servings: e.target.value })} aria-invalid={!servingsOk} />
          </div>
          <p className="pb-2.5 text-sm text-muted-foreground">How many servings the whole recipe makes.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="recipe-notes">Notes (optional)</Label>
          <Textarea id="recipe-notes" value={v.notes} maxLength={2000} rows={2} onChange={(e) => set({ notes: e.target.value })} placeholder="Method, tips, where it came from" />
        </div>
      </section>

      <section aria-labelledby="ingredients-title" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="ingredients-title" className="text-lg font-semibold">
            Ingredients
          </h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditing(null);
              setPickerOpen(true);
            }}
          >
            <Plus aria-hidden /> Add ingredient
          </Button>
        </div>
        {v.ingredients.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No ingredients yet. Add foods from the food database, your saved foods, or a barcode.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card" data-testid="recipe-ingredients">
            {v.ingredients.map((i) => {
              const amount = computeAmount(i.food.basis, i.quantity, i.unitId);
              return (
                <li key={i.uid} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.9375rem] font-semibold">
                      {i.food.name} <SourceBadge source={i.food.key} isEstimate={Boolean(i.food.isEstimate)} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {amount ? `${amount.amountLabel} · ${amount.nutrition.calories} kcal · P ${amount.nutrition.protein_g} g` : "Choose an amount"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Change amount of ${i.food.name}`}
                    onClick={() => {
                      setEditing(i);
                      setPickerOpen(true);
                    }}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${i.food.name}`} onClick={() => set({ ingredients: v.ingredients.filter((x) => x.uid !== i.uid) })}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="recipe-nutrition-title" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="recipe-nutrition-title" className="mb-2 text-lg font-semibold">
          Nutrition
        </h2>
        {v.ingredients.length ? (
          <NutrientTable totals={totals} perServing={per} servings={servingsOk ? servings : 1} />
        ) : (
          <p className="text-sm text-muted-foreground">Add ingredients to see total and per-serving nutrition.</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">Calculated from each ingredient&apos;s source (USDA, label or estimate). Saving takes a fresh copy of each new food&apos;s values.</p>
      </section>

      {error && (
        <p role="alert" className="text-sm text-[#f08a8a]">
          {error}
        </p>
      )}
      <Button type="button" className="w-full" onClick={save} disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />} {recipeId ? "Save changes" : "Save recipe"}
      </Button>

      <FoodPickerDialog
        open={pickerOpen}
        onOpenChange={(o) => {
          setPickerOpen(o);
          if (!o) setEditing(null);
        }}
        myFoods={myFoods}
        initial={editing ? { food: editing.food, quantity: editing.quantity, unitId: editing.unitId } : null}
        title="Add ingredient"
        submitLabel={editing ? "Update amount" : "Add ingredient"}
        onPick={(food, quantity, unitId) => {
          if (editing) set({ ingredients: v.ingredients.map((x) => (x.uid === editing.uid ? { ...x, quantity, unitId } : x)) });
          else set({ ingredients: [...v.ingredients, { uid: newUid(), food, quantity, unitId }] });
          setEditing(null);
        }}
      />
    </div>
  );
}
