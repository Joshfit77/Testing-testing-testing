import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { AiConsentCard } from "@/components/coach/ai-consent-card";
import { FoodPhotoConsentCard } from "@/components/nutrition/food-photo-consent";
import { LabelCheck } from "@/components/nutrition/label-check";
import { BackLink } from "@/components/platform/back-link";
import { isoDateInTz, isValidIsoDate } from "@/lib/domain/dates";
import { mealForTime } from "@/lib/domain/meal-time";
import { NUTRITION_SCORE_LABEL } from "@/lib/food-iq";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { isAiConfigured } from "@/server/env";
import { isFlagEnabled } from "@/server/flags";
import { AiError, getAiUsage } from "@/server/services/ai-coach";

export const metadata = { title: "Check a label" };

/**
 * Check an ingredient label: for products without a barcode, not in Open Food Facts, or without an ingredient list.
 * Typing the text and checking it is free and needs no AI; reading the label from a photo uses the AI (Pro).
 */
export default async function LabelCheckPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [plan, sp, flag] = await Promise.all([getUserPlan(user.id), searchParams, isFlagEnabled("ai_coach")]);

  // Whether this member can have a label read from a photo, and if not, why (typing always works).
  let photo: { available: true } | { available: false; reason: string } = { available: false, reason: "" };
  let consentCard: "ai" | "photo" | null = null;
  if (!isAiConfigured() || !flag) photo = { available: false, reason: "Reading labels from photos isn't available right now. Typing the ingredients works as usual." };
  else {
    let limit = 0;
    try {
      limit = (await getAiUsage(user.id, plan)).chatLimit;
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
    }
    if (limit <= 0) photo = { available: false, reason: "Reading a label from a photo uses the AI and is included with Pro. Typing the ingredients and checking them is free." };
    else {
      const { data: consent } = await supabase.from("profiles").select("ai_data_consent_at, food_photo_consent_at").eq("id", user.id).maybeSingle();
      if (!consent?.ai_data_consent_at) consentCard = "ai";
      else if (!consent.food_photo_consent_at) consentCard = "photo";
      photo = consentCard ? { available: false, reason: "To photograph labels, agree to sending food photos to the AI below. Typing the ingredients works without it." } : { available: true };
    }
  }

  const today = isoDateInTz(new Date(), profile.timezone);
  const date = isValidIsoDate(sp.date) && sp.date <= today ? sp.date : today;
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: profile.timezone || "UTC" }).format(new Date()));
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackLink href="/nutrition/scanner">{NUTRITION_SCORE_LABEL}</BackLink>
      <PageHeader
        eyebrow="Food"
        title="Check a label"
        description="For a product without a barcode, or one the database doesn't know: check its ingredient list for additives, added sugars, sodium sources and allergens, and log its nutrition."
      />
      <LabelCheck photo={photo} date={date} defaultMeal={mealForTime(new Date(2000, 0, 1, hour))} />
      {consentCard === "ai" && <AiConsentCard />}
      {consentCard === "photo" && <FoodPhotoConsentCard />}
      <p className="text-xs text-muted-foreground">
        Have the barcode? <Link href="/nutrition/scanner" className="underline">Scan it</Link> for the product&apos;s full record.
      </p>
    </div>
  );
}
