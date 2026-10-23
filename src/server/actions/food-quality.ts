"use server";

import { revalidatePath } from "next/cache";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { hasFeature } from "@/lib/domain/plans";
import { sanitizeFilters, type FoodFilters } from "@/lib/food-quality";
import { PRODUCT_EXPLAIN_INSTRUCTIONS, productExplanationSchema, productFactsForAi, type ProductExplanation } from "@/lib/food-quality-ai";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireUser } from "@/server/auth";
import { AiError, withAiRequest } from "@/server/services/ai-coach";
import { getQualityProduct } from "@/server/services/food-quality";
import { OffUnavailableError } from "@/server/services/open-food-facts";
import { logError } from "@/server/log";

/** Save the member's product filters (Plus and Pro). */
export async function setFoodFiltersAction(input: unknown): Promise<{ ok: true; message: string; filters: FoodFilters } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!hasFeature(await getUserPlan(user.id), "food_comparisons")) return { ok: false, error: "Personal product filters are included with Plus and Pro." };
  const filters = sanitizeFilters(input);
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update({ food_filters: filters }).eq("id", user.id);
  if (error) {
    logError("food_quality.filters", error);
    return { ok: false, error: "Couldn't save your filters. Try again." };
  }
  revalidatePath("/nutrition/product", "layout");
  revalidatePath("/nutrition/scanner");
  return { ok: true, message: "Filters saved.", filters };
}

/**
 * Pro: explain a product for the member's goals. Uses only the product's known data and the member's targets;
 * counts as one AI message (and needs the AI data consent).
 */
export async function explainProductAction(code: unknown): Promise<{ ok: true; explanation: ProductExplanation } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = z.string().regex(/^\d{8,14}$/).safeParse(code);
  if (!parsed.success) return { ok: false, error: "Invalid barcode." };
  const plan = await getUserPlan(user.id);
  const supabase = await getServerSupabase();
  try {
    const found = await getQualityProduct(parsed.data);
    if (!found) return { ok: false, error: "That product isn't in Open Food Facts." };
    const [{ data: goals }, { data: answers }, { data: profile }] = await Promise.all([
      supabase.from("nutrition_goals").select("calories, protein_g, carbs_g, fat_g").eq("user_id", user.id).maybeSingle(),
      supabase.from("onboarding_answers").select("primary_goal, diet_type").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("food_filters").eq("id", user.id).maybeSingle(),
    ]);
    const filters = sanitizeFilters(profile?.food_filters);
    const member = [
      `Main goal: ${answers?.primary_goal ?? "not set"}. Diet style: ${answers?.diet_type ?? "not set"}.`,
      goals ? `Daily targets: ${goals.calories} kcal, protein ${goals.protein_g} g, carbs ${goals.carbs_g} g, fat ${goals.fat_g} g.` : "Daily targets: not set.",
      filters.allergens.length || filters.diet !== "none" || filters.nutrition.length
        ? `Their product filters: avoid ${filters.allergens.join(", ") || "nothing listed"}; diet ${filters.diet}; prefers ${filters.nutrition.join(", ") || "nothing listed"}.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    const explanation = await withAiRequest({ supabase, userId: user.id, plan, kind: "food_explain", tier: "fast" }, async ({ client, model }) => {
      const res = await client.beta.messages.parse({
        model,
        max_tokens: 1_200,
        system: [{ type: "text", text: PRODUCT_EXPLAIN_INSTRUCTIONS }],
        messages: [{ role: "user", content: `${productFactsForAi(found.quality)}\n\nMember:\n${member}` }],
        output_config: { format: betaZodOutputFormat(productExplanationSchema) },
      });
      const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      if (res.stop_reason === "refusal" || !res.parsed_output) throw new AiError("provider", "The AI couldn't explain this product. Please try again.");
      return { value: res.parsed_output, inputTokens, outputTokens: res.usage.output_tokens };
    });
    const clip = (xs: string[]) => xs.map((x) => x.trim().slice(0, 300)).filter(Boolean).slice(0, 6);
    return {
      ok: true,
      explanation: { summary: explanation.summary.trim().slice(0, 800), fits: clip(explanation.fits), watch_outs: clip(explanation.watch_outs), uncertainties: clip(explanation.uncertainties) },
    };
  } catch (err) {
    if (err instanceof AiError) return { ok: false, error: err.message };
    if (err instanceof OffUnavailableError) return { ok: false, error: "Open Food Facts isn't responding right now. Try again in a moment." };
    logError("food_quality.explain", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
