import { PageHeader } from "@/components/common/page-header";
import { DietPicker } from "@/components/nutrition/diet-picker";
import { isDietType } from "@/lib/domain/diets";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { BackLink } from "@/components/platform/back-link";

export const metadata = { title: "Diets" };

export default async function DietsPage() {
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("onboarding_answers").select("diet_type").eq("user_id", user.id).maybeSingle();
  const current = isDietType(data?.diet_type) ? data.diet_type : null;
  return (
    <div className="space-y-6">
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader
        eyebrow="Food"
        title="Diets"
        description="Pick the way you want to eat. Your diet sets your calorie and macro split and marks the foods that fit it."
      />
      <DietPicker current={current} />
      <p className="text-xs text-muted-foreground">
        General education, not medical or dietetic advice. If you have a medical condition, take medication, are pregnant or breastfeeding, or have a history of
        disordered eating, talk to a doctor or registered dietitian before changing how you eat.
      </p>
    </div>
  );
}
