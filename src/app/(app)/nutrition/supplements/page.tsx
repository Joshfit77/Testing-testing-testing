import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { SupplementsClient } from "@/components/supplements/supplements-client";
import { SUPPLEMENT_DISCLAIMER, SUPPLEMENT_IDS } from "@/data/supplements";
import { isoDateInTz } from "@/lib/domain/dates";
import { DIETS, isDietType } from "@/lib/domain/diets";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { logError } from "@/server/log";
import { BackLink } from "@/components/platform/back-link";

export const metadata = { title: "Supplements" };

/** Free on every plan, like Diets. */
export default async function SupplementsPage() {
  const { user, profile } = await requireOnboardedUser();
  const today = isoDateInTz(new Date(), profile.timezone);
  const supabase = await getServerSupabase();
  const [stackRes, logsRes, dietRes] = await Promise.all([
    supabase.from("supplement_stack").select("supplement_id, added_at").eq("user_id", user.id).order("added_at"),
    supabase.from("supplement_logs").select("supplement_id").eq("user_id", user.id).eq("taken_on", today),
    supabase.from("onboarding_answers").select("diet_type").eq("user_id", user.id).maybeSingle(),
  ]);
  const loadError = stackRes.error ?? logsRes.error;
  if (loadError) logError("supplements.page", loadError);

  const known = new Set(SUPPLEMENT_IDS);
  const stack = (stackRes.data ?? []).map((r) => r.supplement_id as string).filter((id) => known.has(id));
  const takenToday = (logsRes.data ?? []).map((r) => r.supplement_id as string).filter((id) => known.has(id));
  const diet = isDietType(dietRes.data?.diet_type) ? DIETS[dietRes.data.diet_type] : null;

  return (
    <div className="space-y-6">
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader
        eyebrow="Food"
        title="Supplements"
        description="What the common supplements do, how much people take, and how strong the evidence is. Build your stack and check it off each day."
      />
      {loadError ? (
        <Notice tone="error">Your stack couldn&apos;t be loaded right now. Refresh the page to try again.</Notice>
      ) : (
        <SupplementsClient today={today} stack={stack} takenToday={takenToday} dietId={diet?.id ?? null} dietName={diet?.name ?? null} />
      )}
      <p className="text-xs text-muted-foreground">General education, not medical advice. {SUPPLEMENT_DISCLAIMER}</p>
    </div>
  );
}
