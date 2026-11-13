import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { FoodChoice } from "@/lib/domain/food-basis";
import { FOOD_PHOTO_INSTRUCTIONS, FOOD_PHOTO_TIMEOUT_MS, bestMatch, foodPhotoOutputSchema, normalizeFoodPhoto, type MatchedAnalysis, type MatchedEstimate, type PhotoEstimate } from "@/lib/domain/food-photo";
import type { Plan } from "@/lib/domain/types";
import { AiError, withAiRequest } from "@/server/services/ai-coach";
import { searchUsda } from "@/server/services/usda-local";
import { logError } from "@/server/log";
import { costMicros, tokenUsage } from "@/lib/domain/ai-economics";

/**
 * Look up each item's search term in the bundled USDA database (no network, no AI; rules in `matchStrength`). A strong
 * match becomes the starting point the member reviews; a weak one is only offered.
 */
export async function matchToUsda(items: PhotoEstimate[]): Promise<MatchedEstimate[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const best = bestMatch(item.searchTerm, await searchUsda(item.searchTerm, 12));
        if (best) {
          const f = best.food;
          const choice: FoodChoice = { key: `usda:${f.fdcId}`, kind: "usda", ref: String(f.fdcId), name: f.name, detail: `USDA · ${f.usdaName}`, basis: f.basis };
          return { ...item, match: { choice, strong: best.strong } };
        }
      } catch (err) {
        logError("food_photo.match", err);
      }
      return { ...item, match: null };
    }),
  );
}

/** Has the member agreed to send meal photos to the AI provider? (Separate from the general AI consent.) */
export async function hasFoodPhotoConsent(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("food_photo_consent_at").eq("id", userId).maybeSingle();
  return Boolean(data?.food_photo_consent_at);
}

/**
 * Send one meal photo to the AI and return its estimate. The image is held in memory for this request only; it is
 * never written to storage or the database. Counts as one AI request (and one of the 20 daily photo analyses).
 */
export async function analyzeFoodPhoto(
  supabase: SupabaseClient,
  userId: string,
  plan: Plan,
  photo: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" },
  notes: string,
): Promise<MatchedAnalysis> {
  if (!(await hasFoodPhotoConsent(supabase, userId))) throw new AiError("consent_required", "Agree to sending meal photos to the AI first.");
  const output = await withAiRequest({ supabase, userId, plan, kind: "food_photo", tier: "fast" }, async ({ client, model }) => {
    let res;
    try {
      res = await client.beta.messages.parse(
        {
          model,
          max_tokens: 2_000,
          system: [{ type: "text", text: FOOD_PHOTO_INSTRUCTIONS }],
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.base64 } },
                { type: "text", text: notes ? `Estimate this meal. The member adds: ${notes}` : "Estimate this meal." },
              ],
            },
          ],
          output_config: { format: betaZodOutputFormat(foodPhotoOutputSchema) },
        },
        // One attempt, well inside the route's 60-second limit: a member is never charged for an answer they can't get.
        { timeout: FOOD_PHOTO_TIMEOUT_MS, maxRetries: 0 },
      );
    } catch (err) {
      // Failures here release the reservation (withAiRequest), so a timeout or an unreadable answer isn't charged.
      if (err instanceof Anthropic.APIConnectionTimeoutError) throw new AiError("provider", "The analysis took too long. Try again, or log the meal by search.");
      if (err instanceof Anthropic.APIError) throw err;
      if (err instanceof Anthropic.AnthropicError) {
        logError("ai.food_photo.parse", err);
        throw new AiError("provider", "The AI's answer couldn't be read. Try again, or log the meal by search.");
      }
      throw err;
    }
    const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new AiError("provider", "The AI couldn't read that photo. Try another photo, or log the meal by search.");
    return { value: res.parsed_output, inputTokens, outputTokens: res.usage.output_tokens, costMicros: costMicros(model, tokenUsage(res.usage)) };
  });
  const analysis = normalizeFoodPhoto(output);
  return { ...analysis, items: await matchToUsda(analysis.items) };
}
