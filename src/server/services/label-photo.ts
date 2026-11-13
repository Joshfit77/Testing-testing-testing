import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { FOOD_PHOTO_TIMEOUT_MS } from "@/lib/domain/food-photo";
import { LABEL_PHOTO_INSTRUCTIONS, labelPhotoOutputSchema, normalizeLabelPhoto, type LabelReading } from "@/lib/domain/label-photo";
import type { Plan } from "@/lib/domain/types";
import { AiError, withAiRequest } from "@/server/services/ai-coach";
import { hasFoodPhotoConsent } from "@/server/services/food-photo";
import { logError } from "@/server/log";
import { costMicros, tokenUsage } from "@/lib/domain/ai-economics";

/**
 * Transcribe a food label from one photo. The image is held in memory for this request only and never stored.
 * Counts as one AI request and one of the 20 daily food-photo analyses (same limit as meal photos).
 */
export async function readLabelPhoto(supabase: SupabaseClient, userId: string, plan: Plan, photo: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }): Promise<LabelReading> {
  if (!(await hasFoodPhotoConsent(supabase, userId))) throw new AiError("consent_required", "Agree to sending food photos to the AI first.");
  const output = await withAiRequest({ supabase, userId, plan, kind: "food_photo", tier: "fast" }, async ({ client, model }) => {
    let res;
    try {
      res = await client.beta.messages.parse(
        {
          model,
          max_tokens: 2_500,
          system: [{ type: "text", text: LABEL_PHOTO_INSTRUCTIONS }],
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.base64 } },
                { type: "text", text: "Transcribe this food label." },
              ],
            },
          ],
          output_config: { format: betaZodOutputFormat(labelPhotoOutputSchema) },
        },
        { timeout: FOOD_PHOTO_TIMEOUT_MS, maxRetries: 0 },
      );
    } catch (err) {
      if (err instanceof Anthropic.APIConnectionTimeoutError) throw new AiError("provider", "Reading the label took too long. Try again, or type the ingredients.");
      if (err instanceof Anthropic.APIError) throw err;
      if (err instanceof Anthropic.AnthropicError) {
        logError("ai.label_photo.parse", err);
        throw new AiError("provider", "The AI's answer couldn't be read. Try again, or type the ingredients.");
      }
      throw err;
    }
    const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new AiError("provider", "The AI couldn't read that label. Try another photo, or type the ingredients.");
    return { value: res.parsed_output, inputTokens, outputTokens: res.usage.output_tokens, costMicros: costMicros(model, tokenUsage(res.usage)) };
  });
  return normalizeLabelPhoto(output);
}
