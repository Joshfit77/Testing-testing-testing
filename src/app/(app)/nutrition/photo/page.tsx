import { PageHeader } from "@/components/common/page-header";
import { PlanLocked } from "@/components/common/plan-locked";
import { AiConsentCard } from "@/components/coach/ai-consent-card";
import { FoodPhotoConsentCard } from "@/components/nutrition/food-photo-consent";
import { FoodPhotoFlow, type HiddenExtra } from "@/components/nutrition/food-photo-flow";
import type { MyFood } from "@/components/nutrition/nutrition-client";
import { BackLink } from "@/components/platform/back-link";
import { isoDateInTz } from "@/lib/domain/dates";
import { HIDDEN_EXTRAS } from "@/lib/domain/food-photo";
import { mealForTime } from "@/lib/domain/meal-time";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { Notice } from "@/components/common/states";
import { isAiConfigured } from "@/server/env";
import { isFlagEnabled } from "@/server/flags";
import { AiError, getAiUsage } from "@/server/services/ai-coach";
import { getLocalFood } from "@/server/services/usda-local";

export const metadata = { title: "Meal photo" };

export default async function FoodPhotoPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [plan, sp, flag] = await Promise.all([getUserPlan(user.id), searchParams, isFlagEnabled("ai_coach")]);
  const header = (
    <>
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader eyebrow="Food" title="Meal photo" description="Photograph a meal for an AI estimate of what's on the plate. You check and correct every item before it's added to your diary." />
    </>
  );
  // Say so before asking for any consent when the feature can't run on this server right now.
  const unavailable = !isAiConfigured() ? "Meal photo analysis isn't configured on this server yet (no AI provider key). Everything else in the app works normally." : !flag ? "Meal photo analysis is temporarily unavailable." : null;
  if (unavailable) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {header}
        <Notice tone="warning">{unavailable}</Notice>
      </div>
    );
  }
  let usage;
  try {
    usage = await getAiUsage(user.id, plan);
  } catch (e) {
    if (!(e instanceof AiError)) throw e;
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {header}
        <Notice tone="warning">{e.message}</Notice>
      </div>
    );
  }
  if (usage.chatLimit <= 0) {
    return (
      <PlanLocked
        back={{ href: "/nutrition", label: "Food" }}
        eyebrow="Food"
        title="Meal photo"
        plan="Pro"
        description="Take a photo of your meal and get estimated foods, portions, calories and macros to check, correct and add to your diary."
      />
    );
  }
  const { data: consent } = await supabase.from("profiles").select("ai_data_consent_at, food_photo_consent_at").eq("id", user.id).maybeSingle();
  if (!consent?.ai_data_consent_at) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {header}
        <AiConsentCard />
      </div>
    );
  }
  if (!consent.food_photo_consent_at) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {header}
        <FoodPhotoConsentCard />
      </div>
    );
  }

  const today = isoDateInTz(new Date(), profile.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: profile.timezone || "UTC" }).format(new Date()));
  const [{ data: foodRows }, extras] = await Promise.all([
    supabase.from("foods").select("id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_estimate, source").eq("owner_id", user.id).order("name"),
    Promise.all(
      HIDDEN_EXTRAS.map(async (x): Promise<HiddenExtra | null> => {
        const f = await getLocalFood(Number(x.fdcId));
        if (!f) return null;
        return {
          key: x.key,
          label: x.label,
          grams: x.grams,
          topics: x.topics,
          food: { key: `usda:${f.fdcId}`, kind: "usda", ref: String(f.fdcId), name: f.name, detail: "USDA", basis: f.basis },
        };
      }),
    ),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {header}
      <FoodPhotoFlow
        date={date}
        defaultMeal={mealForTime(new Date(2000, 0, 1, hour))}
        myFoods={(foodRows ?? []) as MyFood[]}
        extras={extras.filter((x): x is HiddenExtra => x != null)}
        usage={{ used: usage.chatUsed, limit: usage.chatLimit }}
      />
    </div>
  );
}
