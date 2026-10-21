import Link from "next/link";
import { BookMarked, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { FoodToolsNav, NutritionLocked, nutritionPageUser } from "@/components/nutrition/nutrition-page";
import { LogTemplateForm } from "@/components/nutrition/nutrition-client";
import { SourceBadge } from "@/components/nutrition/source-badge";
import { isoDateInTz } from "@/lib/domain/dates";
import { sanitizeBasis } from "@/lib/domain/food-basis";
import { formatNutrient, perServing, sumNutrients } from "@/lib/domain/recipes";
import { getServerSupabase } from "@/lib/supabase/server";
import { deleteTemplateAction } from "@/server/actions/nutrition";
import { logError } from "@/server/log";

export const metadata = { title: "Saved meals" };

interface TemplateItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  amount_label: string | null;
  servings: number;
  source: string | null;
  is_estimate: boolean;
  basis: unknown;
}

export default async function SavedMealsPage() {
  const { user, profile, allowed } = await nutritionPageUser();
  if (!allowed) return <NutritionLocked title="Saved meals" description="Save a meal you eat often and log it again in one step." />;
  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  const { data, error } = await supabase
    .from("meals")
    .select("id, name, yield_servings, created_at, meal_items(id, name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, amount_label, servings, source, is_estimate, basis)")
    .eq("user_id", user.id)
    .eq("is_template", true)
    .order("name");
  if (error) logError("saved_meals.page", error);
  const templates = (data ?? []) as unknown as { id: string; name: string; yield_servings: number; meal_items: TemplateItem[] }[];

  return (
    <div className="space-y-6">
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader eyebrow="Food" title="Saved meals" description="Meals you saved from your diary. Log or plan one for any day in a single step." />
      <FoodToolsNav current="/nutrition/saved-meals" />
      <p className="text-[0.9375rem] text-muted-foreground">
        To save a meal, log it in the{" "}
        <Link href="/nutrition" className="font-semibold text-gold-highlight underline">
          diary
        </Link>{" "}
        and use <span className="font-semibold text-foreground">Save as meal</span> under it. To build something from ingredients with servings, use{" "}
        <Link href="/nutrition/recipes" className="font-semibold text-gold-highlight underline">
          Recipes
        </Link>
        .
      </p>
      {error ? (
        <Notice tone="error">Your saved meals couldn&apos;t be loaded right now. Refresh the page to try again.</Notice>
      ) : templates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-[0.9375rem] text-muted-foreground">No saved meals yet.</p>
      ) : (
        <ul className="space-y-4">
          {templates.map((t) => {
            const yieldServings = Number(t.yield_servings) || 1;
            const per = perServing(
              sumNutrients(
                t.meal_items.map((i) => {
                  const missing = new Set(sanitizeBasis(i.basis)?.missing ?? []);
                  return {
                    calories: Number(i.calories),
                    protein_g: missing.has("protein_g") ? null : Number(i.protein_g),
                    carbs_g: missing.has("carbs_g") ? null : Number(i.carbs_g),
                    fat_g: missing.has("fat_g") ? null : Number(i.fat_g),
                    fiber_g: i.fiber_g == null ? null : Number(i.fiber_g),
                    sugar_g: i.sugar_g == null ? null : Number(i.sugar_g),
                    sodium_mg: i.sodium_mg == null ? null : Number(i.sodium_mg),
                  };
                }),
              ),
              yieldServings,
            );
            return (
              <li key={t.id} className="rounded-2xl border border-border bg-card p-4" data-testid="saved-meal">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-lg font-semibold">
                      <BookMarked className="size-4 shrink-0 text-gold" aria-hidden /> {t.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Per serving: {formatNutrient(per.calories, "calories")} · P {formatNutrient(per.protein_g, "protein_g")} · C {formatNutrient(per.carbs_g, "carbs_g")} · F{" "}
                      {formatNutrient(per.fat_g, "fat_g")}
                      {yieldServings !== 1 ? ` · makes ${yieldServings}` : ""}
                    </p>
                  </div>
                  <ActionButton
                    action={deleteTemplateAction}
                    fields={{ id: t.id }}
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${t.name}`}
                    confirmMessage={`Delete the saved meal “${t.name}”?`}
                    confirmDetail="Entries you already logged from it stay in your diary."
                    confirmLabel="Delete"
                  >
                    <Trash2 aria-hidden />
                  </ActionButton>
                </div>
                <ul className="mb-3 space-y-1 text-sm">
                  {t.meal_items.map((i) => (
                    <li key={i.id} className="text-muted-foreground">
                      <span className="text-foreground">{i.name}</span> <SourceBadge source={i.source} isEstimate={i.is_estimate} />
                      {i.amount_label ? ` · ${i.amount_label}` : ""} · {Math.round(Number(i.calories))} kcal
                    </li>
                  ))}
                </ul>
                <LogTemplateForm templateId={t.id} date={today} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
