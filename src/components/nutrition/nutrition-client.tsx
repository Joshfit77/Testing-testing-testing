"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Droplets, Loader2, Plus, Search, Undo2 } from "lucide-react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Notice } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { caloriesFromMacros } from "@/lib/domain/nutrition";
import {
  addWaterAction,
  createCustomFoodAction,
  logFoodAction,
  logTemplateAction,
  saveMealTemplateAction,
  undoWaterAction,
  updateGoalsAction,
} from "@/server/actions/nutrition";

export const MEAL_TYPES = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snack"],
] as const;

export interface MyFood {
  id: string;
  name: string;
  brand: string | null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_estimate: boolean;
  source: string;
}

interface SearchFood {
  fdcId: string;
  name: string;
  brand: string | null;
  dataType: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  householdServing: string | null;
}

function MealControls({ mealType, setMealType, status, setStatus, idPrefix }: { mealType: string; setMealType: (v: string) => void; status: string; setStatus: (v: string) => void; idPrefix: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-meal`}>Meal</Label>
        <NativeSelect id={`${idPrefix}-meal`} value={mealType} onChange={(e) => setMealType(e.target.value)}>
          {MEAL_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-status`}>Log as</Label>
        <NativeSelect id={`${idPrefix}-status`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="logged">Eaten</option>
          <option value="planned">Planned</option>
        </NativeSelect>
      </div>
    </div>
  );
}

export function AddFoodDialog({ date, myFoods, searchEnabled }: { date: string; myFoods: MyFood[]; searchEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [mealType, setMealType] = useState("breakfast");
  const [status, setStatus] = useState("logged");
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  // Search state
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [grams, setGrams] = useState<Record<string, string>>({});
  // My foods
  const [servings, setServings] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  // Manual
  const [manual, setManual] = useState({ name: "", calories: "", protein_g: "", carbs_g: "", fat_g: "", isEstimate: true });

  useEffect(() => {
    if (!searchEnabled || q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const json = (await res.json()) as { foods?: SearchFood[]; error?: string };
        if (!res.ok) setSearchError(json.error === "rate_limited" ? "Too many searches — wait a moment." : "Search is unavailable right now.");
        setResults(json.foods ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSearchError("Search failed. Check your connection.");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, searchEnabled]);

  const submit = (item: unknown) =>
    startTransition(async () => {
      const res = await logFoodAction({ date, mealType, status, item });
      setResult(res);
    });

  const manualCalories = Number(manual.calories || 0);
  const macroCalories = caloriesFromMacros({ protein_g: Number(manual.protein_g || 0), carbs_g: Number(manual.carbs_g || 0), fat_g: Number(manual.fat_g || 0) });
  const mismatch = manual.calories && macroCalories > 0 && Math.abs(macroCalories - manualCalories) > Math.max(30, manualCalories * 0.2);
  const filtered = myFoods.filter((f) => !filter || f.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <Button onClick={() => { setOpen(true); setResult(null); }}>
        <Plus aria-hidden /> Add food
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent side="bottom" className="max-h-[92dvh]">
          <DialogHeader>
            <DialogTitle>Add food</DialogTitle>
            <DialogDescription>For {date}</DialogDescription>
          </DialogHeader>
          <MealControls mealType={mealType} setMealType={setMealType} status={status} setStatus={setStatus} idPrefix="add" />
          {result?.message && (
            <p role={result.ok ? "status" : "alert"} className={result.ok ? "mt-3 text-sm text-[#5fc49a]" : "mt-3 text-sm text-[#f08a8a]"}>
              {result.message}
            </p>
          )}
          <Tabs defaultValue={searchEnabled ? "search" : myFoods.length ? "mine" : "manual"} className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="search" className="flex-1">
                Search
              </TabsTrigger>
              <TabsTrigger value="mine" className="flex-1">
                My foods
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">
                Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search">
              {!searchEnabled ? (
                <Notice tone="info">Food database search isn&apos;t configured on this server. Use My foods or Manual entry.</Notice>
              ) : (
                <>
                  <label className="relative block">
                    <span className="sr-only">Search foods</span>
                    <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. greek yogurt, banana" className="pl-9" />
                  </label>
                  <p className="mt-2 text-[11px] text-muted-foreground">Values per 100 g from USDA FoodData Central. Enter the grams you ate.</p>
                  {searchError && <p className="mt-2 text-sm text-[#f08a8a]">{searchError}</p>}
                  <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto" aria-live="polite" aria-busy={searching}>
                    {searching && (
                      <li className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
                      </li>
                    )}
                    {!searching && q.trim().length >= 2 && results.length === 0 && !searchError && <li className="py-4 text-sm text-muted-foreground">No matches.</li>}
                    {results.map((f) => (
                      <li key={f.fdcId} className="rounded-xl border border-border bg-elevated/50 p-3">
                        <p className="text-sm font-semibold">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.brand ? `${f.brand} · ` : ""}
                          {f.calories} kcal · P {f.protein_g}g · C {f.carbs_g}g · F {f.fat_g}g per 100 g
                          {f.householdServing ? ` · label serving ${f.householdServing}` : ""}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            aria-label={`Grams of ${f.name}`}
                            value={grams[f.fdcId] ?? "100"}
                            onChange={(e) => setGrams((g) => ({ ...g, [f.fdcId]: e.target.value }))}
                            className="h-10 w-24"
                          />
                          <span className="text-xs text-muted-foreground">g</span>
                          <Button size="sm" className="ml-auto" disabled={pending} onClick={() => submit({ source: "usda", fdcId: f.fdcId, grams: Number(grams[f.fdcId] ?? 100) })}>
                            Add
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </TabsContent>

            <TabsContent value="mine">
              {myFoods.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No saved foods yet. Create one below the food log, or search the database.</p>
              ) : (
                <>
                  <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter my foods" aria-label="Filter my foods" />
                  <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
                    {filtered.map((f) => (
                      <li key={f.id} className="rounded-xl border border-border bg-elevated/50 p-3">
                        <p className="text-sm font-semibold">
                          {f.name} {f.is_estimate && <span className="text-[11px] font-normal text-gold">(estimate)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {f.serving_size} {f.serving_unit}: {f.calories} kcal · P {f.protein_g}g · C {f.carbs_g}g · F {f.fat_g}g
                          {f.source === "usda" ? " · USDA" : ""}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.25"
                            aria-label={`Servings of ${f.name}`}
                            value={servings[f.id] ?? "1"}
                            onChange={(e) => setServings((s) => ({ ...s, [f.id]: e.target.value }))}
                            className="h-10 w-20"
                          />
                          <span className="text-xs text-muted-foreground">servings</span>
                          <Button size="sm" className="ml-auto" disabled={pending} onClick={() => submit({ source: "food", foodId: f.id, servings: Number(servings[f.id] ?? 1) })}>
                            Add
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </TabsContent>

            <TabsContent value="manual">
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit({
                    source: "manual",
                    name: manual.name,
                    calories: Number(manual.calories || 0),
                    protein_g: Number(manual.protein_g || 0),
                    carbs_g: Number(manual.carbs_g || 0),
                    fat_g: Number(manual.fat_g || 0),
                    isEstimate: manual.isEstimate,
                  });
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="man-name">Food</Label>
                  <Input id="man-name" required maxLength={160} value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ["calories", "kcal"],
                      ["protein_g", "Protein g"],
                      ["carbs_g", "Carbs g"],
                      ["fat_g", "Fat g"],
                    ] as const
                  ).map(([k, l]) => (
                    <div key={k} className="space-y-1">
                      <Label htmlFor={`man-${k}`} className="text-xs">
                        {l}
                      </Label>
                      <Input id={`man-${k}`} type="number" inputMode="decimal" min={0} required={k === "calories"} value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} />
                    </div>
                  ))}
                </div>
                {mismatch && <p className="text-xs text-gold">Heads up: these macros add up to about {macroCalories} kcal.</p>}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={manual.isEstimate} onChange={(e) => setManual({ ...manual, isEstimate: e.target.checked })} className="size-5 accent-[#C9A54C]" />
                  These values are my estimate (not from a label)
                </label>
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" aria-hidden />} Add entry
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CustomFoodForm() {
  const [state, action] = useActionState(createCustomFoodAction, initialActionState);
  return (
    <form action={action} className="space-y-3" key={state.ok ? state.at : "form"}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1 sm:col-span-1">
          <Label htmlFor="cf-name">Name</Label>
          <Input id="cf-name" name="name" required maxLength={160} aria-invalid={Boolean(state.fieldErrors?.name)} />
        </div>
        <div className="col-span-2 space-y-1 sm:col-span-1">
          <Label htmlFor="cf-brand">Brand (optional)</Label>
          <Input id="cf-brand" name="brand" maxLength={120} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cf-size">Serving size</Label>
          <Input id="cf-size" name="servingSize" type="number" inputMode="decimal" step="any" required defaultValue="1" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cf-unit">Unit</Label>
          <Input id="cf-unit" name="servingUnit" required defaultValue="serving" maxLength={30} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(
          [
            ["calories", "kcal"],
            ["protein_g", "Protein g"],
            ["carbs_g", "Carbs g"],
            ["fat_g", "Fat g"],
          ] as const
        ).map(([k, l]) => (
          <div key={k} className="space-y-1">
            <Label htmlFor={`cf-${k}`} className="text-xs">
              {l}
            </Label>
            <Input id={`cf-${k}`} name={k} type="number" inputMode="decimal" step="any" min={0} required defaultValue={k === "calories" ? "" : "0"} />
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isEstimate" className="size-5 accent-[#C9A54C]" />
        Values are an estimate (not copied from a label)
      </label>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Save food</SubmitButton>
    </form>
  );
}

export function WaterCard({ date, totalMl, goalMl }: { date: string; totalMl: number; goalMl: number }) {
  const [state, action] = useActionState(addWaterAction, initialActionState);
  const pct = goalMl ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <p className="font-display text-3xl font-bold">
          {(totalMl / 1000).toFixed(2)} <span className="text-base text-muted-foreground">/ {(goalMl / 1000).toFixed(1)} L</span>
        </p>
        <Droplets className="size-6 text-[#4A86C0]" aria-hidden />
      </div>
      <div role="progressbar" aria-label="Water intake" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-[#4A86C0] transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        {[250, 500, 750].map((ml) => (
          <form key={ml} action={action}>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="amountMl" value={ml} />
            <SubmitButton size="sm" variant="secondary" pendingLabel="…">
              +{ml} ml
            </SubmitButton>
          </form>
        ))}
        {totalMl > 0 && (
          <form action={undoWaterAction}>
            <input type="hidden" name="date" value={date} />
            <Button type="submit" size="sm" variant="ghost" aria-label="Undo last water entry">
              <Undo2 aria-hidden /> Undo
            </Button>
          </form>
        )}
      </div>
      <FormMessage state={state.ok ? { ok: true } : state} />
    </div>
  );
}

export function GoalsForm({ goals }: { goals: { calories: number; protein_g: number; carbs_g: number; fat_g: number; water_ml: number; is_estimate: boolean } | null }) {
  const [state, action] = useActionState(updateGoalsAction, initialActionState);
  const g = goals ?? { calories: 2200, protein_g: 140, carbs_g: 230, fat_g: 70, water_ml: 2500, is_estimate: true };
  return (
    <form action={action} className="space-y-3" key={JSON.stringify(goals)}>
      {goals?.is_estimate && <p className="text-xs text-gold">These targets are estimates based on bodyweight and goal — adjust them to suit you.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["calories", "Calories", g.calories],
            ["protein_g", "Protein (g)", g.protein_g],
            ["carbs_g", "Carbs (g)", g.carbs_g],
            ["fat_g", "Fat (g)", g.fat_g],
            ["water_ml", "Water (ml)", g.water_ml],
          ] as const
        ).map(([k, l, v]) => (
          <div key={k} className="space-y-1">
            <Label htmlFor={`goal-${k}`} className="text-xs">
              {l}
            </Label>
            <Input id={`goal-${k}`} name={k} type="number" inputMode="numeric" defaultValue={v} aria-invalid={Boolean(state.fieldErrors?.[k])} />
            <FieldError message={state.fieldErrors?.[k]} />
          </div>
        ))}
      </div>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="save">
          Save targets
        </SubmitButton>
        <SubmitButton name="intent" value="estimate" variant="ghost" pendingLabel="Estimating…">
          Re-estimate
        </SubmitButton>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estimates are general guidance, not dietary advice. If you have a medical condition, are pregnant, or have a history of disordered eating, consult a
        registered dietitian or physician.
      </p>
    </form>
  );
}

export function SaveMealForm({ mealId, defaultName }: { mealId: string; defaultName: string }) {
  const [state, action] = useActionState(saveMealTemplateAction, initialActionState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="mealId" value={mealId} />
      <div className="min-w-40 flex-1 space-y-1">
        <Label htmlFor={`sm-${mealId}`} className="text-xs">
          Save as meal / recipe
        </Label>
        <Input id={`sm-${mealId}`} name="name" defaultValue={defaultName} maxLength={120} required className="h-9" />
      </div>
      <div className="w-24 space-y-1">
        <Label htmlFor={`sy-${mealId}`} className="text-xs">
          Makes (servings)
        </Label>
        <Input id={`sy-${mealId}`} name="yieldServings" type="number" inputMode="decimal" min={1} step="0.5" defaultValue="1" className="h-9" />
      </div>
      <SubmitButton size="sm" variant="secondary">
        Save
      </SubmitButton>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function LogTemplateForm({ templateId, date }: { templateId: string; date: string }) {
  const [state, action] = useActionState(logTemplateAction, initialActionState);
  const [mealType, setMealType] = useState("dinner");
  const [status, setStatus] = useState("logged");
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="mealType" value={mealType} />
      <input type="hidden" name="status" value={status} />
      <div className="grid grid-cols-[1fr_5rem] items-end gap-2">
        <MealControls mealType={mealType} setMealType={setMealType} status={status} setStatus={setStatus} idPrefix={`t-${templateId}`} />
        <div className="space-y-1">
          <Label htmlFor={`ts-${templateId}`} className="text-xs">
            Servings
          </Label>
          <Input id={`ts-${templateId}`} name="servings" type="number" inputMode="decimal" min={0.25} step="0.25" defaultValue="1" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={`td-${templateId}`} className="text-xs">
          Date
        </Label>
        <Input id={`td-${templateId}`} name="date" type="date" defaultValue={date} className="h-9 w-40" />
        <SubmitButton size="sm" className="ml-auto">
          Add
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
