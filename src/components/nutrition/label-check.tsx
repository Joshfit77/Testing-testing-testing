"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, Check, ImageUp, Loader2, ListChecks, RefreshCw } from "lucide-react";
import { IngredientAlertsSection } from "@/components/nutrition/food-iq-sections";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { allergenLabel } from "@/lib/food-quality";
import { LABEL_PHOTO_MAX_DIMENSION, type LabelReading, type Legibility } from "@/lib/domain/label-photo";
import { analyzeLabel, LABEL_TEXT_MAX, unreadableParts, type LabelAnalysis, type LabelNutrition } from "@/lib/label-analysis";
import { compressImage } from "@/lib/image-compress";
import { logLabelFoodAction } from "@/server/actions/label";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
const MEALS: [Meal, string][] = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snack"],
];
const NUTRIENT_FIELDS = [
  ["calories", "kcal"],
  ["protein_g", "Protein g"],
  ["carbs_g", "Carbs g"],
  ["sugars_g", "of which sugars g"],
  ["fat_g", "Fat g"],
  ["sat_fat_g", "of which saturates g"],
  ["fiber_g", "Fibre g"],
  ["salt_g", "Salt g"],
] as const;
type NutrientKey = (typeof NUTRIENT_FIELDS)[number][0];
type NutritionForm = { basis: LabelNutrition["basis"]; servingGrams: string } & Record<NutrientKey, string>;

const EMPTY_NUTRITION: NutritionForm = { basis: "100g", servingGrams: "", calories: "", protein_g: "", carbs_g: "", sugars_g: "", fat_g: "", sat_fat_g: "", fiber_g: "", salt_g: "" };
const LEGIBILITY_NOTE: Record<Legibility, string | null> = {
  clear: null,
  partly: "Some of the label was hard to read: words the AI couldn't read are marked [?]. Fix them from the package.",
  unreadable: "The label couldn't be read. Try a sharper, closer photo in good light, or type the ingredients.",
};
const n = (s: string) => (s.trim() === "" ? null : Number(s));
const deviceToday = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function toNutrition(f: NutritionForm): LabelNutrition | null {
  const values = Object.fromEntries(NUTRIENT_FIELDS.map(([k]) => [k, n(f[k])])) as Record<NutrientKey, number | null>;
  if (Object.values(values).every((v) => v == null)) return null;
  return { basis: f.basis, servingGrams: n(f.servingGrams), ...values };
}

/**
 * Check a food label: get its text (typed, pasted, or read from a photo by the AI for Pro members), correct it, then
 * check it with the app's own rules. The result belongs to the exact text checked; any edit asks to check again.
 */
export function LabelCheck({ photo, date: initialDate, defaultMeal }: { photo: { available: true } | { available: false; reason: string }; date: string; defaultMeal: Meal }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [statement, setStatement] = useState("");
  const [nutrition, setNutrition] = useState<NutritionForm>(EMPTY_NUTRITION);
  const [reading, setReading] = useState<"idle" | "reading">("idle");
  const [fromPhoto, setFromPhoto] = useState<Legibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ key: string; result: LabelAnalysis } | null>(null);
  const [amount, setAmount] = useState("");
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [date, setDate] = useState(initialDate);
  const [saveId, setSaveId] = useState("");
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const key = JSON.stringify([ingredients, statement, nutrition]);
  const stale = checked != null && checked.key !== key;
  const label = useMemo(() => toNutrition(nutrition), [nutrition]);

  const readPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setReading("reading");
    try {
      const blob = await compressImage(file, LABEL_PHOTO_MAX_DIMENSION, 0.88);
      const form = new FormData();
      form.append("photo", blob, "label.jpg");
      const res = await fetch("/api/ai/label-photo", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as (LabelReading & { message?: string }) | null;
      if (!res.ok || !json) return setError(json?.message ?? "The label couldn't be read. Try again, or type the ingredients.");
      if (!json.isLabel) return setError("That doesn't look like a food label. Photograph the ingredient list, or type it.");
      setFromPhoto(json.legibility);
      setName((v) => v || json.productName);
      setIngredients(json.ingredients);
      setStatement(json.allergenStatement);
      if (json.nutrition) {
        const t = json.nutrition;
        setNutrition({
          basis: t.basis,
          servingGrams: t.servingGrams == null ? "" : String(t.servingGrams),
          ...(Object.fromEntries(NUTRIENT_FIELDS.map(([k]) => [k, t[k] == null ? "" : String(t[k])])) as Record<NutrientKey, string>),
        });
      }
      setChecked(null);
    } catch {
      setError(navigator.onLine ? "Couldn't reach the server. Try again." : "You're offline. Type the ingredients instead: checking them works offline.");
    } finally {
      setReading("idle");
    }
  };

  const check = () => {
    setChecked({ key, result: analyzeLabel({ ingredients, allergenStatement: statement, nutrition: label }) });
    setSaveId(crypto.randomUUID());
    setSaved(null);
  };

  const macrosComplete = label != null && ["calories", "protein_g", "carbs_g", "fat_g"].every((k) => label[k as NutrientKey] != null);
  const unit = nutrition.basis === "serving" ? "serving" : nutrition.basis === "100ml" ? "ml" : "g";
  const save = () =>
    start(async () => {
      if (!label || !macrosComplete) return setSaveError("Add calories, protein, carbs and fat from the label to log it.");
      const r = await logLabelFoodAction({
        date,
        mealType: meal,
        clientId: saveId,
        name: name.trim() || "Labelled food",
        nutrition: { basis: label.basis, servingGrams: label.servingGrams, calories: label.calories, protein_g: label.protein_g, carbs_g: label.carbs_g, fat_g: label.fat_g, fiber_g: label.fiber_g, sugars_g: label.sugars_g, salt_g: label.salt_g },
        quantity: Number(amount),
        unitId: unit,
      });
      if (!r.ok) return setSaveError(r.error);
      setSaveError(null);
      setSaved(r.message);
    });

  const result = checked?.result;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1. The label&apos;s text</CardTitle>
          <p className="text-sm text-muted-foreground">Type or paste the ingredient list exactly as printed{photo.available ? ", or photograph the label and correct what the AI reads" : ""}.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {photo.available ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => cameraRef.current?.click()} disabled={reading === "reading"}>
                {reading === "reading" ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />} {reading === "reading" ? "Reading the label…" : "Photograph the label"}
              </Button>
              <Button variant="secondary" onClick={() => libraryRef.current?.click()} disabled={reading === "reading"}>
                <ImageUp aria-hidden /> Choose a photo
              </Button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a label photo" onChange={(e) => void readPhoto(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
              <input ref={libraryRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a label photo" onChange={(e) => void readPhoto(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
              <p className="w-full text-xs text-muted-foreground">Uses 1 AI message. The photo is sent once to read the text and isn&apos;t stored. The AI only copies the text; it doesn&apos;t judge the ingredients.</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="label-photo-unavailable">
              {photo.reason}
            </p>
          )}
          {fromPhoto && (
            <div role="note" className="rounded-xl border border-[#a8802f]/60 bg-[#a8802f]/10 p-3 text-sm" data-testid="label-photo-note">
              <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> Read from your photo by AI: check every word against the label
              </p>
              {LEGIBILITY_NOTE[fromPhoto] && <p className="mt-1 text-muted-foreground">{LEGIBILITY_NOTE[fromPhoto]}</p>}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="label-name">Product name (optional)</Label>
            <Input id="label-name" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="label-ingredients">Ingredients</Label>
            <Textarea id="label-ingredients" rows={5} maxLength={LABEL_TEXT_MAX} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="e.g. Wheat flour, sugar, palm oil, emulsifier: E322, salt" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="label-statement">Allergy advice (optional)</Label>
            <Textarea id="label-statement" rows={2} maxLength={600} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="e.g. Contains: milk. May contain: nuts." />
          </div>
          <details className="rounded-xl border border-border p-3" open={fromPhoto != null && label != null}>
            <summary className="cursor-pointer text-sm font-semibold">Nutrition from the label (optional)</summary>
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="label-basis">Values are per</Label>
                  <NativeSelect id="label-basis" value={nutrition.basis} onChange={(e) => setNutrition((v) => ({ ...v, basis: e.target.value as NutritionForm["basis"] }))}>
                    <option value="100g">100 g</option>
                    <option value="100ml">100 ml</option>
                    <option value="serving">serving</option>
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="label-serving">Serving size (g or ml)</Label>
                  <Input id="label-serving" type="number" inputMode="decimal" min="0" step="any" value={nutrition.servingGrams} onChange={(e) => setNutrition((v) => ({ ...v, servingGrams: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {NUTRIENT_FIELDS.map(([k, l]) => (
                  <div key={k} className="space-y-1">
                    <Label htmlFor={`label-${k}`} className="text-xs">
                      {l}
                    </Label>
                    <Input id={`label-${k}`} type="number" inputMode="decimal" min="0" step="any" value={nutrition[k]} onChange={(e) => setNutrition((v) => ({ ...v, [k]: e.target.value }))} className="px-2" />
                  </div>
                ))}
              </div>
            </div>
          </details>
          {error && (
            <p role="alert" className="text-sm text-[#f08a8a]">
              {error}
            </p>
          )}
          {unreadableParts(`${ingredients} ${statement}`) > 0 && (
            <p role="note" className="text-sm text-gold" data-testid="label-unreadable">
              The text still has parts that couldn&apos;t be read ([?] or [...]). Fix them from the package: anything unreadable can&apos;t be checked.
            </p>
          )}
          <Button onClick={check} disabled={!ingredients.trim() && !statement.trim()} data-testid="label-check">
            {stale ? <RefreshCw aria-hidden /> : <ListChecks aria-hidden />} {stale ? "Check again" : "Check these ingredients"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4" data-testid="label-result">
          {stale && (
            <p role="status" className="rounded-xl border border-border bg-card p-3 text-sm">
              You&apos;ve changed the text since this check. Check again to update the results.
            </p>
          )}
          {result.unreadable > 0 && (
            <p role="note" className="rounded-xl border border-[#a8802f]/60 bg-[#a8802f]/10 p-3 text-sm" data-testid="label-result-unreadable">
              This check includes {result.unreadable === 1 ? "a part" : `${result.unreadable} parts`} marked unreadable. Nothing there was checked, so an additive or allergen could be missing from the results.
            </p>
          )}
          {!result.likelyEnglish && (
            <p role="note" className="rounded-xl border border-border bg-card p-3 text-sm" data-testid="label-language">
              This doesn&apos;t look like English. E-numbers are still recognised, but ingredient names and allergens in other languages may be missed.
            </p>
          )}
          <IngredientAlertsSection alerts={result.alerts} hasIngredients={Boolean(ingredients.trim())} source="label" />
          <section aria-labelledby="label-allergens-title" className="space-y-2 rounded-2xl border border-border bg-card p-4" data-testid="label-allergens">
            <h2 id="label-allergens-title" className="font-display text-lg">
              Allergens named on this label
            </h2>
            <p className="text-sm">
              <span className="font-semibold">Contains: </span>
              {result.allergens.contains.length ? result.allergens.contains.map(allergenLabel).join(", ") : "none recognised in the text"}
            </p>
            <p className="text-sm">
              <span className="font-semibold">May contain: </span>
              {result.allergens.mayContain.length ? result.allergens.mayContain.map(allergenLabel).join(", ") : "none recognised in the text"}
            </p>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
              Found by matching English words in the text you checked. A missed or misspelt word, or another language, can hide an allergen, so &ldquo;none recognised&rdquo; is not proof that a food is free of it. Always read the package.
            </p>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Add to my diary</CardTitle>
              <p className="text-sm text-muted-foreground">Uses the nutrition values above, from the label.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {saved ? (
                <div className="space-y-2" data-testid="label-saved">
                  <p role="status" className="flex items-center gap-2 font-semibold text-[#5fc49a]">
                    <Check className="size-4" aria-hidden /> {saved}
                  </p>
                  <Link href={`/nutrition?date=${date}`} className="text-sm font-semibold text-gold-highlight underline">
                    Go to my diary
                  </Link>
                </div>
              ) : !macrosComplete ? (
                <p className="text-sm text-muted-foreground">Add the label&apos;s calories, protein, carbs and fat (under &ldquo;Nutrition from the label&rdquo;) to log this food.</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="label-amount">{unit === "serving" ? "Servings" : `Amount (${unit})`}</Label>
                      <Input id="label-amount" type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="label-meal">Meal</Label>
                      <NativeSelect id="label-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
                        {MEALS.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="label-date">Date</Label>
                      <Input id="label-date" type="date" value={date} max={deviceToday()} onChange={(e) => e.target.value && setDate(e.target.value)} />
                    </div>
                  </div>
                  {saveError && (
                    <p role="alert" className="text-sm text-[#f08a8a]">
                      {saveError}
                    </p>
                  )}
                  <Button onClick={save} disabled={saving || stale || !(Number(amount) > 0)} data-testid="label-save">
                    {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Add to diary
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
