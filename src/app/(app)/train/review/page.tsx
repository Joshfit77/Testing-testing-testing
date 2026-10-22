import { PageHeader } from "@/components/common/page-header";
import { PlanLocked } from "@/components/common/plan-locked";
import { BackLink } from "@/components/platform/back-link";
import { TrainingReviewView } from "@/components/train/training-review";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { getAiAllowance } from "@/server/services/ai-coach";
import { getTrainingReview } from "@/server/services/adaptive-training";

export const metadata = { title: "Training review" };

export default async function TrainingReviewPage() {
  const { user } = await requireOnboardedUser();
  const allowance = await getAiAllowance(user.id, await getUserPlan(user.id));
  if (allowance.chatLimit <= 0) {
    return (
      <PlanLocked
        back={{ href: "/train", label: "Train" }}
        eyebrow="Train"
        title="Training review"
        plan="Pro"
        description="A weekly look at your consistency, strength trends, volume and recovery, with explained suggestions you can accept, adjust or turn down."
      />
    );
  }
  const supabase = await getServerSupabase();
  const [{ review, input }, { data: adjustments }] = await Promise.all([
    getTrainingReview(supabase, user.id),
    supabase.from("training_adjustments").select("id, kind, summary, source, created_at, reverted_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(15),
  ]);
  return (
    <div className="space-y-6">
      <BackLink href="/train">Train</BackLink>
      <PageHeader
        eyebrow="Train"
        title="Training review"
        description="Built from your logged workouts, program and recovery check-ins. Nothing changes until you accept it, and every change can be undone."
      />
      <TrainingReviewView
        review={review}
        units={input.units}
        programName={input.program?.name ?? null}
        adjustments={(adjustments ?? []) as { id: string; kind: string; summary: string; source: string; created_at: string; reverted_at: string | null }[]}
      />
    </div>
  );
}
