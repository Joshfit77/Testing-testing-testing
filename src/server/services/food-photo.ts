import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { FOOD_PHOTO_INSTRUCTIONS, foodPhotoOutputSchema, normalizeFoodPhoto, type PhotoAnalysis } from "@/lib/domain/food-photo";
import type { Plan } from "@/lib/domain/types";
import { AiError, withAiRequest } from "@/server/services/ai-coach";

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
): Promise<PhotoAnalysis> {
  if (!(await hasFoodPhotoConsent(supabase, userId))) throw new AiError("consent_required", "Agree to sending meal photos to the AI first.");
  const output = await withAiRequest({ supabase, userId, plan, kind: "food_photo", tier: "fast" }, async ({ client, model }) => {
    const res = await client.beta.messages.parse({
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
    });
    const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new AiError("provider", "The AI couldn't read that photo. Try another photo, or log the meal by search.");
    return { value: res.parsed_output, inputTokens, outputTokens: res.usage.output_tokens };
  });
  return normalizeFoodPhoto(output);
}
