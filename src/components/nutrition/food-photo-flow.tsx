"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, Check, ImageUp, Loader2, Plus, RotateCcw, Search, Sparkles, Trash2, Undo2 } from "lucide-react";
import { FoodPickerDialog } from "@/components/nutrition/food-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeAmount, type FoodChoice } from "@/lib/domain/food-basis";
import { logItemFor } from "@/lib/domain/food-favorites";
import { CONFIDENCE_LABELS, FOOD_PHOTO_MAX_DIMENSION, macroCalories, type PhotoAnalysis, type QuestionTopic } from "@/lib/domain/food-photo";
import { compressImage } from "@/lib/image-compress";
import { cn } from "@/lib/utils";
import { logFoodPhotoItemsAction, setFoodPhotoConsentAction } from "@/server/actions/food-photo";
import type { MyFood } from "@/components/nutrition/nutrition-client";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
const MEALS: [Meal, string][] = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snack"],
];

type Item =
  | {
      id: string;
      kind: "estimate";
      name: string;
      portion: string;
      grams: string;
      calories: string;
      protein_g: string;
      carbs_g: string;
      fat_g: string;
      confidence: "low" | "medium" | "high" | null;
      ingredients: string[];
      searchTerm: string;
    }
  | { id: string; kind: "database"; food: FoodChoice; quantity: number; unitId: string; replaced: Extract<Item, { kind: "estimate" }> | null };

export interface HiddenExtra {
  key: string;
  label: string;
  grams: number;
  topics: QuestionTopic[];
  food: FoodChoice;
}

const n = (s: string) => (s.trim() === "" ? NaN : Number(s));
const r1 = (x: number) => Math.round(x * 10) / 10;

function itemTotals(i: Item) {
  if (i.kind === "database") {
    const a = computeAmount(i.food.basis, i.quantity, i.unitId);
    return a ? { calories: a.nutrition.calories, protein_g: a.nutrition.protein_g, carbs_g: a.nutrition.carbs_g, fat_g: a.nutrition.fat_g } : null;
  }
  const v = { calories: n(i.calories), protein_g: n(i.protein_g), carbs_g: n(i.carbs_g), fat_g: n(i.fat_g) };
  return Object.values(v).every((x) => Number.isFinite(x) && x >= 0) ? v : null;
}

export function FoodPhotoFlow({ date, defaultMeal, myFoods, extras, usage }: { date: string; defaultMeal: Meal; myFoods: MyFood[]; extras: HiddenExtra[]; usage: { used: number; limit: number } }) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [phase, setPhase] = useState<"capture" | "analyzing" | "review">("capture");
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ itemId: string | null; query: string } | null>(null);
  const [saving, start] = useTransition();
  const savingRef = useRef(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      // Resized and re-encoded on the device: smaller upload, fewer image tokens, and no location metadata.
      const blob = await compressImage(file, FOOD_PHOTO_MAX_DIMENSION, 0.82);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("That file couldn't be read as a photo. Try another.");
    }
  };

  const analyze = async () => {
    if (!photo) return;
    setError(null);
    setPhase("analyzing");
    try {
      const form = new FormData();
      form.append("photo", photo.blob, "meal.jpg");
      form.append("notes", notes);
      const res = await fetch("/api/ai/food-photo", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as (PhotoAnalysis & { message?: string }) | null;
      if (!res.ok || !json) {
        setPhase("capture");
        return setError(json?.message ?? "The photo couldn't be analysed. Try again.");
      }
      setAnalysis(json);
      setItems(
        json.items.map((i) => ({
          id: crypto.randomUUID(),
          kind: "estimate",
          name: i.name,
          portion: i.portion,
          grams: i.grams == null ? "" : String(i.grams),
          calories: String(i.calories),
          protein_g: String(i.protein_g),
          carbs_g: String(i.carbs_g),
          fat_g: String(i.fat_g),
          confidence: i.confidence,
          ingredients: i.ingredients,
          searchTerm: i.searchTerm,
        })),
      );
      setPhase("review");
    } catch {
      setPhase("capture");
      setError(navigator.onLine ? "Couldn't reach the server. Try again." : "You're offline. Try again when you're connected.");
    }
  };

  const update = (id: string, patch: Partial<Extract<Item, { kind: "estimate" }>>) => setItems((list) => list.map((i) => (i.id === id && i.kind === "estimate" ? { ...i, ...patch } : i)));
  const blankItem = (): Item => ({ id: crypto.randomUUID(), kind: "estimate", name: "", portion: "", grams: "", calories: "", protein_g: "", carbs_g: "", fat_g: "", confidence: null, ingredients: [], searchTerm: "" });

  const totals = items.map(itemTotals);
  const invalid = items.length === 0 || totals.some((t) => t == null) || items.some((i) => i.kind === "estimate" && !i.name.trim());
  type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  const sum = totals.reduce<Totals>((a, t) => (t ? { calories: a.calories + t.calories, protein_g: a.protein_g + t.protein_g, carbs_g: a.carbs_g + t.carbs_g, fat_g: a.fat_g + t.fat_g } : a), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  const save = () => {
    if (invalid || savingRef.current) return;
    savingRef.current = true;
    start(async () => {
      const payload = items.map((i) =>
        i.kind === "database"
          ? { kind: "database" as const, picked: logItemFor(i.food, i.quantity, i.unitId) }
          : {
              kind: "estimate" as const,
              name: i.name.trim(),
              portion: i.portion.trim(),
              grams: Number.isFinite(n(i.grams)) && n(i.grams) > 0 ? n(i.grams) : null,
              calories: n(i.calories),
              protein_g: n(i.protein_g),
              carbs_g: n(i.carbs_g),
              fat_g: n(i.fat_g),
            },
      );
      const r = await logFoodPhotoItemsAction({ date, mealType: meal, items: payload });
      savingRef.current = false;
      if (!r.ok) return setError(r.error);
      setResult(r.message);
      router.refresh();
    });
  };

  if (result) {
    return (
      <Card data-testid="food-photo-done">
        <CardContent className="space-y-3 pt-5">
          <p role="status" className="font-semibold text-[#5fc49a]">
            {result}
          </p>
          <p className="text-sm text-muted-foreground">They&apos;re marked as estimates in your diary. The photo wasn&apos;t kept.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/nutrition?date=${date}`}>Go to my diary</Link>
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Analyse another meal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {phase !== "review" && (
        <Card>
          <CardHeader>
            <CardTitle>Your meal</CardTitle>
            <p className="text-sm text-muted-foreground">Take the photo from above with the whole plate in view, in good light. Include a fork or your hand for scale if you can.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of a photo that isn't uploaded yet
              <img src={photo.url} alt="Your meal photo" className="mx-auto max-h-80 rounded-xl" data-testid="food-photo-preview" />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">No photo yet</div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant={photo ? "secondary" : "default"} onClick={() => cameraRef.current?.click()} disabled={phase === "analyzing"}>
                {photo ? <RotateCcw aria-hidden /> : <Camera aria-hidden />} {photo ? "Retake" : "Take a photo"}
              </Button>
              <Button variant="secondary" onClick={() => libraryRef.current?.click()} disabled={phase === "analyzing"}>
                <ImageUp aria-hidden /> {photo ? "Choose another" : "Choose from library"}
              </Button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a meal photo" onChange={(e) => void choose(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
              <input ref={libraryRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a meal photo" onChange={(e) => void choose(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="photo-meal">Meal</Label>
                <NativeSelect id="photo-meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
                  {MEALS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="photo-notes">Anything the photo can&apos;t show? (optional)</Label>
                <Input id="photo-notes" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. cooked in olive oil, no dressing" />
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-[#f08a8a]">
                {error}
              </p>
            )}
            <Button onClick={analyze} disabled={!photo || phase === "analyzing"} data-testid="food-photo-analyze">
              {phase === "analyzing" ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />} {phase === "analyzing" ? "Estimating…" : "Estimate nutrition"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Uses 1 AI message ({Math.max(0, usage.limit - usage.used)} of {usage.limit} left this month). The photo is sent once and not stored.
            </p>
          </CardContent>
        </Card>
      )}

      {phase === "review" && analysis && (
        <>
          <div className="rounded-2xl border border-[#a8802f]/60 bg-[#a8802f]/10 p-4 text-sm" data-testid="food-photo-estimate-note">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> Estimated from a photo, not measured
            </p>
            <p className="mt-1 text-muted-foreground">Check and correct every item. Swap an item for a database food when you can; database values are more reliable.</p>
          </div>
          {!analysis.isFood && <p className="text-sm">No food was recognised in that photo. Add the items yourself below, or try another photo.</p>}
          {analysis.summary && <p className="text-sm text-muted-foreground">{analysis.summary}</p>}

          {analysis.questions.length > 0 && (
            <Card data-testid="food-photo-questions">
              <CardHeader>
                <CardTitle className="text-base">What the photo can&apos;t show</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.questions.map((q) => {
                  const quick = extras.filter((x) => x.topics.includes(q.topic));
                  return (
                    <div key={q.topic} className="space-y-1.5">
                      <p className="text-sm">{q.question}</p>
                      {quick.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {quick.map((x) => (
                            <Button
                              key={x.key}
                              size="sm"
                              variant="secondary"
                              onClick={() => setItems((list) => [...list, { id: crypto.randomUUID(), kind: "database", food: x.food, quantity: x.grams, unitId: "g", replaced: null }])}
                            >
                              <Plus aria-hidden /> {x.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <ul className="space-y-3" data-testid="food-photo-items">
            {items.map((i, idx) => {
              const t = totals[idx];
              if (i.kind === "database") {
                const a = computeAmount(i.food.basis, i.quantity, i.unitId);
                return (
                  <li key={i.id} className="rounded-2xl border border-border bg-card p-4" data-testid="food-photo-item">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{i.food.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {a?.amountLabel} · {i.food.detail ?? "Food database"}
                        </p>
                        <Badge variant="success" className="mt-1">
                          Database values
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        {i.replaced && (
                          <Button size="icon-sm" variant="ghost" aria-label={`Back to the photo estimate for ${i.replaced.name}`} onClick={() => setItems((list) => list.map((x) => (x.id === i.id && x.kind === "database" ? x.replaced! : x)))}>
                            <Undo2 aria-hidden />
                          </Button>
                        )}
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${i.food.name}`} onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}>
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </div>
                    {t && (
                      <p className="mt-2 text-sm tabular-nums">
                        {Math.round(t.calories)} kcal · P {r1(t.protein_g)} g · C {r1(t.carbs_g)} g · F {r1(t.fat_g)} g
                      </p>
                    )}
                  </li>
                );
              }
              const v = { calories: n(i.calories), protein_g: n(i.protein_g), carbs_g: n(i.carbs_g), fat_g: n(i.fat_g) };
              const mismatch = [v.calories, v.protein_g, v.carbs_g, v.fat_g].every(Number.isFinite) && Math.abs(macroCalories(v.protein_g, v.carbs_g, v.fat_g) - v.calories) > Math.max(60, v.calories * 0.25);
              const id = (f: string) => `${i.id}-${f}`;
              return (
                <li key={i.id} className="space-y-3 rounded-2xl border border-border bg-card p-4" data-testid="food-photo-item">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {i.confidence ? <Badge variant={i.confidence === "low" ? "default" : "secondary"}>{CONFIDENCE_LABELS[i.confidence]}</Badge> : <Badge variant="secondary">Added by you</Badge>}
                      <Badge variant="secondary">Estimate</Badge>
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${i.name || "item"}`} onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={id("name")}>Food</Label>
                      <Input id={id("name")} value={i.name} maxLength={120} onChange={(e) => update(i.id, { name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={id("portion")}>Portion</Label>
                      <Input id={id("portion")} value={i.portion} maxLength={120} onChange={(e) => update(i.id, { portion: e.target.value })} />
                    </div>
                  </div>
                  {i.ingredients.length > 0 && <p className="text-xs text-muted-foreground">Visible: {i.ingredients.join(", ")}</p>}
                  <div className="grid grid-cols-5 gap-2">
                    {(
                      [
                        ["grams", "Grams"],
                        ["calories", "kcal"],
                        ["protein_g", "Protein g"],
                        ["carbs_g", "Carbs g"],
                        ["fat_g", "Fat g"],
                      ] as const
                    ).map(([f, l]) => (
                      <div key={f} className="space-y-1">
                        <Label htmlFor={id(f)} className="text-xs">
                          {l}
                        </Label>
                        <Input id={id(f)} type="number" inputMode="decimal" min="0" step="1" value={i[f]} onChange={(e) => update(i.id, { [f]: e.target.value })} className="px-2" />
                      </div>
                    ))}
                  </div>
                  {mismatch && (
                    <p className="text-xs text-gold" role="note">
                      The calories don&apos;t match the macros (about {Math.round(macroCalories(v.protein_g, v.carbs_g, v.fat_g))} kcal from protein, carbs and fat). Check them.
                    </p>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setPicker({ itemId: i.id, query: i.searchTerm || i.name })}>
                    <Search aria-hidden /> Use a database food instead
                  </Button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setItems((list) => [...list, blankItem()])}>
              <Plus aria-hidden /> Add something missing
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPicker({ itemId: null, query: "" })}>
              <Search aria-hidden /> Add from the food database
            </Button>
          </div>

          <Card>
            <CardContent className="space-y-3 pt-5">
              <p className="text-sm" data-testid="food-photo-total">
                Total: <span className="font-semibold tabular-nums">{Math.round(sum.calories)} kcal</span> · P {r1(sum.protein_g)} g · C {r1(sum.carbs_g)} g · F {r1(sum.fat_g)} g, added to {MEALS.find(([v]) => v === meal)![1].toLowerCase()} on {date}
              </p>
              {error && (
                <p role="alert" className="text-sm text-[#f08a8a]">
                  {error}
                </p>
              )}
              {invalid && items.length > 0 && <p className="text-sm text-muted-foreground">Every item needs a name and numbers for calories, protein, carbs and fat.</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={invalid || saving} data-testid="food-photo-confirm">
                  {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Confirm and add to diary
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPhase("capture");
                    setAnalysis(null);
                    setItems([]);
                  }}
                >
                  Start over
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <FoodPickerDialog
        open={picker != null}
        onOpenChange={(o) => !o && setPicker(null)}
        myFoods={myFoods}
        initialQuery={picker?.query}
        title="Find the food"
        submitLabel="Use this food"
        onPick={(food, quantity, unitId) => {
          const target = picker?.itemId ?? null;
          setItems((list) => {
            const replaced = target ? (list.find((x) => x.id === target && x.kind === "estimate") as Extract<Item, { kind: "estimate" }> | undefined) : undefined;
            const next: Item = { id: crypto.randomUUID(), kind: "database", food, quantity, unitId, replaced: replaced ?? null };
            return target ? list.map((x) => (x.id === target ? next : x)) : [...list, next];
          });
          setPicker(null);
        }}
      />

      <p className="text-xs text-muted-foreground">
        Don&apos;t want meal photos sent to the AI any more?{" "}
        <button className={cn("underline")} onClick={() => void setFoodPhotoConsentAction(false).then(() => router.refresh())}>
          Turn off meal photo analysis
        </button>
        .
      </p>
    </div>
  );
}
