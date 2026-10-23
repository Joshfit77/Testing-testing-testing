"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { BarcodeScanner } from "@/components/nutrition/barcode-scanner";
import { FoodPickerDialog } from "@/components/nutrition/food-picker";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultUnit, type FoodChoice } from "@/lib/domain/food-basis";
import { logItemFor } from "@/lib/domain/food-favorites";
import { ALLERGENS, NUTRITION_FILTER_LABELS, NUTRITION_FILTERS, type FoodFilters, type NutritionFilter } from "@/lib/food-quality";
import { EXPLAIN_FOCUS, FOCUS_LABEL, type ExplainFocus, type ProductExplanation } from "@/lib/food-quality-ai";
import { cn } from "@/lib/utils";
import { logFoodAction } from "@/server/actions/nutrition";
import { explainProductAction, setFoodFiltersAction } from "@/server/actions/food-quality";

/** The existing barcode scanner (camera, native scanner or typed code), opening the product's quality page. */
export function QualityScanner() {
  const router = useRouter();
  return (
    <BarcodeScanner
      onFound={() => undefined}
      onCode={(code) => router.push(`/nutrition/product/${encodeURIComponent(code)}`)}
      onEnterManually={() => router.push("/nutrition")}
    />
  );
}

type Meal = "breakfast" | "lunch" | "dinner" | "snack";

export function AddProductToDiary({ choice, date, defaultMeal }: { choice: FoodChoice; date: string; defaultMeal: Meal }) {
  const [open, setOpen] = useState(false);
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const initial = { food: choice, ...defaultUnit(choice.basis) };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="add-meal">Meal</Label>
          <NativeSelect id="add-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </NativeSelect>
        </div>
        <Button size="lg" onClick={() => setOpen(true)} disabled={pending} data-testid="add-to-diary">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Add to Food Diary
        </Button>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={cn("text-sm", message.ok ? "text-[#5fc49a]" : "text-[#f08a8a]")}>
          {message.text}
        </p>
      )}
      <FoodPickerDialog
        open={open}
        onOpenChange={setOpen}
        myFoods={[]}
        initial={initial}
        title="Add to Food Diary"
        submitLabel="Add to diary"
        onPick={(food, quantity, unitId) => {
          setOpen(false);
          start(async () => {
            const r = await logFoodAction({ clientId: crypto.randomUUID(), date, mealType: meal, status: "logged", item: logItemFor(food, quantity, unitId) });
            setMessage(r.ok ? { ok: true, text: r.message ?? "Added." } : { ok: false, text: r.message ?? "Couldn't add it. Try again." });
          });
        }}
      />
    </div>
  );
}

export function ExplainProduct({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ProductExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<ExplainFocus>("goals");
  return (
    <div className="space-y-3" data-testid="product-explain">
      <div role="radiogroup" aria-label="What to ask about" className="flex flex-wrap gap-1.5">
        {EXPLAIN_FOCUS.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={focus === f}
            onClick={() => setFocus(f)}
            className={cn("min-h-9 rounded-full border px-3 text-sm", focus === f ? "border-gold bg-gold/15 text-champagne" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {FOCUS_LABEL[f]}
          </button>
        ))}
      </div>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await explainProductAction(code, focus);
            if (r.ok) setResult(r.explanation);
            else setError(r.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />} {result ? "Ask again" : "Ask AI about this food"}
      </Button>
      <p className="text-xs text-muted-foreground">Uses 1 AI message. Only the product data shown here, the app&apos;s reviewed ingredient notes and your goals and targets are sent. The AI can&apos;t add its own claims about ingredients.</p>
      {error && (
        <p role="alert" className="text-sm text-[#f08a8a]">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-2 rounded-xl border border-gold-muted/50 bg-gold/5 p-3 text-sm" data-testid="product-explanation">
          <p className="text-xs uppercase tracking-wide text-gold">AI explanation · based only on the data shown, may be incomplete</p>
          <p>{result.summary}</p>
          {result.fits.length > 0 && (
            <div>
              <p className="font-semibold">How it fits</p>
              <ul className="list-disc pl-5">
                {result.fits.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {result.watch_outs.length > 0 && (
            <div>
              <p className="font-semibold">Keep in mind</p>
              <ul className="list-disc pl-5">
                {result.watch_outs.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {result.uncertainties.length > 0 && (
            <div>
              <p className="font-semibold">Uncertain</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {result.uncertainties.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FiltersEditor({ initial }: { initial: FoodFilters }) {
  const router = useRouter();
  const [f, setF] = useState<FoodFilters>(initial);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <form
      className="space-y-3"
      data-testid="filters-editor"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setFoodFiltersAction(f);
          setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
          if (r.ok) router.refresh();
        });
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold">Allergens to avoid</legend>
        <div className="mt-1 grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
          {Object.entries(ALLERGENS).map(([tag, label]) => (
            <label key={tag} className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-[#cfa53e]" checked={f.allergens.includes(tag)} onChange={() => setF((c) => ({ ...c, allergens: toggle(c.allergens, tag) }))} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="filter-diet">Diet</Label>
        <NativeSelect id="filter-diet" value={f.diet} onChange={(e) => setF((c) => ({ ...c, diet: e.target.value as FoodFilters["diet"] }))}>
          <option value="none">No preference</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="vegan">Vegan</option>
        </NativeSelect>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Nutrition preferences</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {NUTRITION_FILTERS.map((n: NutritionFilter) => (
            <label key={n} className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-[#cfa53e]" checked={f.nutrition.includes(n)} onChange={() => setF((c) => ({ ...c, nutrition: toggle(c.nutrition, n) }))} />
              {NUTRITION_FILTER_LABELS[n]}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Save filters
      </Button>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={cn("text-sm", message.ok ? "text-[#5fc49a]" : "text-[#f08a8a]")}>
          {message.text}
        </p>
      )}
    </form>
  );
}

export function CompareWith({ base }: { base: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [scan, setScan] = useState(false);
  const go = (c: string) => router.push(`/nutrition/compare?a=${encodeURIComponent(base)}&b=${encodeURIComponent(c)}`);
  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const c = code.replace(/\D/g, "");
          if (c.length >= 8) go(c);
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="compare-code">Second product&apos;s barcode</Label>
          <Input id="compare-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 5000159407236" />
        </div>
        <Button type="submit" size="sm" disabled={code.replace(/\D/g, "").length < 8}>
          Compare
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setScan((s) => !s)}>
          {scan ? "Hide scanner" : "Scan it"}
        </Button>
      </form>
      {scan && <BarcodeScanner onFound={() => undefined} onCode={(c) => go(c)} onEnterManually={() => setScan(false)} />}
    </div>
  );
}

/** The Open Food Facts package photo; hidden if it can't load (offline, or the product has none). */
export function ProductImage({ src, alt, small = false }: { src: string; alt: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // An error can happen before hydration, when onError isn't attached yet.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element -- Open Food Facts image (CC BY-SA), shown as published
  return <img ref={ref} src={src} alt={alt} onError={() => setFailed(true)} className={cn("shrink-0 rounded-xl bg-white object-contain", small ? "size-12" : "size-24")} />;
}
