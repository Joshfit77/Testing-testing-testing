"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeScanner } from "@/components/nutrition/barcode-scanner";
import { AmountPicker } from "@/components/nutrition/food-amount";
import { ChoiceRow, foodChoice, searchErrorMessage, type MyFood } from "@/components/nutrition/nutrition-client";
import { defaultUnit, type FoodChoice } from "@/lib/domain/food-basis";
import { prepareEntry, rankFoods } from "@/lib/domain/food-search";

/**
 * Pick a food and an amount without logging it: used for recipe ingredients. Searches the same food
 * database as Add food (USDA, plus branded foods when configured), the user's saved foods, or a barcode.
 */
export function FoodPickerDialog({
  open,
  onOpenChange,
  myFoods,
  onPick,
  initial,
  title = "Add ingredient",
  submitLabel = "Add ingredient",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  myFoods: MyFood[];
  onPick: (food: FoodChoice, quantity: number, unitId: string) => void;
  /** Open straight on the amount step for this food (editing an ingredient). */
  initial?: { food: FoodChoice; quantity: number; unitId: string } | null;
  title?: string;
  submitLabel?: string;
}) {
  const [tab, setTab] = useState("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodChoice[]>([]);
  const [state, setState] = useState<{ kind: "idle" | "loading" | "done" } | { kind: "error"; message: string }>({ kind: "idle" });
  const [picked, setPicked] = useState<{ food: FoodChoice; quantity: number; unitId: string } | null>(initial ?? null);
  const [filter, setFilter] = useState("");
  const [manualHint, setManualHint] = useState(false);

  useEffect(() => {
    if (open) setPicked(initial ?? null);
  }, [open, initial]);

  const term = q.trim();
  useEffect(() => {
    if (!open || tab !== "search" || picked) return;
    const ctrl = new AbortController();
    const t = setTimeout(
      async () => {
        setState({ kind: "loading" });
        try {
          const res = await fetch(`/api/foods/search?${new URLSearchParams({ q: term.length >= 2 ? term : "" })}`, { signal: ctrl.signal });
          const json = (await res.json().catch(() => ({}))) as { foods?: FoodChoice[]; remote?: FoodChoice[]; error?: string };
          if (!res.ok) {
            setState({ kind: "error", message: searchErrorMessage(res.status, json.error) });
            return;
          }
          setResults([...(json.foods ?? []), ...(json.remote ?? [])]);
          setState({ kind: "done" });
        } catch (e) {
          if ((e as Error).name !== "AbortError") setState({ kind: "error", message: "Search failed. Check your connection." });
        }
      },
      term ? 250 : 0,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, open, tab, picked]);

  const mine = myFoods.map((f) => foodChoice(f, "mine"));
  const mineFiltered = filter.trim() ? rankFoods(mine, filter, (c) => prepareEntry(c.name), 100) : mine;
  const choose = (food: FoodChoice) => setPicked({ food, ...defaultUnit(food.basis) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{picked ? "How much?" : title}</DialogTitle>
          <DialogDescription>{picked ? "Pick the amount used in the whole recipe." : "Search the food database, your foods, or scan a barcode."}</DialogDescription>
        </DialogHeader>
        {picked ? (
          <div className="mt-3">
            <AmountPicker
              key={picked.food.key}
              food={picked.food}
              initialQuantity={picked.quantity}
              initialUnitId={picked.unitId}
              pending={false}
              submitLabel={submitLabel}
              idPrefix="ingredient-amount"
              onBack={initial ? undefined : () => setPicked(null)}
              onSubmit={(quantity, unitId) => {
                onPick(picked.food, quantity, unitId);
                setPicked(null);
                setQ("");
                onOpenChange(false);
              }}
            />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="mt-3">
            <TabsList className="w-full">
              <TabsTrigger value="search" className="flex-1">
                Search
              </TabsTrigger>
              <TabsTrigger value="mine" className="flex-1">
                My foods
              </TabsTrigger>
              <TabsTrigger value="scan" className="flex-1">
                Scan
              </TabsTrigger>
            </TabsList>
            <TabsContent value="search">
              <label className="relative block">
                <span className="sr-only">Search foods</span>
                <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. chicken, rice, olive oil" className="pl-9" />
              </label>
              <div className="mt-3" aria-live="polite" aria-busy={state.kind === "loading"}>
                {state.kind === "error" && (
                  <p role="alert" className="text-sm text-[#f08a8a]">
                    {state.message}
                  </p>
                )}
                {state.kind === "loading" && results.length === 0 ? (
                  <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
                  </p>
                ) : state.kind === "done" && results.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">No matches. Try fewer or different words.</p>
                ) : (
                  <section aria-label="Food database results">
                    <p className="text-sm font-semibold text-muted-foreground">{term.length >= 2 ? "USDA food database" : "Popular foods"}</p>
                    <ul className="mt-2 space-y-2">
                      {results.map((f) => (
                        <ChoiceRow key={f.key} food={f} onPick={choose} />
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </TabsContent>
            <TabsContent value="mine">
              {manualHint && (
                <p role="status" className="mb-2 rounded-xl border border-gold-muted/60 bg-card px-3 py-2 text-sm">
                  To use a food that isn&apos;t in the database, save it under My foods on the Food screen (with the values from its label), then pick it here.
                </p>
              )}
              {mine.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No saved foods yet. Add one under My foods on the Food screen, or use Search.</p>
              ) : (
                <>
                  <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter my foods" aria-label="Filter my foods" />
                  <ul className="mt-2 space-y-2">
                    {mineFiltered.map((f) => (
                      <ChoiceRow key={f.key} food={f} onPick={choose} />
                    ))}
                  </ul>
                </>
              )}
            </TabsContent>
            <TabsContent value="scan">
              <BarcodeScanner
                onFound={choose}
                onEnterManually={() => {
                  setManualHint(true);
                  setTab("mine");
                }}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
