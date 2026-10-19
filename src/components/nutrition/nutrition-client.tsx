"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Droplets, Loader2, Plus, Search, Undo2, X } from "lucide-react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeScanner } from "@/components/nutrition/barcode-scanner";
import { AmountPicker, basisSummary } from "@/components/nutrition/food-amount";
import { basisFromFoodRow, defaultUnit, type FoodChoice } from "@/lib/domain/food-basis";
import { prepareEntry, rankFoods } from "@/lib/domain/food-search";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { MEAL_TYPES } from "@/lib/domain/meals";
import { caloriesFromMacros } from "@/lib/domain/nutrition";
import type { QuickFood } from "@/lib/domain/diary";
import {
  addWaterAction,
  createCustomFoodAction,
  logFoodAction,
  logTemplateAction,
  relogItemAction,
  saveMealTemplateAction,
  undoWaterAction,
  updateGoalsAction,
} from "@/server/actions/nutrition";



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
  /** Built-in foods only: whether it fits the user's diet style. */
  fitsDiet?: boolean;
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

function foodChoice(f: MyFood, kind: "mine" | "common"): FoodChoice {
  const tag = f.source === "usda" ? "USDA" : f.source === "openfoodfacts" ? "Open Food Facts (community data) — check the label" : kind === "common" ? "Built-in food · typical values" : "My food";
  return {
    key: `food:${f.id}`,
    kind: "food",
    ref: f.id,
    name: f.name,
    detail: [f.brand, tag].filter(Boolean).join(" · "),
    basis: basisFromFoodRow(f),
    isEstimate: f.is_estimate,
  };
}

type SearchState = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done" };

function searchErrorMessage(status: number, error?: string): string {
  if (error === "rate_limited") return "Too many searches — wait a moment.";
  if (error === "upgrade_required") return "Food search is part of nutrition tracking on Plus and Pro.";
  if (error === "unauthorized") return "Your session expired — sign in again.";
  return status >= 500 ? "Search is unavailable right now." : "Search failed.";
}

function ChoiceRow({ food, onPick, badge }: { food: FoodChoice; onPick: (f: FoodChoice) => void; badge?: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-border bg-elevated/50">
      <button type="button" className="w-full px-3 py-2 text-left hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 rounded-xl" onClick={() => onPick(food)}>
        <span className="block text-sm font-semibold">
          {food.name}
          {food.isEstimate && <span className="ml-1 text-[11px] font-normal text-gold">(typical values)</span>}
          {badge}
        </span>
        {food.detail && <span className="block text-[11px] text-muted-foreground">{food.detail}</span>}
        <span className="block text-xs text-muted-foreground">{basisSummary(food.basis)}</span>
      </button>
    </li>
  );
}

export function AddFoodDialog({
  date,
  myFoods,
  commonFoods,
  remoteSearch,
  categories,
  dietName,
  recent = [],
  frequent = [],
}: {
  date: string;
  myFoods: MyFood[];
  commonFoods: MyFood[];
  /** USDA FoodData Central API (branded foods) is configured in addition to the built-in database. */
  remoteSearch: boolean;
  /** USDA food groups for "Browse by type". */
  categories: string[];
  dietName?: string;
  recent?: QuickFood[];
  frequent?: QuickFood[];
}) {
  const [open, setOpen] = useState(false);
  const [mealType, setMealType] = useState("breakfast");
  const [status, setStatus] = useState("logged");
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const hasRecent = recent.length > 0;
  const [tab, setTab] = useState(hasRecent ? "recent" : "search");
  const [picked, setPicked] = useState<FoodChoice | null>(null);

  // Search / browse state
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<number | null>(null);
  const [results, setResults] = useState<FoodChoice[]>([]);
  const [remote, setRemote] = useState<FoodChoice[]>([]);
  const [remoteError, setRemoteError] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [moreLoading, setMoreLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [dietOnly, setDietOnly] = useState(false);
  // Manual
  const [manual, setManual] = useState({ name: "", calories: "", protein_g: "", carbs_g: "", fat_g: "", isEstimate: true });

  const term = q.trim();
  useEffect(() => {
    if (!open || tab !== "search") return;
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (cat != null) params.set("cat", String(cat));
    if (term.length >= 2 || cat != null) params.set("q", term);
    const t = setTimeout(
      async () => {
        setSearch({ kind: "loading" });
        try {
          const res = await fetch(`/api/foods/search?${params}`, { signal: ctrl.signal });
          const json = (await res.json().catch(() => ({}))) as { foods?: FoodChoice[]; remote?: FoodChoice[]; remoteError?: boolean; total?: number; error?: string };
          if (!res.ok) {
            setSearch({ kind: "error", message: searchErrorMessage(res.status, json.error) });
            return;
          }
          setResults(json.foods ?? []);
          setRemote(json.remote ?? []);
          setRemoteError(Boolean(json.remoteError));
          setTotal(json.total ?? 0);
          setSearch({ kind: "done" });
        } catch (e) {
          if ((e as Error).name !== "AbortError")
            setSearch({ kind: "error", message: typeof navigator !== "undefined" && !navigator.onLine ? "You're offline — search needs a connection." : "Search failed. Check your connection." });
        }
      },
      term ? 250 : 0,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, cat, open, tab]);

  const loadMore = async () => {
    if (cat == null) return;
    setMoreLoading(true);
    try {
      const params = new URLSearchParams({ cat: String(cat), q: term, offset: String(results.length) });
      const res = await fetch(`/api/foods/search?${params}`);
      const json = (await res.json().catch(() => ({}))) as { foods?: FoodChoice[]; error?: string };
      if (res.ok) setResults((r) => [...r, ...(json.foods ?? [])]);
      else setSearch({ kind: "error", message: searchErrorMessage(res.status, json.error) });
    } catch {
      setSearch({ kind: "error", message: "Couldn't load more. Check your connection." });
    } finally {
      setMoreLoading(false);
    }
  };

  const submit = (item: unknown) =>
    startTransition(async () => {
      const res = await logFoodAction({ date, mealType, status, item });
      setResult(res);
      if (res.ok) setPicked(null);
    });

  const logPicked = (food: FoodChoice, quantity: number, unitId: string) =>
    submit(
      food.kind === "usda"
        ? { source: "usda", fdcId: food.ref, quantity, unitId }
        : food.kind === "off"
          ? { source: "barcode", code: food.ref, format: food.format, quantity, unitId }
          : { source: "food", foodId: food.ref, quantity, unitId },
    );

  const pick = (f: FoodChoice) => {
    setResult(null);
    setPicked(f);
  };

  const relog = (itemId: string) =>
    startTransition(async () => {
      setResult(await relogItemAction({ itemId, date, mealType, status }));
    });

  const quickRow = (f: QuickFood, showCount: boolean) => (
    <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/50 px-3 py-2">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{f.name}</span>
        <span className="text-xs text-muted-foreground">
          {Math.round(f.calories)} kcal · P {Number(f.protein_g)} · C {Number(f.carbs_g)} · F {Number(f.fat_g)}
          {showCount ? ` · logged ${f.count}×` : ""}
        </span>
      </span>
      <Button size="sm" disabled={pending} onClick={() => relog(f.id)} aria-label={`Add ${f.name} again`}>
        <Plus aria-hidden /> Add
      </Button>
    </li>
  );

  const manualCalories = Number(manual.calories || 0);
  const macroCalories = caloriesFromMacros({ protein_g: Number(manual.protein_g || 0), carbs_g: Number(manual.carbs_g || 0), fat_g: Number(manual.fat_g || 0) });
  const mismatch = manual.calories && macroCalories > 0 && Math.abs(macroCalories - manualCalories) > Math.max(30, manualCalories * 0.2);
  const myChoices = myFoods.map((f) => foodChoice(f, "mine"));
  const filtered = filter.trim() ? rankFoods(myChoices, filter, (c) => prepareEntry(c.name), 100) : myChoices;
  const searching = term.length >= 2 && cat == null;
  const myMatches = searching ? rankFoods(myChoices, term, (c) => prepareEntry(c.name), 5) : [];
  const pool = dietOnly ? commonFoods.filter((f) => f.fitsDiet) : commonFoods;
  const commonMatches = searching ? rankFoods(pool, term, (f) => prepareEntry(f.name), 8) : [];
  const loading = search.kind === "loading";
  const fitsBadge = (f: MyFood) =>
    f.fitsDiet && dietName ? <span className="ml-1.5 rounded-full border border-[#2f5a3d] px-2 py-0.5 align-middle text-[10px] font-semibold text-[#8fd3a5]">Fits {dietName}</span> : null;
  const sectionTitle = "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground";

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          setResult(null);
          setPicked(null);
          setQ("");
          setCat(null);
          if (hasRecent && tab === "search") setTab("recent");
        }}
      >
        <Plus aria-hidden /> Add food
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{picked ? "How much?" : "Add food"}</DialogTitle>
            <DialogDescription>For {date}</DialogDescription>
          </DialogHeader>
          {result?.message && (
            <p role={result.ok ? "status" : "alert"} className={result.ok ? "mt-3 text-sm text-[#5fc49a]" : "mt-3 text-sm text-[#f08a8a]"}>
              {result.message}
            </p>
          )}
          {picked ? (
            <div className="mt-3">
              <AmountPicker
                key={picked.key}
                food={picked}
                initialQuantity={defaultUnit(picked.basis).quantity}
                initialUnitId={defaultUnit(picked.basis).unitId}
                mealType={mealType}
                onMealType={setMealType}
                pending={pending}
                submitLabel={status === "planned" ? "Plan it" : "Log food"}
                onSubmit={(quantity, unitId) => logPicked(picked, quantity, unitId)}
                onBack={() => setPicked(null)}
                idPrefix="add-amount"
              >
                <div className="space-y-1">
                  <Label htmlFor="add-amount-status">Log as</Label>
                  <NativeSelect id="add-amount-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="logged">Eaten</option>
                    <option value="planned">Planned</option>
                  </NativeSelect>
                </div>
              </AmountPicker>
            </div>
          ) : (
            <>
              <MealControls mealType={mealType} setMealType={setMealType} status={status} setStatus={setStatus} idPrefix="add" />
              <Tabs value={tab} onValueChange={setTab} className="mt-4">
                <TabsList className="w-full">
                  {hasRecent && (
                    <TabsTrigger value="recent" className="flex-1">
                      Recent
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="search" className="flex-1">
                    Search
                  </TabsTrigger>
                  <TabsTrigger value="scan" className="flex-1">
                    Scan
                  </TabsTrigger>
                  <TabsTrigger value="mine" className="flex-1">
                    My foods
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="flex-1">
                    Manual
                  </TabsTrigger>
                </TabsList>

                {hasRecent && (
                  <TabsContent value="recent">
                    <div className="space-y-4">
                      {frequent.length > 0 && (
                        <section aria-label="Frequent foods">
                          <p className={sectionTitle}>Frequent</p>
                          <ul className="mt-2 space-y-2">{frequent.map((f) => quickRow(f, true))}</ul>
                        </section>
                      )}
                      <section aria-label="Recent foods">
                        <p className={sectionTitle}>Recent</p>
                        <ul className="mt-2 space-y-2">{recent.map((f) => quickRow(f, false))}</ul>
                      </section>
                      <p className="text-[11px] text-muted-foreground">One tap adds the same amount you logged last time to the meal chosen above.</p>
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="search">
                  {cat != null && (
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{categories[cat]}</p>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setCat(null)}>
                        <X aria-hidden /> All types
                      </Button>
                    </div>
                  )}
                  <label className="relative block">
                    <span className="sr-only">{cat != null ? `Search ${categories[cat]}` : "Search foods"}</span>
                    <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={cat != null ? `Search ${categories[cat]}` : "e.g. chicken, banana, rice"} className="pl-9" />
                  </label>
                  {dietName && searching && (
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={dietOnly} onChange={(e) => setDietOnly(e.target.checked)} className="size-5 accent-[#C9A54C]" />
                      Only show built-in foods that fit {dietName}
                    </label>
                  )}
                  <div className="mt-3 space-y-4" aria-live="polite" aria-busy={loading}>
                    {search.kind === "error" && (
                      <p role="alert" className="text-sm text-[#f08a8a]">
                        {search.message}
                      </p>
                    )}

                    {cat == null && !searching && (
                      <section aria-label="Browse by type">
                        <p className={sectionTitle}>Browse by type</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {categories.map((c, i) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setCat(i);
                                setQ("");
                                setResults([]);
                              }}
                              className="rounded-full border border-border bg-elevated/60 px-3 py-1.5 text-xs hover:border-gold-muted hover:text-gold-highlight"
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {searching && myMatches.length > 0 && (
                      <section aria-label="My foods matches">
                        <p className={sectionTitle}>My foods</p>
                        <ul className="mt-2 space-y-2">
                          {myMatches.map((f) => (
                            <ChoiceRow key={f.key} food={f} onPick={pick} />
                          ))}
                        </ul>
                      </section>
                    )}

                    <section aria-label={cat != null ? categories[cat] : searching ? "Food database" : "Popular foods"}>
                      <p className={sectionTitle}>{cat != null ? `USDA · ${total} foods` : searching ? "USDA food database" : "Popular foods"}</p>
                      {loading && results.length === 0 ? (
                        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" aria-hidden /> {cat != null || searching ? "Searching…" : "Loading…"}
                        </p>
                      ) : search.kind === "done" && results.length === 0 ? (
                        <p className="py-2 text-sm text-muted-foreground">No matches. Try fewer or different words, or add it under Manual.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {results.map((f) => (
                            <ChoiceRow key={f.key} food={f} onPick={pick} />
                          ))}
                        </ul>
                      )}
                      {cat != null && results.length < total && search.kind === "done" && (
                        <Button type="button" variant="secondary" size="sm" className="mt-2 w-full" disabled={moreLoading} onClick={() => void loadMore()}>
                          {moreLoading && <Loader2 className="animate-spin" aria-hidden />} Show more ({total - results.length} left)
                        </Button>
                      )}
                      <p className="mt-2 text-[11px] text-muted-foreground">USDA FoodData Central (SR Legacy, public domain). Values per 100 g; pick any amount next.</p>
                    </section>

                    {searching && (
                      <section aria-label="Common foods">
                        <p className={sectionTitle}>Built-in common foods</p>
                        {commonMatches.length ? (
                          <ul className="mt-2 space-y-2">
                            {commonMatches.map((f) => (
                              <ChoiceRow key={f.id} food={foodChoice(f, "common")} onPick={pick} badge={fitsBadge(f)} />
                            ))}
                          </ul>
                        ) : (
                          <p className="py-2 text-sm text-muted-foreground">{commonFoods.length ? "No built-in foods match." : "No built-in foods are loaded on this server yet."}</p>
                        )}
                        <p className="mt-2 text-[11px] text-muted-foreground">Typical values; check the label when you have it.</p>
                      </section>
                    )}

                    {searching && remoteSearch && (remote.length > 0 || remoteError) && (
                      <section aria-label="Branded foods">
                        <p className={sectionTitle}>More from USDA FoodData Central</p>
                        {remoteError ? (
                          <p className="mt-2 text-sm text-muted-foreground">Branded-food search isn&apos;t responding right now; the results above still work.</p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {remote.map((f) => (
                              <ChoiceRow key={f.key} food={f} onPick={pick} />
                            ))}
                          </ul>
                        )}
                      </section>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="scan">
                  <BarcodeScanner
                    onFound={pick}
                    onEnterManually={(name) => {
                      if (name) setManual((m) => ({ ...m, name: name.slice(0, 160), isEstimate: false }));
                      setTab("manual");
                    }}
                  />
                </TabsContent>

                <TabsContent value="mine">
                  {myFoods.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">No saved foods yet. Create one below the food log, or use Search.</p>
                  ) : (
                    <>
                      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter my foods" aria-label="Filter my foods" />
                      <ul className="mt-2 space-y-2">
                        {filtered.map((f) => (
                          <ChoiceRow key={f.key} food={f} onPick={pick} />
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
            </>
          )}
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
